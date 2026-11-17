import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, FileUp, Loader2 } from "lucide-react";
import { useL } from "./core";
import { toneColor } from "./charts";
import type { Tone } from "../../ops/select";

// ---------------------------------------------------------------- skeleton

/** Shimmer placeholder used while a lazy page loads. */
export function Skeleton({ h = 16, w = "100%", r = 8, className }: { h?: number | string; w?: number | string; r?: number; className?: string }) {
  return <span className={`k-skel${className ? ` ${className}` : ""}`} style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

/** Whole-page skeleton: hero, a stat row and two panels. */
export function PageSkeleton() {
  return (
    <div className="k-page" aria-busy="true">
      <div className="k-skel-hero">
        <Skeleton h={12} w={160} />
        <Skeleton h={30} w="42%" />
        <Skeleton h={14} w="64%" />
        <Skeleton h={26} w="36%" r={13} />
      </div>
      <div className="k-skel-row">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} h={92} r={14} />
        ))}
      </div>
      <div className="k-grid-main">
        <Skeleton h={340} r={14} />
        <Skeleton h={340} r={14} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- fake reading (files)

export type ReadStep = { label: string; ms?: number };

/**
 * Staged "reading" animation for fake file parsing (P6/MSP import, invoice inbox, quotes, documents).
 * start() runs the steps one after another and resolves when done; `step` is the index in progress.
 */
export function useFakeRead(steps: ReadStep[]) {
  const [step, setStep] = useState(-1);
  const [done, setDone] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const start = useCallback(
    () =>
      new Promise<void>((resolve) => {
        timers.current.forEach((t) => window.clearTimeout(t));
        timers.current = [];
        setDone(false);
        let at = 0;
        steps.forEach((s, i) => {
          timers.current.push(window.setTimeout(() => setStep(i), at));
          at += s.ms ?? 650;
        });
        timers.current.push(
          window.setTimeout(() => {
            setStep(steps.length);
            setDone(true);
            resolve();
          }, at),
        );
      }),
    [steps],
  );
  const reset = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setStep(-1);
    setDone(false);
  }, []);
  return { step, done, running: step >= 0 && !done, start, reset };
}

/** Checklist that shows the reading steps ticking off. */
export function ReadSteps({ steps, step }: { steps: ReadStep[]; step: number }) {
  const { t } = useL();
  return (
    <ol className="k-readsteps">
      {steps.map((s, i) => (
        <li key={i} className={i < step ? "done" : i === step ? "now" : undefined}>
          <span>{i < step ? <Check size={12} strokeWidth={3} /> : i === step ? <Loader2 size={12} className="k-spin" /> : null}</span>
          {t(s.label)}
        </li>
      ))}
    </ol>
  );
}

/**
 * Drop zone for files. Nothing is uploaded: the page receives the File (name/size) and simulates reading.
 */
export function Dropzone({ accept, hint, title, onFile, children, compact }: { accept?: string; hint?: ReactNode; title?: ReactNode; onFile: (file: { name: string; size: number }) => void; children?: ReactNode; compact?: boolean }) {
  const { t } = useL();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`k-drop${over ? " over" : ""}${compact ? " compact" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile({ name: f.name, size: f.size });
      }}
    >
      <span className="k-drop-icon">
        <FileUp size={20} />
      </span>
      <strong>{title ?? t("Drop a file here")}</strong>
      {hint ? <span className="k-drop-hint">{hint}</span> : null}
      <div className="k-row" style={{ justifyContent: "center" }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => input.current?.click()}>
          {t("Choose a file")}
        </button>
        {children}
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile({ name: f.name, size: f.size });
          e.target.value = "";
        }}
      />
    </div>
  );
}

export const fmtBytes = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// ---------------------------------------------------------------- stacked columns (histogram)

/**
 * Stacked monthly columns (e.g. resource Used / To come) with an optional marker line (data date)
 * and an optional limit line. Values share one scale; labels under each column.
 */
export function StackedColumns({
  items,
  series,
  height = 200,
  marker,
  markerLabel,
  limit,
  limitLabel,
  format = (v: number) => String(Math.round(v)),
  onPick,
  picked,
}: {
  items: { key: string; label: string; values: number[] }[];
  series: { label: string; tone: Tone; hatch?: boolean }[];
  height?: number;
  marker?: string;
  markerLabel?: string;
  limit?: number;
  limitLabel?: string;
  format?: (v: number) => string;
  onPick?: (key: string) => void;
  picked?: string | null;
}) {
  const max = Math.max(limit ?? 0, ...items.map((i) => i.values.reduce((a, b) => a + b, 0)), 1) * 1.08;
  const mIdx = marker ? items.findIndex((i) => i.key === marker) : -1;
  return (
    <div className="k-stack-cols">
      <div className="k-stack-plot" style={{ height }}>
        {limit != null ? (
          <div className="k-limit" style={{ bottom: `${(limit / max) * 100}%` }}>
            <span>{limitLabel}</span>
          </div>
        ) : null}
        {mIdx >= 0 ? (
          <div className="k-stack-marker" style={{ left: `${((mIdx + 0.5) / items.length) * 100}%` }}>
            <span>{markerLabel}</span>
          </div>
        ) : null}
        {items.map((it) => {
          const total = it.values.reduce((a, b) => a + b, 0);
          return (
            <button key={it.key} type="button" className={`k-stack-col${picked === it.key ? " on" : ""}`} onClick={onPick ? () => onPick(it.key) : undefined} disabled={!onPick} title={`${it.label}: ${series.map((s, i) => `${s.label} ${format(it.values[i] ?? 0)}`).join(" · ")}`}>
              <span className="k-stack-bar k-grow-y" style={{ height: `${(total / max) * 100}%` }}>
                {it.values.map((v, i) =>
                  v > 0 ? <i key={i} className={series[i]?.hatch ? "hatch" : undefined} style={{ height: `${(v / Math.max(total, 1e-9)) * 100}%`, background: series[i]?.hatch ? undefined : toneColor(series[i]?.tone ?? "brand"), ["--hc" as string]: toneColor(series[i]?.tone ?? "brand") }} /> : null,
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="k-stack-labels">
        {items.map((it, i) => (
          <span key={it.key} style={{ visibility: items.length > 14 && i % 2 ? "hidden" : undefined }}>
            {it.label}
          </span>
        ))}
      </div>
      <div className="k-legend">
        {series.map((s) => (
          <span key={s.label} style={{ ["--lc" as string]: toneColor(s.tone) }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- lifecycle strip

export type LifeStep = { label: ReactNode; date?: ReactNode; state: "done" | "current" | "todo" | "late" | "skipped"; href?: string; note?: ReactNode };

/** A record's life across the chain, with dates under each step (detail-page signature visual). */
export function LifecycleStrip({ steps }: { steps: LifeStep[] }) {
  return (
    <ol className="k-life">
      {steps.map((s, i) => {
        const inner = (
          <>
            <span className="k-life-dot">{s.state === "done" ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
            <strong>{s.label}</strong>
            {s.date ? <small>{s.date}</small> : null}
            {s.note ? <em>{s.note}</em> : null}
          </>
        );
        return (
          <li key={i} className={`k-life-step ${s.state}`}>
            {s.href ? <Link to={s.href}>{inner}</Link> : <div>{inner}</div>}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- breadcrumbs

export function Breadcrumbs({ items }: { items: { label: ReactNode; to?: string }[] }) {
  const { t } = useL();
  return (
    <nav className="k-crumbs" aria-label={t("Breadcrumb")}>
      {items.map((it, i) => (
        <Fragment key={i}>
          {i ? <ChevronRight size={12} aria-hidden="true" /> : null}
          {it.to && i < items.length - 1 ? <Link to={it.to}>{it.label}</Link> : <span aria-current={i === items.length - 1 ? "page" : undefined}>{it.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { data, evidenceBySheet, itemById, sheetImage, P } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { docName, projectName } from "../lib/loc";
import { Logo } from "../components/ui";
import { useT } from "../lib/i18n";

const STAGES = [
  { key: "read", label: "Reading the package", end: 1100 },
  { key: "classify", label: "Sorting sheets by structure and discipline", end: 2100 },
  { key: "schedules", label: "Reading schedules and tables", end: 3700 },
  { key: "locate", label: "Marking each value on its sheet", end: 4900 },
  { key: "checks", label: "Cross-checking the drawings", end: 5900 },
  { key: "price", label: "Building and pricing the bill", end: 7000 },
] as const;

const TOTAL_MS = STAGES[STAGES.length - 1]!.end;

export function GeneratePage() {
  const tr = useT();
  const navigate = useNavigate();
  const setGenerated = useApp((s) => s.setGenerated);
  const lang = useApp((s) => s.lang);
  const boq = useBoq();
  const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const [t, setT] = useState(reduce ? TOTAL_MS : 0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setGenerated(true);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const el = now - t0;
      setT(Math.min(el, TOTAL_MS));
      if (el < TOTAL_MS) raf.current = requestAnimationFrame(tick);
      else setGenerated(true);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reduce, setGenerated]);

  const skip = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setT(TOTAL_MS);
    setGenerated(true);
  };

  const done = t >= TOTAL_MS;
  const percent = Math.round((t / TOTAL_MS) * 100);
  const stageIndex = STAGES.findIndex((s) => t < s.end);
  const current = stageIndex === -1 ? STAGES.length : stageIndex;

  const evidenceSheets = useMemo(() => data.sheets.filter((s) => evidenceBySheet.has(s.id)), []);
  const evidenceOrder = useMemo(() => new Map(evidenceSheets.map((s, i) => [s.id, i])), [evidenceSheets]);
  const sourceCount = useMemo(() => data.items.reduce((a, i) => a + i.src.length, 0), []);
  const textSources = useMemo(() => data.items.reduce((a, i) => a + i.src.filter((s) => s.how === "text").length, 0), []);
  const scheduleSheets = evidenceSheets.length;

  const progress = (i: number) => {
    const start = i === 0 ? 0 : STAGES[i - 1]!.end;
    return Math.max(0, Math.min(1, (t - start) / (STAGES[i]!.end - start)));
  };
  const ease = (k: number) => 1 - Math.pow(1 - k, 3);

  const sev = data.checks.reduce<Record<string, number>>((a, c) => ({ ...a, [c.severity]: (a[c.severity] ?? 0) + 1 }), {});
  const details = [
    tr("{n} of 205 sheets in 4 files", { n: Math.round(ease(progress(0)) * 205) }),
    tr("{b} structures, {d} disciplines", { b: data.buildings.length, d: new Set(data.sheets.map((s) => s.discipline)).size - 1 }),
    tr("{q} quantities from {s} sheets", { q: Math.round(ease(progress(2)) * data.items.length), s: Math.round(ease(progress(2)) * scheduleSheets) }),
    progress(3) < 1
      ? tr("{n} of {t} values marked", { n: Math.round(ease(progress(3)) * sourceCount), t: sourceCount })
      : tr("{t} values marked, {x} on the text layer, {h} by hand", { t: sourceCount, x: textSources, h: sourceCount - textSources }),
    progress(4) > 0
      ? tr("{e} error, {w} conflicts, {i} notes, {o} agreements", { e: sev.error ?? 0, w: sev.warn ?? 0, i: sev.info ?? 0, o: Math.round(ease(progress(4)) * (sev.ok ?? 0)) })
      : tr("Arithmetic, counts and cross-discipline values"),
    tr("{l} bill lines, {a} AZN", { l: boq.lines.length, a: fmtMoney(ease(progress(5)) * boq.total) }),
  ];

  let tileIndex = 0;
  const step = 900 / data.sheets.length;
  const evStep = 1400 / Math.max(1, evidenceSheets.length);
  const mkStep = 1050 / Math.max(1, evidenceSheets.length);

  return (
    <div className="generate">
      <header className="gen-top">
        <span className="brand-inline">
          <Logo size={30} />
          <span className="brand-words">
            <strong>Nobel BOQ</strong>
            <small>{tr("Quantity takeoff platform")}</small>
          </span>
        </span>
        {!done ? (
          <button type="button" className="btn btn-ghost" onClick={skip}>
            {tr("Skip")}
          </button>
        ) : null}
      </header>

      <div className="gen-body">
        <section className="gen-side">
          <p className="gen-project">{projectName(lang)}</p>
          <h1>{done ? tr("The bill is ready") : tr("Generating the bill")}</h1>
          <div className="gen-progress" aria-label={tr("{n}% complete", { n: percent })}>
            <div className="gen-progress-row">
              <span className="gen-percent num-inline">{percent}%</span>
              <span className="muted small">{done ? tr("All stages complete") : tr(STAGES[Math.min(current, STAGES.length - 1)]!.label)}</span>
            </div>
            <div className="gen-bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
          <ol className="gen-stages">
            {STAGES.map((s, i) => {
              const state = i < current ? "done" : i === current ? "running" : "pending";
              return (
                <li key={s.key} className={`gen-stage ${state}`}>
                  <span className="gen-icon" aria-hidden="true">
                    {state === "done" ? <Check size={13} strokeWidth={3} /> : state === "running" ? <span className="spinner" /> : null}
                  </span>
                  <div>
                    <div className="gen-label">{tr(s.label)}</div>
                    <div className="gen-detail num-inline">{state === "pending" ? "" : details[i]}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className={`gen-result${done ? " show" : ""}`}>
            <div className="gen-total">
              <span className="muted">{tr("Total including VAT")}</span>
              <strong className="num">{fmtMoney(boq.total)} AZN</strong>
            </div>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate(`${P}/bill`)} disabled={!done}>
              {tr("Open the bill")}
            </button>
          </div>
        </section>

        <div className="gen-main">
        <section className={`mosaic card${t >= STAGES[0].end ? " classified" : ""}`} aria-label={tr("Sheets in the package")}>
          {data.documents.map((d) => {
            const sheets = data.sheets.filter((s) => s.doc === d.code);
            return (
              <div key={d.code} className="mosaic-doc">
                <div className="mosaic-head">
                  <strong>{docName(d.code, lang)}</strong>
                  <span className="muted num-inline">{tr("{n} sheets", { n: sheets.length })}</span>
                </div>
                <div className="mosaic-grid">
                  {sheets.map((s) => {
                    const i = tileIndex++;
                    const ev = evidenceOrder.get(s.id);
                    const marks = ev != null ? evidenceBySheet.get(s.id)! : [];
                    const style = {
                      ["--in" as string]: `${Math.round(40 + i * step)}ms`,
                      ["--hl" as string]: ev != null ? `${Math.round(STAGES[1].end + ev * evStep)}ms` : "0ms",
                      ["--mk" as string]: ev != null ? `${Math.round(STAGES[2].end + ev * mkStep)}ms` : "0ms",
                    };
                    return (
                      <div key={s.id} className={`tile d-${s.discipline}${ev != null ? " has-ev" : ""}${reduce ? " still" : ""}`} style={style} title={`${s.id} ${s.titleEn}`}>
                        <svg viewBox={`0 0 ${s.w} ${s.h}`} preserveAspectRatio="xMidYMid meet">
                          <image href={sheetImage(s.id, true)} width={s.w} height={s.h} />
                          {marks.map((m, k) => {
                            const b = itemById.get(m.itemId)!.src[m.srcIndex]!.box;
                            return <rect key={k} x={b[0] - 6} y={b[1] - 6} width={b[2] - b[0] + 12} height={b[3] - b[1] + 12} />;
                          })}
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
        </div>
      </div>
    </div>
  );
}

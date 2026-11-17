import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FileSignature, Route } from "lucide-react";
import { Badge, LifecycleStrip, useL, type LifeStep } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import type { TrailStep } from "../../../ops/select";
import type { Agreement } from "../../../ops/types";
import { AGR_META, agrState, lifeSteps, PR, type Funnel } from "./shared";

/** Lifecycle strip of a record's chain inside a light card, with a one-line summary of where it stands. */
export function ChainLife({ kind, id, title, extra }: { kind: TrailStep["kind"]; id: string; title?: ReactNode; extra?: ReactNode }) {
  const l = useL();
  const s = useOps();
  const steps = lifeSteps(s, kind, id, l);
  return <LifeCard steps={steps} title={title ?? l.t("Lifecycle")} extra={extra} />;
}

export function LifeCard({ steps, title, extra }: { steps: LifeStep[]; title: ReactNode; extra?: ReactNode }) {
  const { t } = useL();
  const done = steps.filter((x) => x.state === "done").length;
  const live = steps.filter((x) => x.state !== "skipped").length;
  const now = steps.find((x) => x.state === "late") ?? steps.find((x) => x.state === "current");
  return (
    <section className="pur-life" aria-label={t("Lifecycle")}>
      <header>
        <h2>
          <Route size={14} /> {title}
        </h2>
        <span className="pur-life-sum">
          {t("{a} of {b} steps done", { a: done, b: live })}
          {now ? (
            <>
              {" · "}
              <b className={now.state === "late" ? "k-text-bad" : "k-text-brand"}>{now.label}</b>
            </>
          ) : null}
        </span>
        {extra ? <div className="pur-life-extra">{extra}</div> : null}
      </header>
      <div className="pur-life-track">
        <LifecycleStrip steps={steps} />
      </div>
    </section>
  );
}

export function AgrStatus({ a }: { a: Agreement }) {
  const { x } = useL();
  const m = AGR_META[agrState(a)];
  return <Badge tone={m.tone}>{x(m.label)}</Badge>;
}

/** Link badge shown on an order placed under a framework agreement. */
export function AgrLink({ a }: { a: Agreement }) {
  const { t } = useL();
  return (
    <Link to={PR.agreement(a.id)} className="pur-agr-badge" title={t("Called off from a framework agreement")}>
      <FileSignature size={12} />
      {t("Framework {ref}", { ref: a.ref })}
    </Link>
  );
}

/** Validity bar: from → to with a today marker. Amber when expiring, grey when expired. */
export function ValidityBar({ a, compact }: { a: Agreement; compact?: boolean }) {
  const { d, t } = useL();
  const st = agrState(a);
  const span = Math.max(1, diffDays(a.from, a.to));
  const k = Math.max(0, Math.min(1, diffDays(a.from, TODAY) / span));
  const left = diffDays(TODAY, a.to);
  return (
    <div className={`pur-valid ${st.toLowerCase()}${compact ? " compact" : ""}`}>
      <div className="pur-valid-track">
        <i className="k-grow-x" style={{ width: `${k * 100}%` }} />
        {TODAY >= a.from && TODAY <= a.to ? <b style={{ left: `${k * 100}%` }} title={t("Today")} /> : null}
      </div>
      <div className="pur-valid-dates">
        <span>{d(a.from)}</span>
        <em>{st === "EXPIRED" ? t("ended") : TODAY < a.from ? t("starts {d}", { d: d(a.from, false) }) : t("{n} days left", { n: left })}</em>
        <span>{d(a.to)}</span>
      </div>
    </div>
  );
}

/** Spend meter against a cap; the pending amount is drawn hatched on top. */
export function CapMeter({ used, cap, pending = 0 }: { used: number; cap: number; pending?: number }) {
  const u = cap > 0 ? used / cap : 0;
  const p = cap > 0 ? pending / cap : 0;
  const tone = u + p > 1 ? "bad" : u + p > 0.85 ? "warn" : "brand";
  return (
    <span className={`pur-cap k-tone-${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, u + p) * 100)}>
      <i className="k-grow-x" style={{ width: `${Math.min(1, u) * 100}%` }} />
      {pending > 0 ? <s style={{ left: `${Math.min(1, u) * 100}%`, width: `${Math.max(0, Math.min(1, u + p) - Math.min(1, u)) * 100}%` }} /> : null}
    </span>
  );
}

/** ± % chip of a rate against the BOQ rate. Green under, red over. */
export function VarChip({ rate, boq }: { rate: number; boq: number | null | undefined }) {
  if (!boq) return <span className="muted small">—</span>;
  const v = rate / boq - 1;
  const tone = Math.abs(v) < 0.005 ? "muted" : v < 0 ? "ok" : v > 0.08 ? "bad" : "warn";
  return <span className={`pur-var k-tone-${tone}`}>{`${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v * 100).toFixed(1)}%`}</span>;
}

/** Four thin bars for requested / ordered / received / issued against the BOQ quantity. */
export function MiniFunnel({ f }: { f: Funnel }) {
  const { t } = useL();
  const top = Math.max(f.boq, f.requested, f.ordered, 1e-9);
  const rows: [string, number, string][] = [
    ["req", f.requested, t("Requested")],
    ["ord", f.ordered, t("Ordered")],
    ["rec", f.received, t("Received")],
    ["iss", f.issued, t("Issued")],
  ];
  return (
    <span className="pur-minifunnel" title={rows.map((r) => `${r[2]} ${Math.round((r[1] / (f.boq || top)) * 100)}%`).join(" · ")}>
      {rows.map(([k, v]) => (
        <i key={k} className={k}>
          <b className="k-grow-x" style={{ width: `${Math.min(1, v / top) * 100}%` }} />
        </i>
      ))}
      {f.boq > 0 ? <u style={{ left: `${Math.min(1, f.boq / top) * 100}%` }} /> : null}
    </span>
  );
}

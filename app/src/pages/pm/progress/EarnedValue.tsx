import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { Panel, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { fmtMoneyShort } from "../../../lib/format";
import { buildingShort } from "../../../lib/loc";
import { programmeStats, sectionName } from "../../../ops/select";
import type { Activity } from "../../../ops/types";
import { BUILDINGS, cpiOf } from "./shared";

export type EvRow = { key: string; label: string; pv: number; ev: number; ac: number; spi: number | null; cpi: number | null; budget: number };

/** PV / EV / AC for a subset of activities. AC is assumed from EV with a small fixed variation per subset. */
export function evOf(key: string, label: string, acts: Activity[]): EvRow {
  const st = programmeStats(acts);
  const cpi = cpiOf(key);
  const ac = st.earned / cpi;
  return { key, label, pv: st.planned, ev: st.earned, ac, spi: st.planned > 0 ? st.earned / st.planned : null, cpi: st.earned > 0 ? st.earned / ac : null, budget: acts.reduce((a, x) => a + x.budget, 0) };
}

const idxTone = (v: number | null) => (v == null ? "muted" : v >= 0.98 ? "ok" : v >= 0.9 ? "warn" : "bad");
const fmtIdx = (v: number | null) => (v == null ? "—" : v.toFixed(2));

/** Earned value by building or by trade, plus the SPI × CPI quadrant with one dot per building. */
export function EarnedValue({ activities }: { activities: Activity[] }) {
  const { t, lang } = useL();
  const [by, setBy] = useState<"building" | "trade">("building");
  const [hover, setHover] = useState<string | null>(null);

  const buildings = useMemo(() => BUILDINGS.map((b) => evOf(b, buildingShort(b, lang), activities.filter((a) => a.building === b))), [activities, lang]);
  const trades = useMemo(() => {
    const keys = [...new Set(activities.map((a) => a.section ?? "_gen"))];
    return keys
      .map((k) => evOf(`T-${k}`, k === "_gen" ? t("General items") : sectionName(k, lang), activities.filter((a) => (a.section ?? "_gen") === k)))
      .filter((r) => r.budget > 0)
      .sort((a, b) => b.pv - a.pv || b.budget - a.budget);
  }, [activities, lang, t]);
  const rows = by === "building" ? buildings : trades;
  const total = evOf("ALL", t("Whole project"), activities);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.pv, r.ev, r.ac)));

  // Quadrant: SPI on X (0.6–1.2), CPI on Y (0.88–1.08).
  const W = 260;
  const H = 220;
  const P = 26;
  const X = (v: number) => P + ((Math.max(0.6, Math.min(1.2, v)) - 0.6) / 0.6) * (W - P * 2);
  const Y = (v: number) => H - P - ((Math.max(0.88, Math.min(1.08, v)) - 0.88) / 0.2) * (H - P * 2);
  const dots = buildings.filter((b) => b.spi != null && b.cpi != null);
  const idle = buildings.filter((b) => b.spi == null || b.cpi == null);

  return (
    <Panel
      title={t("Earned value")}
      icon={<Scale size={15} />}
      sub={t("Planned value (PV), earned value (EV) and actual cost (AC). Actual cost is estimated from the site cost reports.")}
      actions={<Segmented value={by} onChange={setBy} label={t("Group by")} options={[{ value: "building", label: t("By building") }, { value: "trade", label: t("By trade") }]} />}
    >
      <div className="pg-ev">
        <div className="pg-ev-table">
          <div className="pg-ev-row head">
            <span>{by === "building" ? t("Building") : t("Trade")}</span>
            <span>{t("PV · EV · AC")}</span>
            <span>SPI</span>
            <span>CPI</span>
          </div>
          {rows.map((r) => (
            <div key={r.key} className={`pg-ev-row${hover === r.key ? " on" : ""}`} onMouseEnter={() => setHover(r.key)} onMouseLeave={() => setHover(null)}>
              <span className="pg-ev-name truncate" title={r.label}>
                {r.label}
              </span>
              <span className="pg-ev-bars" title={`PV ${fmtMoneyShort(r.pv)} · EV ${fmtMoneyShort(r.ev)} · AC ${fmtMoneyShort(r.ac)} AZN`}>
                <i className="pv k-grow-x" style={{ width: `${(r.pv / max) * 100}%` }} />
                <i className="ev k-grow-x" style={{ width: `${(r.ev / max) * 100}%` }} />
                <i className="ac k-grow-x" style={{ width: `${(r.ac / max) * 100}%` }} />
                <small className="num-inline">
                  {fmtMoneyShort(r.pv)} · {fmtMoneyShort(r.ev)} · {fmtMoneyShort(r.ac)}
                </small>
              </span>
              <b className={`num-inline k-text-${idxTone(r.spi)}`}>{fmtIdx(r.spi)}</b>
              <b className={`num-inline k-text-${idxTone(r.cpi)}`}>{fmtIdx(r.cpi)}</b>
            </div>
          ))}
          <div className="pg-ev-row total">
            <span>{total.label}</span>
            <span className="num-inline muted small">
              PV {fmtMoneyShort(total.pv)} · EV {fmtMoneyShort(total.ev)} · AC {fmtMoneyShort(total.ac)} AZN
            </span>
            <b className={`num-inline k-text-${idxTone(total.spi)}`}>{fmtIdx(total.spi)}</b>
            <b className={`num-inline k-text-${idxTone(total.cpi)}`}>{fmtIdx(total.cpi)}</b>
          </div>
          <div className="k-legend pg-ev-legend">
            <span style={{ ["--lc" as string]: "var(--stamp-line)" }}>PV</span>
            <span style={{ ["--lc" as string]: "var(--stamp)" }}>EV</span>
            <span style={{ ["--lc" as string]: "var(--amber)" }}>AC</span>
          </div>
        </div>

        <figure className="pg-quad">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Schedule and cost performance by building")}>
            <rect x={X(1)} y={P} width={W - P - X(1)} height={Y(1) - P} className="pg-quad-good" />
            <rect x={P} y={Y(1)} width={X(1) - P} height={H - P - Y(1)} className="pg-quad-bad" />
            <rect x={P} y={P} width={W - P * 2} height={H - P * 2} className="pg-quad-frame" />
            <line x1={X(1)} x2={X(1)} y1={P} y2={H - P} className="pg-quad-axis" />
            <line x1={P} x2={W - P} y1={Y(1)} y2={Y(1)} className="pg-quad-axis" />
            <text x={W - P - 4} y={P + 12} textAnchor="end" className="pg-quad-q">
              {t("Ahead · under cost")}
            </text>
            <text x={P + 4} y={P + 12} className="pg-quad-q">
              {t("Behind · under cost")}
            </text>
            <text x={W - P - 4} y={H - P - 6} textAnchor="end" className="pg-quad-q">
              {t("Ahead · over cost")}
            </text>
            <text x={P + 4} y={H - P - 6} className="pg-quad-q bad">
              {t("Behind · over cost")}
            </text>
            <text x={W / 2} y={H - 6} textAnchor="middle" className="k-axis">
              SPI →
            </text>
            <text x={10} y={H / 2} textAnchor="middle" className="k-axis" transform={`rotate(-90 10 ${H / 2})`}>
              CPI →
            </text>
            {dots.map((b) => (
              <g key={b.key} className={`pg-quad-dot${hover === b.key ? " on" : ""}`} onMouseEnter={() => setHover(b.key)} onMouseLeave={() => setHover(null)}>
                <circle cx={X(b.spi!)} cy={Y(b.cpi!)} r={Math.max(6, Math.min(16, Math.sqrt(b.budget / 2500)))} className={`k-tone-${b.spi! >= 0.98 && b.cpi! >= 0.98 ? "ok" : b.spi! < 0.9 ? "bad" : "warn"}`} />
                <text x={X(b.spi!)} y={Y(b.cpi!) + 3.5} textAnchor="middle">
                  {b.key}
                </text>
                <title>{`${b.label}: SPI ${fmtIdx(b.spi)} · CPI ${fmtIdx(b.cpi)}`}</title>
              </g>
            ))}
          </svg>
          <figcaption className="muted small">
            {idle.length ? t("Not started yet: {list}.", { list: idle.map((b) => b.label).join(", ") }) : t("Every building has earned value.")} {t("Dot size is the building's budget.")}
          </figcaption>
        </figure>
      </div>
    </Panel>
  );
}

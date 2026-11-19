import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, History } from "lucide-react";
import { Avatar, Empty, Panel, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { R } from "../../../ops/select";
import type { ProgressSnapshot } from "../../../ops/types";

/** Weekly planned vs actual line from the submitted updates, and the list of updates with their line changes. */
export function SnapshotHistory() {
  const { t, x, d, stamp } = useL();
  const snapshots = useOps((s) => s.snapshots);
  const activities = useOps((s) => s.activities);
  const [open, setOpen] = useState<string | null>(null);
  const sorted = useMemo(() => [...snapshots].sort((a, b) => a.dataDate.localeCompare(b.dataDate) || a.submittedAt.localeCompare(b.submittedAt)), [snapshots]);

  if (!sorted.length)
    return (
      <Panel title={t("Update history")} icon={<History size={15} />}>
        <Empty title={t("No weekly updates yet")}>{t("Each submitted weekly update is kept here with its planned and actual progress.")}</Empty>
      </Panel>
    );

  return (
    <Panel title={t("Update history")} icon={<History size={15} />} count={sorted.length} sub={t("Every submitted weekly update: planned against actual progress at its data date.")}>
      <HistoryChart points={sorted} />
      <ul className="pg-snaps">
        {[...sorted].reverse().map((s) => {
          const on = open === s.id;
          return (
            <li key={s.id} className={on ? "open" : undefined}>
              <button type="button" className="pg-snap-head" aria-expanded={on} onClick={() => setOpen(on ? null : s.id)}>
                <span className="k-ref">{s.id}</span>
                <span className="pg-snap-date">
                  <b>{d(s.dataDate)}</b>
                  <small>{t("submitted {at}", { at: stamp(s.submittedAt) })}</small>
                </span>
                <span className="pg-snap-who">
                  <Avatar name={s.by} size={20} />
                  <span className="truncate">{s.by}</span>
                </span>
                <span className="pg-snap-idx">
                  <small>SPI</small>
                  {s.plannedPct > 0 ? <b className={`num-inline k-text-${s.spi >= 0.98 ? "ok" : s.spi >= 0.9 ? "warn" : "bad"}`}>{s.spi.toFixed(2)}</b> : <b className="num-inline muted">—</b>}
                </span>
                <span className="pg-snap-idx">
                  <small>CPI</small>
                  {s.cpi > 0 ? <b className={`num-inline k-text-${s.cpi >= 0.98 ? "ok" : "warn"}`}>{s.cpi.toFixed(2)}</b> : <b className="num-inline muted" title={t("No cost recorded at that update")}>—</b>}
                </span>
                <span className="pg-snap-lines num-inline">{t("{n} lines", { n: s.lines.length })}</span>
                <ChevronDown size={15} className="pg-snap-chev" />
              </button>
              {s.note ? <p className="pg-snap-note">{x(s.note)}</p> : null}
              {on ? (
                <ul className="pg-snap-changes k-rise">
                  {s.lines.length ? (
                    s.lines.map((l) => {
                      const a = activities.find((y) => y.id === l.activityId);
                      const up = l.pct - l.pctBefore;
                      return (
                        <li key={l.activityId}>
                          {a ? (
                            <Link to={R.programme(a.id)} className="k-ref">
                              {a.code}
                            </Link>
                          ) : (
                            <span className="k-ref">{l.activityId}</span>
                          )}
                          <span className="truncate">{a ? x(a.name) : ""}</span>
                          <span className="pg-snap-move num-inline">
                            <span className="muted">{l.pctBefore}%</span>
                            <i style={{ ["--a" as string]: `${l.pctBefore}%`, ["--b" as string]: `${l.pct}%` }} />
                            <b>{l.pct}%</b>
                          </span>
                          <span className={`num-inline small ${up > 0 ? "k-text-ok" : up < 0 ? "k-text-bad" : "muted"}`}>{up > 0 ? `+${up}` : up}</span>
                        </li>
                      );
                    })
                  ) : (
                    <li className="muted small">{t("No activity lines in this update.")}</li>
                  )}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function HistoryChart({ points }: { points: ProgressSnapshot[] }) {
  const { t, d } = useL();
  const W = 920;
  const H = 190;
  const pad = { l: 34, r: 12, t: 12, b: 24 };
  const top = Math.max(0.05, ...points.map((p) => Math.max(p.plannedPct, p.actualPct))) * 1.15;
  const X = (i: number) => pad.l + (points.length < 2 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const Y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const line = (sel: (p: ProgressSnapshot) => number) => points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(sel(p)).toFixed(1)}`).join(" ");
  const gap = `${line((p) => p.plannedPct)} ${[...points].reverse().map((p, j) => `L${X(points.length - 1 - j).toFixed(1)} ${Y(p.actualPct).toFixed(1)}`).join(" ")} Z`;
  const ticks = [0, top / 2, top].map((v) => Math.round(v * 1000) / 1000);
  return (
    <figure className="pg-hist">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Planned against actual progress by week")}>
        {ticks.map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(g)} y2={Y(g)} className="k-grid" />
            <text x={pad.l - 6} y={Y(g) + 4} textAnchor="end" className="k-axis">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        <path d={gap} className="pg-hist-gap" />
        <path d={line((p) => p.plannedPct)} className="pg-hist-planned" />
        <path d={line((p) => p.actualPct)} className="pg-hist-actual" />
        {points.map((p, i) => (
          <g key={p.id}>
            <circle cx={X(i)} cy={Y(p.plannedPct)} r={3} className="pg-hist-dot-p" />
            <circle cx={X(i)} cy={Y(p.actualPct)} r={4} className="pg-hist-dot-a">
              <title>{`${d(p.dataDate)}: ${t("planned {a}%, actual {b}%", { a: (p.plannedPct * 100).toFixed(1), b: (p.actualPct * 100).toFixed(1) })}`}</title>
            </circle>
            <text x={X(i)} y={H - 6} textAnchor="middle" className="k-axis">
              {d(p.dataDate, false)}
            </text>
          </g>
        ))}
      </svg>
      <div className="k-legend">
        <span className="lg-planned">{t("Planned")}</span>
        <span className="lg-actual">{t("Actual")}</span>
        <span style={{ ["--lc" as string]: "var(--redline-soft)" }}>{t("Gap")}</span>
      </div>
    </figure>
  );
}

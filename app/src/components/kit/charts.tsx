import { useEffect, useState, type ReactNode } from "react";
import { useL, CountUp } from "./core";
import { diffDays, toDate } from "../../ops/dates";
import type { CurvePoint, Tone } from "../../ops/select";

const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--ink-2)",
  brand: "var(--stamp)",
  info: "#7a63c9",
  ok: "var(--ok)",
  warn: "var(--amber)",
  bad: "var(--redline)",
  muted: "var(--faint)",
};
export const toneColor = (t: Tone) => TONE_VAR[t];

/** Score ring that counts up to its value (0–100). */
export function RingGauge({ value, size = 96, stroke = 9, tone = "brand", label, sub }: { value: number; size?: number; stroke?: number; tone?: Tone; label?: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div className="k-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sheet-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE_VAR[tone]} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, v)) / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="k-ring-arc" />
      </svg>
      <div className="k-ring-label">
        <strong style={{ fontSize: size * 0.26 }}>
          <CountUp value={value} />
        </strong>
        {label ? <span>{label}</span> : null}
        {sub ? <small>{sub}</small> : null}
      </div>
    </div>
  );
}

/** Planned vs actual (and forecast) S-curve with a today line. Values are 0–1. */
export function SCurve({ points, height = 220, today, onPick, picked }: { points: CurvePoint[]; height?: number; today: string; onPick?: (date: string) => void; picked?: string }) {
  const { t, d } = useL();
  const W = 640;
  const H = height;
  const pad = { l: 34, r: 14, t: 14, b: 26 };
  const first = points[0]?.date ?? today;
  const last = points[points.length - 1]?.date ?? today;
  const span = Math.max(1, diffDays(first, last));
  const X = (date: string) => pad.l + (diffDays(first, date) / span) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const path = (sel: (p: CurvePoint) => number | null) =>
    points
      .filter((p) => sel(p) != null)
      .map((p, i) => `${i ? "L" : "M"}${X(p.date).toFixed(1)} ${Y(sel(p)!).toFixed(1)}`)
      .join(" ");
  const at = points.find((p) => p.date === today) ?? points.filter((p) => p.date <= today).slice(-1)[0];
  const months: string[] = [];
  for (const p of points) {
    const m = p.date.slice(0, 7);
    if (!months.includes(m)) months.push(m);
  }
  return (
    <div className="k-scurve">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} onClick={onPick ? (e) => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const xr = ((e.clientX - rect.left) / rect.width) * W;
        const k = Math.max(0, Math.min(1, (xr - pad.l) / (W - pad.l - pad.r)));
        const target = points[Math.round(k * (points.length - 1))];
        if (target) onPick(target.date);
      } : undefined}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(g)} y2={Y(g)} className="k-grid" />
            <text x={pad.l - 6} y={Y(g) + 4} textAnchor="end" className="k-axis">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        {months.filter((_, i) => i % Math.ceil(months.length / 8) === 0).map((m) => (
          <text key={m} x={X(`${m}-01` < first ? first : `${m}-01`)} y={H - 8} className="k-axis">
            {d(`${m}-01`, false).replace(/^1 /, "")}
          </text>
        ))}
        <path d={`${path((p) => p.planned)} L${X(last)} ${Y(0)} L${X(first)} ${Y(0)}Z`} className="k-area-planned" />
        <path d={path((p) => p.planned)} className="k-line-planned" />
        <path d={path((p) => p.forecast)} className="k-line-forecast" />
        <path d={path((p) => p.actual)} className="k-line-actual" />
        <line x1={X(today)} x2={X(today)} y1={pad.t} y2={H - pad.b} className="k-today" />
        {picked ? <line x1={X(picked)} x2={X(picked)} y1={pad.t} y2={H - pad.b} className="k-picked" /> : null}
        {at ? (
          <>
            <circle cx={X(at.date)} cy={Y(at.planned)} r={4} className="k-dot-planned" />
            {at.actual != null ? <circle cx={X(at.date)} cy={Y(at.actual)} r={5} className="k-dot-actual" /> : null}
          </>
        ) : null}
      </svg>
      <div className="k-legend">
        <span className="lg-planned">{t("Planned")}</span>
        <span className="lg-actual">{t("Actual")}</span>
        <span className="lg-forecast">{t("Forecast")}</span>
        <span className="lg-today">{t("Today")}</span>
      </div>
    </div>
  );
}

/** Horizontal bars with labels and values. */
export function BarList({ items, format = (v) => String(v), max }: { items: { key: string; label: ReactNode; value: number; sub?: ReactNode; tone?: Tone; onClick?: () => void }[]; format?: (v: number) => ReactNode; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="k-barlist">
      {items.map((it) => {
        const inner = (
          <>
            <span className="k-bar-label">
              {it.label}
              {it.sub ? <small>{it.sub}</small> : null}
            </span>
            <span className="k-bar-track">
              <i className="k-grow-x" style={{ width: `${(it.value / top) * 100}%`, background: TONE_VAR[it.tone ?? "brand"] }} />
            </span>
            <span className="k-bar-value num-inline">{format(it.value)}</span>
          </>
        );
        return <li key={it.key}>{it.onClick ? <button type="button" onClick={it.onClick}>{inner}</button> : <div>{inner}</div>}</li>;
      })}
    </ul>
  );
}

/** One square per item, grouped by state. */
export function Waffle({ groups, onPick }: { groups: { key: string; label: ReactNode; count: number; tone: Tone; outline?: number }[]; onPick?: (key: string) => void }) {
  return (
    <div className="k-waffle">
      <div className="k-waffle-grid">
        {groups.flatMap((g) =>
          Array.from({ length: g.count }, (_, i) => (
            <button key={`${g.key}-${i}`} type="button" title={typeof g.label === "string" ? g.label : undefined} className={`k-sq${i < (g.outline ?? 0) ? " outline" : ""}`} style={{ background: TONE_VAR[g.tone] }} onClick={onPick ? () => onPick(g.key) : undefined} tabIndex={onPick ? 0 : -1} />
          )),
        )}
      </div>
      <ul className="k-waffle-key">
        {groups.map((g) => (
          <li key={g.key}>
            <i style={{ background: TONE_VAR[g.tone] }} />
            {g.label}
            <b className="num-inline">{g.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Spider chart, values 0–100; null values draw a dashed spoke. */
export function Radar({ axes, size = 280, onPick, picked }: { axes: { key: string; label: string; value: number | null }[]; size?: number; onPick?: (key: string) => void; picked?: string | null }) {
  const c = size / 2;
  const R = size / 2 - 44;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v] as const;
  };
  const poly = axes.map((ax, i) => pt(i, (ax.value ?? 0) / 100).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="k-radar" style={{ width: "100%", maxWidth: size }}>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon key={g} points={axes.map((_, i) => pt(i, g).join(",")).join(" ")} className="k-grid" fill="none" />
      ))}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.2);
        return (
          <g key={ax.key} onClick={onPick ? () => onPick(ax.key) : undefined} style={{ cursor: onPick ? "pointer" : undefined }}>
            <line x1={c} y1={c} x2={x} y2={y} className="k-grid" strokeDasharray={ax.value == null ? "3 3" : undefined} />
            <text x={lx} y={ly} textAnchor={lx < c - 5 ? "end" : lx > c + 5 ? "start" : "middle"} dominantBaseline="middle" className={`k-radar-label${picked === ax.key ? " on" : ""}`}>
              {ax.label}
            </text>
          </g>
        );
      })}
      <polygon points={poly} className="k-radar-area" />
      {axes.map((ax, i) => {
        const [x, y] = pt(i, (ax.value ?? 0) / 100);
        return <circle key={ax.key} cx={x} cy={y} r={picked === ax.key ? 5 : 3.5} className="k-radar-dot" />;
      })}
    </svg>
  );
}

export function Sparkline({ values, width = 120, height = 32, tone = "brand" }: { values: number[]; width?: number; height?: number; tone?: Tone }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * width).toFixed(1)} ${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="k-spark">
      <path d={d} fill="none" stroke={TONE_VAR[tone]} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Donut({ parts, size = 120, thickness = 16, center }: { parts: { key: string; value: number; tone: Tone; label?: string }[]; size?: number; thickness?: number; center?: ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="k-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sheet-3)" strokeWidth={thickness} />
        {parts.map((p) => {
          const len = (p.value / total) * C;
          const el = <circle key={p.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE_VAR[p.tone]} strokeWidth={thickness} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          acc += len;
          return el;
        })}
      </svg>
      {center ? <div className="k-donut-center">{center}</div> : null}
    </div>
  );
}

/** Vertical columns with an optional horizontal limit line (e.g. approval limit). */
export function Columns({ items, height = 160, limit, limitLabel, format = (v: number) => String(Math.round(v)) }: { items: { key: string; label: ReactNode; value: number; tone?: Tone; onClick?: () => void; title?: string }[]; height?: number; limit?: number; limitLabel?: ReactNode; format?: (v: number) => string }) {
  const max = Math.max(limit ?? 0, ...items.map((i) => i.value), 1) * 1.08;
  return (
    <div className="k-columns" style={{ height }}>
      {limit != null ? (
        <div className="k-limit" style={{ bottom: `${(limit / max) * 100}%` }}>
          <span>{limitLabel}</span>
        </div>
      ) : null}
      {items.map((it) => (
        <button key={it.key} type="button" className="k-col" onClick={it.onClick} title={it.title} disabled={!it.onClick}>
          <span className="k-col-value num-inline">{format(it.value)}</span>
          <i className="k-grow-y" style={{ height: `${(it.value / max) * 100}%`, background: TONE_VAR[it.tone ?? "brand"] }} />
          <span className="k-col-label">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Day index helper for timeline-style charts. */
export function dayX(from: string, date: string, pxPerDay: number) {
  return Math.round((toDate(date).getTime() - toDate(from).getTime()) / 86_400_000) * pxPerDay;
}

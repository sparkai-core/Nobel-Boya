import { useState } from "react";
import { useL } from "../../../components/kit";
import { fmtMoneyShort } from "../../../lib/format";

// ---------------------------------------------------------------- treemap

type Box = { x: number; y: number; w: number; h: number };

function worst(row: number[], side: number) {
  const s = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
}

/** Squarified treemap layout in a W × H box. */
function squarify(values: number[], W: number, H: number): Box[] {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let rest = values.map((v) => (v / total) * W * H);
  let b: Box = { x: 0, y: 0, w: W, h: H };
  const out: Box[] = [];
  while (rest.length) {
    const side = Math.min(b.w, b.h);
    const row = [rest[0]!];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]!], side) <= worst(row, side)) {
      row.push(rest[i]!);
      i++;
    }
    const s = row.reduce((a, v) => a + v, 0);
    if (b.w >= b.h) {
      const cw = s / b.h;
      let yy = b.y;
      for (const a of row) {
        const hh = a / cw;
        out.push({ x: b.x, y: yy, w: cw, h: hh });
        yy += hh;
      }
      b = { x: b.x + cw, y: b.y, w: b.w - cw, h: b.h };
    } else {
      const rh = s / b.w;
      let xx = b.x;
      for (const a of row) {
        const ww = a / rh;
        out.push({ x: xx, y: b.y, w: ww, h: rh });
        xx += ww;
      }
      b = { x: b.x, y: b.y + rh, w: b.w, h: b.h - rh };
    }
    rest = rest.slice(row.length);
  }
  return out;
}

/** Spend by vendor as a treemap: area is committed value; the largest share is darkest. */
export function Treemap({ items, onPick }: { items: { key: string; label: string; sub: string; value: number }[]; onPick?: (key: string) => void }) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const W = 160;
  const H = 100;
  const boxes = squarify(sorted.map((i) => i.value), W, H);
  const total = sorted.reduce((a, i) => a + i.value, 0) || 1;
  return (
    <div className="ppl-tm" role="list">
      {sorted.map((it, i) => {
        const b = boxes[i]!;
        const share = it.value / total;
        const small = b.w * b.h < W * H * 0.06;
        return (
          <button
            key={it.key}
            type="button"
            role="listitem"
            className={`ppl-tm-tile${small ? " small" : ""}`}
            style={{ left: `${(b.x / W) * 100}%`, top: `${(b.y / H) * 100}%`, width: `${(b.w / W) * 100}%`, height: `${(b.h / H) * 100}%`, ["--a" as string]: String(0.55 + 0.45 * (1 - i / Math.max(1, sorted.length))), animationDelay: `${i * 40}ms` }}
            onClick={onPick ? () => onPick(it.key) : undefined}
            title={`${it.label} · ${fmtMoneyShort(it.value)} AZN · ${Math.round(share * 100)}%`}
          >
            <strong>{it.label}</strong>
            <span className="num-inline">
              {fmtMoneyShort(it.value)} · {Math.round(share * 100)}%
            </span>
            <small>{it.sub}</small>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- bullet bars

/** Committed against the trade's BOQ budget; the tick shows what the same quantities cost at BOQ rates. */
export function Bullets({ rows }: { rows: { key: string; label: string; budget: number; committed: number; boqOfCommitted: number }[] }) {
  const { t } = useL();
  const open = rows.filter((r) => r.committed > 0);
  const idle = rows.filter((r) => r.committed <= 0);
  return (
    <>
    <ul className="ppl-bul">
      {open.map((r, i) => {
        const scale = Math.max(r.budget, r.committed, r.boqOfCommitted, 1);
        const diff = r.boqOfCommitted ? r.committed / r.boqOfCommitted - 1 : 0;
        return (
          <li key={r.key} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="ppl-bul-head">
              <strong className="truncate">{r.label}</strong>
              <span className="num-inline muted">
                {fmtMoneyShort(r.committed)} / {fmtMoneyShort(r.budget)}
              </span>
            </div>
            <div className="ppl-bul-track" title={t("Committed {a} of a {b} BOQ budget", { a: fmtMoneyShort(r.committed), b: fmtMoneyShort(r.budget) })}>
              <i className={`ppl-bul-bar k-grow-x${diff > 0.005 ? " over" : ""}`} style={{ width: `${(r.committed / scale) * 100}%` }} />
              {r.boqOfCommitted > 0 ? <b className="ppl-bul-tick" style={{ left: `${(r.boqOfCommitted / scale) * 100}%` }} /> : null}
            </div>
            <small className={diff > 0.005 ? "k-text-bad" : diff < -0.005 ? "k-text-ok" : "muted"}>
              {r.committed > 0 ? (diff > 0.005 ? t("{p}% over BOQ rates", { p: (diff * 100).toFixed(1) }) : diff < -0.005 ? t("{p}% under BOQ rates", { p: (-diff * 100).toFixed(1) }) : t("At BOQ rates")) : t("Nothing ordered yet")}
              {" · "}
              {t("{p}% of budget committed", { p: Math.round((r.committed / Math.max(1, r.budget)) * 100) })}
            </small>
          </li>
        );
      })}
    </ul>
    {idle.length ? (
      <p className="ppl-bul-idle">
        {t("Nothing ordered yet")}: {idle.map((r) => `${r.label} (${fmtMoneyShort(r.budget)})`).join(" · ")}
      </p>
    ) : null}
    </>
  );
}

// ---------------------------------------------------------------- cycle-time funnel

export type FunnelStage = { key: string; label: string; count: number; days: number | null };

/** How many requests reached each stage, with the median days each hand-off takes. */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const { t } = useL();
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ol className="ppl-fun">
      {stages.map((s, i) => (
        <li key={s.key} style={{ animationDelay: `${i * 50}ms` }}>
          {i > 0 ? (
            <span className={`ppl-fun-days${s.days != null && s.days > 4 ? " slow" : ""}`}>{s.days != null ? t("median {n} d", { n: s.days }) : "—"}</span>
          ) : null}
          <div className="ppl-fun-row">
            <span className="ppl-fun-label">{s.label}</span>
            <span className="ppl-fun-track">
              <i className="k-grow-x" style={{ width: `${(s.count / max) * 100}%` }} />
            </span>
            <b className="num-inline">{s.count}</b>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- vendor scatter

export type ScatterPt = { key: string; label: string; price: number; reliability: number; spend: number };

/** Price against BOQ (x) vs delivery reliability (y); bubble size is spend. Best value sits top left. */
export function Scatter({ points, onPick }: { points: ScatterPt[]; onPick?: (key: string) => void }) {
  const { t } = useL();
  const [hover, setHover] = useState<string | null>(null);
  const W = 880;
  const H = 320;
  const P = { l: 40, r: 16, t: 16, b: 34 };
  const xs = points.map((p) => p.price);
  const x0 = Math.min(-0.12, ...xs) - 0.02;
  const x1 = Math.max(0.1, ...xs) + 0.02;
  const y0 = 40;
  const y1 = 100;
  const X = (v: number) => P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r);
  const Y = (v: number) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const maxSpend = Math.max(1, ...points.map((p) => p.spend));
  const r = (s: number) => 5 + Math.sqrt(s / maxSpend) * 15;
  const xTicks = [-0.1, -0.05, 0, 0.05, 0.1].filter((v) => v >= x0 && v <= x1);
  const hp = points.find((p) => p.key === hover);
  return (
    <div className="ppl-sc">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Vendor price against delivery reliability")}>
        <rect x={P.l} y={P.t} width={X(0) - P.l} height={Y(75) - P.t} className="ppl-sc-best" />
        <text x={P.l + 6} y={P.t + 14} className="ppl-sc-q">
          {t("Best value")}
        </text>
        <text x={W - P.r - 6} y={H - P.b - 8} textAnchor="end" className="ppl-sc-q">
          {t("Dear and unreliable")}
        </text>
        {[40, 55, 70, 85, 100].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} className="k-grid" />
            <text x={P.l - 6} y={Y(v) + 4} textAnchor="end" className="k-axis">
              {v}
            </text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1={P.t} y2={H - P.b} className={v === 0 ? "ppl-sc-zero" : "k-grid"} />
            <text x={X(v)} y={H - P.b + 14} textAnchor="middle" className="k-axis">
              {v > 0 ? "+" : ""}
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}
        <text x={(W + P.l) / 2} y={H - 4} textAnchor="middle" className="k-axis">
          {t("Price vs BOQ rate")}
        </text>
        {points.map((p, i) => (
          <g key={p.key} className={`ppl-sc-pt${hover === p.key ? " on" : ""}${p.price <= 0 && p.reliability >= 75 ? " best" : p.price > 0 && p.reliability < 70 ? " worst" : ""}`} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)} onClick={onPick ? () => onPick(p.key) : undefined} style={{ animationDelay: `${i * 40}ms` }}>
            <circle cx={X(p.price)} cy={Y(p.reliability)} r={r(p.spend)} />
            <text x={X(p.price)} y={Y(p.reliability) - r(p.spend) - 4} textAnchor="middle" className="ppl-sc-label">
              {p.label.split(" ")[0]}
            </text>
          </g>
        ))}
      </svg>
      <p className="ppl-sc-read" aria-live="polite">
        {hp ? (
          <>
            <b>{hp.label}</b> · {hp.price > 0 ? "+" : ""}
            {(hp.price * 100).toFixed(1)}% {t("vs BOQ")} · {t("reliability {n}", { n: hp.reliability })} · {fmtMoneyShort(hp.spend)} AZN
          </>
        ) : (
          <span className="muted">{t("Bubble size is the value ordered. Hover a vendor to read it.")}</span>
        )}
      </p>
    </div>
  );
}

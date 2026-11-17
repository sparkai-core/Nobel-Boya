import { useState } from "react";
import { useL } from "../../../components/kit";
import { fmtNum } from "../../../lib/format";
import type { PriceSeries } from "../../../ops/types";
import { monthLabel } from "./shared";

type Pt = { month: string; price: number; low?: number; high?: number; fc: boolean };

const W = 640;
const H = 230;
const PAD = { l: 52, r: 12, t: 14, b: 24 };
const BH = 64;

/**
 * Stepped price path: history solid, forecast dashed inside its low/high band, with a
 * today divider. Below it, month-to-month % move bars. Hover a month to read it.
 */
export function PriceChart({ series, months }: { series: PriceSeries; months: 6 | 12 }) {
  const { t, lang } = useL();
  const [hover, setHover] = useState<number | null>(null);
  const hist = series.history.slice(-months).map<Pt>((h) => ({ month: h.month, price: h.price, fc: false }));
  const fc = series.forecast.map<Pt>((f) => ({ month: f.month, price: f.price, low: f.low, high: f.high, fc: true }));
  const pts = [...hist, ...fc];
  const n = pts.length;
  const lo = Math.min(...pts.map((p) => p.low ?? p.price));
  const hi = Math.max(...pts.map((p) => p.high ?? p.price));
  const padV = (hi - lo) * 0.08 || hi * 0.05 || 1;
  const y0 = lo - padV;
  const y1 = hi + padV;
  const slot = (W - PAD.l - PAD.r) / n;
  const X = (i: number) => PAD.l + i * slot;
  const Y = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);

  const step = (from: number, to: number, val: (p: Pt) => number) => {
    let d = "";
    for (let i = from; i < to; i++) {
      const p = pts[i]!;
      d += `${i === from ? "M" : "L"}${X(i).toFixed(1)} ${Y(val(p)).toFixed(1)} L${X(i + 1).toFixed(1)} ${Y(val(p)).toFixed(1)} `;
    }
    return d;
  };
  const h = hist.length;
  const histPath = step(0, h, (p) => p.price);
  const fcPath = `M${X(h).toFixed(1)} ${Y(hist[h - 1]!.price).toFixed(1)} ` + step(h, n, (p) => p.price).replace(/^M/, "L");
  const bandTop = step(h, n, (p) => p.high ?? p.price);
  const bandBottom: string[] = [];
  for (let i = n - 1; i >= h; i--) {
    const p = pts[i]!;
    bandBottom.push(`L${X(i + 1).toFixed(1)} ${Y(p.low ?? p.price).toFixed(1)} L${X(i).toFixed(1)} ${Y(p.low ?? p.price).toFixed(1)}`);
  }
  const band = `${bandTop} ${bandBottom.join(" ")} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => y0 + (y1 - y0) * k);
  const digits = hi < 100 ? 2 : 0;
  const rising = series.call === "BUY_NOW";
  const tone = rising ? "up" : series.call === "WAIT" ? "down" : "flat";

  // month-to-month moves
  const all = [...series.history, ...series.forecast.map((f) => ({ month: f.month, price: f.price }))];
  const moves = pts.map((p) => {
    const i = all.findIndex((a) => a.month === p.month);
    const prev = i > 0 ? all[i - 1]!.price : p.price;
    return prev ? (p.price - prev) / prev : 0;
  });
  const maxMove = Math.max(0.005, ...moves.map((m) => Math.abs(m)));
  const hp = hover != null ? pts[hover] : null;

  return (
    <div className={`ppl-pc ppl-pc-${tone}`}>
      <svg viewBox={`0 0 ${W} ${H + BH}`} className="ppl-pc-svg" onMouseLeave={() => setHover(null)} role="img" aria-label={t("Price history and forecast for {m}", { m: series.name.en })}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} className="k-grid" />
            <text x={PAD.l - 6} y={Y(v) + 4} textAnchor="end" className="k-axis">
              {fmtNum(v, digits)}
            </text>
          </g>
        ))}
        <rect x={X(h)} y={PAD.t} width={X(n) - X(h)} height={H - PAD.t - PAD.b} className="ppl-pc-fczone" />
        <path d={band} className="ppl-pc-band" />
        <path key={`${series.key}-${months}`} d={histPath} pathLength={1} className="ppl-pc-hist" />
        <path d={fcPath} className="ppl-pc-fc" />
        <line x1={X(h)} x2={X(h)} y1={PAD.t - 4} y2={H - PAD.b} className="k-today" />
        <text x={X(h) + 4} y={PAD.t + 6} className="ppl-pc-today">
          {t("Today")}
        </text>
        {pts.map((p, i) =>
          i % (n > 12 ? 2 : 1) === 0 || i === h ? (
            <text key={p.month} x={X(i) + slot / 2} y={H - 8} textAnchor="middle" className={`k-axis${p.fc ? " ppl-pc-fcx" : ""}`}>
              {monthLabel(p.month, lang, p.month.endsWith("-01") || i === 0)}
            </text>
          ) : null,
        )}
        {/* month-to-month move bars */}
        <line x1={PAD.l} x2={W - PAD.r} y1={H + BH / 2} y2={H + BH / 2} className="k-grid" />
        <text x={PAD.l - 6} y={H + BH / 2 + 4} textAnchor="end" className="k-axis">
          0%
        </text>
        {moves.map((m, i) => {
          const bh = (Math.abs(m) / maxMove) * (BH / 2 - 6);
          const up = m >= 0;
          return <rect key={i} x={X(i) + slot * 0.22} width={slot * 0.56} y={up ? H + BH / 2 - bh : H + BH / 2} height={Math.max(1, bh)} rx={2} className={`ppl-pc-move ${up ? "up" : "down"}${pts[i]!.fc ? " fc" : ""}`} />;
        })}
        {hp && hover != null ? (
          <g className="ppl-pc-hover">
            <line x1={X(hover) + slot / 2} x2={X(hover) + slot / 2} y1={PAD.t} y2={H + BH - 4} />
            <circle cx={X(hover) + slot / 2} cy={Y(hp.price)} r={4.5} />
          </g>
        ) : null}
        {pts.map((p, i) => (
          <rect key={p.month} x={X(i)} y={0} width={slot} height={H + BH} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      <div className="ppl-pc-read" aria-live="polite">
        {hp && hover != null ? (
          <>
            <b>{monthLabel(hp.month, lang, true)}</b>
            <span className="num-inline">
              {fmtNum(hp.price, digits)} AZN/{series.unit}
            </span>
            {hp.fc ? (
              <small className="num-inline">
                {t("range {a}–{b}", { a: fmtNum(hp.low ?? hp.price, digits), b: fmtNum(hp.high ?? hp.price, digits) })}
              </small>
            ) : null}
            <small className={`num-inline ${moves[hover]! >= 0 ? "k-text-warn" : "k-text-ok"}`}>
              {moves[hover]! >= 0 ? "+" : ""}
              {(moves[hover]! * 100).toFixed(1)}% {t("vs previous month")}
            </small>
          </>
        ) : (
          <small className="muted">{t("Hover or tap a month to read the price.")}</small>
        )}
      </div>
      <div className="k-legend">
        <span className="ppl-lg ppl-lg-hist">{t("History")}</span>
        <span className="ppl-lg ppl-lg-fc">{t("Forecast")}</span>
        <span className="ppl-lg ppl-lg-band">{t("Low–high range")}</span>
        <span className="ppl-lg ppl-lg-move">{t("Monthly move")}</span>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, LineChart, Radar as RadarIcon, Scale } from "lucide-react";
import { Badge, Meter, PageHero, Panel, Radar, RingGauge, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, TODAY } from "../../../ops/dates";
import { projectHealth, type Tone } from "../../../ops/select";
import { makeSeed } from "../../../ops/seed";

/** Weekly history: fixed points relative to the seeded score, ending at today's live score. */
const OFFSETS = [-11, -9, -10, -7, -6, -8, -4];
let seedScore: number | null = null;
const baseScore = () => (seedScore ??= projectHealth(makeSeed()).score);

const toneOf = (v: number | null): Tone => (v == null ? "muted" : v >= 72 ? "ok" : v >= 60 ? "warn" : "bad");

export function HealthPage() {
  const { t, x, d } = useL();
  const s = useOps();
  const h = useMemo(() => projectHealth(s), [s]);
  const [area, setArea] = useState<string | null>(null);

  const history = useMemo(() => {
    const base = baseScore();
    const pts = OFFSETS.map((o, i) => ({ date: addDays(TODAY, -(OFFSETS.length - i) * 7), score: Math.max(0, Math.min(100, base + o)) }));
    return [...pts, { date: TODAY, score: h.score }];
  }, [h.score]);
  const lastWeek = history[history.length - 2]!.score;
  const delta = h.score - lastWeek;

  const drivers = h.drivers.filter((dr) => !area || dr.area === area);
  const maxAbs = Math.max(5, ...h.drivers.map((dr) => Math.abs(dr.impact)));
  const areaLabel = (k: string) => {
    const a = h.areas.find((v) => v.key === k);
    return a ? x(a.label) : k;
  };
  const lost = h.drivers.filter((dr) => dr.impact < 0).reduce((a, dr) => a + dr.impact, 0);
  const gained = h.drivers.filter((dr) => dr.impact > 0).reduce((a, dr) => a + dr.impact, 0);

  // Score over time chart geometry.
  const W = 560;
  const H = 200;
  const pad = { l: 30, r: 14, t: 14, b: 26 };
  const lo = Math.max(0, Math.min(...history.map((p) => p.score)) - 10);
  const hi = Math.min(100, Math.max(...history.map((p) => p.score)) + 8);
  const PX = (i: number) => pad.l + (i / (history.length - 1)) * (W - pad.l - pad.r);
  const PY = (v: number) => pad.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b);
  const line = history.map((p, i) => `${i ? "L" : "M"}${PX(i).toFixed(1)} ${PY(p.score).toFixed(1)}`).join(" ");
  const bands = [
    { from: 72, to: 100, cls: "ok", label: t("On track") },
    { from: 60, to: 72, cls: "warn", label: t("Watch") },
    { from: 0, to: 60, cls: "bad", label: t("At risk") },
  ];

  return (
    <div className="k-page pmc">
      <PageHero
        eyebrow={t("Project management · Health")}
        title={t("Project health")}
        subtitle={t("One score out of 100 across eight areas, and the things on site and in the office that move it up or down.")}
        flow={["Measure eight areas", "Explain the score", "Fix what needs management"]}
        art="health"
      />

      <section className="pmc-health-top">
        <div className="pmc-health-score">
          <RingGauge value={h.score} size={196} stroke={15} tone={h.tone} label={t("out of 100")} />
          <div className="pmc-health-copy">
            <Badge tone={h.tone}>{x(h.status)}</Badge>
            <h2>{t("Project health is {status}", { status: x(h.status).toLowerCase() })}</h2>
            <p className={`pmc-trend ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>
              {delta > 0 ? <ArrowUpRight size={16} /> : delta < 0 ? <ArrowDownRight size={16} /> : <ArrowRight size={16} />}
              {delta > 0 ? t("Up {n} since last week", { n: delta }) : delta < 0 ? t("Down {n} since last week", { n: -delta }) : t("Same as last week")}
            </p>
            <div className="pmc-health-split">
              <span>
                <small>{t("Points lost")}</small>
                <b className="num-inline k-text-bad">{lost}</b>
              </span>
              <span>
                <small>{t("Points gained")}</small>
                <b className="num-inline k-text-ok">+{gained}</b>
              </span>
              <span>
                <small>{t("Need management")}</small>
                <b className="num-inline">{h.drivers.filter((dr) => dr.attention).length}</b>
              </span>
            </div>
          </div>
        </div>

        <Panel title={t("Health by area")} icon={<RadarIcon size={15} />} sub={t("Click a spoke to see what drives it.")} actions={area ? <button type="button" className="k-link-btn" onClick={() => setArea(null)}>{t("All areas")}</button> : null}>
          <div className="pmc-radar">
            <Radar axes={h.areas.map((a) => ({ key: a.key, label: x(a.label), value: a.score }))} size={300} picked={area} onPick={(k) => setArea(area === k ? null : k)} />
          </div>
        </Panel>
      </section>

      <div className="k-grid-main">
        <Panel
          title={t("What moves the score")}
          icon={<Scale size={15} />}
          sub={area ? t("Drivers in {area}", { area: areaLabel(area) }) : t("Left of the line costs points, right of the line earns them.")}
        >
          {drivers.length ? (
            <ul className="pmc-stems">
              <li className="pmc-stems-head" aria-hidden="true">
                <span />
                <span className="pmc-stems-axis">
                  <em>{t("Points lost")}</em>
                  <em>{t("Points gained")}</em>
                </span>
                <span />
              </li>
              {drivers.map((dr, i) => {
                const w = (Math.abs(dr.impact) / maxAbs) * 50;
                return (
                  <li key={i} className="k-rise" style={{ animationDelay: `${i * 50}ms` }}>
                    <span className="pmc-stem-text">
                      <strong>{x(dr.text)}</strong>
                      <small>
                        <button type="button" className="pmc-chip" onClick={() => setArea(dr.area)}>{areaLabel(dr.area)}</button>
                        {dr.attention ? <Badge tone="bad">{t("Needs management")}</Badge> : null}
                      </small>
                    </span>
                    <span className="pmc-stem-plot">
                      <i className="pmc-stem-zero" />
                      <i className={`pmc-stem ${dr.impact < 0 ? "neg" : "pos"}`} style={dr.impact < 0 ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }}>
                        <b className="num-inline">{dr.impact > 0 ? `+${dr.impact}` : dr.impact}</b>
                      </i>
                    </span>
                    <Link to={dr.link} className="k-link-btn pmc-stem-fix">
                      {dr.impact < 0 ? t("Fix") : t("Open")} <ArrowRight size={13} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">{t("Nothing moves this area at the moment.")}</p>
          )}
        </Panel>

        <Panel title={t("Score over time")} icon={<LineChart size={15} />} sub={t("Weekly, ending today.")}>
          <svg viewBox={`0 0 ${W} ${H}`} className="pmc-hist" role="img" aria-label={t("Score over time")}>
            {bands.map((b) => {
              const y1 = PY(Math.min(hi, b.to));
              const y2 = PY(Math.max(lo, b.from));
              return y2 > y1 ? (
                <g key={b.cls}>
                  <rect x={pad.l} width={W - pad.l - pad.r} y={y1} height={y2 - y1} className={`pmc-hist-band ${b.cls}`} />
                  <text x={W - pad.r - 4} y={y1 + 12} textAnchor="end" className="pmc-hist-band-label">{b.label}</text>
                </g>
              ) : null;
            })}
            <path d={`${line} L${PX(history.length - 1)} ${H - pad.b} L${PX(0)} ${H - pad.b}Z`} className="pmc-hist-area" />
            <path d={line} className="pmc-hist-line" />
            {history.map((p, i) => (
              <g key={p.date}>
                <circle cx={PX(i)} cy={PY(p.score)} r={i === history.length - 1 ? 5.5 : 3.5} className={i === history.length - 1 ? "pmc-hist-now" : "pmc-hist-dot"} />
                {i === history.length - 1 || i === 0 ? (
                  <text x={PX(i)} y={PY(p.score) - 10} textAnchor="middle" className="pmc-hist-val">{p.score}</text>
                ) : null}
                <text x={PX(i)} y={H - 8} textAnchor="middle" className="k-axis">{d(p.date, false)}</text>
              </g>
            ))}
          </svg>
        </Panel>
      </div>

      <section className="pmc-areas" aria-label={t("Areas")}>
        {h.areas.map((a, i) => (
          <article key={a.key} className={`pmc-area k-rise${area === a.key ? " on" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
            <button type="button" className="pmc-area-pick" onClick={() => setArea(area === a.key ? null : a.key)} aria-pressed={area === a.key}>
              <span className="pmc-area-name">{x(a.label)}</span>
              <b className={`num-inline k-text-${toneOf(a.score)}`}>{a.score ?? "—"}</b>
            </button>
            <Meter value={(a.score ?? 0) / 100} tone={toneOf(a.score)} />
            <span className="pmc-area-foot">
              <small>{t("{n} drivers", { n: h.drivers.filter((dr) => dr.area === a.key).length })}</small>
              <Link to={a.link} className="k-link-btn">
                {t("Open")} <ArrowRight size={12} />
              </Link>
            </span>
          </article>
        ))}
      </section>

      <p className="muted small pmc-foot">
        {t("Schedule weighs 25%, cost and materials 15% each, the other areas 8–10%.")}
      </p>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarRange, LineChart, Radar as RadarIcon, Scale } from "lucide-react";
import { Badge, Empty, Meter, PageHero, Panel, Radar, RingGauge, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { projectHealth, R, type Tone } from "../../../ops/select";

const toneOf = (v: number | null): Tone => (v == null ? "muted" : v >= 72 ? "ok" : v >= 60 ? "warn" : "bad");

export function HealthPage() {
  const { t, x, d } = useL();
  const s = useOps();
  const h = useMemo(() => projectHealth(s), [s]);
  const hasData = (h as { hasData?: boolean }).hasData ?? s.activities.length > 0;
  const [area, setArea] = useState<string | null>(null);

  // Real history: the schedule performance (SPI) of every submitted weekly progress update.
  const history = useMemo(
    () => [...s.snapshots].sort((a, b) => a.dataDate.localeCompare(b.dataDate) || a.submittedAt.localeCompare(b.submittedAt)).map((p) => ({ id: p.id, date: p.dataDate, score: Math.round(p.spi * 100) })),
    [s.snapshots],
  );

  const hero = (
    <PageHero
      eyebrow={t("Project management · Health")}
      title={t("Project health")}
      subtitle={t("One score out of 100 across eight areas, and the things on site and in the office that move it up or down.")}
      flow={["Measure eight areas", "Explain the score", "Fix what needs management"]}
      art="health"
    />
  );

  if (!hasData)
    return (
      <div className="k-page pmc">
        {hero}
        <Panel>
          <Empty
            icon={<CalendarRange size={20} />}
            title={t("No programme to score yet")}
            action={
              <Link to={R.programme()} className="btn btn-primary">
                {t("Open the programme")}
              </Link>
            }
          >
            {t("The health score is worked out from the programme. Add activities or import a P6 / MS Project file, then the score appears here.")}
          </Empty>
        </Panel>
      </div>
    );

  const drivers = h.drivers.filter((dr) => !area || dr.area === area);
  const maxAbs = Math.max(5, ...h.drivers.map((dr) => Math.abs(dr.impact)));
  const areaLabel = (k: string) => {
    const a = h.areas.find((v) => v.key === k);
    return a ? x(a.label) : k;
  };
  const lost = h.drivers.filter((dr) => dr.impact < 0).reduce((a, dr) => a + dr.impact, 0);
  const gained = h.drivers.filter((dr) => dr.impact > 0).reduce((a, dr) => a + dr.impact, 0);
  const last = history[history.length - 1];

  // SPI over the weekly updates chart geometry.
  const W = 560;
  const H = 200;
  const pad = { l: 30, r: 14, t: 14, b: 26 };
  const scores = history.map((p) => p.score);
  const lo = Math.max(0, Math.min(80, ...scores) - 10);
  const hi = Math.max(110, ...scores) + 5;
  const PX = (i: number) => pad.l + (history.length < 2 ? (W - pad.l - pad.r) / 2 : (i / (history.length - 1)) * (W - pad.l - pad.r));
  const PY = (v: number) => pad.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b);
  const line = history.map((p, i) => `${i ? "L" : "M"}${PX(i).toFixed(1)} ${PY(p.score).toFixed(1)}`).join(" ");
  const bands = [
    { from: 98, to: hi, cls: "ok", label: t("On plan") },
    { from: 90, to: 98, cls: "warn", label: t("Watch") },
    { from: lo, to: 90, cls: "bad", label: t("Behind") },
  ];

  return (
    <div className="k-page pmc">
      {hero}

      <section className="pmc-health-top">
        <div className="pmc-health-score">
          <RingGauge value={h.score} size={196} stroke={15} tone={h.tone} label={t("out of 100")} />
          <div className="pmc-health-copy">
            <Badge tone={h.tone}>{x(h.status)}</Badge>
            <h2>{t("Project health is {status}", { status: x(h.status).toLowerCase() })}</h2>
            <p className="muted small">
              {last ? t("Last weekly update {id}: SPI {n}", { id: last.id, n: (last.score / 100).toFixed(2) }) : t("Scored from {n} activities in the programme.", { n: s.activities.length })}
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

        <Panel title={t("Schedule performance by weekly update")} icon={<LineChart size={15} />} sub={t("SPI of every submitted weekly progress update (100 = on plan).")}>
          {history.length ? (
            <svg viewBox={`0 0 ${W} ${H}`} className="pmc-hist" role="img" aria-label={t("Schedule performance by weekly update")}>
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
              {history.length > 1 ? <path d={`${line} L${PX(history.length - 1)} ${H - pad.b} L${PX(0)} ${H - pad.b}Z`} className="pmc-hist-area" /> : null}
              {history.length > 1 ? <path d={line} className="pmc-hist-line" /> : null}
              {history.map((p, i) => (
                <g key={p.id}>
                  <circle cx={PX(i)} cy={PY(p.score)} r={i === history.length - 1 ? 5.5 : 3.5} className={i === history.length - 1 ? "pmc-hist-now" : "pmc-hist-dot"} />
                  {i === history.length - 1 || i === 0 ? (
                    <text x={PX(i)} y={PY(p.score) - 10} textAnchor="middle" className="pmc-hist-val">{(p.score / 100).toFixed(2)}</text>
                  ) : null}
                  <text x={PX(i)} y={H - 8} textAnchor="middle" className="k-axis">{d(p.date, false)}</text>
                </g>
              ))}
            </svg>
          ) : (
            <Empty
              title={t("No weekly updates yet")}
              action={
                <Link to={R.progressTracking} className="btn btn-ghost btn-sm">
                  {t("Weekly progress update")}
                </Link>
              }
            >
              {t("Each weekly progress update adds a point here.")}
            </Empty>
          )}
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

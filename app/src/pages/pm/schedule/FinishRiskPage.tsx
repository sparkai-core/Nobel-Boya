import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dices, Gauge, ListOrdered, Plus, Route, SlidersHorizontal, Upload } from "lucide-react";
import { BarList, Badge, Empty, PageHero, Panel, useL } from "../../../components/kit";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { R, type Tone } from "../../../ops/select";
import { useSchedule } from "./model";
import { OPTIMISM, simulate } from "./montecarlo";

/** Runs scale down for big programmes so a run stays well under a second. */
const runsFor = (n: number) => Math.max(200, Math.min(2000, Math.floor(600_000 / Math.max(1, n))));

/**
 * Finish-date outlook: a Monte-Carlo simulation of the remaining work run in the browser, shown as a
 * histogram of finish dates with the cumulative curve, P50 / P80, the contract date and the activities
 * that most often decide the finish.
 */
export function FinishRiskPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const { activities, links, outlook, byId } = useSchedule();
  const [seed, setSeed] = useState(1);
  const [running, setRunning] = useState(false);
  const RUNS = runsFor(activities.length);
  const res = useMemo(() => simulate(activities, links, RUNS, seed), [activities, links, RUNS, seed]);

  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => {
      setSeed((s) => s + 1);
      setRunning(false);
    }, 650);
    return () => clearTimeout(id);
  }, [running]);

  // Measured against the contract finish when one is set, else against the programme's own finish.
  const targetDate = outlook.contractKnown ? outlook.contract : outlook.current;
  const targetWord = outlook.contractKnown ? t("Contract") : t("Programme finish");
  const contract = diffDays(TODAY, targetDate);
  const chance = res.runs ? res.finishes.filter((f) => f <= contract).length / res.runs : 0;
  const p10 = res.pct(0.1);
  const p50 = res.pct(0.5);
  const p80 = res.pct(0.8);
  const p90 = res.pct(0.9);
  const spread = p90 - p10;
  const verdict: { label: string; tone: Tone; text: string } =
    chance >= 0.7
      ? { label: t("Likely on time"), tone: "ok", text: outlook.contractKnown ? t("Most runs finish by the contract date.") : t("Most runs finish by the programme's own finish date.") }
      : chance >= 0.3
        ? { label: t("At risk"), tone: "warn", text: outlook.contractKnown ? t("The contract date is reachable, but not in most runs.") : t("The programme's finish date is reachable, but not in most runs.") }
        : { label: t("Likely late"), tone: "bad", text: outlook.contractKnown ? t("Few runs reach the contract date with the work as planned.") : t("Few runs reach the programme's finish date with the work as planned.") };
  const spreadWord = spread <= 14 ? t("Tight") : spread <= 35 ? t("Normal") : t("Wide");

  // Histogram bins.
  const min = res.finishes[0] ?? 0;
  const max = res.finishes[res.finishes.length - 1] ?? 0;
  const lo = Math.min(min, contract) - 3;
  const hi = Math.max(max, contract) + 3;
  const binW = Math.max(2, Math.ceil((hi - lo) / 26));
  const bins: { from: number; n: number; cum: number }[] = [];
  let acc = 0;
  for (let b = lo; b <= hi; b += binW) {
    const n = res.finishes.filter((f) => f >= b && f < b + binW).length;
    acc += n;
    bins.push({ from: b, n, cum: acc / res.runs });
  }
  const top = Math.max(1, ...bins.map((b) => b.n));
  const W = 760;
  const H = 280;
  const pad = { l: 40, r: 44, t: 30, b: 34 };
  const X = (day: number) => pad.l + ((day - lo) / Math.max(1, hi + binW - lo)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const bw = Math.max(2, X(lo + binW) - X(lo) - 3);
  const cumPath = bins.map((b, i) => `${i ? "L" : "M"}${(X(b.from + binW)).toFixed(1)} ${Y(b.cum).toFixed(1)}`).join(" ");
  const ticks = bins.filter((_, i) => i % Math.ceil(bins.length / 7) === 0);

  const drivers = [...res.critical.entries()]
    .map(([id, n]) => ({ a: byId.get(id), share: n / res.runs }))
    .filter((r) => r.a && r.a.status !== "COMPLETED")
    .sort((a, b) => b.share - a.share)
    .slice(0, 8);

  if (!res.hasWork) {
    return (
      <div className="k-page pms">
        <PageHero eyebrow={t("Project management · Finish risk")} title={t("Finish-date outlook")} subtitle={t("Simulated runs of the remaining work, each with its own durations, pushed through the logic to a finish date.")} art="risk" />
        <div className="k-panel">
          <Empty
            icon={<Gauge size={20} />}
            title={activities.length ? t("No remaining work to simulate") : t("No programme yet")}
            action={
              activities.length ? undefined : (
                <div className="pms-empty-actions">
                  <button type="button" className="btn btn-primary" onClick={() => navigate(`${R.planning("activities")}?import=1`)}>
                    <Upload size={15} /> {t("Import a P6 / MS Project file")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate(`${R.planning("activities")}?add=1`)}>
                    <Plus size={15} /> {t("Add an activity")}
                  </button>
                </div>
              )
            }
          >
            {activities.length ? t("Every activity is finished.") : t("The finish-date outlook runs on the programme's activities and links.")}
          </Empty>
        </div>
      </div>
    );
  }

  const marker = (day: number, label: string, cls: string, row: number) => (
    <g className={`pms-mc-mark ${cls}`}>
      <line x1={X(day)} x2={X(day)} y1={pad.t - 6 + row * 13} y2={H - pad.b} />
      <text x={X(day) + 4} y={pad.t + 3 + row * 13}>
        {label}
      </text>
    </g>
  );

  return (
    <div className="k-page pms">
      <PageHero
        eyebrow={t("Project management · Finish risk")}
        title={t("Finish-date outlook")}
        subtitle={t("{n} simulated runs of the remaining work, each with its own durations, pushed through the logic to a finish date.", { n: RUNS.toLocaleString("en-GB") })}
        flow={["Sample durations", "Forward pass", "Finish dates", "Confidence"]}
        art="risk"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setRunning(true)} disabled={running}>
            <Dices size={15} className={running ? "pms-spin" : undefined} />
            {running ? t("Running…") : t("Run again")}
          </button>
        }
      />

      <section className={`pms-verdict k-tone-${verdict.tone}${running ? " busy" : ""}`}>
        <div className="pms-verdict-main">
          <span className="k-eyebrow">{t("Verdict")}</span>
          <strong>{verdict.label}</strong>
          <p>{verdict.text}</p>
        </div>
        <div className="pms-verdict-figs">
          <div>
            <span>{outlook.contractKnown ? t("Chance of finishing by the contract date") : t("Chance of finishing by the programme finish")}</span>
            <b className="num-inline">{Math.round(chance * 100)}%</b>
            <small>{d(targetDate)}</small>
          </div>
          <div>
            <span>{t("P50 finish")}</span>
            <b className="num-inline">{d(addDays(TODAY, p50), false)}</b>
            <small>{t("half the runs finish by then")}</small>
          </div>
          <div>
            <span>{t("P80 finish")}</span>
            <b className="num-inline">{d(addDays(TODAY, p80), false)}</b>
            <small>{t("safe date to promise")}</small>
          </div>
          <div>
            <span>{t("Spread")}</span>
            <b>{spreadWord}</b>
            <small>{t("P10 to P90: {n} days", { n: spread })}</small>
          </div>
        </div>
      </section>

      <div className="k-grid-main">
        <Panel title={t("Finish dates across the runs")} icon={<Gauge size={15} />} sub={t("Bars: how many runs finished in each window. Line: share finished by that date.")}>
          <div className="pms-mc-scroll">
            <svg key={seed} className={`pms-mc${running ? " busy" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Histogram of finish dates")}>
              {[0, 0.25, 0.5, 0.75, 1].map((g) => (
                <g key={g}>
                  <line x1={pad.l} x2={W - pad.r} y1={Y(g)} y2={Y(g)} className="k-grid" />
                  <text x={W - pad.r + 6} y={Y(g) + 4} className="k-axis">
                    {Math.round(g * 100)}%
                  </text>
                </g>
              ))}
              <rect x={X(contract + 1)} y={pad.t} width={Math.max(0, X(hi + binW) - X(contract + 1))} height={H - pad.t - pad.b} className="pms-mc-late" />
              {bins.map((b, i) => (
                <rect key={b.from} className={`pms-mc-bar${b.from + binW - 1 > contract ? " late" : ""}`} x={X(b.from) + 1.5} y={Y(b.n / top)} width={bw} height={Math.max(0, H - pad.b - Y(b.n / top))} rx={3} style={{ animationDelay: `${i * 18}ms` }}>
                  <title>{`${d(addDays(TODAY, b.from), false)} – ${d(addDays(TODAY, b.from + binW - 1), false)}: ${b.n} ${t("runs")}`}</title>
                </rect>
              ))}
              <path d={cumPath} className="pms-mc-cum" />
              {ticks.map((b) => (
                <text key={b.from} x={X(b.from)} y={H - 12} className="k-axis">
                  {d(addDays(TODAY, b.from), false)}
                </text>
              ))}
              {marker(contract, targetWord, "contract", 0)}
              {marker(p50, "P50", "p50", 1)}
              {marker(p80, "P80", "p80", 2)}
            </svg>
          </div>
          <div className="pms-legend">
            <span className="lg-mc-ok">{t("Runs on time")}</span>
            <span className="lg-mc-late">{outlook.contractKnown ? t("Runs after the contract date") : t("Runs after the programme finish")}</span>
            <span className="lg-mc-cum">{t("Share finished")}</span>
            <span className="lg-mc-p">{t("P50 / P80")}</span>
          </div>
          <p className="muted small pms-mc-note">
            {t("Single-point estimate with every duration at its most likely value: {date}. The programme says {cur}.", { date: d(addDays(TODAY, res.likely)), cur: d(outlook.calculated) })}
          </p>
        </Panel>

        <div className="k-stack">
          <Panel title={t("What decides the finish")} icon={<ListOrdered size={15} />} sub={t("How often each activity was on the driving chain to the finish.")}>
            {drivers.length ? (
              <BarList
                items={drivers.map(({ a, share }) => ({
                  key: a!.id,
                  label: (
                    <>
                      <span className="pms-code">{a!.code}</span> {x(a!.name)}
                    </>
                  ),
                  value: Math.round(share * 100),
                  tone: share > 0.8 ? "bad" : share > 0.4 ? "warn" : "brand",
                  onClick: () => navigate(R.programme(a!.id)),
                }))}
                max={100}
                format={(v) => `${v}%`}
              />
            ) : (
              <p className="muted">{t("No remaining work to simulate.")}</p>
            )}
            <Link to={R.recovery} className="k-link-btn pms-mt">
              <Route size={13} /> {t("Recovery options for the top drivers")}
            </Link>
          </Panel>
          <Panel title={t("Assumptions")} icon={<SlidersHorizontal size={15} />}>
            <ul className="pms-assume">
              <li>
                <Badge tone="bad" dot={false}>
                  −{OPTIMISM * 100}% / +40%
                </Badge>
                {t("Structural steel and roofing: supply and wind")}
              </li>
              <li>
                <Badge tone="warn" dot={false}>
                  −{OPTIMISM * 100}% / +30%
                </Badge>
                {t("Concrete, rebar, masonry and external works: rain")}
              </li>
              <li>
                <Badge tone="neutral" dot={false}>
                  −{OPTIMISM * 100}% / +25%
                </Badge>
                {t("Services, finishes and the rest")}
              </li>
            </ul>
            <p className="muted small">{t("Remaining work only. Finished activities keep their actual dates, running ones their remaining share. Results stay the same until you run again.")}</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

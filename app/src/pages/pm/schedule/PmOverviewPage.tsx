import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Ban,
  CalendarRange,
  ClipboardCheck,
  Construction,
  FileInput,
  FileQuestion,
  Flag,
  GitBranch,
  HeartPulse,
  LayoutGrid,
  NotebookPen,
  Radio,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge, CountUp, Panel, RingGauge, SCurve, StatusBadge, useL, Waffle } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, PROJECT_START, TODAY } from "../../../ops/dates";
import { poLate, projectHealth, R, sCurve, statusMeta, type Tone } from "../../../ops/select";
import { lateness, milestoneRows, MS_TONE, programmeFilter, useSchedule } from "./model";
import { NoProgramme, ProjectRunStrip } from "./ProjectRunStrip";

type Attention = { key: string; icon: LucideIcon; tone: "bad" | "warn" | "brand"; title: string; sub: string; tag?: string; step: { label: string; to: string }; open?: string; weight: number };

/**
 * PM home: the run strip, where the job stands against plan (S-curve), the tasks by state, a ranked
 * "needs attention" queue built from blockers, RFIs, late orders, inspections and site impacts,
 * project health, the finish dates at a glance and tiles into the other modules.
 */
export function PmOverviewPage() {
  const { t, x, d, rel } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const { activities, cp, stats, outlook, byId, milestones } = useSchedule();
  const health = useMemo(() => projectHealth(s), [s]);
  const has = activities.length > 0;
  const curve = useMemo(() => sCurve(activities, 7, s.snapshots.map((p) => ({ date: p.dataDate, actual: p.actualPct }))), [activities, s.snapshots]);
  const [glance, setGlance] = useState<"job" | "finish">("job");

  // ------------------------------------------------------------ tasks by state
  const mix = useMemo(() => {
    const by = (st: string) => activities.filter((a) => a.status === st);
    const lateIn = (list: typeof activities) => list.filter((a) => lateness(a)).length;
    const done = by("COMPLETED");
    const prog = by("IN_PROGRESS");
    const blocked = by("BLOCKED");
    const ns = by("NOT_STARTED");
    return [
      { key: "blocked", label: t("Blocked"), count: blocked.length, tone: "bad" as Tone, outline: lateIn(blocked) },
      { key: "progress", label: t("In progress"), count: prog.length, tone: "brand" as Tone, outline: lateIn(prog) },
      { key: "done", label: t("Done"), count: done.length, tone: "ok" as Tone, outline: 0 },
      { key: "notstarted", label: t("Not started"), count: ns.length, tone: "muted" as Tone, outline: lateIn(ns) },
    ];
  }, [activities, t]);
  const lateCount = activities.filter((a) => lateness(a)).length;

  // ------------------------------------------------------------ needs attention
  const queue = useMemo(() => {
    const items: Attention[] = [];
    const usedRfi = new Set<string>();
    for (const a of activities.filter((z) => z.status === "BLOCKED")) {
      const rfi = s.rfis.find((r) => r.activityId === a.id && r.status === "OPEN");
      if (rfi) usedRfi.add(rfi.id);
      const crit = cp.get(a.id)?.critical;
      const over = rfi ? diffDays(rfi.dueAt, TODAY) : 0;
      items.push({
        key: a.id,
        icon: Ban,
        tone: "bad",
        title: t("{code} {name} is blocked", { code: a.code, name: x(a.name) }),
        sub: a.blockedReason ? x(a.blockedReason) : t("Work cannot continue until the blocker is cleared."),
        tag: [crit ? t("On the critical path") : null, rfi && over > 0 ? t("{ref} {n} days overdue", { ref: rfi.ref, n: over }) : null].filter(Boolean).join(" · "),
        step: rfi ? { label: t("Chase {ref} with the designer", { ref: rfi.ref }), to: R.rfi(rfi.id) } : { label: t("Open in the programme"), to: R.programme(a.id) },
        open: R.programme(a.id),
        weight: 100 + (crit ? 20 : 0),
      });
    }
    for (const i of s.impacts.filter((z) => z.kind === "EQUIPMENT_FAILURE" && (z.status === "REPORTED" || z.status === "UNDER_REVIEW" || z.status === "CONFIRMED"))) {
      const a = byId.get(i.activityId);
      const crit = cp.get(i.activityId)?.critical;
      items.push({ key: i.id, icon: Construction, tone: crit ? "bad" : "warn", title: x(i.text), sub: a ? t("Holds {code} {name} · {n} days at stake", { code: a.code, name: x(a.name), n: i.daysImpact }) : "", tag: crit ? t("On the critical path") : undefined, step: { label: t("Review on the live programme"), to: R.live }, weight: 82 + (crit ? 6 : 0) });
    }
    for (const r of s.rfis.filter((z) => z.status === "OPEN" && z.dueAt < TODAY && !usedRfi.has(z.id))) {
      items.push({ key: r.id, icon: FileQuestion, tone: r.timeImpact ? "bad" : "warn", title: t("{ref} is {n} days overdue", { ref: r.ref, n: diffDays(r.dueAt, TODAY) }), sub: x(r.subject), step: { label: t("Chase the answer"), to: R.rfi(r.id) }, weight: 70 + (r.timeImpact ? 10 : 0) });
    }
    for (const po of s.pos.filter(poLate)) {
      const mr = s.mrs.find((m) => m.id === po.mrId);
      const a = mr?.activityId ? byId.get(mr.activityId) : undefined;
      const vendor = s.vendors.find((v) => v.id === po.vendorId)?.name ?? "";
      items.push({ key: po.id, icon: Truck, tone: a && cp.get(a.id)?.critical ? "bad" : "warn", title: t("{ref} is late on delivery", { ref: po.ref }), sub: [vendor, `${t("due")} ${d(po.expectedAt)}`, a ? t("holds {code}", { code: a.code }) : null].filter(Boolean).join(" · "), step: { label: t("Open the order"), to: R.order(po.id) }, weight: 76 });
    }
    for (const ins of s.inspections.filter((z) => z.status === "FAILED" || (z.kind === "NCR" && z.status === "OPEN"))) {
      const a = ins.activityId ? byId.get(ins.activityId) : undefined;
      items.push({ key: ins.id, icon: ShieldAlert, tone: "warn", title: ins.status === "FAILED" ? t("{ref} failed: {title}", { ref: ins.ref, title: x(ins.title) }) : t("{ref} open: {title}", { ref: ins.ref, title: x(ins.title) }), sub: [x(ins.location), a ? a.code : null].filter(Boolean).join(" · "), step: { label: t("Open the inspection"), to: R.inspection(ins.id) }, weight: ins.kind === "NCR" ? 58 : 54 });
    }
    return items.sort((a, b) => b.weight - a.weight);
  }, [activities, s.rfis, s.impacts, s.pos, s.mrs, s.vendors, s.inspections, cp, byId, t, x, d]);

  // ------------------------------------------------------------ milestones
  const upcoming = useMemo(
    () =>
      milestoneRows(milestones, activities)
        .filter((r) => !r.f.done)
        .sort((a, b) => a.f.forecast.localeCompare(b.f.forecast))
        .slice(0, 3),
    [milestones, activities],
  );
  const msLate = milestoneRows(milestones, activities).filter((r) => r.f.state === "LATE" || r.f.state === "AT_RISK").length;
  const msOpen = milestones.length - milestoneRows(milestones, activities).filter((r) => r.f.done).length;

  // ------------------------------------------------------------ module tiles
  const openMrs = s.mrs.filter((m) => m.status === "SUBMITTED" || m.status === "SOURCING" || m.status === "DRAFT").length;
  const latePos = s.pos.filter(poLate).length;
  const followed = s.programmes.find((p) => p.current);
  const report = s.reports.find((r) => r.date === TODAY);
  const insOpen = s.inspections.filter((i) => i.status === "REQUESTED").length;
  const ncrOpen = s.inspections.filter((i) => i.kind === "NCR" && i.status === "OPEN").length;
  const openDelays = s.delays.filter((z) => z.status === "OPEN" || z.status === "UNDER_REVIEW" || z.status === "CONFIRMED");
  const critCount = activities.filter((a) => cp.get(a.id)?.critical && a.status !== "COMPLETED").length;

  const gap = Math.round((stats.plannedPct - stats.actualPct) * 100);

  const top = queue[0];

  return (
    <div className="k-page pms">
      <ProjectRunStrip
        big
        health={{ score: health.score, status: health.status, tone: health.tone, hasData: health.hasData }}
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => navigate(R.programme())}>
              <CalendarRange size={15} />
              {t("Open the programme")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(R.reports)}>
              <NotebookPen size={15} />
              {t("Daily reports")}
            </button>
          </>
        }
      />

      <div className="k-grid-main">
        <div className="k-stack">
          {/* ---------------- where we stand ---------------- */}
          <Panel title={t("Where we stand")} icon={<TrendingUp size={15} />} actions={has ? <Link to={R.health} className="k-link-btn">{t("Earned value")} <ArrowRight size={13} /></Link> : undefined}>
            {!has ? (
              <NoProgramme />
            ) : (
            <>
            <div className="pms-stand">
              <div className="pms-stand-fig">
                <span>{t("Planned by today")}</span>
                <strong className="num-inline">
                  <CountUp value={stats.plannedPct * 100} format={(v) => `${v.toFixed(1)}%`} />
                </strong>
              </div>
              <div className="pms-stand-fig">
                <span>{t("Done by today")}</span>
                <strong className="num-inline k-text-brand">
                  <CountUp value={stats.actualPct * 100} format={(v) => `${v.toFixed(1)}%`} />
                </strong>
              </div>
              <div className={`pms-stand-gap ${gap > 0 ? "behind" : "ahead"}`}>
                <strong>{gap > 0 ? t("{n} points behind plan", { n: gap }) : gap < 0 ? t("{n} points ahead of plan", { n: -gap }) : t("Exactly on plan")}</strong>
                <span>
                  {t("Schedule performance {v}", { v: stats.spi.toFixed(2) })} · {t("forecast finish {date}", { date: d(outlook.forecast) })}
                </span>
              </div>
            </div>
            <CurveWithTags points={curve} planned={stats.plannedPct} actual={stats.actualPct} />
            {!s.snapshots.length ? <p className="muted small">{t("The actual line starts with your first progress update; only today's figure is shown until then.")}</p> : null}
            </>
            )}
          </Panel>

          {/* ---------------- needs attention ---------------- */}
          <Panel title={t("Needs attention now")} icon={<Zap size={15} />} count={queue.length} sub={t("Built from blockers, overdue RFIs, late orders, inspections and site impacts. Most urgent first.")} pad={false}>
            {top ? (
              <div className="pms-attn">
                <div className={`pms-attn-top k-tone-${top.tone}`}>
                  <span className="pms-attn-icon">
                    <top.icon size={18} />
                  </span>
                  <div className="pms-attn-copy">
                    <small>{t("Most urgent")}</small>
                    <strong>{top.title}</strong>
                    <p>{top.sub}</p>
                    {top.tag ? <span className="pms-attn-tag">{top.tag}</span> : null}
                  </div>
                  <div className="pms-attn-actions">
                    <span className="pms-attn-label">{t("Suggested next step")}</span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(top.step.to)}>
                      {top.step.label}
                      <ArrowRight size={13} />
                    </button>
                    {top.open ? (
                      <Link to={top.open} className="k-link-btn">
                        {t("See it in the programme")}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <ul className="pms-attn-list">
                  {queue.slice(1, 7).map((q) => (
                    <li key={q.key}>
                      <span className={`pms-attn-dot k-tone-${q.tone}`}>
                        <q.icon size={14} />
                      </span>
                      <div className="pms-attn-text">
                        <strong>{q.title}</strong>
                        <small>{q.sub}</small>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(q.step.to)}>
                        {q.step.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="k-panel-body muted">{t("Nothing needs attention right now.")}</p>
            )}
          </Panel>

          {/* ---------------- programme at a glance ---------------- */}
          <Panel
            title={t("Programme at a glance")}
            icon={<Flag size={15} />}
            actions={<Segmented value={glance} onChange={setGlance} label={t("Time window")} options={[{ value: "job", label: t("Whole job") }, { value: "finish", label: t("Around the finish") }]} />}
          >
            {has ? <Glance window={glance} outlook={outlook} /> : <p className="muted small">{t("The finish dates appear here once the project has a programme.")}</p>}
            <ul className="pms-routes">
              <li>
                <Link to={R.critical}>
                  <GitBranch size={15} />
                  <span>{t("Critical path")}</span>
                  <small>{has ? t("{n} activities decide the finish", { n: critCount }) : t("No programme yet")}</small>
                  <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <Link to={R.milestones}>
                  <Flag size={15} />
                  <span>{t("Milestones")}</span>
                  <small>{!milestones.length ? t("No milestones yet") : msLate ? t("{n} of {m} forecast late or at risk", { n: msLate, m: milestones.length }) : t("All {m} on track", { m: milestones.length })}</small>
                  <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <Link to={R.delays}>
                  <Ban size={15} />
                  <span>{t("Delays")}</span>
                  <small>{s.delays.length ? t("{n} open · {d} days lost", { n: openDelays.length, d: openDelays.reduce((a, z) => a + z.daysLost, 0) }) : t("No delays recorded")}</small>
                  <ArrowRight size={14} />
                </Link>
              </li>
              <li>
                <Link to={R.live}>
                  <Radio size={15} />
                  <span>{t("Live programme")}</span>
                  <small>{outlook.pending.length ? t("{n} site impacts waiting to go in", { n: outlook.pending.length }) : t("No site impacts waiting")}</small>
                  <ArrowRight size={14} />
                </Link>
              </li>
            </ul>
          </Panel>
        </div>

        <div className="k-stack">
          {/* ---------------- health ---------------- */}
          <Panel title={t("Project health")} icon={<HeartPulse size={15} />} actions={<Link to={R.health} className="k-link-btn">{t("Health")} <ArrowRight size={13} /></Link>}>
            {!health.hasData ? (
              <p className="muted small">{t("Health is worked out from the project's own records once it has a programme.")}</p>
            ) : (
            <div className="pms-health">
              <RingGauge value={health.score} size={118} tone={health.tone} label={x(health.status)} />
              {!health.drivers.length ? <p className="muted small">{t("Nothing recorded is pulling the score up or down.")}</p> : null}
              <ul className="pms-drivers">
                {health.drivers.slice(0, 3).map((dr, i) => (
                  <li key={i}>
                    <Link to={dr.link}>
                      <b className={`num-inline ${dr.impact < 0 ? "k-text-bad" : "k-text-ok"}`}>
                        {dr.impact > 0 ? "+" : "−"}
                        {Math.abs(dr.impact)}
                      </b>
                      <span>{x(dr.text)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            )}
          </Panel>

          {/* ---------------- tasks by state ---------------- */}
          <Panel title={t("Tasks by state")} icon={<LayoutGrid size={15} />} count={activities.length} sub={lateCount ? t("One square per activity. Red outlines are running late.") : t("One square per activity.")}>
            {has ? <Waffle groups={mix} onPick={(k) => navigate(programmeFilter(k))} /> : <p className="muted small">{t("No activities yet.")}</p>}
            {lateCount ? (
              <Link to={programmeFilter("late")} className="pms-late-link">
                <i aria-hidden="true" />
                {t("{n} running late", { n: lateCount })}
                <ArrowRight size={13} />
              </Link>
            ) : null}
          </Panel>

          {/* ---------------- upcoming milestones ---------------- */}
          <Panel title={t("Next milestones")} icon={<Flag size={15} />} pad={false} actions={<Link to={R.milestones} className="k-link-btn">{t("All")} <ArrowRight size={13} /></Link>}>
            {upcoming.length ? (
              <ul className="pms-next-ms">
                {upcoming.map(({ m, f }) => (
                  <li key={m.id}>
                    <Link to={`${R.milestones}?m=${m.id}`}>
                      <i className={`pms-diamond k-tone-${MS_TONE[f.state]}`} aria-hidden="true" />
                      <span className="pms-next-ms-name">
                        <strong className="truncate">{x(m.name)}</strong>
                        <small>
                          {d(f.forecast)} · {rel(f.forecast)}
                        </small>
                      </span>
                      {f.slip > 0 ? <Badge tone={MS_TONE[f.state]}>{t("+{n} d", { n: f.slip })}</Badge> : <StatusBadge kind="milestone" status={f.state} />}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : milestones.length && !msOpen ? (
              <p className="k-panel-body muted">{t("Every milestone is done.")}</p>
            ) : (
              <div className="k-panel-body">
                <p className="muted small">{t("No milestones yet.")}</p>
                <Link to={`${R.milestones}?new=1`} className="k-link-btn">
                  {t("Add a milestone")} <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ---------------- module tiles ---------------- */}
      <section className="pms-tiles" aria-label={t("Other modules")}>
        <Tile to={R.proc} icon={ShoppingCart} title={t("Procurement")} value={openMrs} unit={t("open requests")} note={latePos ? t("{n} orders late", { n: latePos }) : t("No late orders")} tone={latePos ? "bad" : "ok"} />
        <Tile to={R.planning()} icon={FileInput} title={t("Planning")} value={activities.length} unit={t("activities")} note={followed ? t("Follows {name}", { name: followed.name }) : t("Nothing imported yet")} tone={followed ? "ok" : "muted"} />
        <Tile to={report ? R.report(report.id) : R.reports} icon={NotebookPen} title={t("Daily report today")} value={report ? report.entries.length : 0} unit={t("entries")} note={report ? `${report.labour.reduce((a, l) => a + l.count, 0)} ${t("on site")} · ${x(statusMeta("report", report.status).label)}` : t("Not started yet")} tone={report?.status === "DRAFT" ? "warn" : "ok"} />
        <Tile to={R.inspections} icon={ClipboardCheck} title={t("Inspections")} value={insOpen} unit={t("waiting")} note={ncrOpen ? t("{n} NCR open", { n: ncrOpen }) : t("No open NCRs")} tone={ncrOpen ? "bad" : "ok"} />
      </section>
    </div>
  );
}

function Tile({ to, icon: Icon, title, value, unit, note, tone }: { to: string; icon: LucideIcon; title: string; value: number; unit: string; note: string; tone: Tone }) {
  return (
    <Link to={to} className="pms-tile">
      <span className="pms-tile-top">
        <span className="pms-tile-icon">
          <Icon size={15} />
        </span>
        <span>{title}</span>
        <ArrowRight size={14} className="pms-tile-arrow" />
      </span>
      <strong className="num-inline">
        <CountUp value={value} />
        <small>{unit}</small>
      </strong>
      <span className={`pms-tile-note k-text-${tone}`}>{note}</span>
    </Link>
  );
}

/** The kit S-curve with the planned and actual values labelled where they cross today. */
function CurveWithTags({ points, planned, actual }: { points: ReturnType<typeof sCurve>; planned: number; actual: number }) {
  const { t } = useL();
  const H = 220;
  const first = points[0]?.date ?? TODAY;
  const last = points[points.length - 1]?.date ?? TODAY;
  const frac = diffDays(first, TODAY) / Math.max(1, diffDays(first, last));
  const left = ((34 + frac * (640 - 48)) / 640) * 100;
  const y = (v: number) => 14 + (1 - v) * (H - 40);
  let yp = y(planned);
  let ya = y(actual);
  if (Math.abs(yp - ya) < 18) {
    const mid = (yp + ya) / 2;
    yp = mid - 10;
    ya = mid + 10;
  }
  return (
    <div className="pms-curve">
      <SCurve points={points} today={TODAY} height={H} />
      <span className="pms-curve-tag plan" style={{ left: `${left}%`, top: yp }}>
        {t("Plan")} {(planned * 100).toFixed(1)}%
      </span>
      <span className="pms-curve-tag act" style={{ left: `${left}%`, top: ya }}>
        {t("Actual")} {(actual * 100).toFixed(1)}%
      </span>
    </div>
  );
}

/** Four lanes: contract target, baseline finish, current programme finish and forecast finish. */
function Glance({ window, outlook }: { window: "job" | "finish"; outlook: ReturnType<typeof useSchedule>["outlook"] }) {
  const { t, d, lang } = useL();
  const dates = [outlook.forecast, outlook.current, outlook.baseline, ...(outlook.contractKnown ? [outlook.contract] : [])].sort();
  const lastDate = dates[dates.length - 1]!;
  const firstDate = dates[0]!;
  const from = window === "job" ? PROJECT_START : addDays(firstDate, -40);
  const to = addDays(lastDate, window === "job" ? 25 : 20);
  const span = Math.max(1, diffDays(from, to));
  const pos = (date: string) => (diffDays(from, date) / span) * 100;
  const lanes = [
    ...(outlook.contractKnown ? [{ key: "contract", label: t("Contract target"), date: outlook.contract, tone: "neutral" as Tone, filled: false }] : []),
    { key: "baseline", label: t("Baseline finish"), date: outlook.baseline, tone: "muted" as Tone, filled: false },
    { key: "current", label: t("Current programme"), date: outlook.current, tone: "brand" as Tone, filled: true },
    { key: "forecast", label: t("Forecast finish"), date: outlook.forecast, tone: outlook.contractKnown ? (outlook.forecast > outlook.contract ? ("bad" as Tone) : ("ok" as Tone)) : ("brand" as Tone), filled: true },
  ];
  const ticks: string[] = [];
  for (let m = `${from.slice(0, 7)}-01`; m <= to; ) {
    if (m >= from) ticks.push(m);
    const [yy, mm] = m.split("-").map(Number) as [number, number];
    m = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
  }
  const step = window === "job" ? 2 : 1;
  const todayIn = TODAY >= from && TODAY <= to;
  return (
    <div className="pms-glance">
      <div className="pms-glance-axis">
        <span />
        <div>
          {ticks
            .filter((_, i) => i % step === 0)
            .map((m) => (
              <small key={m} style={{ left: `${pos(m)}%` }}>
                {d(m, false).replace(/^1 /, "")} {lang === "en" ? m.slice(2, 4) : ""}
              </small>
            ))}
        </div>
      </div>
      {lanes.map((l, i) => {
        const p = pos(l.date);
        return (
          <div key={l.key} className="pms-lane" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="pms-lane-label">{l.label}</span>
            <div className="pms-lane-track">
              {todayIn ? <b className="pms-lane-today" style={{ left: `${pos(TODAY)}%` }} /> : null}
              <i className={`pms-lane-line k-tone-${l.tone}`} style={{ width: `${p}%` }} />
              <i className={`pms-diamond big k-tone-${l.tone}${l.filled ? " filled" : ""}`} style={{ left: `${p}%` }} />
              <span className={`pms-lane-date k-text-${l.tone}${p > 70 ? " flip" : ""}`} style={{ left: `${p}%` }}>
                {d(l.date)}
              </span>
            </div>
          </div>
        );
      })}
      <p className="pms-glance-foot">
        {todayIn ? (
          <span className="pms-glance-today">{t("Dashed line is today")}</span>
        ) : (
          <span className="pms-glance-today">{TODAY < from ? t("Today is {n} days before this window", { n: diffDays(TODAY, from) }) : t("Today is {n} days after this window", { n: diffDays(to, TODAY) })}</span>
        )}
        {outlook.pendingDays > 0 ? <span>{t("Forecast adds {n} days from site impacts still under review.", { n: outlook.pendingDays })}</span> : null}
      </p>
    </div>
  );
}

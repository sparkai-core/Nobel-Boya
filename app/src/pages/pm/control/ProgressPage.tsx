import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, ArrowRight, Box, Grid3x3, Package, Pause, Play, RotateCcw, Stethoscope, Wrench } from "lucide-react";
import { Badge, PageHero, Panel, SCurve, StatusBadge, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, maxDate, minDate, TODAY } from "../../../ops/dates";
import { poLate, programmeStats, R, sCurve } from "../../../ops/select";
import { buildingShort } from "../../../lib/loc";
import type { Activity, ProgressZone } from "../../../ops/types";
import { SiteModel, STATE_LABEL, STATE_ORDER, stateCounts } from "./SiteModel";
import { PhotosView, ZonesView } from "./ProgressPhotos";
import { groupPct, isOpenDelay, plannedPctAt, shownPctAt, useCpm } from "./shared";

type View = "model" | "photos" | "zones";
type Trade = ProgressZone["category"];
const TRADES: Trade[] = ["EXCAVATION", "CONCRETE", "STEEL", "MEP", "FINISHING"];
const TRADE_LABEL: Record<string, string> = { EXCAVATION: "Excavation", CONCRETE: "Concrete", STEEL: "Steel", MEP: "MEP", FINISHING: "Finishing" };

/** Storey × trade map of the activities (codes). */
const RAIL: { b: string; level: string; cells: Partial<Record<Trade, string[]>> }[] = [
  { b: "WH", level: "Roof", cells: { STEEL: ["WH-150", "WH-160"], FINISHING: ["WH-170"] } },
  { b: "WH", level: "Hall", cells: { CONCRETE: ["WH-140", "WH-190", "WH-230"], MEP: ["WH-210", "WH-220"], FINISHING: ["WH-180", "WH-200", "WH-240", "WH-250"] } },
  { b: "WH", level: "Foundations", cells: { EXCAVATION: ["WH-110"], CONCRETE: ["WH-120", "WH-130"], STEEL: ["WH-125"] } },
  { b: "AD", level: "First floor and roof", cells: { CONCRETE: ["AD-150"], MEP: ["AD-220", "AD-230"], FINISHING: ["AD-160", "AD-200", "AD-210", "AD-240"] } },
  { b: "AD", level: "Ground floor", cells: { CONCRETE: ["AD-130", "AD-140"], MEP: ["AD-190"], FINISHING: ["AD-170", "AD-180"] } },
  { b: "AD", level: "Foundations", cells: { EXCAVATION: ["AD-110"], CONCRETE: ["AD-120"], STEEL: ["AD-125"] } },
  { b: "PS", level: "Pump station and tanks", cells: { EXCAVATION: ["PS-110", "TK-110"], CONCRETE: ["TK-120"], MEP: ["PS-120", "PS-130", "TK-130"] } },
  { b: "SITE", level: "External works", cells: { EXCAVATION: ["SW-110"], CONCRETE: ["SW-120"], FINISHING: ["SW-130", "SW-140"] } },
];

export function ProgressPage() {
  const { t, x, d, lang } = useL();
  const activities = useOps((s) => s.activities);
  const [view, setView] = useState<View>("model");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const crit = useCpm();

  const points = useMemo(() => sCurve(activities), [activities]);
  const todayIdx = Math.max(0, points.findIndex((p) => p.date === TODAY));
  const [idx, setIdx] = useState(todayIdx);
  const [playing, setPlaying] = useState(false);
  useEffect(() => setIdx((i) => Math.min(i, points.length - 1)), [points.length]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setIdx((i) => {
        if (i >= points.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 380);
    return () => clearInterval(id);
  }, [playing, points.length]);
  const date = points[idx]?.date ?? TODAY;
  const future = date > TODAY;

  const byCode = useMemo(() => new Map(activities.map((a) => [a.code, a])), [activities]);
  const defaultSel = useMemo(() => {
    const live = activities.filter((a) => a.status === "IN_PROGRESS" || a.status === "BLOCKED");
    return (live.find((a) => a.status === "BLOCKED") ?? live.sort((a, b) => a.pct - plannedPctAt(a, TODAY) - (b.pct - plannedPctAt(b, TODAY)))[0] ?? activities[0])?.id ?? null;
  }, [activities]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusCell, setFocusCell] = useState<string | null>(null);
  const sel = activities.find((a) => a.id === (selected ?? defaultSel));

  const counts = useMemo(() => stateCounts(activities, date), [activities, date]);
  const stats = programmeStats(activities);

  const focus = useMemo(() => {
    if (!focusCell) return null;
    const [ri, tr] = focusCell.split("/") as [string, Trade];
    const codes = RAIL[Number(ri)]?.cells[tr] ?? [];
    return new Set(codes.map((c) => byCode.get(c)?.id).filter(Boolean) as string[]);
  }, [focusCell, byCode]);

  const titleOf = useCallback((a: Activity) => `${a.code} · ${x(a.name)} · ${Math.round(shownPctAt(a, date))}%`, [x, date]);
  const labels = useMemo(() => ({ WH: buildingShort("WH", lang), AD: buildingShort("AD", lang), PS: buildingShort("PS", lang), TK: buildingShort("TK", lang) }), [lang]);
  const onSelect = useCallback((id: string) => setSelected(id), []);

  return (
    <div className="k-page pmc">
      <PageHero
        eyebrow={t("Project management · Site progress")}
        title={t("Site progress")}
        subtitle={t("The site as built, against the plan and the forecast: scrub through time, open any block and see why it is where it is.")}
        flow={["Capture", "Estimate with AI", "Log progress", "Programme and health update"]}
        art="progress"
        actions={
          <Segmented
            label={t("View")}
            value={view}
            onChange={setView}
            options={[
              { value: "model", label: t("Site model") },
              { value: "photos", label: t("Photos") },
              { value: "zones", label: t("Zones") },
            ]}
          />
        }
      />

      {view === "model" ? (
        <>
          <div className="k-grid-main pmc-prog">
            <Panel
              title={t("Site model")}
              icon={<Box size={15} />}
              actions={
                <span className={`pmc-mode ${future ? "future" : "past"}`}>
                  {future ? t("Forecast") : date === TODAY ? t("Today") : t("Planned against actual")} · <b className="num-inline">{d(date)}</b>
                </span>
              }
              pad={false}
            >
              <div className="pmc-model-wrap">
                <SiteModel activities={activities} date={date} selected={sel?.id ?? null} focus={focus} onSelect={onSelect} labels={labels} titleOf={titleOf} />
                <ul className="pmc-model-key">
                  {STATE_ORDER.map((st) => (
                    <li key={st} className={`k-${st}`}>
                      <i className={`sw st-${st}`} aria-hidden="true" />
                      <span>{t(STATE_LABEL[st])}</span>
                      <b className="num-inline">{counts[st]}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pmc-scrub">
                <div className="pmc-scrub-bar">
                  <button type="button" className="icon-btn" onClick={() => (playing ? setPlaying(false) : (idx >= points.length - 1 && setIdx(0), setPlaying(true)))} aria-label={playing ? t("Pause") : t("Play through time")}>
                    {playing ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <input type="range" min={0} max={Math.max(0, points.length - 1)} value={idx} onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} aria-label={t("Date")} className="pmc-scrub-range" style={{ ["--today" as string]: `${(todayIdx / Math.max(1, points.length - 1)) * 100}%` }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPlaying(false); setIdx(todayIdx); }} disabled={idx === todayIdx}>
                    <RotateCcw size={13} />
                    {t("Today")}
                  </button>
                </div>
                <SCurve points={points} today={TODAY} height={150} picked={date !== TODAY ? date : undefined} onPick={(dt) => { setPlaying(false); setIdx(Math.max(0, points.findIndex((p) => p.date === dt))); }} />
                <p className="muted small">
                  {t("Click the curve or drag the slider. Before today the model shows planned against actual; after today it shows the forecast.")} {t("Built {a}% against {b}% planned today.", { a: Math.round(stats.actualPct * 100), b: Math.round(stats.plannedPct * 100) })}
                </p>
              </div>
            </Panel>

            {sel ? <Passport a={sel} critical={!!crit.get(sel.id)?.critical} /> : null}
          </div>

          <Panel
            title={t("Level rail")}
            icon={<Grid3x3 size={15} />}
            sub={t("Each square fills from the bottom as work is done; red where it is behind plan. Click a square to light it up on the model.")}
            actions={focusCell ? <button type="button" className="k-link-btn" onClick={() => setFocusCell(null)}>{t("Show everything")}</button> : null}
          >
            <div className="pmc-rail-wrap">
              <table className="pmc-rail">
                <thead>
                  <tr>
                    <th />
                    {TRADES.map((tr) => (
                      <th key={tr}>{t(TRADE_LABEL[tr]!)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RAIL.map((row, ri) => (
                    <tr key={ri} className={ri > 0 && RAIL[ri - 1]!.b !== row.b ? "gap" : undefined}>
                      <th>
                        <strong>{buildingShort(row.b, lang)}</strong>
                        <small>{t(row.level)}</small>
                      </th>
                      {TRADES.map((tr) => {
                        const acts = (row.cells[tr] ?? []).map((c) => byCode.get(c)).filter(Boolean) as Activity[];
                        if (!acts.length)
                          return (
                            <td key={tr}>
                              <span className="pmc-sqr empty" aria-hidden="true" />
                            </td>
                          );
                        const g = groupPct(acts, date);
                        const behind = g.actual < g.plan - 3;
                        const key = `${ri}/${tr}`;
                        const on = focusCell === key;
                        return (
                          <td key={tr}>
                            <button
                              type="button"
                              className={`pmc-sqr${behind ? " behind" : ""}${on ? " on" : ""}${g.actual >= 99.5 ? " full" : ""}`}
                              title={`${acts.map((a) => a.code).join(", ")} · ${Math.round(g.actual)}% / ${t("plan")} ${Math.round(g.plan)}%`}
                              onClick={() => {
                                setFocusCell(on ? null : key);
                                setSelected((acts.find((a) => a.status === "IN_PROGRESS" || a.status === "BLOCKED") ?? acts[0]!).id);
                              }}
                            >
                              <i style={{ height: `${g.actual}%` }} />
                              {g.plan > 0 && g.plan < 100 ? <b style={{ bottom: `${g.plan}%` }} /> : null}
                              <span className="num-inline">{Math.round(g.actual)}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}

      {view === "photos" ? <PhotosView zoneId={zoneId} onZone={setZoneId} /> : null}
      {view === "zones" ? (
        <ZonesView
          onOpen={(id) => {
            setZoneId(id);
            setView("photos");
          }}
        />
      ) : null}
    </div>
  );
}

/** Status / Why / Fix for one activity: dial, finish line, material not on site and open blockers. */
function Passport({ a, critical }: { a: Activity; critical: boolean }) {
  const { t, x, d } = useL();
  const delays = useOps((s) => s.delays);
  const impacts = useOps((s) => s.impacts);
  const rfis = useOps((s) => s.rfis);
  const inspections = useOps((s) => s.inspections);
  const mrs = useOps((s) => s.mrs);
  const pos = useOps((s) => s.pos);
  const subs = useOps((s) => s.subs);

  const plan = Math.round(plannedPctAt(a, TODAY));
  const gap = a.pct - plan;
  const myDelays = delays.filter((dl) => dl.activityId === a.id && isOpenDelay(dl));
  const myImpacts = impacts.filter((i) => i.activityId === a.id && (i.status === "REPORTED" || i.status === "UNDER_REVIEW" || i.status === "CONFIRMED"));
  const myRfis = rfis.filter((r) => r.activityId === a.id && r.status === "OPEN");
  const myNcrs = inspections.filter((i) => i.activityId === a.id && i.kind === "NCR" && i.status === "OPEN");
  const myMrs = mrs.filter((m) => m.activityId === a.id);
  const openPos = pos.filter((p) => (p.status === "ISSUED" || p.status === "PART_RECEIVED") && myMrs.some((m) => m.id === p.mrId));
  const unordered = myMrs.filter((m) => (m.status === "SUBMITTED" || m.status === "SOURCING" || m.status === "DRAFT") && !pos.some((p) => p.mrId === m.id));

  const why = a.blockedReason
    ? x(a.blockedReason)
    : myDelays[0]
      ? x(myDelays[0].title)
      : myImpacts[0]
        ? x(myImpacts[0].text)
        : openPos.some(poLate)
          ? t("Material on order is late to site.")
          : gap < -3
            ? t("Output on site is below the planned rate.")
            : a.status === "NOT_STARTED"
              ? t("Not started yet; nothing holds it back today.")
              : t("Running to plan.");
  const fix = myRfis[0]
    ? { text: t("Get {ref} answered", { ref: myRfis[0].ref }), to: R.rfi(myRfis[0].id) }
    : openPos[0]
      ? { text: t("Chase {ref} with the vendor", { ref: openPos[0].ref }), to: R.order(openPos[0].id) }
      : myDelays[0]
        ? { text: t("Look at recovery options"), to: R.recovery }
        : myNcrs[0]
          ? { text: t("Close {ref}", { ref: myNcrs[0].ref }), to: R.inspection(myNcrs[0].id) }
          : gap < -3
            ? { text: t("Add crew or hours on {code}", { code: a.code }), to: R.aiScheduling }
            : { text: t("Open in the programme"), to: R.programme(a.id) };

  // finish line
  const from = minDate(a.start, a.bStart);
  const to = addDays(maxDate(a.end, a.bEnd, TODAY), 4);
  const span = Math.max(1, diffDays(from, to));
  const L = (dt: string) => `${Math.max(0, Math.min(100, (diffDays(from, dt) / span) * 100))}%`;
  const marks = [
    { k: "start", label: t("Start"), date: a.aStart ?? a.start },
    { k: "today", label: t("Today"), date: TODAY },
    { k: "contract", label: t("Contract"), date: a.bEnd },
    { k: "forecast", label: t("Forecast"), date: a.end },
  ];

  const r1 = 46;
  const r2 = 34;
  const arc = (r: number, v: number) => {
    const c = 2 * Math.PI * r;
    return { strokeDasharray: c, strokeDashoffset: c * (1 - Math.max(0, Math.min(100, v)) / 100) };
  };

  const blockers = [
    ...myDelays.map((dl) => ({ key: dl.id, tone: "bad" as const, text: x(dl.title), ref: dl.ref, to: R.delays })),
    ...myImpacts.map((i) => ({ key: i.id, tone: "warn" as const, text: x(i.text), ref: i.id, to: R.live })),
    ...myRfis.map((r) => ({ key: r.id, tone: "warn" as const, text: x(r.subject), ref: r.ref, to: R.rfi(r.id) })),
    ...myNcrs.map((n) => ({ key: n.id, tone: "bad" as const, text: x(n.title), ref: n.ref, to: R.inspection(n.id) })),
  ];

  return (
    <Panel className="pmc-passport" title={t("Passport")} icon={<Stethoscope size={15} />} actions={<Link className="k-link-btn" to={R.programme(a.id)}>{t("Programme")} <ArrowRight size={13} /></Link>}>
      <div className="pmc-pass-head">
        <span className="k-ref">{a.code}</span>
        <StatusBadge kind="activity" status={a.status} />
        {critical ? <Badge tone="bad">{t("Critical")}</Badge> : null}
      </div>
      <h3 className="pmc-pass-title">{x(a.name)}</h3>

      <div className="pmc-pass-dial">
        <svg viewBox="0 0 110 110" width={110} height={110} aria-hidden="true">
          <circle cx={55} cy={55} r={r1} className="pmc-dial-track" />
          <circle cx={55} cy={55} r={r1} className="pmc-dial-plan" style={arc(r1, plan)} transform="rotate(-90 55 55)" />
          <circle cx={55} cy={55} r={r2} className="pmc-dial-track" />
          <circle cx={55} cy={55} r={r2} className={`pmc-dial-act${gap < -3 ? " behind" : ""}`} style={arc(r2, a.pct)} transform="rotate(-90 55 55)" />
          <text x={55} y={58} textAnchor="middle" className="pmc-dial-num">{a.pct}%</text>
          <text x={55} y={72} textAnchor="middle" className="pmc-dial-sub">{t("built")}</text>
        </svg>
        <dl className="pmc-pass-swy">
          <div>
            <dt>{t("Status")}</dt>
            <dd>
              {t("{a}% built against {b}% planned", { a: a.pct, b: plan })} <b className={gap < -3 ? "k-text-bad" : gap > 3 ? "k-text-brand" : "k-text-ok"}>({gap > 0 ? `+${gap}` : gap})</b>
            </dd>
          </div>
          <div>
            <dt>{t("Why")}</dt>
            <dd>{why}</dd>
          </div>
          <div>
            <dt>{t("Fix")}</dt>
            <dd>
              <Link to={fix.to} className="k-link-btn">
                {fix.text} <ArrowRight size={12} />
              </Link>
            </dd>
          </div>
        </dl>
      </div>

      <div className="pmc-fline">
        <span className="pmc-fline-track">
          <i style={{ left: L(a.start), width: `calc(${L(a.end)} - ${L(a.start)})` }} className="cur" />
          <i style={{ left: L(a.bStart), width: `calc(${L(a.bEnd)} - ${L(a.bStart)})` }} className="base" />
        </span>
        {marks.map((m, i) => (
          <span key={m.k} className={`pmc-fline-mark ${m.k}`} style={{ left: L(m.date), ["--row" as string]: i % 2 }}>
            <b>{m.label}</b>
            <small>{d(m.date, false)}</small>
          </span>
        ))}
      </div>

      <section className="pmc-pass-sec">
        <h4>
          <Package size={13} /> {t("Material not on site")}
        </h4>
        {openPos.length || unordered.length ? (
          <ul>
            {openPos.map((p) => (
              <li key={p.id}>
                <Link to={R.order(p.id)} className="k-ref">{p.ref}</Link>
                <span className="truncate">{x(p.lines[0]?.description)}</span>
                <small className={poLate(p) ? "k-text-bad" : undefined}>{poLate(p) ? t("late since {date}", { date: d(p.expectedAt, false) }) : t("due {date}", { date: d(p.expectedAt, false) })}</small>
              </li>
            ))}
            {unordered.map((m) => (
              <li key={m.id}>
                <Link to={R.request(m.id)} className="k-ref">{m.ref}</Link>
                <span className="truncate">{x(m.title)}</span>
                <small className="k-text-warn">{t("not ordered yet")}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{t("Everything needed is on site or not needed yet.")}</p>
        )}
      </section>

      <section className="pmc-pass-sec">
        <h4>
          <AlertOctagon size={13} /> {t("Open blockers")}
        </h4>
        {blockers.length ? (
          <ul>
            {blockers.map((b) => (
              <li key={b.key}>
                <Link to={b.to} className={`k-ref k-text-${b.tone}`}>{b.ref}</Link>
                <span className="truncate">{b.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{t("Nothing is blocking this work.")}</p>
        )}
      </section>
      <p className="pmc-pass-foot muted small">
        <Wrench size={12} /> {subs.find((v) => v.id === a.owner)?.name ?? a.owner} · {t("{n} crew", { n: a.crew })}
      </p>
    </Panel>
  );
}


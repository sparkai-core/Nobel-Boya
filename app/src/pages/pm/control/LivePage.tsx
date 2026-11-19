import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarRange, Check, CheckCheck, CloudRain, Hourglass, Layers, Send, Users, Wrench, X as XIcon } from "lucide-react";
import { Badge, Empty, Field, PageHero, Panel, Register, StatusBadge, toast, useL, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, maxDate, monthShort, PROJECT_FINISH, PROJECT_START, same, toDate, TODAY } from "../../../ops/dates";
import { programmeStats, R } from "../../../ops/select";
import type { ImpactKind, LiveImpact, Weather } from "../../../ops/types";
import { IMPACT_LABEL, signed, useCpm, useFloat } from "./shared";

const KIND_ICON: Record<ImpactKind, typeof Hourglass> = { TASK_DELAY: Hourglass, MANPOWER_SHORTAGE: Users, WEATHER_IMPACT: CloudRain, EQUIPMENT_FAILURE: Wrench };
const KIND_HINT: Record<ImpactKind, string> = {
  TASK_DELAY: "Work stopped or ran slow",
  MANPOWER_SHORTAGE: "Fewer people than planned",
  WEATHER_IMPACT: "Rain, wind or heat",
  EQUIPMENT_FAILURE: "Plant out of service",
};
const OPEN_IMPACT: LiveImpact["status"][] = ["REPORTED", "UNDER_REVIEW", "CONFIRMED"];
const WEATHERS: Weather[] = ["SUNNY", "CLOUDY", "RAIN", "WIND"];
const WEATHER_LABEL: Record<Weather, string> = { SUNNY: "Sunny", CLOUDY: "Cloudy", RAIN: "Rain", WIND: "Wind" };

export function LivePage() {
  const { t, x, d, lang } = useL();
  const activities = useOps((s) => s.activities);
  const impacts = useOps((s) => s.impacts);
  const addImpact = useOps((s) => s.addImpact);
  const updateImpact = useOps((s) => s.updateImpact);
  const acceptImpacts = useOps((s) => s.acceptImpacts);
  const crit = useCpm();
  const floatOf = useFloat();

  const hasActs = activities.length > 0;
  const contractSet = useOps((s) => !!s.setup.contractFinish);
  const stats = programmeStats(activities);
  const baselineFinish = activities.reduce((a, v) => maxDate(a, v.bEnd), PROJECT_START);
  const overrun = (i: LiveImpact) => Math.max(0, i.daysImpact - floatOf(i.activityId));
  const open = impacts.filter((i) => OPEN_IMPACT.includes(i.status));
  const pending = open.reduce((a, i) => a + overrun(i), 0);
  const forecastFinish = addDays(stats.forecastFinish, pending);
  const confirmed = impacts.filter((i) => i.status === "CONFIRMED");
  const act = (id: string) => activities.find((a) => a.id === id);

  // ---------------------------------------------------------------- layers calendar
  const axisEnd = addDays(maxDate(forecastFinish, PROJECT_FINISH, baselineFinish), 20);
  const span = Math.max(1, diffDays(PROJECT_START, axisEnd));
  const X = (date: string) => (diffDays(PROJECT_START, date) / span) * 100;
  const months = useMemo(() => {
    const out: { iso: string; label: string }[] = [];
    const s = toDate(PROJECT_START);
    let y = s.getUTCFullYear();
    let m = s.getUTCMonth() + 1;
    for (;;) {
      if (m > 11) {
        m = 0;
        y++;
      }
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      if (iso > axisEnd) break;
      out.push({ iso, label: `${monthShort(m, lang)}${m === 0 ? ` ${String(y).slice(2)}` : ""}` });
      m++;
    }
    return out;
  }, [axisEnd, lang]);

  const layers: { key: string; label: string; end: string; cls: string; note: string }[] = [
    { key: "base", label: t("Baseline"), end: baselineFinish, cls: "base", note: t("as first planned") },
    { key: "contract", label: t("Contract target"), end: PROJECT_FINISH, cls: "contract", note: contractSet ? t("the date we signed for") : t("not set: the latest activity finish is used") },
    { key: "current", label: t("Current programme"), end: stats.forecastFinish, cls: "current", note: t("{n} d vs contract", { n: signed(diffDays(PROJECT_FINISH, stats.forecastFinish)) }) },
    { key: "forecast", label: t("Forecast"), end: forecastFinish, cls: "forecast", note: pending ? t("+{n} d from open site impacts", { n: pending }) : t("no open impacts") },
  ];

  // ---------------------------------------------------------------- report form
  const choices = useMemo(() => activities.filter((a) => a.status !== "COMPLETED").sort((a, b) => (a.status === "NOT_STARTED" ? 1 : 0) - (b.status === "NOT_STARTED" ? 1 : 0) || a.start.localeCompare(b.start)), [activities]);
  const [kind, setKind] = useState<ImpactKind>("TASK_DELAY");
  const [activityId, setActivityId] = useState(() => choices.find((a) => a.status === "IN_PROGRESS")?.id ?? choices[0]?.id ?? "");
  useEffect(() => {
    if (!choices.some((c) => c.id === activityId) && choices[0]) setActivityId(choices[0].id);
  }, [choices, activityId]);
  const [startedAt, setStartedAt] = useState(TODAY);
  const [text, setText] = useState("");
  const [lost, setLost] = useState(1);
  const [crewPlanned, setCrewPlanned] = useState(() => Math.max(1, act(activityId)?.crew ?? 1));
  const [crewOnSite, setCrewOnSite] = useState(() => Math.max(0, act(activityId)?.crew ?? 0));
  const [windowDays, setWindowDays] = useState(5);
  const [hours, setHours] = useState(8);
  const [wxForecast, setWxForecast] = useState<Weather>("CLOUDY");
  const [wxRecorded, setWxRecorded] = useState<Weather>("RAIN");
  const [outDays, setOutDays] = useState(3);
  const [replacement, setReplacement] = useState(true);
  const [mobDays, setMobDays] = useState(1);
  const [tried, setTried] = useState(false);

  const days =
    kind === "TASK_DELAY"
      ? Math.max(0, lost)
      : kind === "MANPOWER_SHORTAGE"
        ? Math.ceil(Math.max(0, windowDays) * Math.max(0, 1 - crewOnSite / Math.max(1, crewPlanned)))
        : kind === "WEATHER_IMPACT"
          ? Math.ceil(Math.max(0, hours) / 8)
          : replacement
            ? Math.min(outDays, mobDays)
            : outDays;
  const sel = act(activityId);
  const selFloat = floatOf(activityId);

  const submit = () => {
    setTried(true);
    if (!activityId || days <= 0) return;
    const auto =
      kind === "MANPOWER_SHORTAGE"
        ? `${crewOnSite} / ${crewPlanned} ${t("crew on site")}`
        : kind === "WEATHER_IMPACT"
          ? `${t(WEATHER_LABEL[wxRecorded])}: ${hours} ${t("hours lost")}`
          : kind === "EQUIPMENT_FAILURE"
            ? `${t("Out of service")} ${outDays} ${t("days")}`
            : t(IMPACT_LABEL[kind]);
    const id = addImpact({
      kind,
      activityId,
      startedAt,
      text: same(text.trim() || `${sel?.code ?? ""} · ${auto}`),
      daysImpact: days,
      crewPlanned: kind === "MANPOWER_SHORTAGE" ? crewPlanned : null,
      crewOnSite: kind === "MANPOWER_SHORTAGE" ? crewOnSite : null,
      hoursLost: kind === "WEATHER_IMPACT" ? hours : null,
    });
    toast(t("{id} reported: {n} days on {code}", { id, n: days, code: sel?.code ?? "" }), "warn");
    setText("");
    setTried(false);
  };

  const pickActivity = (id: string) => {
    setActivityId(id);
    const a = act(id);
    if (a) {
      setCrewPlanned(Math.max(1, a.crew));
      setCrewOnSite(Math.max(0, a.crew));
    }
  };

  const setStatus = (i: LiveImpact, status: LiveImpact["status"], msg: string) => {
    updateImpact(i.id, { status });
    toast(msg, status === "REJECTED" ? "muted" : "ok");
  };

  const columns: Column<LiveImpact>[] = [
    {
      key: "kind",
      header: t("What happened"),
      sort: (i) => i.kind,
      render: (i) => {
        const Icon = KIND_ICON[i.kind];
        return (
          <div className="pmc-imp-what">
            <span className={`pmc-imp-icon k-tone-${i.kind === "EQUIPMENT_FAILURE" ? "bad" : i.kind === "WEATHER_IMPACT" ? "info" : "warn"}`}>
              <Icon size={15} />
            </span>
            <div className="k-cell-title">
              <strong>{x(i.text)}</strong>
              <small>
                {i.id} · {t(IMPACT_LABEL[i.kind])}
                {i.crewPlanned ? ` · ${i.crewOnSite}/${i.crewPlanned} ${t("crew")}` : ""}
                {i.hoursLost ? ` · ${i.hoursLost} ${t("h lost")}` : ""}
              </small>
            </div>
          </div>
        );
      },
    },
    {
      key: "act",
      header: t("Activity"),
      sort: (i) => act(i.activityId)?.code ?? "",
      render: (i) => {
        const a = act(i.activityId);
        return a ? (
          <Link className="pmc-code" to={R.programme(a.id)} onClick={(e) => e.stopPropagation()} title={x(a.name)}>
            {a.code}
            {crit.get(a.id)?.critical ? <i className="pmc-crit-dot" title={t("On the critical path")} /> : null}
          </Link>
        ) : (
          "—"
        );
      },
    },
    { key: "start", header: t("Started"), sort: (i) => i.startedAt, hideBelow: 900, render: (i) => <span className="num-inline">{d(i.startedAt)}</span> },
    {
      key: "days",
      header: t("Days of impact"),
      align: "right",
      sort: (i) => i.daysImpact,
      render: (i) => (
        <span className="k-cell-title" style={{ justifyItems: "end" }}>
          <b className="num-inline">{i.daysImpact}</b>
          <small className={overrun(i) ? "k-text-bad" : "k-text-ok"}>{overrun(i) ? t("+{n} d on the finish", { n: overrun(i) }) : t("float covers it")}</small>
        </span>
      ),
    },
    { key: "status", header: t("Status"), sort: (i) => i.status, render: (i) => <StatusBadge kind="impact" status={i.status} /> },
    {
      key: "next",
      header: t("Next step"),
      align: "right",
      render: (i) => (
        <span className="pmc-imp-next" onClick={(e) => e.stopPropagation()}>
          {i.status === "REPORTED" || i.status === "UNDER_REVIEW" ? (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(i, "CONFIRMED", t("{id} confirmed. It waits for the planner.", { id: i.id }))}>
                <Check size={13} />
                {t("Confirm")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(i, "REJECTED", t("{id} rejected", { id: i.id }))}>
                <XIcon size={13} />
                {t("Reject")}
              </button>
            </>
          ) : i.status === "CONFIRMED" ? (
            <span className="muted small">{t("Waiting for the planner")}</span>
          ) : i.status === "MITIGATED" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(i, "RESOLVED", t("{id} marked resolved", { id: i.id }))}>
              <CheckCheck size={13} />
              {t("Mark resolved")}
            </button>
          ) : (
            <span className="muted small">—</span>
          )}
        </span>
      ),
    },
  ];

  const hint = (k: string) => <span className="muted small">{k}</span>;

  return (
    <div className="k-page pmc">
      <PageHero
        eyebrow={t("Project management · Live programme")}
        title={t("Live programme")}
        subtitle={t("What the site reports today, set against the baseline, the contract and the current programme, before the planner accepts it.")}
        flow={["Site reports", "Confirm", "Planner accepts", "Programme moves"]}
        art="live"
      />

      <Panel title={t("Four layers of the finish date")} icon={<Layers size={15} />} sub={t("Each bar runs from the project start. Pins mark impacts reported from site.")}>
        {!hasActs ? (
          <Empty
            icon={<CalendarRange size={20} />}
            title={t("No programme yet")}
            action={
              <Link to={R.programme()} className="btn btn-primary">
                {t("Open the programme")}
              </Link>
            }
          >
            {t("The finish dates come from the programme activities. Add activities or import a P6 / MS Project file first.")}
          </Empty>
        ) : (
        <div className="pmc-layers">
          <div className="pmc-layers-scale">
            {months.map((m) => (
              <span key={m.iso} style={{ left: `${X(m.iso)}%` }}>{m.label}</span>
            ))}
          </div>
          <div className="pmc-layers-body">
            {months.map((m) => (
              <i key={m.iso} className="pmc-layers-grid" style={{ left: `${X(m.iso)}%` }} />
            ))}
            <b className="pmc-layers-today" style={{ left: `${X(TODAY)}%` }}>
              <span>{t("Today")}</span>
            </b>
            <div className="pmc-layers-pins">
              {impacts.filter((i) => i.status !== "REJECTED").map((i) => {
                const Icon = KIND_ICON[i.kind];
                return (
                  <span key={i.id} className={`pmc-pin s-${i.status.toLowerCase()}`} style={{ left: `${X(i.startedAt)}%` }} title={`${i.id} · ${x(i.text)} · ${t("{n} d", { n: i.daysImpact })}`}>
                    <Icon size={11} />
                  </span>
                );
              })}
            </div>
            {layers.map((l, i) => (
              <div key={l.key} className={`pmc-layer ${l.cls}`}>
                <span className="pmc-layer-name">
                  <strong>{l.label}</strong>
                  <small>{l.note}</small>
                </span>
                <span className="pmc-layer-track">
                  <i className="k-grow-x" style={{ width: `${X(l.end)}%`, animationDelay: `${i * 90}ms` }} />
                  {l.key === "forecast" && pending ? <em style={{ left: `${X(stats.forecastFinish)}%`, width: `${X(forecastFinish) - X(stats.forecastFinish)}%` }} /> : null}
                  <b className="num-inline" style={{ left: `${X(l.end)}%` }}>{d(l.end)}</b>
                </span>
              </div>
            ))}
            <i className="pmc-layers-contract" style={{ left: `${X(PROJECT_FINISH)}%` }} />
          </div>
        </div>
        )}
      </Panel>

      <div className="k-grid-main">
        <Panel title={t("Something happened on site")} icon={<AlertTriangle size={15} />} sub={t("Report it now. The planner confirms it before the programme moves.")}>
          <div className="pmc-kinds" role="radiogroup" aria-label={t("Kind of impact")}>
            {(Object.keys(KIND_ICON) as ImpactKind[]).map((k) => {
              const Icon = KIND_ICON[k];
              return (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className={`pmc-kind${kind === k ? " on" : ""}`} onClick={() => setKind(k)}>
                  <span className="pmc-kind-icon">
                    <Icon size={20} />
                  </span>
                  <strong>{t(IMPACT_LABEL[k])}</strong>
                  <small>{t(KIND_HINT[k])}</small>
                </button>
              );
            })}
          </div>
          {!choices.length ? (
            <p className="k-note" style={{ marginTop: 16 }}>
              {t("An impact is reported against an open activity of the programme. There is none yet.")}{" "}
              <Link to={R.programme()} className="k-link-btn">
                {t("Open the programme")}
              </Link>
            </p>
          ) : null}
          <div className="k-form" style={{ marginTop: 16 }}>
            <Field label={t("Activity")} hint={sel ? (crit.get(sel.id)?.critical ? t("On the critical path") : t("{n} days of float today", { n: selFloat })) : undefined}>
              <select className="input select" value={activityId} onChange={(e) => pickActivity(e.target.value)}>
                {choices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {x(a.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Day it started")}>
              <input className="input" type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value || TODAY)} />
            </Field>
            <Field label={t("What happened")} wide>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("One line the planner can act on")} />
            </Field>
            {kind === "TASK_DELAY" ? (
              <Field label={t("Working days lost")}>
                <input className="input num-inline" type="number" min={0} value={lost} onChange={(e) => setLost(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
              </Field>
            ) : null}
            {kind === "MANPOWER_SHORTAGE" ? (
              <>
                <Field label={t("Crew planned")}>
                  <input className="input num-inline" type="number" min={1} value={crewPlanned} onChange={(e) => setCrewPlanned(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
                </Field>
                <Field label={t("Crew on site")}>
                  <input className="input num-inline" type="number" min={0} value={crewOnSite} onChange={(e) => setCrewOnSite(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
                </Field>
                <Field label={t("For how many working days")}>
                  <input className="input num-inline" type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
                </Field>
              </>
            ) : null}
            {kind === "WEATHER_IMPACT" ? (
              <>
                <Field label={t("Hours lost")}>
                  <input className="input num-inline" type="number" min={0} step={1} value={hours} onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))} />
                </Field>
                <Field label={t("Forecast weather")}>
                  <select className="input select" value={wxForecast} onChange={(e) => setWxForecast(e.target.value as Weather)}>
                    {WEATHERS.map((w) => (
                      <option key={w} value={w}>{t(WEATHER_LABEL[w])}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Recorded on site")} hint={wxForecast !== wxRecorded ? t("Not in the forecast: note it for an extension of time.") : t("Matches the forecast.")}>
                  <select className="input select" value={wxRecorded} onChange={(e) => setWxRecorded(e.target.value as Weather)}>
                    {WEATHERS.map((w) => (
                      <option key={w} value={w}>{t(WEATHER_LABEL[w])}</option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}
            {kind === "EQUIPMENT_FAILURE" ? (
              <>
                <Field label={t("Out of service (days)")}>
                  <input className="input num-inline" type="number" min={0} value={outDays} onChange={(e) => setOutDays(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
                </Field>
                <Field label={t("Replacement available")}>
                  <label className="pmc-check">
                    <input type="checkbox" checked={replacement} onChange={(e) => setReplacement(e.target.checked)} />
                    {replacement ? t("Yes, a hire unit can come") : t("No replacement")}
                  </label>
                </Field>
                {replacement ? (
                  <Field label={t("Mobilisation days")}>
                    <input className="input num-inline" type="number" min={0} value={mobDays} onChange={(e) => setMobDays(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
                  </Field>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="pmc-computed">
            <span>
              <small>{t("Days of impact")}</small>
              <b className="num-inline">{days}</b>
            </span>
            <span>
              <small>{t("Float on this activity")}</small>
              <b className="num-inline">{selFloat}</b>
            </span>
            <span className={days > selFloat ? "bad" : "ok"}>
              <small>{t("Effect on the finish")}</small>
              <b className="num-inline">{days > selFloat ? t("+{n} d", { n: days - selFloat }) : t("none")}</b>
            </span>
            <span className="k-spacer" />
            <button type="button" className="btn btn-primary" onClick={submit} disabled={!activityId || !act(activityId)}>
              <Send size={15} />
              {t("Report impact")}
            </button>
          </div>
          {tried && days <= 0 ? <p className="k-field-error">{t("The impact must be at least one day.")}</p> : null}
        </Panel>

        <div className="k-stack">
          <div className={`k-callout k-tone-${!hasActs ? "info" : pending || stats.varianceDays > 0 ? "bad" : "ok"} pmc-finish`}>
            <CalendarRange size={18} />
            <div>
              <strong>{t("Where the finish date stands")}</strong>
              <p>
                {!hasActs ? (
                  t("No programme yet, so there is no finish date to report.")
                ) : (
                  <>
                    {t("The current programme finishes on {date}, {n} days against the contract date.", { date: d(stats.forecastFinish), n: signed(stats.varianceDays) })}{" "}
                    {pending ? t("Open site impacts could add {n} more days, to {date}.", { n: pending, date: d(forecastFinish) }) : t("No open site impact reaches the finish.")}
                  </>
                )}
              </p>
            </div>
          </div>

          <Panel title={t("Planner decision")} icon={<CheckCheck size={15} />} count={confirmed.length}>
            {confirmed.length ? (
              <>
                <ul className="pmc-decide">
                  {confirmed.map((i) => (
                    <li key={i.id}>
                      <span className="k-ref">{i.id}</span>
                      <span className="truncate">{x(i.text)}</span>
                      <b className="num-inline">{t("+{n} d", { n: i.daysImpact })}</b>
                    </li>
                  ))}
                </ul>
                <p className="muted small">{t("Accepting moves the end of each activity by its impact. The impacts then show as in the programme.")}</p>
              </>
            ) : (
              hint(t("Nothing confirmed yet. Confirm an impact in the register below first."))
            )}
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 12, width: "100%" }}
              disabled={!confirmed.length}
              onClick={() => {
                const n = confirmed.length;
                acceptImpacts();
                toast(t("{n} impacts accepted into the programme", { n }));
              }}
            >
              {t("Accept confirmed impacts into the programme")}
            </button>
          </Panel>

          <Panel title={t("Impact days by kind")} pad>
            <KindTally impacts={impacts} />
          </Panel>
        </div>
      </div>

      <Register
        rows={impacts}
        columns={columns}
        rowKey={(i) => i.id}
        initialSort={{ key: "start", dir: "desc" }}
        toolbar={
          <div className="k-row">
            <strong>{t("Impact register")}</strong>
            <Badge tone="warn">{t("{n} open", { n: open.length })}</Badge>
          </div>
        }
        empty={t("No site impacts reported.")}
      />
    </div>
  );
}

function KindTally({ impacts }: { impacts: LiveImpact[] }) {
  const { t } = useL();
  const rows: { k: ImpactKind; n: number; days: number }[] = (Object.keys(KIND_ICON) as ImpactKind[]).map((k) => ({ k, n: impacts.filter((i) => i.kind === k).length, days: impacts.filter((i) => i.kind === k && i.status !== "REJECTED").reduce((a, i) => a + i.daysImpact, 0) }));
  const max = Math.max(1, ...rows.map((r) => r.days));
  const out: ReactNode[] = rows.map((r) => {
    const Icon = KIND_ICON[r.k];
    return (
      <li key={r.k}>
        <Icon size={14} />
        <span>{t(IMPACT_LABEL[r.k])}</span>
        <span className="pmc-tally-bar"><i className="k-grow-x" style={{ width: `${(r.days / max) * 100}%` }} /></span>
        <b className="num-inline">{t("{n} d", { n: r.days })}</b>
      </li>
    );
  });
  return <ul className="pmc-tally">{out}</ul>;
}

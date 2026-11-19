import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity as Pulse, Megaphone, Plus, ShieldAlert, ShieldCheck, Ticket } from "lucide-react";
import { CountUp, PageHero, StatTiles, TabBar, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, PROJECT_START, TODAY } from "../../../ops/dates";
import type { Incident } from "../../../ops/types";
import { INCIDENT_KIND, isRestDay, WEEK } from "./shared";
import { IncidentsTab } from "./SafetyIncidents";
import { permitStatus, PermitsTab } from "./SafetyPermits";
import { AuditsTab, ToolboxTab } from "./SafetyMore";

type Tab = "incidents" | "permits" | "toolbox" | "audits";
const TABS: Tab[] = ["incidents", "permits", "toolbox", "audits"];
const KIND_TONE: Record<Incident["kind"], string> = { LOST_TIME: "bad", FIRST_AID: "warn", NEAR_MISS: "info", PROPERTY: "warn", ENVIRONMENT: "warn" };
const KIND_RANK: Incident["kind"][] = ["LOST_TIME", "FIRST_AID", "PROPERTY", "ENVIRONMENT", "NEAR_MISS"];
/** Hours counted for the incident rate: a present day is 8 hours, a half day 4. */
const SAFETY_HOURS = { PRESENT: 8, HALF: 4 } as Record<string, number>;

/**
 * Safety / HSE: days without a lost-time injury drawn as a day strip, the HSE figures, then incidents,
 * permits to work, toolbox talks and the weekly site walk.
 */
export function SafetyPage() {
  const { t, x, d } = useL();
  const incidents = useOps((s) => s.incidents);
  const permits = useOps((s) => s.permits);
  const toolbox = useOps((s) => s.toolbox);
  const attendance = useOps((s) => s.attendance);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "incidents";
  const setTab = (v: Tab) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("tab", v);
        return n;
      },
      { replace: true },
    );
  const [logInc, setLogInc] = useState(false);
  const [newPermit, setNewPermit] = useState(false);
  const [logTalk, setLogTalk] = useState(false);

  // ------------------------------------------------------------ figures
  const lastLti = incidents.filter((i) => i.kind === "LOST_TIME").map((i) => i.date).sort().pop() ?? null;
  // Count from the last lost-time injury, else from the first day on site: the project start once it has
  // passed, or the first attendance or incident on record. Nothing to count from means "—".
  const firstRecord = [...attendance.map((a) => a.date), ...incidents.map((i) => i.date)].filter((v) => v <= TODAY).sort()[0] ?? null;
  const countFrom = lastLti ?? (PROJECT_START < TODAY ? PROJECT_START : firstRecord);
  const safeDays = countFrom ? Math.max(0, diffDays(countFrom, TODAY)) : null;
  const hours = useMemo(() => attendance.reduce((a, r) => a + (SAFETY_HOURS[r.status] ?? 0), 0), [attendance]);
  const recordable = incidents.filter((i) => i.kind === "LOST_TIME").length;
  const trir = hours ? (recordable * 200_000) / hours : null;
  const open = incidents.filter((i) => i.status !== "CLOSED");
  const active = permits.filter((p) => permitStatus(p) === "ACTIVE");
  const suspended = permits.filter((p) => p.status === "SUSPENDED");
  const talks = toolbox.filter((k) => WEEK.includes(k.date));

  const days = useMemo(() => {
    const out: { day: string; worst: Incident | null; n: number }[] = [];
    const from = PROJECT_START < TODAY ? PROJECT_START : firstRecord;
    if (!from) return out;
    for (let day = from; day <= TODAY; day = addDays(day, 1)) {
      const list = incidents.filter((i) => i.date === day).sort((a, b) => KIND_RANK.indexOf(a.kind) - KIND_RANK.indexOf(b.kind));
      out.push({ day, worst: list[0] ?? null, n: list.length });
    }
    return out;
  }, [incidents, firstRecord]);

  const newAction =
    tab === "permits" ? (
      <button type="button" className="btn btn-primary" onClick={() => setNewPermit(true)}>
        <Plus size={15} />
        {t("New permit")}
      </button>
    ) : tab === "toolbox" ? (
      <button type="button" className="btn btn-primary" onClick={() => setLogTalk(true)}>
        <Plus size={15} />
        {t("Log toolbox talk")}
      </button>
    ) : (
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          setTab("incidents");
          setLogInc(true);
        }}
      >
        <Plus size={15} />
        {t("Log incident")}
      </button>
    );

  return (
    <div className="k-page st-page">
      <PageHero
        eyebrow={t("Site · Safety")}
        title={t("Safety and HSE")}
        subtitle={t("Incidents and their investigations, permits to work, toolbox talks and the weekly site walk.")}
        flow={["Permit", "Brief", "Watch the site", "Report", "Close out"]}
        art="inspection"
        actions={
          <>{newAction}</>
        }
      />

      <section className="st-pulse k-rise" aria-label={t("Days since the project started")}>
        <div className="st-pulse-fig">
          <span className="k-eyebrow">
            <ShieldCheck size={13} /> {t("Days without a lost-time injury")}
          </span>
          <strong className="num-inline">{safeDays == null ? "—" : <CountUp value={safeDays} />}</strong>
          <small>
            {lastLti
              ? t("Last one on {date}", { date: d(lastLti) })
              : countFrom
                ? t("None recorded since {date}", { date: d(countFrom) })
                : t("Counting starts with the first day on site: take a roll call or set the planned start.")}
          </small>
        </div>
        {days.length ? (
        <>
        <div className="st-pulse-days">
          {days.map((x2, i) => (
            <i
              key={x2.day}
              className={`${x2.worst ? `k-tone-${KIND_TONE[x2.worst.kind]} hit` : "safe"}${isRestDay(x2.day) ? " rest" : ""}${x2.day === TODAY ? " today" : ""}`}
              style={{ animationDelay: `${i * 12}ms` }}
              title={`${d(x2.day)}${x2.worst ? ` · ${x2.worst.ref} ${x(INCIDENT_KIND[x2.worst.kind])}` : ""}`}
            >
              {x2.n > 1 ? x2.n : ""}
            </i>
          ))}
        </div>
        <div className="st-pulse-key">
          <span className="safe">{t("Safe day")}</span>
          <span className="k-tone-info">{t("Near miss")}</span>
          <span className="k-tone-warn">{t("First aid or damage")}</span>
          <span className="k-tone-bad">{t("Lost time")}</span>
        </div>
        </>
        ) : null}
      </section>

      <StatTiles
        items={[
          { label: t("TRIR"), icon: <Pulse size={14} />, value: <span className="num-inline">{trir == null ? "—" : trir.toFixed(2)}</span>, sub: hours ? t("{r} recordable in {h} man-hours", { r: recordable, h: hours.toLocaleString("en-US") }) : t("needs attendance hours"), tone: trir == null ? "neutral" : recordable ? "bad" : "ok" },
          { label: t("Open incidents"), icon: <ShieldAlert size={14} />, value: <CountUp value={open.length} />, sub: t("{n} under investigation", { n: incidents.filter((i) => i.status === "INVESTIGATING").length }), tone: open.length ? "warn" : "ok", onClick: () => setTab("incidents") },
          { label: t("Active permits"), icon: <Ticket size={14} />, value: <CountUp value={active.length} />, sub: suspended.length ? t("{n} suspended", { n: suspended.length }) : t("none suspended"), tone: suspended.length ? "bad" : "neutral", onClick: () => setTab("permits") },
          { label: t("Toolbox talks this week"), icon: <Megaphone size={14} />, value: <CountUp value={talks.length} />, sub: t("{n} attendances", { n: talks.reduce((a, k) => a + k.attendees, 0) }), onClick: () => setTab("toolbox") },
        ]}
      />

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "incidents", label: t("Incidents"), count: open.length || undefined },
          { value: "permits", label: t("Permits to work"), count: active.length || undefined },
          { value: "toolbox", label: t("Toolbox talks") },
          { value: "audits", label: t("Audits") },
        ]}
      />

      <div key={tab} className="st-tabbody">
        {tab === "incidents" ? <IncidentsTab logOpen={logInc} setLogOpen={setLogInc} /> : null}
        {tab === "permits" ? <PermitsTab newOpen={newPermit} setNewOpen={setNewPermit} /> : null}
        {tab === "toolbox" ? <ToolboxTab logOpen={logTalk} setLogOpen={setLogTalk} /> : null}
        {tab === "audits" ? <AuditsTab /> : null}
      </div>
    </div>
  );
}

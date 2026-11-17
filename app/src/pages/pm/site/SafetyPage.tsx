import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity as Pulse, Megaphone, Plus, ScanEye, ShieldAlert, ShieldCheck, Ticket } from "lucide-react";
import { CountUp, PageHero, StatTiles, TabBar, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, PROJECT_START, TODAY } from "../../../ops/dates";
import type { Incident } from "../../../ops/types";
import { INCIDENT_KIND, isRestDay, WEEK } from "./shared";
import { IncidentsTab } from "./SafetyIncidents";
import { permitStatus, PermitsTab } from "./SafetyPermits";
import { PpeCamera } from "./PpeCamera";
import { AuditsTab, ToolboxTab } from "./SafetyMore";

type Tab = "incidents" | "permits" | "toolbox" | "ppe" | "audits";
const TABS: Tab[] = ["incidents", "permits", "toolbox", "ppe", "audits"];
const KIND_TONE: Record<Incident["kind"], string> = { LOST_TIME: "bad", FIRST_AID: "warn", NEAR_MISS: "info", PROPERTY: "warn", ENVIRONMENT: "warn" };
const KIND_RANK: Incident["kind"][] = ["LOST_TIME", "FIRST_AID", "PROPERTY", "ENVIRONMENT", "NEAR_MISS"];
/** Hours before the first daily report (5–18 Oct): about 30 people a day. */
const EARLY_HOURS = 12 * 30 * 9;

/**
 * Safety / HSE: days without a lost-time injury drawn as a day strip, the HSE figures, then incidents,
 * permits to work, toolbox talks, the PPE camera AI and the weekly site walk.
 */
export function SafetyPage() {
  const { t, x, d } = useL();
  const incidents = useOps((s) => s.incidents);
  const permits = useOps((s) => s.permits);
  const toolbox = useOps((s) => s.toolbox);
  const ppe = useOps((s) => s.ppeChecks);
  const reports = useOps((s) => s.reports);
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
  const safeDays = diffDays(lastLti ?? PROJECT_START, TODAY);
  const hours = useMemo(() => reports.reduce((a, r) => a + r.labour.reduce((s, l) => s + l.count, 0) * 9, 0) + EARLY_HOURS, [reports]);
  const recordable = incidents.filter((i) => i.kind === "LOST_TIME").length;
  const trir = hours ? (recordable * 200_000) / hours : 0;
  const open = incidents.filter((i) => i.status !== "CLOSED");
  const active = permits.filter((p) => permitStatus(p) === "ACTIVE");
  const suspended = permits.filter((p) => p.status === "SUSPENDED");
  const talks = toolbox.filter((k) => WEEK.includes(k.date));
  const waiting = ppe.filter((p) => p.status === "WAITING");

  const days = useMemo(() => {
    const out: { day: string; worst: Incident | null; n: number }[] = [];
    for (let day = PROJECT_START; day <= TODAY; day = addDays(day, 1)) {
      const list = incidents.filter((i) => i.date === day).sort((a, b) => KIND_RANK.indexOf(a.kind) - KIND_RANK.indexOf(b.kind));
      out.push({ day, worst: list[0] ?? null, n: list.length });
    }
    return out;
  }, [incidents]);

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
        subtitle={t("Incidents and their investigations, permits to work, toolbox talks, PPE checks from the site cameras and the weekly site walk.")}
        flow={["Permit", "Brief", "Watch the site", "Report", "Close out"]}
        art="inspection"
        actions={
          <>
            {newAction}
            <button type="button" className="btn btn-ghost" onClick={() => setTab("ppe")}>
              <ScanEye size={15} />
              {t("PPE cameras")}
            </button>
          </>
        }
      />

      <section className="st-pulse k-rise" aria-label={t("Days since the project started")}>
        <div className="st-pulse-fig">
          <span className="k-eyebrow">
            <ShieldCheck size={13} /> {t("Days without a lost-time injury")}
          </span>
          <strong className="num-inline">
            <CountUp value={safeDays} />
          </strong>
          <small>{lastLti ? t("Last one on {date}", { date: d(lastLti) }) : t("None since the project started on {date}", { date: d(PROJECT_START) })}</small>
        </div>
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
      </section>

      <StatTiles
        items={[
          { label: t("TRIR"), icon: <Pulse size={14} />, value: <span className="num-inline">{trir.toFixed(2)}</span>, sub: t("{r} recordable in {h}k hours", { r: recordable, h: Math.round(hours / 1000) }), tone: recordable ? "bad" : "ok" },
          { label: t("Open incidents"), icon: <ShieldAlert size={14} />, value: <CountUp value={open.length} />, sub: t("{n} under investigation", { n: incidents.filter((i) => i.status === "INVESTIGATING").length }), tone: open.length ? "warn" : "ok", onClick: () => setTab("incidents") },
          { label: t("Active permits"), icon: <Ticket size={14} />, value: <CountUp value={active.length} />, sub: suspended.length ? t("{n} suspended", { n: suspended.length }) : t("none suspended"), tone: suspended.length ? "bad" : "neutral", onClick: () => setTab("permits") },
          { label: t("Toolbox talks this week"), icon: <Megaphone size={14} />, value: <CountUp value={talks.length} />, sub: t("{n} attendances", { n: talks.reduce((a, k) => a + k.attendees, 0) }), onClick: () => setTab("toolbox") },
          { label: t("PPE alerts waiting"), icon: <ScanEye size={14} />, value: <CountUp value={waiting.length} />, sub: t("from {n} cameras", { n: new Set(ppe.map((p) => p.camera)).size }), tone: waiting.length ? "bad" : "ok", onClick: () => setTab("ppe") },
        ]}
      />

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "incidents", label: t("Incidents"), count: open.length || undefined },
          { value: "permits", label: t("Permits to work"), count: active.length || undefined },
          { value: "toolbox", label: t("Toolbox talks") },
          { value: "ppe", label: t("PPE camera AI"), count: waiting.length || undefined },
          { value: "audits", label: t("Audits") },
        ]}
      />

      <div key={tab} className="st-tabbody">
        {tab === "incidents" ? <IncidentsTab logOpen={logInc} setLogOpen={setLogInc} /> : null}
        {tab === "permits" ? <PermitsTab newOpen={newPermit} setNewOpen={setNewPermit} /> : null}
        {tab === "toolbox" ? <ToolboxTab logOpen={logTalk} setLogOpen={setLogTalk} /> : null}
        {tab === "ppe" ? <PpeCamera /> : null}
        {tab === "audits" ? <AuditsTab /> : null}
      </div>
    </div>
  );
}

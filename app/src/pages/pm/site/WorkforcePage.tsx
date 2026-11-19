import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, BadgeCheck, ClipboardCheck, ClipboardList, Clock, Coins, UserMinus, UserPlus, Users } from "lucide-react";
import { CountUp, Empty, PageHero, StatTiles, TabBar, toneColor, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import type { AttendanceStatus } from "../../../ops/types";
import { siteMeta, WEEK } from "./shared";
import { certState, liveActivity, onSite, statusOn } from "./workforce-model";
import { ATT_ORDER, LogAttendanceDialog, RollCallDialog } from "./RollCall";
import { AllocationsTab, AttendanceTab, WorkersTab } from "./WorkforceTabs";
import { ComplianceTab, ProductivityTab, TimesheetsTab } from "./WorkforceMore";
import { WorkerDialog } from "./SiteDialogs";

type Tab = "workers" | "attendance" | "allocations" | "timesheets" | "compliance" | "productivity";
const TABS: Tab[] = ["workers", "attendance", "allocations", "timesheets", "compliance", "productivity"];
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

/**
 * Workforce: who is on site today (roll call), what needs attention (certificates, absences, crews short
 * of the programme), and tabs for the register, the week's attendance, allocations, timesheets,
 * compliance and crew productivity.
 */
export function WorkforcePage() {
  const { t, x, d } = useL();
  const workers = useOps((s) => s.workers);
  const attendance = useOps((s) => s.attendance);
  const activities = useOps((s) => s.activities);
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "workers";
  const setTab = (v: Tab) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("tab", v);
        return n;
      },
      { replace: true },
    );
  const [rolling, setRolling] = useState(false);
  const [logging, setLogging] = useState(false);
  const [adding, setAdding] = useState(false);

  // ------------------------------------------------------------ today
  const today = useMemo(() => {
    const by = new Map<AttendanceStatus | "NONE", string[]>();
    for (const w of workers) {
      const st = statusOn(attendance, w.id, TODAY) ?? "NONE";
      by.set(st, [...(by.get(st) ?? []), w.id]);
    }
    return by;
  }, [workers, attendance]);
  const present = workers.filter((w) => onSite(statusOn(attendance, w.id, TODAY))).length;
  const hoursToday = attendance.filter((a) => a.date === TODAY).reduce((s, a) => s + a.hours, 0);
  const weekHours = attendance.filter((a) => WEEK.includes(a.date)).reduce((s, a) => s + a.hours, 0);
  const weekCost = attendance.filter((a) => WEEK.includes(a.date)).reduce((s, a) => s + a.hours * (workers.find((w) => w.id === a.workerId)?.rate ?? 0), 0);
  const certs = workers.flatMap((w) => w.certs.map((c) => ({ w, c, st: certState(c.expires) })));
  const expiring = certs.filter((c) => c.st !== "ok");
  const expired = certs.filter((c) => c.st === "expired");
  const absent = workers.filter((w) => {
    const st = statusOn(attendance, w.id, TODAY);
    return st === "ABSENT" || st === "INJURY";
  });
  const shortfall = activities
    .filter(liveActivity)
    .map((a) => {
      const here = workers.filter((w) => w.activityId === a.id && onSite(statusOn(attendance, w.id, TODAY))).length;
      return { a, here, short: Math.max(0, a.crew - here) };
    })
    .filter((r) => r.short > 0)
    .sort((p, q) => q.short - p.short);
  const totalShort = shortfall.reduce((s, r) => s + r.short, 0);
  const liveCount = activities.filter(liveActivity).length;
  const stripKeys: (AttendanceStatus | "NONE")[] = [...ATT_ORDER, "NONE"];

  return (
    <div className="k-page st-page">
      <PageHero
        eyebrow={t("Site · Workforce")}
        title={t("Workforce")}
        subtitle={t("Who is on site today, where each crew works, what their hours cost and whose tickets run out next.")}
        flow={["Roll call", "Allocate", "Timesheets", "Approve"]}
        art="subs"
        actions={
          <>
            {workers.length ? (
              <button type="button" className="btn btn-primary" onClick={() => setRolling(true)}>
                <ClipboardCheck size={15} />
                {t("Take roll call")}
              </button>
            ) : null}
            <button type="button" className={workers.length ? "btn btn-ghost" : "btn btn-primary"} onClick={() => setAdding(true)}>
              <UserPlus size={15} />
              {t("Add worker")}
            </button>
            {workers.length ? (
              <button type="button" className="btn btn-ghost" onClick={() => setLogging(true)}>
                <ClipboardList size={15} />
                {t("Log attendance")}
              </button>
            ) : null}
          </>
        }
      />

      {!workers.length ? (
        <Empty
          icon={<Users size={22} />}
          title={t("No workers registered yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <UserPlus size={15} />
              {t("Add worker")}
            </button>
          }
        >
          {t("Add the people on site, your own staff and subcontractor crews. Roll call, timesheets and certificate tracking start from this list.")}
        </Empty>
      ) : (
        <>
      <section className="st-today k-rise">
        <div className="st-today-main">
          <span className="k-eyebrow">{t("Workforce today")} · {d(TODAY)}</span>
          <div className="st-today-fig">
            <strong className="num-inline">
              <CountUp value={present} />
            </strong>
            <span>{t("of {n} on site", { n: workers.length })}</span>
          </div>
          <div className="st-strip" role="img" aria-label={t("Attendance today")}>
            {stripKeys.map((k) => {
              const n = today.get(k)?.length ?? 0;
              if (!n) return null;
              const tone = k === "NONE" ? "muted" : siteMeta("attendance", k).tone;
              return <i key={k} className={`k-grow-x st-strip-${k.toLowerCase()}`} style={{ flexGrow: n, background: toneColor(tone) }} title={`${k === "NONE" ? t("No record") : x(siteMeta("attendance", k).label)}: ${n}`} />;
            })}
          </div>
          <div className="st-strip-key">
            {stripKeys.map((k) => {
              const n = today.get(k)?.length ?? 0;
              const tone = k === "NONE" ? "muted" : siteMeta("attendance", k).tone;
              return (
                <span key={k} className={n ? undefined : "zero"}>
                  <i style={{ background: toneColor(tone) }} />
                  {k === "NONE" ? t("No record") : x(siteMeta("attendance", k).label)} <b className="num-inline">{n}</b>
                </span>
              );
            })}
          </div>
          <div className="st-people" aria-hidden="true">
            {workers.map((w, i) => {
              const st = statusOn(attendance, w.id, TODAY);
              return <i key={w.id} className={`st-person-dot ${st ? `st-att-${st.toLowerCase()}` : "none"}`} style={{ animationDelay: `${i * 22}ms` }} title={w.name} />;
            })}
          </div>
        </div>
        <ul className="st-today-attn">
          <li className={expiring.length ? "warn" : "ok"}>
            <BadgeCheck size={16} />
            <button type="button" onClick={() => setTab("compliance")}>
              <strong>{expiring.length ? t("{n} certificates expire within 30 days", { n: expiring.length }) : certs.length ? t("Certificates are in date") : t("No certificates recorded")}</strong>
              <small>{expired.length ? t("{n} already expired: {names}", { n: expired.length, names: expired.map((c) => c.w.name).join(", ") }) : t("Nothing has expired")}</small>
            </button>
          </li>
          <li className={absent.length ? "bad" : "ok"}>
            <UserMinus size={16} />
            <button type="button" onClick={() => setTab("attendance")}>
              <strong>{absent.length ? t("{n} absent today", { n: absent.length }) : t("No absences today")}</strong>
              <small>{absent.length ? absent.map((w) => w.name).join(", ") : today.get("NONE")?.length === workers.length ? t("No roll call taken today yet") : t("Everyone booked is accounted for")}</small>
            </button>
          </li>
          <li className={totalShort ? "bad" : "ok"}>
            <AlertTriangle size={16} />
            <button type="button" onClick={() => setTab("allocations")}>
              <strong>{totalShort ? t("Crews {n} short of the programme", { n: totalShort }) : liveCount ? t("Crews match the programme") : t("No activities running now")}</strong>
              <small>{shortfall.slice(0, 3).map((r) => t("{code}: {h} of {p}", { code: r.a.code, h: r.here, p: r.a.crew })).join(" · ") || (liveCount ? t("Planned crews are on site") : t("Crews are compared once the programme has running activities"))}</small>
            </button>
          </li>
        </ul>
      </section>

      <StatTiles
        items={[
          { label: t("On site today"), icon: <Users size={14} />, value: <CountUp value={present} />, sub: t("{h} man-hours booked", { h: fmt(hoursToday) }), tone: "brand" },
          { label: t("Man-hours this week"), icon: <Clock size={14} />, value: <CountUp value={weekHours} format={fmt} />, sub: t("{from} – {to}", { from: d(WEEK[0]!, false), to: d(TODAY, false) }), onClick: () => setTab("attendance") },
          { label: t("Labour cost this week"), icon: <Coins size={14} />, value: <CountUp value={weekCost} format={fmt} />, sub: "AZN", onClick: () => setTab("timesheets") },
          { label: t("Tickets to renew"), icon: <BadgeCheck size={14} />, value: <CountUp value={expiring.length} />, sub: t("{n} expired", { n: expired.length }), tone: expired.length ? "bad" : expiring.length ? "warn" : "ok", onClick: () => setTab("compliance") },
        ]}
      />

      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "workers", label: t("Workers"), count: workers.length },
          { value: "attendance", label: t("Attendance") },
          { value: "allocations", label: t("Allocations") },
          { value: "timesheets", label: t("Timesheets") },
          { value: "compliance", label: t("Compliance"), count: expiring.length || undefined },
          { value: "productivity", label: t("Productivity") },
        ]}
      />

      <div key={tab} className="st-tabbody">
        {tab === "workers" ? <WorkersTab /> : null}
        {tab === "attendance" ? <AttendanceTab /> : null}
        {tab === "allocations" ? <AllocationsTab /> : null}
        {tab === "timesheets" ? <TimesheetsTab /> : null}
        {tab === "compliance" ? <ComplianceTab /> : null}
        {tab === "productivity" ? <ProductivityTab /> : null}
      </div>
        </>
      )}

      <RollCallDialog open={rolling} onClose={() => setRolling(false)} />
      <LogAttendanceDialog open={logging} onClose={() => setLogging(false)} />
      <WorkerDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

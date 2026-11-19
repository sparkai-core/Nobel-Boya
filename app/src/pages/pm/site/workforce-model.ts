import { addDays, diffDays, TODAY } from "../../../ops/dates";
import type { Activity, AttendanceRow, AttendanceStatus, DailyReport, Worker } from "../../../ops/types";
import { WEEK } from "./shared";

export const statusOn = (att: AttendanceRow[], workerId: string, date: string): AttendanceStatus | null => att.find((a) => a.date === date && a.workerId === workerId)?.status ?? null;
export const onSite = (s: AttendanceStatus | null) => s === "PRESENT" || s === "HALF";

export type CertState = "expired" | "soon" | "ok";
export const certState = (expires: string): CertState => (expires < TODAY ? "expired" : diffDays(TODAY, expires) <= 30 ? "soon" : "ok");

/** Activities that need a crew right now. */
export const liveActivity = (a: Activity) => (a.status === "IN_PROGRESS" || a.status === "BLOCKED") && !a.isMilestone;

/** Hours booked by a worker over the last seven days. */
export const weekHours = (att: AttendanceRow[], workerId: string) => att.filter((a) => a.workerId === workerId && WEEK.includes(a.date)).reduce((x, a) => x + a.hours, 0);

export type CrewOutput = { activity: Activity; unit: string; qty: number; manHours: number; rate: number; workers: number; days: number };

/**
 * Output per man-hour by crew over the last seven days: quantities from the daily reports divided by the
 * hours booked in attendance against the same activity. Only what was logged; no norms are assumed.
 */
export function crewOutput(activities: Activity[], workers: Worker[], attendance: AttendanceRow[], reports: DailyReport[]): CrewOutput[] {
  const from = addDays(TODAY, -6);
  const reps = reports.filter((r) => r.date >= from && r.date <= TODAY);
  const out: CrewOutput[] = [];
  for (const a of activities) {
    const rows = attendance.filter((r) => r.activityId === a.id && r.date >= from && r.date <= TODAY);
    const manHours = rows.reduce((x, r) => x + r.hours, 0);
    if (!manHours) continue;
    const entries = reps.flatMap((r) => r.entries.filter((e) => e.activityId === a.id));
    if (!entries.length) continue;
    const unit = entries[0]!.unit;
    const qty = entries.filter((e) => e.unit === unit).reduce((x, e) => x + e.qty, 0);
    const rate = qty / manHours;
    out.push({ activity: a, unit, qty, manHours, rate, workers: workers.filter((w) => w.activityId === a.id).length, days: new Set(reps.filter((r) => r.entries.some((e) => e.activityId === a.id)).map((r) => r.date)).size });
  }
  return out.sort((x, y) => x.unit.localeCompare(y.unit) || y.rate - x.rate);
}

/** Workers whose activity has no output in the reports (shown as "no output logged"). */
export function crewsWithoutOutput(activities: Activity[], workers: Worker[], measured: CrewOutput[]) {
  const ids = new Set(measured.map((m) => m.activity.id));
  return activities.filter((a) => !ids.has(a.id) && workers.some((w) => w.activityId === a.id));
}

export const timesheetText = (subName: string) => ({ en: `Timesheets approved: ${subName}, week to ${TODAY}`, az: `Tabellər təsdiqləndi: ${subName}, ${TODAY} tarixinədək həftə` });

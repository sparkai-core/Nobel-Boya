import { useMemo } from "react";
import { useOps } from "../../../ops/store";
import { cpm, milestoneForecast, programmeStats, R, type Cpm, type MilestoneState, type Tone } from "../../../ops/select";
import { addDays, diffDays, maxDate, minDate, PROJECT_FINISH, PROJECT_START, TODAY } from "../../../ops/dates";
import type { Activity, Dependency, LiveImpact, Milestone, Subcontractor, WbsNode } from "../../../ops/types";

/**
 * Derived schedule numbers shared by the Schedule pages (overview, programme, WBS, milestones,
 * critical path, dependencies, calendar, finish risk). Everything is computed from the store.
 */

export const dayOf = (d: string) => diffDays(PROJECT_START, d);
export const dateOf = (n: number) => addDays(PROJECT_START, n);
export const durOf = (a: Pick<Activity, "start" | "end">) => Math.max(0, diffDays(a.start, a.end));

/** Share of an activity that should be done today on its current dates (0–100). */
export function expectedPct(a: Activity, date = TODAY) {
  if (date <= a.start) return 0;
  if (date >= a.end) return 100;
  return Math.round((diffDays(a.start, date) / Math.max(1, diffDays(a.start, a.end))) * 100);
}

/** "overdue": the finish date has passed; "behind": running, but 3+ points under today's plan. */
export type Lateness = "overdue" | "behind" | null;
export function lateness(a: Activity, date = TODAY): Lateness {
  if (a.status === "COMPLETED") return null;
  if (a.end < date) return "overdue";
  if ((a.status === "IN_PROGRESS" || a.status === "BLOCKED") && expectedPct(a, date) - a.pct >= 3) return "behind";
  if (a.status === "NOT_STARTED" && a.start < date) return "behind";
  return null;
}

export const slipDays = (a: Activity) => diffDays(a.bEnd, a.end);

const NAME_TAIL = /\s+(MMC|QSC|ASC|Qrup|Mühəndis|İşləri|Abadlıq)$/i;
/** Subcontractor name, full and short ("Monolit Beton Qrup" → "Monolit"). */
export function ownerName(owner: string, subs: Subcontractor[]) {
  return subs.find((s) => s.id === owner)?.name ?? owner;
}
export function ownerShort(owner: string, subs: Subcontractor[]) {
  const full = ownerName(owner, subs).replace(NAME_TAIL, "");
  return full.split(/\s+/)[0] ?? full;
}

// ---------------------------------------------------------------- finish outlook

export type Outlook = {
  contract: string;
  baseline: string;
  /** Latest finish on the programme as it stands. */
  current: string;
  /** Finish the logic gives (critical path), never earlier than the current finish. */
  calculated: string;
  /** Calculated finish plus site impacts still waiting to go into the programme. */
  forecast: string;
  pendingDays: number;
  pending: LiveImpact[];
  lateDays: number;
};

const PENDING: LiveImpact["status"][] = ["REPORTED", "UNDER_REVIEW", "CONFIRMED"];

export function finishOutlook(activities: Activity[], cp: Map<string, Cpm>, impacts: LiveImpact[]): Outlook {
  const current = activities.reduce((a, x) => maxDate(a, x.end), PROJECT_START);
  const baseline = activities.reduce((a, x) => maxDate(a, x.bEnd), PROJECT_START);
  const maxEf = Math.max(0, ...[...cp.values()].map((c) => c.ef));
  const calculated = maxDate(current, dateOf(maxEf));
  const pending = impacts.filter((i) => PENDING.includes(i.status));
  let pendingDays = 0;
  for (const i of pending) {
    const c = cp.get(i.activityId);
    if (!c) continue;
    pendingDays = Math.max(pendingDays, i.daysImpact - Math.max(0, c.tf));
  }
  const forecast = addDays(calculated, pendingDays);
  return { contract: PROJECT_FINISH, baseline, current, calculated, forecast, pendingDays, pending, lateDays: diffDays(PROJECT_FINISH, forecast) };
}

// ---------------------------------------------------------------- WBS

export type Rollup = { count: number; budget: number; earned: number; pct: number; planned: number; start: string; end: string; bEnd: string; critical: number; blocked: number; ids: string[] };

export function wbsChildren(wbs: WbsNode[]) {
  const map = new Map<string | null, WbsNode[]>();
  for (const n of wbs) map.set(n.parentId, [...(map.get(n.parentId) ?? []), n]);
  return map;
}

export function subtreeIds(id: string, kids: Map<string | null, WbsNode[]>): Set<string> {
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const k of kids.get(cur) ?? []) {
      out.add(k.id);
      stack.push(k.id);
    }
  }
  return out;
}

export function rollup(acts: Activity[], cp?: Map<string, Cpm>): Rollup {
  const budget = acts.reduce((a, x) => a + x.budget, 0);
  const earned = acts.reduce((a, x) => a + (x.budget * x.pct) / 100, 0);
  const plannedV = acts.reduce((a, x) => a + (x.budget * baselineShare(x)) / 100, 0);
  return {
    count: acts.length,
    budget,
    earned,
    pct: budget > 0 ? (earned / budget) * 100 : acts.length ? acts.reduce((a, x) => a + x.pct, 0) / acts.length : 0,
    planned: budget > 0 ? (plannedV / budget) * 100 : 0,
    start: acts.length ? minDate(...acts.map((a) => a.start)) : PROJECT_START,
    end: acts.length ? maxDate(...acts.map((a) => a.end)) : PROJECT_START,
    bEnd: acts.length ? maxDate(...acts.map((a) => a.bEnd)) : PROJECT_START,
    critical: cp ? acts.filter((a) => cp.get(a.id)?.critical && a.status !== "COMPLETED").length : 0,
    blocked: acts.filter((a) => a.status === "BLOCKED").length,
    ids: acts.map((a) => a.id),
  };
}

function baselineShare(a: Activity) {
  if (TODAY <= a.bStart) return 0;
  if (TODAY >= a.bEnd) return 100;
  return (diffDays(a.bStart, TODAY) / Math.max(1, diffDays(a.bStart, a.bEnd))) * 100;
}

// ---------------------------------------------------------------- milestones

export const MS_TONE: Record<MilestoneState, Tone> = { DONE: "ok", ON_TRACK: "ok", WATCH: "warn", AT_RISK: "bad", LATE: "bad" };

export function milestoneRows(milestones: Milestone[], activities: Activity[]) {
  return milestones.map((m) => ({ m, f: milestoneForecast(m, activities) }));
}

// ---------------------------------------------------------------- links

export function linkLabel(l: Pick<Dependency, "type" | "lag">) {
  return l.lag ? `${l.type} ${l.lag > 0 ? "+" : "−"}${Math.abs(l.lag)}` : l.type;
}

/** Programme link with a list filter (blocked, late, critical…). */
export const programmeFilter = (f: string) => `${R.programme()}?filter=${f}`;

// ---------------------------------------------------------------- hook

/** One subscription for the schedule pages: collections plus the critical path and outlook. */
export function useSchedule() {
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const milestones = useOps((s) => s.milestones);
  const impacts = useOps((s) => s.impacts);
  const wbs = useOps((s) => s.wbs);
  const subs = useOps((s) => s.subs);
  const cp = useMemo(() => cpm(activities, links), [activities, links]);
  const stats = useMemo(() => programmeStats(activities), [activities]);
  const outlook = useMemo(() => finishOutlook(activities, cp, impacts), [activities, cp, impacts]);
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  return { activities, links, milestones, impacts, wbs, subs, cp, stats, outlook, byId };
}

import { useMemo } from "react";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, maxDate, TODAY } from "../../../ops/dates";
import { cpm, milestoneForecast, programmeStats } from "../../../ops/select";
import type { Activity, DelayCause, DelayEvent, Dependency, ImpactKind, Milestone } from "../../../ops/types";

/** Shared maths and labels for the PM control pages (delays, live programme, recovery, health, progress, reports). */

export const CAUSES: DelayCause[] = ["WEATHER", "MATERIAL_DELIVERY", "DESIGN_CHANGE", "RFI", "MANPOWER", "EQUIPMENT", "AUTHORITY", "SUBCONTRACTOR", "SITE_CONDITION", "VARIATION"];

/** English labels; render through t(). */
export const CAUSE_LABEL: Record<DelayCause, string> = {
  WEATHER: "Weather",
  MATERIAL_DELIVERY: "Material delivery",
  DESIGN_CHANGE: "Design change",
  RFI: "Design query (RFI)",
  MANPOWER: "Manpower",
  EQUIPMENT: "Equipment",
  AUTHORITY: "Authority / permits",
  SUBCONTRACTOR: "Subcontractor",
  SITE_CONDITION: "Site condition",
  VARIATION: "Variation",
};

export const IMPACT_LABEL: Record<ImpactKind, string> = {
  TASK_DELAY: "Task delay",
  MANPOWER_SHORTAGE: "Manpower shortage",
  WEATHER_IMPACT: "Weather",
  EQUIPMENT_FAILURE: "Equipment failure",
};

export const OPEN_DELAY: DelayEvent["status"][] = ["OPEN", "UNDER_REVIEW", "CONFIRMED"];
export const isOpenDelay = (d: DelayEvent) => OPEN_DELAY.includes(d.status);

/** Every activity reached from `id` through the logic links (including `id`). */
export function downstream(links: Dependency[], id: string) {
  const out = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const l of links) if (l.from === cur) queue.push(l.to);
  }
  return out;
}

export function useCpm() {
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  return useMemo(() => cpm(activities, links), [activities, links]);
}

/** Effective float per activity id (see effectiveFloat). */
export function useFloat() {
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const cp = useCpm();
  return useMemo(() => {
    const cache = new Map<string, number>();
    return (id: string) => {
      if (!cache.has(id)) cache.set(id, effectiveFloat(activities, links, cp, id));
      return cache.get(id)!;
    };
  }, [activities, links, cp]);
}

export type ImpactPreview = {
  activity: Activity;
  totalFloat: number;
  critical: boolean;
  absorbed: number;
  push: number;
  milestones: { m: Milestone; from: string; to: string }[];
  finishFrom: string;
  finishTo: string;
  cpChanged: boolean;
};

/** What a delay of `daysLost` on an activity does: float it eats, the push left over and the milestones it moves. */
export function previewImpact(activities: Activity[], links: Dependency[], milestones: Milestone[], activityId: string, daysLost: number): ImpactPreview | null {
  const activity = activities.find((a) => a.id === activityId);
  if (!activity) return null;
  const cp = cpm(activities, links);
  const c = cp.get(activityId);
  const totalFloat = effectiveFloat(activities, links, cp, activityId);
  const absorbed = Math.max(0, Math.min(daysLost, totalFloat));
  const push = Math.max(0, daysLost - absorbed);
  const after = push > 0 ? downstream(links, activityId) : new Set<string>();
  const moved = activities.map((a) => (after.has(a.id) && a.status !== "COMPLETED" ? { ...a, end: addDays(a.end, push) } : a));
  const ms = milestones
    .filter((m) => !m.actual)
    .map((m) => ({ m, from: milestoneForecast(m, activities).forecast, to: milestoneForecast(m, moved).forecast }))
    .filter((r) => r.to > r.from);
  const finishFrom = programmeStats(activities).forecastFinish;
  const finishTo = programmeStats(moved).forecastFinish;
  return { activity, totalFloat, critical: (c?.tf ?? 1) <= 0, absorbed, push, milestones: ms, finishFrom, finishTo, cpChanged: push > 0 && finishTo > finishFrom };
}

export const severityFor = (push: number, daysLost: number): DelayEvent["severity"] => (push >= 10 ? "CRITICAL" : push >= 4 ? "HIGH" : push > 0 || daysLost >= 4 ? "MEDIUM" : "LOW");

// ---------------------------------------------------------------- progress through time

const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v));

/** Baseline plan % of an activity on a date. */
export function plannedPctAt(a: Activity, date: string) {
  if (date <= a.bStart) return 0;
  if (date >= a.bEnd) return 100;
  return clamp((diffDays(a.bStart, date) / Math.max(1, diffDays(a.bStart, a.bEnd))) * 100);
}

/** Actual % on a date up to today (history interpolated from the actual start). */
export function actualPctAt(a: Activity, date: string) {
  if (date >= TODAY) return a.pct;
  if (a.aEnd && date >= a.aEnd) return 100;
  if (!a.aStart || date <= a.aStart) return 0;
  const end = a.aEnd ?? TODAY;
  return clamp((a.pct * diffDays(a.aStart, date)) / Math.max(1, diffDays(a.aStart, end)));
}

/** Forecast % after today, from the current programme dates. */
export function forecastPctAt(a: Activity, date: string) {
  if (date <= TODAY) return actualPctAt(a, date);
  if (a.pct >= 100) return 100;
  const from = maxDate(a.start, TODAY);
  if (date >= a.end) return 100;
  if (date <= from) return a.pct;
  return clamp(a.pct + ((100 - a.pct) * diffDays(from, date)) / Math.max(1, diffDays(from, a.end)));
}

/** What the site shows on a date: actual before today, forecast after. */
export const shownPctAt = (a: Activity, date: string) => (date <= TODAY ? actualPctAt(a, date) : forecastPctAt(a, date));

/** Budget-weighted plan / actual of a set of activities today. */
export function groupPct(acts: Activity[], date = TODAY) {
  const w = acts.reduce((s, a) => s + Math.max(1, a.budget), 0) || 1;
  return {
    plan: acts.reduce((s, a) => s + Math.max(1, a.budget) * plannedPctAt(a, date), 0) / w,
    actual: acts.reduce((s, a) => s + Math.max(1, a.budget) * shownPctAt(a, date), 0) / w,
  };
}

/** Small deterministic hash for seeding local visuals. */
export function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/** Forecast finish after applyScenario(days): every unfinished, slipped activity is pulled back by up to `days`. */
export function finishAfterRecovery(activities: Activity[], days: number) {
  return activities.reduce((m, a) => {
    if (a.status === "COMPLETED") return maxDate(m, a.end);
    const slip = diffDays(a.bEnd, a.end);
    return maxDate(m, slip > 0 ? addDays(a.end, -Math.min(slip, days)) : a.end);
  }, activities[0]?.start ?? TODAY);
}

/**
 * Float that reads sensibly on site. Pure CPM gives an activity with no logic successor all the float
 * to the project end (e.g. rebar fixing that in reality feeds the footings). For those, borrow the float
 * of the next linked activity in the same building that it overlaps or feeds.
 */
export function effectiveFloat(activities: Activity[], links: Dependency[], cp: Map<string, { tf: number }>, id: string) {
  const a = activities.find((v) => v.id === id);
  const tf = Math.max(0, cp.get(id)?.tf ?? 0);
  if (!a || links.some((l) => l.from === id)) return tf;
  const next = activities
    .filter((v) => v.id !== id && v.building === a.building && v.status !== "COMPLETED" && v.start > a.start && links.some((l) => l.from === v.id))
    .sort((x, y) => x.start.localeCompare(y.start))[0];
  if (!next) return tf;
  return Math.min(tf, Math.max(0, cp.get(next.id)?.tf ?? 0) + Math.max(0, diffDays(a.end, next.end)));
}

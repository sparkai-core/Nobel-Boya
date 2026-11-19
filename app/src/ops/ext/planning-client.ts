import { addDays, same, toDate } from "../dates";
import { useOps } from "../store";
import type { Activity, CalendarDay, Dependency, LinkType, Milestone, WbsNode } from "../types";
import { materialise } from "./programme-import";
import { dropConstraints } from "./planning-p2";

/**
 * Create, edit and delete paths for the programme the user keeps by hand: activities with their
 * predecessors, milestones and WBS items. Everything is saved in the ops store of the open project.
 */

const pad = (n: number) => String(n).padStart(4, "0");

/** Takes the next number of a counter and saves the counter. */
function take(kind: string) {
  const s = useOps.getState();
  const n = (s.seq[kind] ?? 0) + 1;
  useOps.setState({ seq: { ...s.seq, [kind]: n } });
  return n;
}

/** The next free activity ID suggestion, e.g. "A1010" (P6 style, steps of 10). */
export function suggestCode(activities: Activity[], prefix = "A") {
  let max = 1000;
  for (const a of activities) {
    const m = /^([A-Za-z]+)-?(\d+)$/.exec(a.code);
    if (m && m[1]!.toUpperCase() === prefix) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}${Math.ceil((max + 1) / 10) * 10}`;
}

// ---------------------------------------------------------------- working days

/** Working-day test from the project's week and calendar (holidays, shutdowns, extra days). */
export function workingDayTest(workweek: number[], calendar: CalendarDay[]) {
  const by = new Map(calendar.map((c) => [c.date, c.kind]));
  return (iso: string) => {
    const k = by.get(iso);
    if (k === "EXTRA") return true;
    if (k) return false;
    return workweek.includes(toDate(iso).getUTCDay());
  };
}

/** Finish date after `days` working days from a start (0 = same day, a milestone). */
export function addWorkingDays(start: string, days: number, workweek: number[], calendar: CalendarDay[]) {
  const ok = workingDayTest(workweek, calendar);
  let d = start;
  let n = 0;
  let guard = 0;
  while (n < days && guard < 20000) {
    d = addDays(d, 1);
    guard++;
    if (ok(d)) n++;
  }
  return d;
}

/** Working days between a start and a finish, as addWorkingDays counts them. */
export function countWorkingDays(start: string, end: string, workweek: number[], calendar: CalendarDay[]) {
  const ok = workingDayTest(workweek, calendar);
  let n = 0;
  let guard = 0;
  for (let d = addDays(start, 1); d <= end && guard < 20000; d = addDays(d, 1), guard++) if (ok(d)) n++;
  return n;
}

// ---------------------------------------------------------------- activities

export type PredInput = { from: string; type: LinkType; lag: number };

export type ActivityInput = {
  code: string;
  name: string;
  wbsId: string;
  building: string;
  section: string | null;
  start: string;
  end: string;
  isMilestone: boolean;
  owner: string;
  crew: number;
  budget: number;
  preds: PredInput[];
};

function setPreds(links: Dependency[], activityId: string, preds: PredInput[]): Dependency[] {
  const keep = links.filter((l) => l.to !== activityId);
  const added = preds
    .filter((p) => p.from && p.from !== activityId)
    .filter((p, i, arr) => arr.findIndex((x) => x.from === p.from && x.type === p.type) === i)
    .map((p) => ({ id: `ML-${pad(take("ML"))}`, from: p.from, to: activityId, type: p.type, lag: Math.round(p.lag) || 0 }));
  return [...keep, ...added];
}

/** Adds an activity typed in by hand. Its baseline is its first dates. */
export function createActivity(input: ActivityInput): string {
  const id = `A-${pad(take("A"))}`;
  const s = useOps.getState();
  const end = input.isMilestone ? input.start : input.end < input.start ? input.start : input.end;
  const a: Activity = {
    id,
    code: input.code.trim(),
    wbsId: input.wbsId,
    name: same(input.name.trim()),
    building: input.building,
    section: input.section,
    start: input.start,
    end,
    bStart: input.start,
    bEnd: end,
    aStart: null,
    aEnd: null,
    pct: 0,
    status: "NOT_STARTED",
    priority: "MEDIUM",
    isMilestone: input.isMilestone,
    owner: input.owner.trim(),
    budget: Math.max(0, input.budget || 0),
    crew: Math.max(0, Math.round(input.crew || 0)),
    blockedReason: null,
  };
  useOps.setState({ activities: [...s.activities, a], links: setPreds(s.links, id, input.preds) });
  useOps.getState().pushFeed("PM", { en: `Activity ${a.code} added: ${input.name.trim()}`, az: `İş əlavə edildi: ${a.code} ${input.name.trim()}` }, `pm/programme?task=${id}`);
  return id;
}

/** Saves edits to an activity. The baseline stays as it was; progress is changed from the progress controls. */
export function updateActivityDetails(id: string, input: ActivityInput) {
  const s = useOps.getState();
  const end = input.isMilestone ? input.start : input.end < input.start ? input.start : input.end;
  useOps.setState({
    activities: s.activities.map((a) =>
      a.id === id
        ? {
            ...a,
            code: input.code.trim(),
            name: a.name.en === input.name.trim() ? a.name : same(input.name.trim()),
            wbsId: input.wbsId,
            building: input.building,
            section: input.section,
            start: input.start,
            end,
            isMilestone: input.isMilestone,
            owner: input.owner.trim(),
            crew: Math.max(0, Math.round(input.crew || 0)),
            budget: Math.max(0, input.budget || 0),
          }
        : a,
    ),
    links: setPreds(s.links, id, input.preds),
  });
}

/** Deletes an activity with its links, its constraints and its place in milestones and resources. */
export function deleteActivity(id: string) {
  const s = useOps.getState();
  const a = s.activities.find((x) => x.id === id);
  if (!a) return;
  useOps.setState({
    activities: s.activities.filter((x) => x.id !== id),
    links: s.links.filter((l) => l.from !== id && l.to !== id),
    milestones: s.milestones.map((m) => (m.drivers.includes(id) ? { ...m, drivers: m.drivers.filter((d) => d !== id) } : m)),
    resources: s.resources.map((r) => (r.activityIds.includes(id) ? { ...r, activityIds: r.activityIds.filter((x) => x !== id) } : r)),
    constraints: s.constraints.filter((c) => c.activityId !== id),
  });
  dropConstraints([id]);
  useOps.getState().pushFeed("PM", { en: `Activity ${a.code} deleted`, az: `${a.code} işi silindi` }, "pm/programme");
}

// ---------------------------------------------------------------- milestones

export type MilestoneInput = { code: string; name: string; target: string; payment: number | null; drivers: string[]; actual: string | null };

export function createMilestone(input: MilestoneInput): string {
  const id = `MS-${pad(take("MS"))}`;
  const m: Milestone = { id, code: input.code.trim() || id, name: same(input.name.trim()), baseline: input.target, target: input.target, forecast: input.target, actual: input.actual, payment: input.payment && input.payment > 0 ? input.payment : null, drivers: input.drivers };
  useOps.setState((s) => ({ milestones: [...s.milestones, m] }));
  useOps.getState().pushFeed("PM", { en: `Milestone added: ${m.code} ${input.name.trim()}`, az: `Mərhələ əlavə edildi: ${m.code} ${input.name.trim()}` }, `pm/milestones?m=${id}`);
  return id;
}

export function updateMilestone(id: string, input: MilestoneInput) {
  useOps.setState((s) => ({
    milestones: s.milestones.map((m) =>
      m.id === id
        ? { ...m, code: input.code.trim() || m.code, name: m.name.en === input.name.trim() ? m.name : same(input.name.trim()), target: input.target, forecast: input.drivers.length ? m.forecast : input.target, actual: input.actual, payment: input.payment && input.payment > 0 ? input.payment : null, drivers: input.drivers }
        : m,
    ),
  }));
}

export function deleteMilestone(id: string) {
  useOps.setState((s) => ({ milestones: s.milestones.filter((m) => m.id !== id), delays: s.delays.map((d) => (d.milestoneIds.includes(id) ? { ...d, milestoneIds: d.milestoneIds.filter((x) => x !== id) } : d)) }));
}

// ---------------------------------------------------------------- WBS

export type WbsInput = { parentId: string | null; code: string; name: string; building: string | null };

/**
 * Adds a WBS item. The first time the user changes a WBS derived from the BOQ, the derived items
 * become the project's own (they are otherwise rebuilt on load and would be lost once one item is saved).
 */
export function createWbsNode(input: WbsInput): string {
  const s = useOps.getState();
  const base = materialise(s.wbs, s.activities);
  const remap = (pid: string | null) => {
    if (!pid || !base.changed) return pid;
    const i = s.wbs.findIndex((w) => w.id === pid);
    return i >= 0 ? base.wbs[i]!.id : pid;
  };
  const id = `UW-${pad(take("UW"))}`;
  const node: WbsNode = { id, parentId: remap(input.parentId), code: input.code.trim(), name: same(input.name.trim()), building: input.building || null };
  useOps.setState({ wbs: [...base.wbs, node], ...(base.changed ? { activities: base.activities } : {}) });
  return id;
}

export function updateWbsNode(id: string, input: WbsInput) {
  const s = useOps.getState();
  const base = materialise(s.wbs, s.activities);
  const idx = s.wbs.findIndex((w) => w.id === id);
  if (idx < 0) return;
  const realId = base.wbs[idx]!.id;
  const remap = (pid: string | null) => {
    if (!pid) return pid;
    const i = s.wbs.findIndex((w) => w.id === pid);
    return i >= 0 ? base.wbs[i]!.id : pid;
  };
  const parentId = remap(input.parentId);
  useOps.setState({
    wbs: base.wbs.map((w) => (w.id === realId ? { ...w, parentId: parentId === realId ? w.parentId : parentId, code: input.code.trim(), name: w.name.en === input.name.trim() ? w.name : same(input.name.trim()), building: input.building || null } : w)),
    ...(base.changed ? { activities: base.activities } : {}),
  });
  return realId;
}

/** Deletes a WBS item that has no sub-items. Its activities move up to its parent. */
export function deleteWbsNode(id: string): boolean {
  const s = useOps.getState();
  if (s.wbs.some((w) => w.parentId === id)) return false;
  const base = materialise(s.wbs, s.activities);
  const idx = s.wbs.findIndex((w) => w.id === id);
  if (idx < 0) return false;
  const realId = base.wbs[idx]!.id;
  const parent = base.wbs[idx]!.parentId ?? "";
  useOps.setState({ wbs: base.wbs.filter((w) => w.id !== realId), activities: base.activities.map((a) => (a.wbsId === realId ? { ...a, wbsId: parent } : a)) });
  return true;
}

/** WBS items in tree order with their depth, for pickers. */
export function wbsOptions(wbs: WbsNode[]) {
  const kids = new Map<string | null, WbsNode[]>();
  const ids = new Set(wbs.map((w) => w.id));
  for (const w of wbs) {
    const p = w.parentId && ids.has(w.parentId) ? w.parentId : null;
    kids.set(p, [...(kids.get(p) ?? []), w]);
  }
  const out: { node: WbsNode; depth: number }[] = [];
  const walk = (p: string | null, depth: number) => {
    for (const w of kids.get(p) ?? []) {
      if (out.some((o) => o.node.id === w.id)) continue;
      out.push({ node: w, depth });
      walk(w.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

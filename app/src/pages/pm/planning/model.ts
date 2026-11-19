import { diffDays, maxDate, minDate, PROJECT_FINISH, PROJECT_START, TODAY } from "../../../ops/dates";
import { progressWeight } from "../../../ops/select";
import type { Activity, Dependency, LinkType, OpsData, ProgrammeRev, Tool, WbsNode } from "../../../ops/types";

/** Planning tab keys (sub-routes of pm/planning). */
export const TABS = ["programmes", "activities", "resources", "changes"] as const;
export type Tab = (typeof TABS)[number];

export const TOOL_NAME: Record<Tool, string> = { P6: "Primavera P6", MSP: "MS Project" };

const DAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The project's working week as a calendar name, e.g. "Mon–Sat 6d" (every activity runs on it). */
export function calendarName(workweek: number[]) {
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => workweek.includes(d));
  if (!days.length) return "—";
  const run = days.every((d, i) => i === 0 || d === (days[i - 1]! + 1) % 7);
  return `${run && days.length > 1 ? `${DAY_EN[days[0]!]}–${DAY_EN[days[days.length - 1]!]}` : days.map((d) => DAY_EN[d]).join(" ")} ${days.length}d`;
}

export const LINK_WORDS: Record<LinkType, string> = { FS: "Finish to start", SS: "Start to start", FF: "Finish to finish", SF: "Start to finish" };

export const linkLabel = (code: string, l: Pick<Dependency, "type" | "lag">) => `${code} ${l.type}${l.lag ? (l.lag > 0 ? `+${l.lag}` : l.lag) : ""}`;

export const origDur = (a: Activity) => Math.max(0, diffDays(a.bStart, a.bEnd));
export const remDur = (a: Activity) => (a.status === "COMPLETED" ? 0 : Math.max(0, diffDays(a.start > TODAY ? a.start : TODAY, a.end)));
/** P6 variance: baseline finish − finish (negative = late). */
export const variance = (a: Activity) => diffDays(a.end, a.bEnd);

/** Latest finish of the programme; PROJECT_FINISH when there are no activities. */
export const programmeFinish = (acts: Activity[]) => (acts.length ? acts.reduce((m, a) => maxDate(m, a.end), acts[0]!.end) : PROJECT_FINISH);
export const baselineFinish = (acts: Activity[]) => (acts.length ? acts.reduce((m, a) => maxDate(m, a.bEnd), acts[0]!.bEnd) : PROJECT_FINISH);

// ---------------------------------------------------------------- WBS grouping

export type WbsGroup = { node: WbsNode; level: number; children: WbsGroup[]; activities: Activity[] };

/** Activities with no (or an unknown) WBS item are shown under this group. */
export const UNASSIGNED: WbsNode = { id: "__none", parentId: null, code: "—", name: { en: "No WBS item", az: "WBS bəndi yoxdur" }, building: null };

/** WBS tree from the top, with each node's own activities (only nodes that hold work). Activities on no known node come last. */
export function wbsTree(wbs: WbsNode[], acts: Activity[]): WbsGroup[] {
  const ids = new Set(wbs.map((w) => w.id));
  const kids = new Map<string | null, WbsNode[]>();
  for (const w of wbs) {
    const p = w.parentId && ids.has(w.parentId) ? w.parentId : null;
    kids.set(p, [...(kids.get(p) ?? []), w]);
  }
  const own = new Map<string, Activity[]>();
  const loose: Activity[] = [];
  for (const a of acts) {
    if (!ids.has(a.wbsId)) loose.push(a);
    else own.set(a.wbsId, [...(own.get(a.wbsId) ?? []), a]);
  }
  const seen = new Set<string>();
  const build = (parentId: string | null, level: number): WbsGroup[] =>
    (kids.get(parentId) ?? [])
      .filter((node) => !seen.has(node.id) && seen.add(node.id))
      .map((node) => ({ node, level, children: build(node.id, level + 1), activities: own.get(node.id) ?? [] }))
      .filter((g) => g.activities.length || g.children.length);
  const out = build(null, 0);
  if (loose.length) out.push({ node: UNASSIGNED, level: 0, children: [], activities: loose });
  return out;
}

export const groupActivities = (g: WbsGroup): Activity[] => [...g.activities, ...g.children.flatMap(groupActivities)];

export function groupSpan(list: Activity[], weight: (a: Activity) => number = progressWeight(list)) {
  if (!list.length) return null;
  const total = list.reduce((x, a) => x + weight(a), 0);
  return {
    start: list.reduce((m, a) => minDate(m, a.start), list[0]!.start),
    end: list.reduce((m, a) => maxDate(m, a.end), list[0]!.end),
    pct: total > 0 ? list.reduce((x, a) => x + (weight(a) * a.pct) / 100, 0) / total : list.reduce((x, a) => x + a.pct, 0) / list.length / 100,
  };
}

// ---------------------------------------------------------------- resources

const monthKey = (iso: string) => iso.slice(0, 7);
export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/**
 * Plan of a resource by month: its budgeted quantity spread evenly over the months its activities run
 * (a planning assumption, labelled as such). Nothing is counted as used: "used" is what the user records.
 */
export function spreadResource(acts: Activity[], total: number): { month: string; planned: number }[] {
  const w = new Map<string, number>();
  for (const a of acts) {
    const ms = monthsBetween(monthKey(a.start), monthKey(a.end));
    for (const mm of ms) w.set(mm, (w.get(mm) ?? 0) + 1 / ms.length);
  }
  if (!w.size) return [];
  const keys = [...w.keys()].sort();
  const sum = [...w.values()].reduce((x, y) => x + y, 0) || 1;
  return monthsBetween(keys[0]!, keys[keys.length - 1]!).map((mm) => ({ month: mm, planned: Math.round(((w.get(mm) ?? 0) / sum) * total * 10) / 10 }));
}

// ---------------------------------------------------------------- material supply for an activity

export type SupplyState = "ONSITE" | "ONORDER" | "SHORT" | "NOTREQ";
export type SupplyRow = { key: string; name: OpsData["materials"][number]["name"] | null; unit: string; need: number; onSite: number; onOrder: number; state: SupplyState; mrRef: string | null };

export function supplyFor(s: Pick<OpsData, "mrs" | "pos" | "stock" | "materials" | "resources">, activityId: string): SupplyRow[] {
  const mrs = s.mrs.filter((m) => m.activityId === activityId && m.status !== "CANCELLED");
  const rows: SupplyRow[] = [];
  for (const mr of mrs) {
    const pos = s.pos.filter((p) => p.mrId === mr.id && p.status !== "CANCELLED");
    for (const l of mr.lines) {
      const key = l.material ?? l.key;
      const pls = pos.flatMap((p) => p.lines.filter((x) => (l.material ? x.material === l.material : false)).map((x) => ({ p, x })));
      const received = pls.reduce((a, { x }) => a + x.received, 0);
      const onOrder = pls.filter(({ p }) => p.status === "ISSUED" || p.status === "PART_RECEIVED").reduce((a, { x }) => a + Math.max(0, x.qty - x.received), 0);
      const stock = l.material ? (s.stock.find((k) => k.key === l.material)?.onHand ?? 0) : 0;
      const onSite = Math.min(l.qty, Math.max(received, stock));
      const state: SupplyState = onSite >= l.qty - 1e-6 || mr.status === "FULFILLED" ? "ONSITE" : onSite + onOrder >= l.qty - 1e-6 ? "ONORDER" : "SHORT";
      rows.push({ key: `${mr.id}-${key}`, name: l.material ? (s.materials.find((m) => m.key === l.material)?.name ?? l.description) : l.description, unit: l.unit, need: l.qty, onSite: state === "ONSITE" ? l.qty : onSite, onOrder, state, mrRef: mr.ref });
    }
  }
  for (const r of s.resources.filter((x) => x.type === "MATERIAL" && x.activityIds.includes(activityId))) {
    if (rows.length) continue;
    const share = r.budget / Math.max(1, r.activityIds.length);
    rows.push({ key: r.id, name: r.name, unit: r.unit, need: Math.round(share * 10) / 10, onSite: 0, onOrder: 0, state: "NOTREQ", mrRef: null });
  }
  return rows;
}

// ---------------------------------------------------------------- revisions

export type RevRow = { code: string; name: string; oldEnd: string | null; newEnd: string | null; days: number; oldPct: number | null; newPct: number | null; kind: "CHANGED" | "ADDED" | "REMOVED" | "SAME" };

/** Current programme compared with a saved point, biggest moves first. */
export function compareWith(rev: ProgrammeRev, acts: Activity[]): { rows: RevRow[]; finishOld: string; finishNew: string; changed: number; added: number; removed: number; same: number } {
  const rows: RevRow[] = [];
  const snap = new Map(rev.snapshot.map((x) => [x.code, x]));
  const now = new Set(acts.map((a) => a.code));
  for (const a of acts) {
    const o = snap.get(a.code);
    if (!o) {
      rows.push({ code: a.code, name: a.name.en, oldEnd: null, newEnd: a.end, days: 0, oldPct: null, newPct: a.pct, kind: "ADDED" });
      continue;
    }
    const days = diffDays(o.end, a.end);
    rows.push({ code: a.code, name: a.name.en, oldEnd: o.end, newEnd: a.end, days, oldPct: o.pct, newPct: a.pct, kind: days !== 0 || o.start !== a.start || o.pct !== a.pct ? "CHANGED" : "SAME" });
  }
  for (const o of rev.snapshot) if (!now.has(o.code)) rows.push({ code: o.code, name: o.name, oldEnd: o.end, newEnd: null, days: 0, oldPct: o.pct, newPct: null, kind: "REMOVED" });
  rows.sort((a, b) => Math.abs(b.days) - Math.abs(a.days) || (b.newPct ?? 0) - (b.oldPct ?? 0) - ((a.newPct ?? 0) - (a.oldPct ?? 0)) || a.code.localeCompare(b.code));
  const count = (k: RevRow["kind"]) => rows.filter((r) => r.kind === k).length;
  return { rows, finishOld: rev.finish, finishNew: acts.length ? programmeFinish(acts) : "", changed: count("CHANGED"), added: count("ADDED"), removed: count("REMOVED"), same: count("SAME") };
}

// ---------------------------------------------------------------- export files

/** What an export carries besides the activities: the programme's name and code, the data date and the working week. */
export type ExportMeta = { name: string; code: string; dataDate: string; workweek: number[] };

type ExportAct = { n: number; id: string; code: string; name: string; wbsId: string; wbs: number; start: string; end: string; bStart: string; bEnd: string; pct: number; aStart: string | null; aEnd: string | null; status: Activity["status"]; milestone: boolean };

/**
 * Numbered rows: P6 and MS Project need numeric ids, so every activity and WBS item is numbered in list
 * order. A single top WBS item is the project itself and is not written as a WBS item of its own.
 */
function exportRows(acts: Activity[], all: WbsNode[]) {
  const known = new Set(all.map((w) => w.id));
  const roots = all.filter((w) => !w.parentId || !known.has(w.parentId));
  const top = roots.length === 1 ? roots[0]!.id : null;
  const wbs = all.filter((w) => w.id !== top).map((w) => (w.parentId === top ? { ...w, parentId: null } : w));
  const wbsNo = new Map(wbs.map((w, i) => [w.id, i + 1]));
  const rows: ExportAct[] = acts.map((a, i) => ({ n: i + 1, id: a.id, code: a.code, name: a.name.en, wbsId: wbsNo.has(a.wbsId) ? a.wbsId : "", wbs: wbsNo.get(a.wbsId) ?? 0, start: a.start, end: a.end, bStart: a.bStart, bEnd: a.bEnd, pct: a.pct, aStart: a.aStart, aEnd: a.aEnd, status: a.status, milestone: a.isMilestone }));
  const actNo = new Map(rows.map((r) => [r.id, r.n]));
  return { rows, actNo, wbsNo, wbs };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const xerText = (s: string) => s.replace(/[\t\r\n]+/g, " ");
const hours = (a: ExportAct) => Math.max(0, diffDays(a.start, a.end)) * 8;
const p6Status = (a: ExportAct) => (a.status === "COMPLETED" ? "TK_Complete" : a.status === "NOT_STARTED" ? "TK_NotStart" : "TK_Active");
const startOf = (acts: Activity[]) => (acts.length ? acts.reduce((m, a) => minDate(m, a.start), acts[0]!.start) : PROJECT_START);

/** Primavera P6 XER (tab separated tables). */
export function buildXer(meta: ExportMeta, acts: Activity[], links: Dependency[], allWbs: WbsNode[]) {
  const { rows, actNo, wbsNo, wbs } = exportRows(acts, allWbs);
  const T = "\t";
  const code = xerText(meta.code || "PROJECT");
  const out: string[] = [];
  out.push(["ERMHDR", "22.12", meta.dataDate, "Project", "admin", "Nobel", "dbxDatabaseNoName", "Project Management", "AZN", xerText(meta.name)].join(T));
  out.push("%T\tPROJECT", ["%F", "proj_id", "proj_short_name", "last_recalc_date", "plan_start_date", "scd_end_date"].join(T), ["%R", "1", code, `${meta.dataDate} 08:00`, `${startOf(acts)} 08:00`, `${programmeFinish(acts)} 17:00`].join(T));
  out.push("%T\tCALENDAR", ["%F", "clndr_id", "clndr_name", "day_hr_cnt", "week_hr_cnt"].join(T), ["%R", "1", calendarName(meta.workweek), "8", String(meta.workweek.length * 8)].join(T));
  out.push("%T\tPROJWBS", ["%F", "wbs_id", "proj_id", "wbs_short_name", "wbs_name", "parent_wbs_id", "proj_node_flag"].join(T));
  out.push(["%R", "1000000", "1", code, xerText(meta.name), "", "Y"].join(T));
  for (const w of wbs) out.push(["%R", String(1000000 + wbsNo.get(w.id)!), "1", xerText(w.code), xerText(w.name.en), w.parentId && wbsNo.has(w.parentId) ? String(1000000 + wbsNo.get(w.parentId)!) : "1000000", "N"].join(T));
  out.push("%T\tTASK", ["%F", "task_id", "proj_id", "wbs_id", "clndr_id", "task_code", "task_name", "task_type", "status_code", "complete_pct_type", "phys_complete_pct", "target_drtn_hr_cnt", "remain_drtn_hr_cnt", "act_start_date", "act_end_date", "early_start_date", "early_end_date", "target_start_date", "target_end_date"].join(T));
  for (const a of rows) {
    out.push(["%R", String(a.n), "1", String(a.wbs ? 1000000 + a.wbs : 1000000), "1", xerText(a.code), xerText(a.name), a.milestone ? "TT_FinMile" : "TT_Task", p6Status(a), "CP_Phys", String(a.pct), String(hours(a)), String(a.status === "COMPLETED" ? 0 : Math.max(0, diffDays(a.start > meta.dataDate ? a.start : meta.dataDate, a.end)) * 8), a.aStart ? `${a.aStart} 08:00` : "", a.aEnd ? `${a.aEnd} 17:00` : "", `${a.start} 08:00`, `${a.end} 17:00`, `${a.bStart} 08:00`, `${a.bEnd} 17:00`].join(T));
  }
  out.push("%T\tTASKPRED", ["%F", "task_pred_id", "task_id", "pred_task_id", "proj_id", "pred_proj_id", "pred_type", "lag_hr_cnt"].join(T));
  links.forEach((l, i) => {
    const to = actNo.get(l.to);
    const from = actNo.get(l.from);
    if (!to || !from) return;
    out.push(["%R", String(i + 1), String(to), String(from), "1", "1", `PR_${l.type}`, String(l.lag * 8)].join(T));
  });
  out.push("%E");
  return `${out.join("\r\n")}\r\n`;
}

/** Primavera P6 XML (APIBusinessObjects). */
export function buildP6Xml(meta: ExportMeta, acts: Activity[], links: Dependency[], allWbs: WbsNode[]) {
  const { rows, actNo, wbsNo, wbs } = exportRows(acts, allWbs);
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V22.12/API/BusinessObjects">`,
    `  <Calendar><ObjectId>1</ObjectId><Name>${esc(calendarName(meta.workweek))}</Name><HoursPerDay>8</HoursPerDay></Calendar>`,
    `  <Project>`,
    `    <ObjectId>1</ObjectId>`,
    `    <Id>${esc(meta.code || "PROJECT")}</Id>`,
    `    <Name>${esc(meta.name)}</Name>`,
    `    <DataDate>${meta.dataDate}T08:00:00</DataDate>`,
    `    <PlannedStartDate>${startOf(acts)}T08:00:00</PlannedStartDate>`,
    ...wbs.map((w) => `    <WBS><ObjectId>${wbsNo.get(w.id)}</ObjectId>${w.parentId && wbsNo.has(w.parentId) ? `<ParentObjectId>${wbsNo.get(w.parentId)}</ParentObjectId>` : ""}<Code>${esc(w.code)}</Code><Name>${esc(w.name.en)}</Name></WBS>`),
    ...rows.map((a) =>
      [
        `    <Activity>`,
        `      <ObjectId>${a.n}</ObjectId>`,
        `      <Id>${esc(a.code)}</Id>`,
        `      <Name>${esc(a.name)}</Name>`,
        a.wbs ? `      <WBSObjectId>${a.wbs}</WBSObjectId>` : "",
        `      <CalendarObjectId>1</CalendarObjectId>`,
        `      <Type>${a.milestone ? "Finish Milestone" : "Task Dependent"}</Type>`,
        `      <Status>${a.status === "COMPLETED" ? "Completed" : a.status === "NOT_STARTED" ? "Not Started" : "In Progress"}</Status>`,
        `      <PercentComplete>${a.pct / 100}</PercentComplete>`,
        `      <StartDate>${a.start}T08:00:00</StartDate>`,
        `      <FinishDate>${a.end}T17:00:00</FinishDate>`,
        `      <PlannedStartDate>${a.bStart}T08:00:00</PlannedStartDate>`,
        `      <PlannedFinishDate>${a.bEnd}T17:00:00</PlannedFinishDate>`,
        a.aStart ? `      <ActualStartDate>${a.aStart}T08:00:00</ActualStartDate>` : "",
        a.aEnd ? `      <ActualFinishDate>${a.aEnd}T17:00:00</ActualFinishDate>` : "",
        `    </Activity>`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    `  </Project>`,
    ...links.map((l, i) => {
      const f = actNo.get(l.from);
      const t = actNo.get(l.to);
      return f && t ? `  <Relationship><ObjectId>${i + 1}</ObjectId><PredecessorActivityObjectId>${f}</PredecessorActivityObjectId><SuccessorActivityObjectId>${t}</SuccessorActivityObjectId><Type>${LINK_WORDS[l.type]}</Type><Lag>${l.lag * 8}</Lag></Relationship>` : "";
    }),
    `</APIBusinessObjects>`,
  ];
  return lines.filter(Boolean).join("\n");
}

const MSP_TYPE: Record<LinkType, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };

/** Microsoft Project XML (MSPDI). WBS items become summary tasks; activity IDs go to Text1. */
export function buildMspXml(meta: ExportMeta, acts: Activity[], links: Dependency[], allWbs: WbsNode[]) {
  const { rows, wbs } = exportRows(acts, allWbs);
  const ids = new Set(wbs.map((w) => w.id));
  const kids = new Map<string | null, WbsNode[]>();
  for (const w of wbs) {
    const p = w.parentId && ids.has(w.parentId) ? w.parentId : null;
    kids.set(p, [...(kids.get(p) ?? []), w]);
  }
  const byWbs = new Map<string, ExportAct[]>();
  const loose: ExportAct[] = [];
  for (const r of rows) {
    if (r.wbsId && ids.has(r.wbsId)) byWbs.set(r.wbsId, [...(byWbs.get(r.wbsId) ?? []), r]);
    else loose.push(r);
  }
  // Number everything first (outline order), then write: a predecessor may come later in the outline.
  type Row = { uid: number; level: number; r?: ExportAct; w?: WbsNode };
  const order: Row[] = [];
  const actUid = new Map<string, number>();
  const seen = new Set<string>();
  const addAct = (r: ExportAct, level: number) => {
    order.push({ uid: order.length + 1, level, r });
    actUid.set(r.id, order.length);
  };
  const walk = (p: string | null, level: number) => {
    for (const w of kids.get(p) ?? []) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      order.push({ uid: order.length + 1, level, w });
      for (const r of byWbs.get(w.id) ?? []) addAct(r, level + 1);
      walk(w.id, level + 1);
    }
  };
  walk(null, 1);
  for (const r of loose) addAct(r, 1);
  const tasks = order.map((o) => {
    if (o.w) return `    <Task><UID>${o.uid}</UID><ID>${o.uid}</ID><Name>${esc(o.w.name.en)}</Name><WBS>${esc(o.w.code)}</WBS><OutlineLevel>${o.level}</OutlineLevel><Summary>1</Summary></Task>`;
    const a = o.r!;
    return [
      `    <Task>`,
      `      <UID>${o.uid}</UID>`,
      `      <ID>${o.uid}</ID>`,
      `      <Name>${esc(a.name)}</Name>`,
      `      <Text1>${esc(a.code)}</Text1>`,
      `      <OutlineLevel>${o.level}</OutlineLevel>`,
      `      <Summary>0</Summary>`,
      `      <Milestone>${a.milestone ? 1 : 0}</Milestone>`,
      `      <Start>${a.start}T08:00:00</Start>`,
      `      <Finish>${a.end}T17:00:00</Finish>`,
      `      <Duration>PT${hours(a)}H0M0S</Duration>`,
      `      <PercentComplete>${Math.round(a.pct)}</PercentComplete>`,
      a.aStart ? `      <ActualStart>${a.aStart}T08:00:00</ActualStart>` : "",
      a.aEnd ? `      <ActualFinish>${a.aEnd}T17:00:00</ActualFinish>` : "",
      `      <CalendarUID>1</CalendarUID>`,
      ...links
        .filter((l) => l.to === a.id && actUid.has(l.from))
        .map((l) => `      <PredecessorLink><PredecessorUID>${actUid.get(l.from)}</PredecessorUID><Type>${MSP_TYPE[l.type]}</Type><LinkLag>${l.lag * 4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`),
      `      <Baseline><Number>0</Number><Start>${a.bStart}T08:00:00</Start><Finish>${a.bEnd}T17:00:00</Finish></Baseline>`,
      `    </Task>`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<Project xmlns="http://schemas.microsoft.com/project">`,
    `  <Name>${esc(meta.name)}.xml</Name>`,
    `  <Title>${esc(meta.name)}</Title>`,
    `  <StatusDate>${meta.dataDate}T17:00:00</StatusDate>`,
    `  <StartDate>${startOf(acts)}T08:00:00</StartDate>`,
    `  <MinutesPerDay>480</MinutesPerDay>`,
    `  <Calendars><Calendar><UID>1</UID><Name>${esc(calendarName(meta.workweek))}</Name><IsBaseCalendar>1</IsBaseCalendar></Calendar></Calendars>`,
    `  <Tasks>`,
    ...tasks,
    `  </Tasks>`,
    `</Project>`,
  ].join("\n");
}

/** A saved point as a programme: snapshot dates on the current activity list. */
export function actsFromRev(rev: ProgrammeRev, acts: Activity[]): Activity[] {
  const byCode = new Map(acts.map((a) => [a.code, a]));
  return rev.snapshot
    .map((x) => {
      const a = byCode.get(x.code);
      return a ? { ...a, start: x.start, end: x.end, pct: x.pct } : null;
    })
    .filter((a): a is Activity => a !== null);
}

export function download(fileName: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Spread assumed for an activity's remaining work: −10 % best case, +25 % worst case (+40 % while blocked). */
export const RISK_SPREAD = { best: 0.1, worst: 0.25, blocked: 0.4 };

/** Best · most likely · worst remaining durations, from the assumed spread (not from the file). */
export function riskDays(a: Activity) {
  const d = Math.max(1, remDur(a) || origDur(a));
  const up = a.status === "BLOCKED" ? RISK_SPREAD.blocked : RISK_SPREAD.worst;
  return { best: Math.max(1, Math.round(d * (1 - RISK_SPREAD.best))), likely: d, worst: Math.max(d, Math.round(d * (1 + up))) };
}

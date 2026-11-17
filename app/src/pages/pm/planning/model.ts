import { diffDays, maxDate, minDate, PROJECT_START, TODAY } from "../../../ops/dates";
import type { Activity, Dependency, LinkType, OpsData, ProgrammeRev, Resource, Tool, WbsNode } from "../../../ops/types";

/** Planning tab keys (sub-routes of pm/planning). */
export const TABS = ["programmes", "activities", "resources", "changes"] as const;
export type Tab = (typeof TABS)[number];

export const TOOL_NAME: Record<Tool, string> = { P6: "Primavera P6", MSP: "MS Project" };

/** Which tool wrote a file, from its name. null = not a programme file. */
export function detectTool(name: string): Tool | null {
  const n = name.toLowerCase();
  if (n.endsWith(".xer")) return "P6";
  if (n.endsWith(".mpp")) return "MSP";
  if (n.endsWith(".xml")) return n.includes("msp") || n.includes("project") ? "MSP" : "P6";
  return null;
}

export const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Calendar the activity runs on (the P6 file carries two: site Mon–Sat and the fabrication shop 7-day). */
export function calendarOf(a: Activity) {
  return a.code === "WH-150" || a.code === "G-900" ? "Mon–Sun 7d" : "Mon–Sat 6d";
}

export const LINK_WORDS: Record<LinkType, string> = { FS: "Finish to start", SS: "Start to start", FF: "Finish to finish", SF: "Start to finish" };

export const linkLabel = (code: string, l: Pick<Dependency, "type" | "lag">) => `${code} ${l.type}${l.lag ? (l.lag > 0 ? `+${l.lag}` : l.lag) : ""}`;

export const origDur = (a: Activity) => Math.max(0, diffDays(a.bStart, a.bEnd));
export const remDur = (a: Activity) => (a.status === "COMPLETED" ? 0 : Math.max(0, diffDays(a.start > TODAY ? a.start : TODAY, a.end)));
/** P6 variance: baseline finish − finish (negative = late). */
export const variance = (a: Activity) => diffDays(a.end, a.bEnd);

export const programmeFinish = (acts: Activity[]) => acts.reduce((m, a) => maxDate(m, a.end), PROJECT_START);
export const baselineFinish = (acts: Activity[]) => acts.reduce((m, a) => maxDate(m, a.bEnd), PROJECT_START);

// ---------------------------------------------------------------- WBS grouping

export type WbsGroup = { node: WbsNode; level: number; children: WbsGroup[]; activities: Activity[] };

/** WBS tree under the project root, with each node's own activities (only nodes that hold work). */
export function wbsTree(wbs: WbsNode[], acts: Activity[]): WbsGroup[] {
  const root = wbs.find((w) => w.parentId === null);
  const build = (parentId: string | null, level: number): WbsGroup[] =>
    wbs
      .filter((w) => w.parentId === parentId)
      .map((node) => ({ node, level, children: build(node.id, level + 1), activities: acts.filter((a) => a.wbsId === node.id) }))
      .filter((g) => g.activities.length || g.children.length);
  return build(root?.id ?? null, 0);
}

export const groupActivities = (g: WbsGroup): Activity[] => [...g.activities, ...g.children.flatMap(groupActivities)];

export function groupSpan(list: Activity[]) {
  if (!list.length) return null;
  const budget = list.reduce((x, a) => x + a.budget, 0) || 1;
  return {
    start: list.reduce((m, a) => minDate(m, a.start), list[0]!.start),
    end: list.reduce((m, a) => maxDate(m, a.end), list[0]!.end),
    pct: list.reduce((x, a) => x + (a.budget * a.pct) / 100, 0) / budget,
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

/** Spread a resource budget over the months its activities run; past months count as used. */
export function spreadResource(acts: Activity[], total: number, from: string, to: string): Resource["monthly"] {
  const w = new Map<string, number>();
  for (const a of acts) {
    const ms = monthsBetween(monthKey(a.start), monthKey(a.end));
    for (const mm of ms) w.set(mm, (w.get(mm) ?? 0) + 1 / ms.length);
  }
  const sum = [...w.values()].reduce((x, y) => x + y, 0) || 1;
  const now = monthKey(TODAY);
  return monthsBetween(monthKey(from), monthKey(to)).map((mm) => {
    const q = Math.round(((w.get(mm) ?? 0) / sum) * total * 10) / 10;
    return { month: mm, used: mm < now ? q : mm === now ? Math.round(q * 5) / 10 : 0, toCome: mm < now ? 0 : mm === now ? Math.round(q * 5) / 10 : q };
  });
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
  for (const a of acts) {
    const o = rev.snapshot.find((x) => x.code === a.code);
    if (!o) {
      rows.push({ code: a.code, name: a.name.en, oldEnd: null, newEnd: a.end, days: 0, oldPct: null, newPct: a.pct, kind: "ADDED" });
      continue;
    }
    const days = diffDays(o.end, a.end);
    rows.push({ code: a.code, name: a.name.en, oldEnd: o.end, newEnd: a.end, days, oldPct: o.pct, newPct: a.pct, kind: days !== 0 || o.start !== a.start || o.pct !== a.pct ? "CHANGED" : "SAME" });
  }
  for (const o of rev.snapshot) if (!acts.some((a) => a.code === o.code)) rows.push({ code: o.code, name: o.name, oldEnd: o.end, newEnd: null, days: 0, oldPct: o.pct, newPct: null, kind: "REMOVED" });
  rows.sort((a, b) => Math.abs(b.days) - Math.abs(a.days) || (b.newPct ?? 0) - (b.oldPct ?? 0) - ((a.newPct ?? 0) - (a.oldPct ?? 0)) || a.code.localeCompare(b.code));
  const count = (k: RevRow["kind"]) => rows.filter((r) => r.kind === k).length;
  return { rows, finishOld: rev.finish, finishNew: programmeFinish(acts), changed: count("CHANGED"), added: count("ADDED"), removed: count("REMOVED"), same: count("SAME") };
}

// ---------------------------------------------------------------- export files

type ExportAct = { id: string; code: string; name: string; wbs: string; start: string; end: string; bStart: string; bEnd: string; pct: number; aStart: string | null; aEnd: string | null; status: Activity["status"]; cal: string };

const toExport = (acts: Activity[], wbs: WbsNode[]): ExportAct[] =>
  acts.map((a) => ({ id: a.id, code: a.code, name: a.name.en, wbs: wbs.find((w) => w.id === a.wbsId)?.code ?? "", start: a.start, end: a.end, bStart: a.bStart, bEnd: a.bEnd, pct: a.pct, aStart: a.aStart, aEnd: a.aEnd, status: a.status, cal: calendarOf(a) }));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hours = (a: ExportAct) => Math.max(0, diffDays(a.start, a.end)) * 8;
const p6Status = (a: ExportAct) => (a.status === "COMPLETED" ? "TK_Complete" : a.status === "NOT_STARTED" ? "TK_NotStart" : "TK_Active");

/** Primavera P6 XER (tab separated tables). */
export function buildXer(name: string, acts: Activity[], links: Dependency[], wbs: WbsNode[], dataDate: string) {
  const rows = toExport(acts, wbs);
  const T = "\t";
  const out: string[] = [];
  out.push(["ERMHDR", "22.12", dataDate, "Project", "admin", "Nobel", "dbxDatabaseNoName", "Project Management", "AZN"].join(T));
  out.push("%T\tPROJECT", ["%F", "proj_id", "proj_short_name", "last_recalc_date", "plan_start_date", "scd_end_date"].join(T), ["%R", "4501", "QOBU", `${dataDate} 08:00`, `${PROJECT_START} 08:00`, `${programmeFinish(acts)} 17:00`].join(T));
  out.push("%T\tCALENDAR", ["%F", "clndr_id", "clndr_name", "day_hr_cnt", "week_hr_cnt"].join(T), ["%R", "601", "Mon-Sat 6d", "8", "48"].join(T), ["%R", "602", "Mon-Sun 7d", "8", "56"].join(T));
  out.push("%T\tPROJWBS", ["%F", "wbs_id", "proj_id", "wbs_short_name", "wbs_name", "parent_wbs_id"].join(T));
  wbs.forEach((w, i) => out.push(["%R", String(7000 + i), "4501", w.code, w.name.en, w.parentId ? String(7000 + wbs.findIndex((x) => x.id === w.parentId)) : ""].join(T)));
  out.push("%T\tTASK", ["%F", "task_id", "proj_id", "wbs_id", "clndr_id", "task_code", "task_name", "status_code", "phys_complete_pct", "target_drtn_hr_cnt", "remain_drtn_hr_cnt", "act_start_date", "act_end_date", "early_start_date", "early_end_date", "target_start_date", "target_end_date"].join(T));
  for (const a of rows) {
    out.push(["%R", String(9000 + Number(a.id.slice(1))), "4501", String(7000 + wbs.findIndex((w) => w.code === a.wbs)), a.cal.includes("7d") ? "602" : "601", a.code, a.name, p6Status(a), String(a.pct), String(hours(a)), String(a.status === "COMPLETED" ? 0 : Math.max(0, diffDays(a.start > dataDate ? a.start : dataDate, a.end)) * 8), a.aStart ? `${a.aStart} 08:00` : "", a.aEnd ? `${a.aEnd} 17:00` : "", `${a.start} 08:00`, `${a.end} 17:00`, `${a.bStart} 08:00`, `${a.bEnd} 17:00`].join(T));
  }
  out.push("%T\tTASKPRED", ["%F", "task_pred_id", "task_id", "pred_task_id", "proj_id", "pred_type", "lag_hr_cnt"].join(T));
  links.forEach((l, i) => {
    const to = acts.find((a) => a.id === l.to);
    const from = acts.find((a) => a.id === l.from);
    if (!to || !from) return;
    out.push(["%R", String(12000 + i), String(9000 + Number(to.id.slice(1))), String(9000 + Number(from.id.slice(1))), "4501", `PR_${l.type}`, String(l.lag * 8)].join(T));
  });
  out.push("%E");
  out[0] = `${out[0]}\t${name}`;
  return `${out.join("\r\n")}\r\n`;
}

/** Primavera P6 XML (APIBusinessObjects). */
export function buildP6Xml(name: string, acts: Activity[], links: Dependency[], wbs: WbsNode[], dataDate: string) {
  const rows = toExport(acts, wbs);
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V22.12/API/BusinessObjects">`,
    `  <Project>`,
    `    <Id>QOBU</Id>`,
    `    <Name>${esc(name)}</Name>`,
    `    <DataDate>${dataDate}T08:00:00</DataDate>`,
    `    <PlannedStartDate>${PROJECT_START}T08:00:00</PlannedStartDate>`,
    ...wbs.map((w) => `    <WBS><Code>${esc(w.code)}</Code><Name>${esc(w.name.en)}</Name></WBS>`),
    ...rows.map((a) =>
      [
        `    <Activity>`,
        `      <Id>${a.code}</Id>`,
        `      <Name>${esc(a.name)}</Name>`,
        `      <WBSCode>${esc(a.wbs)}</WBSCode>`,
        `      <CalendarName>${a.cal}</CalendarName>`,
        `      <Status>${a.status === "COMPLETED" ? "Completed" : a.status === "NOT_STARTED" ? "Not Started" : "In Progress"}</Status>`,
        `      <PercentComplete>${a.pct / 100}</PercentComplete>`,
        `      <StartDate>${a.start}T08:00:00</StartDate>`,
        `      <FinishDate>${a.end}T17:00:00</FinishDate>`,
        `      <BaselineStartDate>${a.bStart}T08:00:00</BaselineStartDate>`,
        `      <BaselineFinishDate>${a.bEnd}T17:00:00</BaselineFinishDate>`,
        a.aStart ? `      <ActualStartDate>${a.aStart}T08:00:00</ActualStartDate>` : "",
        a.aEnd ? `      <ActualFinishDate>${a.aEnd}T17:00:00</ActualFinishDate>` : "",
        `    </Activity>`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    ...links.map((l) => {
      const f = acts.find((a) => a.id === l.from);
      const t = acts.find((a) => a.id === l.to);
      return f && t ? `    <Relationship><PredecessorActivityId>${f.code}</PredecessorActivityId><SuccessorActivityId>${t.code}</SuccessorActivityId><Type>${LINK_WORDS[l.type]}</Type><Lag>${l.lag * 8}</Lag></Relationship>` : "";
    }),
    `  </Project>`,
    `</APIBusinessObjects>`,
  ];
  return lines.filter(Boolean).join("\n");
}

const MSP_TYPE: Record<LinkType, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };

/** Microsoft Project XML (MSPDI). */
export function buildMspXml(name: string, acts: Activity[], links: Dependency[], wbs: WbsNode[], dataDate: string) {
  const rows = toExport(acts, wbs);
  const uid = (id: string) => Number(id.slice(1));
  const lines = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<Project xmlns="http://schemas.microsoft.com/project">`,
    `  <Name>${esc(name)}</Name>`,
    `  <StatusDate>${dataDate}T17:00:00</StatusDate>`,
    `  <StartDate>${PROJECT_START}T08:00:00</StartDate>`,
    `  <Calendars><Calendar><UID>1</UID><Name>Mon-Sat 6d</Name></Calendar><Calendar><UID>2</UID><Name>Mon-Sun 7d</Name></Calendar></Calendars>`,
    `  <Tasks>`,
    ...rows.map((a) =>
      [
        `    <Task>`,
        `      <UID>${uid(a.id)}</UID>`,
        `      <ID>${uid(a.id)}</ID>`,
        `      <Name>${esc(a.name)}</Name>`,
        `      <WBS>${esc(a.wbs)}</WBS>`,
        `      <Text1>${a.code}</Text1>`,
        `      <Start>${a.start}T08:00:00</Start>`,
        `      <Finish>${a.end}T17:00:00</Finish>`,
        `      <Duration>PT${hours(a)}H0M0S</Duration>`,
        `      <PercentComplete>${a.pct}</PercentComplete>`,
        `      <BaselineStart>${a.bStart}T08:00:00</BaselineStart>`,
        `      <BaselineFinish>${a.bEnd}T17:00:00</BaselineFinish>`,
        a.aStart ? `      <ActualStart>${a.aStart}T08:00:00</ActualStart>` : "",
        a.aEnd ? `      <ActualFinish>${a.aEnd}T17:00:00</ActualFinish>` : "",
        `      <CalendarUID>${a.cal.includes("7d") ? 2 : 1}</CalendarUID>`,
        ...links
          .filter((l) => l.to === a.id)
          .map((l) => `      <PredecessorLink><PredecessorUID>${uid(l.from)}</PredecessorUID><Type>${MSP_TYPE[l.type]}</Type><LinkLag>${l.lag * 4800}</LinkLag></PredecessorLink>`),
        `    </Task>`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    `  </Tasks>`,
    `</Project>`,
  ];
  return lines.join("\n");
}

/** A saved point as a programme: snapshot dates on the current activity list. */
export function actsFromRev(rev: ProgrammeRev, acts: Activity[]): Activity[] {
  return rev.snapshot
    .map((x) => {
      const a = acts.find((y) => y.code === x.code);
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

/** P6 / MSP style best · most likely · worst durations for an activity. */
export function riskDays(a: Activity) {
  const d = Math.max(1, remDur(a) || origDur(a));
  const h = hash(a.code);
  const blocked = a.status === "BLOCKED" ? 0.25 : 0;
  return { best: Math.max(1, Math.round(d * (0.86 + (h % 5) / 100))), likely: d, worst: Math.round(d * (1.18 + (h % 9) / 50 + blocked)) };
}

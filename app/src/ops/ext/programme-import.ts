import { data } from "../../data";
import { diffDays, nowStamp, same, TODAY } from "../dates";
import { me } from "../people";
import { DERIVED_WBS } from "../seed";
import { useOps } from "../store";
import type { Activity, ActivityStatus, Dependency, LinkType, Milestone, Programme, ProgrammeRev, Tool, Txt, WbsNode } from "../types";
import { dropConstraints } from "./planning-p2";

/**
 * Reads real programme files and brings them into the project.
 *
 * - Primavera P6 XER (tab-separated tables: %T table, %F fields, %R rows)
 * - Primavera P6 XML (APIBusinessObjects / PMXML)
 * - Microsoft Project XML (MSPDI, "Save As → XML" in MS Project)
 *
 * Binary .mpp files cannot be read in the browser and are refused with a clear message.
 * Nothing is invented: activities get no budget, crew or owner; the building is set only when a
 * WBS or activity name clearly names one of the project's buildings.
 */

// ---------------------------------------------------------------- parsed file

export type ParsedTask = {
  /** Id of the task in the file (task_id / ObjectId / UID). */
  key: string;
  code: string;
  name: string;
  wbsKey: string | null;
  start: string;
  end: string;
  /** Baseline (or planned) dates; equal to the current dates when the file has neither. */
  bStart: string;
  bEnd: string;
  aStart: string | null;
  aEnd: string | null;
  pct: number;
  status: ActivityStatus;
  milestone: boolean;
};
export type ParsedWbs = { key: string; parentKey: string | null; code: string; name: string };
export type ParsedLink = { from: string; to: string; type: LinkType; lag: number };

export type ParsedProgramme = {
  tool: Tool;
  format: "XER" | "P6XML" | "MSPDI";
  file: string;
  size: number;
  projectCode: string;
  projectName: string;
  dataDate: string | null;
  start: string | null;
  finish: string | null;
  /** "Must finish by" / project deadline in the file, if any. */
  mustFinish: string | null;
  tasks: ParsedTask[];
  wbs: ParsedWbs[];
  links: ParsedLink[];
  calendars: number;
  wbsLevels: number;
  /** Where the baseline dates came from. */
  baseline: "BASELINE" | "PLANNED" | "NONE";
  warnings: Txt[];
};

export type ReadResult = { ok: true; programme: ParsedProgramme } | { ok: false; error: Txt };

const T = (en: string, az: string): Txt => ({ en, az });
const fail = (en: string, az: string): ReadResult => ({ ok: false, error: T(en, az) });

// ---------------------------------------------------------------- helpers

/** "2026-10-05 08:00", "2026-10-05T08:00:00" → "2026-10-05". null for anything that is not a real date. */
export function isoDay(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1950 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const num = (v: string | null | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));

/** Decodes a file: UTF-8 / UTF-16 with or without BOM, else the encoding the XML names, else Windows-1254 (Turkish / Azerbaijani Latin). */
export function decodeBytes(buf: Uint8Array): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf.subarray(2));
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder("utf-8").decode(buf.subarray(3));
  if (buf.length > 4 && buf[0] !== 0 && buf[1] === 0 && buf[2] !== 0 && buf[3] === 0) return new TextDecoder("utf-16le").decode(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    /* not UTF-8 */
  }
  const head = new TextDecoder("windows-1252").decode(buf.subarray(0, 300));
  const named = /encoding=["']([\w.-]+)["']/i.exec(head)?.[1];
  for (const enc of [named, "windows-1254", "windows-1252"]) {
    if (!enc) continue;
    try {
      return new TextDecoder(enc).decode(buf);
    } catch {
      /* unknown label */
    }
  }
  return new TextDecoder("utf-8").decode(buf);
}

const isOle = (buf: Uint8Array) => buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;

/** Best-effort building of the active project named in a WBS or activity name. */
function buildingMatcher() {
  const list = (data.buildings ?? [])
    .flatMap((b) => [b.en, b.az, b.short].filter((n) => n && n.trim().length >= 4).map((n) => ({ id: b.id, n: n.toLocaleLowerCase() })))
    .sort((a, b) => b.n.length - a.n.length);
  return (text: string): string | null => {
    const t = text.toLocaleLowerCase();
    return list.find((x) => t.includes(x.n))?.id ?? null;
  };
}

function finishWarnings(w: Txt[], counts: { noDates: number; badOrder: number; dupCodes: number; unknownLinks: number; selfLinks: number }) {
  const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (counts.noDates) w.push(T(`${pl(counts.noDates, "activity has", "activities have")} no dates and ${counts.noDates === 1 ? "was" : "were"} left out`, `${counts.noDates} işin tarixi yoxdur və idxal edilmədi`));
  if (counts.badOrder) w.push(T(`${pl(counts.badOrder, "activity finishes", "activities finish")} before ${counts.badOrder === 1 ? "it starts" : "they start"}: finish set to the start date`, `${counts.badOrder} iş başlamadan bitir: bitmə tarixi başlama tarixinə bərabər edildi`));
  if (counts.dupCodes) w.push(T(`${pl(counts.dupCodes, "activity ID appears", "activity IDs appear")} more than once: a suffix was added (-2, -3 …)`, `${counts.dupCodes} iş kodu təkrarlanır: sonuna şəkilçi əlavə edildi (-2, -3 …)`));
  if (counts.unknownLinks) w.push(T(`${pl(counts.unknownLinks, "link points", "links point")} to activities that are not in this file and ${counts.unknownLinks === 1 ? "was" : "were"} left out`, `${counts.unknownLinks} əlaqə bu faylda olmayan işlərə aiddir və idxal edilmədi`));
  if (counts.selfLinks) w.push(T(`${pl(counts.selfLinks, "link", "links")} from an activity to itself left out`, `İşin özünə olan ${counts.selfLinks} əlaqə idxal edilmədi`));
}

/** Makes activity codes unique, in file order. */
function uniqueCodes(tasks: ParsedTask[]) {
  const seen = new Map<string, number>();
  let dup = 0;
  for (const t of tasks) {
    const n = (seen.get(t.code) ?? 0) + 1;
    seen.set(t.code, n);
    if (n > 1) {
      dup++;
      let c = `${t.code}-${n}`;
      while (seen.has(c)) c = `${c}x`;
      seen.set(c, 1);
      t.code = c;
    }
  }
  return dup;
}

function wbsDepth(wbs: ParsedWbs[]) {
  const by = new Map(wbs.map((w) => [w.key, w]));
  const memo = new Map<string, number>();
  const depth = (k: string, guard = 0): number => {
    if (memo.has(k)) return memo.get(k)!;
    const w = by.get(k);
    const d = !w || !w.parentKey || guard > 60 ? 1 : depth(w.parentKey, guard + 1) + 1;
    memo.set(k, d);
    return d;
  };
  return wbs.reduce((m, w) => Math.max(m, depth(w.key)), 0);
}

/** Fixes dates on a task in place; false when it has no usable date at all. */
function settle(t: { start: string | null; end: string | null; bStart: string | null; bEnd: string | null; milestone: boolean }, counts: { badOrder: number }) {
  let start = t.start ?? t.end;
  let end = t.end ?? t.start;
  if (!start || !end) return null;
  if (end < start) {
    counts.badOrder++;
    end = start;
  }
  let bStart = t.bStart ?? t.bEnd ?? start;
  let bEnd = t.bEnd ?? t.bStart ?? end;
  if (bEnd < bStart) bEnd = bStart;
  if (t.milestone) {
    // A milestone is one date: its finish, or its start for a start milestone (no finish given).
    start = end = t.end ? end : start;
    bStart = bEnd = t.bEnd ? bEnd : bStart;
  }
  return { start, end, bStart, bEnd };
}

function statusOf(pct: number, aStart: string | null, aEnd: string | null): ActivityStatus {
  if (aEnd || pct >= 100) return "COMPLETED";
  if (aStart || pct > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

// ---------------------------------------------------------------- Primavera P6 XER

type XerTables = Map<string, Record<string, string>[]>;

function readXerTables(text: string): XerTables {
  const tables: XerTables = new Map();
  let rows: Record<string, string>[] | null = null;
  let fields: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (!line) continue;
    const tab = line.indexOf("\t");
    const tag = tab < 0 ? line.trim() : line.slice(0, tab);
    if (tag === "%T") {
      rows = [];
      tables.set(line.slice(tab + 1).trim(), rows);
      fields = [];
    } else if (tag === "%F") {
      fields = line.slice(tab + 1).split("\t").map((f) => f.trim());
    } else if (tag === "%R" && rows) {
      const vals = line.slice(tab + 1).split("\t");
      const row: Record<string, string> = {};
      for (let i = 0; i < fields.length; i++) row[fields[i]!] = vals[i] ?? "";
      rows.push(row);
    }
  }
  return tables;
}

function parseXer(text: string, file: string, size: number): ReadResult {
  const head = text.slice(0, 2000);
  if (!head.startsWith("ERMHDR") && !head.includes("%T\t")) return fail("This is not a Primavera P6 .xer file (no XER tables found).", "Bu Primavera P6 .xer faylı deyil (XER cədvəlləri tapılmadı).");
  const tables = readXerTables(text);
  const allTasks = tables.get("TASK") ?? [];
  if (!allTasks.length) return fail("The file has no activities (the TASK table is empty or missing).", "Faylda iş yoxdur (TASK cədvəli boşdur və ya yoxdur).");
  const warnings: Txt[] = [];

  // A file can carry several projects: take the one with the most activities.
  const projects = tables.get("PROJECT") ?? [];
  const perProject = new Map<string, number>();
  for (const t of allTasks) perProject.set(t.proj_id ?? "", (perProject.get(t.proj_id ?? "") ?? 0) + 1);
  const projId = [...perProject.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const proj = projects.find((p) => p.proj_id === projId) ?? projects[0];
  if (perProject.size > 1) {
    warnings.push(T(`The file holds ${perProject.size} projects; only "${proj?.proj_short_name ?? projId}" (the one with the most activities) was read`, `Faylda ${perProject.size} layihə var; yalnız ən çox işi olan "${proj?.proj_short_name ?? projId}" oxundu`));
  }
  const inProj = (r: Record<string, string>) => perProject.size <= 1 || !("proj_id" in r) || r.proj_id === projId;
  const taskRows = allTasks.filter(inProj);

  // Calendars: hours per working day, used to turn lag hours into days.
  const calRows = tables.get("CALENDAR") ?? [];
  const dayHours = new Map<string, number>();
  for (const c of calRows) {
    const h = num(c.day_hr_cnt);
    if (c.clndr_id && h && h > 0 && h <= 24) dayHours.set(c.clndr_id, h);
  }
  const usedCals = new Set(taskRows.map((t) => t.clndr_id).filter(Boolean));

  // WBS
  const projCode = (proj?.proj_short_name || file.replace(/\.[^.]+$/, "")).trim();
  const wbsRows = (tables.get("PROJWBS") ?? []).filter(inProj);
  const rootRow = wbsRows.find((w) => w.proj_node_flag === "Y");
  const rootKey = rootRow?.wbs_id ?? "__root";
  const wbsById = new Map(wbsRows.map((w) => [w.wbs_id ?? "", w]));
  const wbs: ParsedWbs[] = [{ key: rootKey, parentKey: null, code: projCode, name: rootRow?.wbs_name || proj?.proj_short_name || projCode }];
  const codeOf = new Map<string, string>([[rootKey, projCode]]);
  const fullCode = (id: string, guard = 0): string => {
    if (codeOf.has(id)) return codeOf.get(id)!;
    const w = wbsById.get(id);
    if (!w || guard > 60) return "";
    const parent = w.parent_wbs_id && wbsById.has(w.parent_wbs_id) ? w.parent_wbs_id : rootKey;
    const short = (w.wbs_short_name || w.wbs_id || "").trim();
    const code = parent === rootKey ? short : `${fullCode(parent, guard + 1)}.${short}`;
    codeOf.set(id, code);
    return code;
  };
  for (const w of wbsRows) {
    if (!w.wbs_id || w.wbs_id === rootKey) continue;
    const parent = w.parent_wbs_id && wbsById.has(w.parent_wbs_id) ? w.parent_wbs_id : rootKey;
    wbs.push({ key: w.wbs_id, parentKey: parent, code: fullCode(w.wbs_id), name: (w.wbs_name || w.wbs_short_name || w.wbs_id).trim() });
  }

  // Activities
  const counts = { noDates: 0, badOrder: 0, dupCodes: 0, unknownLinks: 0, selfLinks: 0 };
  let planned = 0;
  const tasks: ParsedTask[] = [];
  const calOf = new Map<string, string>();
  for (const r of taskRows) {
    const key = r.task_id ?? "";
    if (!key) continue;
    const typ = r.task_type ?? "";
    const milestone = typ === "TT_Mile" || typ === "TT_FinMile";
    const aStart = isoDay(r.act_start_date);
    const aEnd = isoDay(r.act_end_date);
    const st = r.status_code ?? "";
    const done = st === "TK_Complete" || !!aEnd;
    const tStart = isoDay(r.target_start_date);
    const tEnd = isoDay(r.target_end_date);
    if (tStart || tEnd) planned++;
    const start = aStart ?? isoDay(r.early_start_date) ?? isoDay(r.restart_date) ?? tStart;
    const end = done ? (aEnd ?? isoDay(r.early_end_date) ?? isoDay(r.reend_date) ?? tEnd) : (isoDay(r.early_end_date) ?? isoDay(r.reend_date) ?? tEnd);
    const dates = settle({ start: typ === "TT_FinMile" ? null : start, end: typ === "TT_Mile" ? null : end, bStart: tStart, bEnd: tEnd, milestone }, counts);
    if (!dates) {
      counts.noDates++;
      continue;
    }
    let pct: number;
    if (done) pct = 100;
    else if (st === "TK_NotStart" && !aStart) pct = 0;
    else {
      const target = num(r.target_drtn_hr_cnt);
      const remain = num(r.remain_drtn_hr_cnt);
      const phys = num(r.phys_complete_pct) ?? num(r.complete_pct);
      pct = r.complete_pct_type === "CP_Drtn" && target && target > 0 && remain != null ? clampPct((1 - remain / target) * 100) : clampPct(phys ?? 0);
    }
    const status: ActivityStatus = done ? "COMPLETED" : st === "TK_Active" || aStart || pct > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    if (r.clndr_id) calOf.set(key, r.clndr_id);
    tasks.push({
      key,
      code: (r.task_code || key).trim(),
      name: (r.task_name || r.task_code || key).trim(),
      wbsKey: r.wbs_id && (wbsById.has(r.wbs_id) || r.wbs_id === rootKey) ? r.wbs_id : rootKey,
      ...dates,
      aStart: status === "NOT_STARTED" ? null : (aStart ?? dates.start),
      aEnd: done ? (aEnd ?? dates.end) : null,
      pct: status === "COMPLETED" ? 100 : pct,
      status,
      milestone,
    });
  }
  counts.dupCodes = uniqueCodes(tasks);

  // Links
  const known = new Set(tasks.map((t) => t.key));
  const links: ParsedLink[] = [];
  for (const r of (tables.get("TASKPRED") ?? [])) {
    const to = r.task_id ?? "";
    const from = r.pred_task_id ?? "";
    if (!known.has(to) || !known.has(from)) {
      if (to && from && (known.has(to) || known.has(from))) counts.unknownLinks++;
      continue;
    }
    if (to === from) {
      counts.selfLinks++;
      continue;
    }
    const type = (r.pred_type ?? "PR_FS").replace("PR_", "") as LinkType;
    const hours = num(r.lag_hr_cnt) ?? 0;
    const perDay = dayHours.get(calOf.get(to) ?? "") ?? 8;
    links.push({ from, to, type: type === "SS" || type === "FF" || type === "SF" ? type : "FS", lag: Math.round(hours / perDay) });
  }
  finishWarnings(warnings, counts);
  const baseline = planned ? "PLANNED" : "NONE";
  if (baseline === "PLANNED") warnings.push(T("XER files carry no baseline: the planned dates in the file are used as the baseline", "XER faylında baza plan olmur: fayldakı planlaşdırılmış tarixlər baza plan kimi götürüldü"));

  return {
    ok: true,
    programme: {
      tool: "P6",
      format: "XER",
      file,
      size,
      projectCode: projCode,
      projectName: (proj?.proj_short_name || projCode).trim(),
      dataDate: isoDay(proj?.last_recalc_date) ?? isoDay(proj?.next_data_date),
      start: isoDay(proj?.plan_start_date),
      finish: isoDay(proj?.scd_end_date),
      mustFinish: isoDay(proj?.plan_end_date),
      tasks,
      wbs,
      links,
      calendars: usedCals.size || calRows.length,
      wbsLevels: wbsDepth(wbs),
      baseline,
      warnings,
    },
  };
}

// ---------------------------------------------------------------- XML helpers

function parseXml(text: string): Document | null {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return null;
  return doc;
}
const kids = (el: Element | null | undefined, name: string): Element[] => {
  if (!el) return [];
  const out: Element[] = [];
  for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) out.push(c);
  return out;
};
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0] ?? null;
const val = (el: Element | null | undefined, name: string) => {
  const k = kid(el, name);
  const v = k?.textContent?.trim();
  return v ? v : null;
};
const all = (doc: Document | Element, name: string) => Array.from(doc.getElementsByTagNameNS("*", name));

// ---------------------------------------------------------------- Microsoft Project XML (MSPDI)

function parseMspdi(doc: Document, file: string, size: number): ReadResult {
  const p = doc.documentElement;
  const taskEls = kids(kid(p, "Tasks"), "Task");
  if (!taskEls.length) return fail("The MS Project file has no tasks.", "MS Project faylında tapşırıq yoxdur.");
  const warnings: Txt[] = [];
  const counts = { noDates: 0, badOrder: 0, dupCodes: 0, unknownLinks: 0, selfLinks: 0 };
  const minutesPerDay = num(val(p, "MinutesPerDay")) || 480;
  const projectName = (val(p, "Title") || val(p, "Name") || file.replace(/\.[^.]+$/, "")).replace(/\.xml$/i, "").trim();
  const projectCode = projectName.length > 24 ? projectName.slice(0, 24).trim() : projectName;

  // Summary tasks become WBS nodes by outline; the rest become activities.
  const rootKey = "__root";
  const wbs: ParsedWbs[] = [{ key: rootKey, parentKey: null, code: "0", name: projectName }];
  const stack: { level: number; key: string }[] = [];
  type Raw = { uid: string; el: Element; parent: string };
  const raws: Raw[] = [];
  const summaryUids = new Set<string>();
  for (const el of taskEls) {
    if (val(el, "IsNull") === "1") continue;
    const uid = val(el, "UID");
    if (uid == null) continue;
    const level = num(val(el, "OutlineLevel")) ?? 1;
    if (level <= 0 || uid === "0") continue; // the project summary task
    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    const parent = stack[stack.length - 1]?.key ?? rootKey;
    if (val(el, "Summary") === "1") {
      const key = `S${uid}`;
      summaryUids.add(uid);
      wbs.push({ key, parentKey: parent, code: val(el, "WBS") || val(el, "OutlineNumber") || uid, name: val(el, "Name") || uid });
      stack.push({ level, key });
    } else raws.push({ uid, el, parent });
  }

  // Activity IDs: the user's own codes in Text1 when every task has a unique one, else the WBS code, else the row ID.
  const pickCodes = (field: string) => {
    const v = raws.map((r) => val(r.el, field));
    return v.every((x) => x) && new Set(v).size === v.length ? (v as string[]) : null;
  };
  const codes = pickCodes("Text1") ?? pickCodes("WBS") ?? raws.map((r) => val(r.el, "ID") || r.uid);

  let hasBaseline = false;
  const tasks: ParsedTask[] = [];
  raws.forEach((r, i) => {
    const el = r.el;
    const milestone = val(el, "Milestone") === "1";
    const base0 = kids(el, "Baseline").find((b) => (val(b, "Number") ?? "0") === "0");
    const bStart = isoDay(val(base0, "Start")) ?? isoDay(val(el, "BaselineStart"));
    const bEnd = isoDay(val(base0, "Finish")) ?? isoDay(val(el, "BaselineFinish"));
    if (bStart || bEnd) hasBaseline = true;
    const aStart = isoDay(val(el, "ActualStart"));
    const aEnd = isoDay(val(el, "ActualFinish"));
    const pctRaw = num(val(el, "PercentComplete")) ?? 0;
    const pct = aEnd ? 100 : clampPct(pctRaw);
    const dates = settle({ start: isoDay(val(el, "Start")), end: isoDay(val(el, "Finish")), bStart, bEnd, milestone }, counts);
    if (!dates) {
      counts.noDates++;
      return;
    }
    const status = statusOf(pct, aStart, aEnd);
    tasks.push({
      key: r.uid,
      code: codes[i] ?? r.uid,
      name: val(el, "Name") || codes[i] || r.uid,
      wbsKey: r.parent,
      ...dates,
      aStart: status === "NOT_STARTED" ? null : (aStart ?? dates.start),
      aEnd: status === "COMPLETED" ? (aEnd ?? dates.end) : null,
      pct: status === "COMPLETED" ? 100 : pct,
      status,
      milestone,
    });
  });
  counts.dupCodes = uniqueCodes(tasks);

  // Links: PredecessorLink inside each successor. Type 0 FF, 1 FS, 2 SF, 3 SS; LinkLag in tenths of a minute.
  const known = new Set(tasks.map((t) => t.key));
  const TYPES: Record<string, LinkType> = { "0": "FF", "1": "FS", "2": "SF", "3": "SS" };
  const ELAPSED = new Set(["4", "6", "8", "10", "12"]);
  let summaryLinks = 0;
  let pctLags = 0;
  const links: ParsedLink[] = [];
  for (const r of raws) {
    if (!known.has(r.uid)) continue;
    for (const pl of kids(r.el, "PredecessorLink")) {
      const from = val(pl, "PredecessorUID");
      if (!from) continue;
      if (from === r.uid) {
        counts.selfLinks++;
        continue;
      }
      if (!known.has(from)) {
        if (summaryUids.has(from)) summaryLinks++;
        else counts.unknownLinks++;
        continue;
      }
      const fmt = val(pl, "LagFormat") ?? "7";
      const tenths = num(val(pl, "LinkLag")) ?? 0;
      let lag = 0;
      if (fmt === "19" || fmt === "20") {
        if (tenths) pctLags++;
      } else lag = Math.round(tenths / 10 / (ELAPSED.has(fmt) ? 1440 : minutesPerDay));
      links.push({ from, to: r.uid, type: TYPES[val(pl, "Type") ?? "1"] ?? "FS", lag });
    }
  }
  finishWarnings(warnings, counts);
  if (summaryLinks) warnings.push(T(`${summaryLinks} ${summaryLinks === 1 ? "link to a summary task was" : "links to summary tasks were"} left out (summary tasks become WBS items here)`, `Xülasə tapşırıqlara olan ${summaryLinks} əlaqə idxal edilmədi (xülasə tapşırıqlar burada WBS bəndi olur)`));
  if (pctLags) warnings.push(T(`${pctLags} ${pctLags === 1 ? "link uses a percentage lag and was" : "links use a percentage lag and were"} read with no lag`, `${pctLags} əlaqədə faizlə gecikmə var və gecikməsiz oxundu`));
  if (!hasBaseline) warnings.push(T("The file has no baseline: the current dates are used as the baseline", "Faylda baza plan yoxdur: cari tarixlər baza plan kimi götürüldü"));
  const status = isoDay(val(p, "StatusDate"));
  if (!status) warnings.push(T("The file has no status date: today is used as the data date", "Faylda status tarixi yoxdur: bu gün məlumat tarixi kimi götürüldü"));
  const cals = kids(kid(p, "Calendars"), "Calendar");
  const baseCals = cals.filter((c) => val(c, "IsBaseCalendar") === "1");

  return {
    ok: true,
    programme: {
      tool: "MSP",
      format: "MSPDI",
      file,
      size,
      projectCode,
      projectName,
      dataDate: status,
      start: isoDay(val(p, "StartDate")),
      finish: isoDay(val(p, "FinishDate")),
      mustFinish: null,
      tasks,
      wbs,
      links,
      calendars: baseCals.length || cals.length,
      wbsLevels: wbsDepth(wbs),
      baseline: hasBaseline ? "BASELINE" : "NONE",
      warnings,
    },
  };
}

// ---------------------------------------------------------------- Primavera P6 XML (APIBusinessObjects)

function parseP6Xml(doc: Document, file: string, size: number): ReadResult {
  const root = doc.documentElement;
  const projects = kids(root, "Project");
  if (!projects.length) return fail("The P6 XML file has no project.", "P6 XML faylında layihə yoxdur.");
  const proj = [...projects].sort((a, b) => kids(b, "Activity").length - kids(a, "Activity").length)[0]!;
  const actEls = kids(proj, "Activity");
  if (!actEls.length) return fail("The P6 XML project has no activities.", "P6 XML layihəsində iş yoxdur.");
  const warnings: Txt[] = [];
  if (projects.length > 1) warnings.push(T(`The file holds ${projects.length} projects; only the one with the most activities was read`, `Faylda ${projects.length} layihə var; yalnız ən çox işi olan oxundu`));
  const counts = { noDates: 0, badOrder: 0, dupCodes: 0, unknownLinks: 0, selfLinks: 0 };
  const projectCode = (val(proj, "Id") || file.replace(/\.[^.]+$/, "")).trim();
  const projectName = (val(proj, "Name") || projectCode).trim();

  // WBS by ObjectId, or by code when the file has none.
  const rootKey = "__root";
  const wbsEls = kids(proj, "WBS");
  const wbsKeyOf = (el: Element) => val(el, "ObjectId") ?? `C:${val(el, "Code") ?? ""}`;
  const keys = new Set(wbsEls.map(wbsKeyOf));
  const codeKey = new Map(wbsEls.map((el) => [val(el, "Code") ?? "", wbsKeyOf(el)]));
  const wbs: ParsedWbs[] = [{ key: rootKey, parentKey: null, code: projectCode, name: projectName }];
  for (const el of wbsEls) {
    const key = wbsKeyOf(el);
    const code = val(el, "Code") ?? key;
    let parent = val(el, "ParentObjectId");
    if (!parent || !keys.has(parent)) {
      const up = code.includes(".") ? codeKey.get(code.slice(0, code.lastIndexOf("."))) : undefined;
      parent = up ?? rootKey;
    }
    wbs.push({ key, parentKey: parent === key ? rootKey : parent, code, name: val(el, "Name") ?? code });
  }

  const raw = actEls.map((el) => num(val(el, "PercentComplete")) ?? 0);
  const fraction = raw.every((v) => v <= 1);
  let hasBaseline = false;
  let hasPlanned = false;
  const tasks: ParsedTask[] = [];
  actEls.forEach((el, i) => {
    const key = val(el, "ObjectId") ?? val(el, "Id") ?? String(i);
    const type = val(el, "Type") ?? "";
    const milestone = /milestone/i.test(type);
    const aStart = isoDay(val(el, "ActualStartDate"));
    const aEnd = isoDay(val(el, "ActualFinishDate"));
    const blS = isoDay(val(el, "BaselineStartDate"));
    const blF = isoDay(val(el, "BaselineFinishDate"));
    const plS = isoDay(val(el, "PlannedStartDate"));
    const plF = isoDay(val(el, "PlannedFinishDate"));
    if (blS || blF) hasBaseline = true;
    if (plS || plF) hasPlanned = true;
    const statusText = (val(el, "Status") ?? "").toLowerCase();
    const done = statusText.startsWith("complete") || !!aEnd;
    const start = aStart ?? isoDay(val(el, "StartDate")) ?? isoDay(val(el, "RemainingEarlyStartDate")) ?? plS;
    const end = done ? (aEnd ?? isoDay(val(el, "FinishDate")) ?? plF) : (isoDay(val(el, "FinishDate")) ?? isoDay(val(el, "RemainingEarlyFinishDate")) ?? plF);
    const dates = settle({ start: /finish milestone/i.test(type) ? null : start, end: /start milestone/i.test(type) ? null : end, bStart: blS ?? plS, bEnd: blF ?? plF, milestone }, counts);
    if (!dates) {
      counts.noDates++;
      return;
    }
    const pct = done ? 100 : clampPct(fraction ? raw[i]! * 100 : raw[i]!);
    const status: ActivityStatus = done ? "COMPLETED" : statusText.includes("progress") || aStart || pct > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    const wbsId = val(el, "WBSObjectId");
    const wbsCode = val(el, "WBSCode");
    tasks.push({
      key,
      code: (val(el, "Id") || key).trim(),
      name: (val(el, "Name") || val(el, "Id") || key).trim(),
      wbsKey: wbsId && keys.has(wbsId) ? wbsId : wbsCode && codeKey.has(wbsCode) ? codeKey.get(wbsCode)! : rootKey,
      ...dates,
      aStart: status === "NOT_STARTED" ? null : (aStart ?? dates.start),
      aEnd: done ? (aEnd ?? dates.end) : null,
      pct: status === "COMPLETED" ? 100 : pct,
      status,
      milestone,
    });
  });
  counts.dupCodes = uniqueCodes(tasks);

  const known = new Set(tasks.map((t) => t.key));
  const byCode = new Map(tasks.map((t) => [t.code, t.key]));
  const TYPES: Record<string, LinkType> = { "finish to start": "FS", "start to start": "SS", "finish to finish": "FF", "start to finish": "SF" };
  const links: ParsedLink[] = [];
  for (const el of all(doc, "Relationship")) {
    const from = val(el, "PredecessorActivityObjectId") ?? byCode.get(val(el, "PredecessorActivityId") ?? "") ?? null;
    const to = val(el, "SuccessorActivityObjectId") ?? byCode.get(val(el, "SuccessorActivityId") ?? "") ?? null;
    if (!from || !to) continue;
    if (!known.has(from) || !known.has(to)) {
      if (known.has(from) || known.has(to)) counts.unknownLinks++;
      continue;
    }
    if (from === to) {
      counts.selfLinks++;
      continue;
    }
    const typeText = (val(el, "Type") ?? "Finish to Start").toLowerCase();
    const short = typeText.replace("pr_", "").toUpperCase();
    const type: LinkType = TYPES[typeText] ?? (short === "SS" || short === "FF" || short === "SF" ? short : "FS");
    links.push({ from, to, type, lag: Math.round((num(val(el, "Lag")) ?? 0) / 8) });
  }
  finishWarnings(warnings, counts);
  const baseline = hasBaseline ? "BASELINE" : hasPlanned ? "PLANNED" : "NONE";
  if (baseline === "PLANNED") warnings.push(T("The file has no baseline: the planned dates are used as the baseline", "Faylda baza plan yoxdur: planlaşdırılmış tarixlər baza plan kimi götürüldü"));

  return {
    ok: true,
    programme: {
      tool: "P6",
      format: "P6XML",
      file,
      size,
      projectCode,
      projectName,
      dataDate: isoDay(val(proj, "DataDate")),
      start: isoDay(val(proj, "PlannedStartDate")) ?? isoDay(val(proj, "StartDate")),
      finish: isoDay(val(proj, "ScheduledFinishDate")) ?? isoDay(val(proj, "FinishDate")),
      mustFinish: isoDay(val(proj, "MustFinishByDate")),
      tasks,
      wbs,
      links,
      calendars: kids(root, "Calendar").length || all(doc, "Calendar").length,
      wbsLevels: wbsDepth(wbs),
      baseline,
      warnings,
    },
  };
}

// ---------------------------------------------------------------- entry point

export const ACCEPT = ".xer,.xml,.mpp";

/** Reads a programme file the user chose. Never throws: a file that cannot be used comes back with a reason. */
export async function readProgrammeFile(file: File): Promise<ReadResult> {
  const name = file.name;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "mpp" || ext === "mpt") {
    return fail(
      "MS Project .mpp files are a closed binary format and cannot be read here. Save the file as XML from MS Project: File → Save As → XML, then import that file.",
      "MS Project .mpp faylı qapalı ikili formatdır və burada oxuna bilmir. Faylı MS Project-də XML kimi saxlayın: Fayl → Fərqli saxla → XML, sonra həmin faylı idxal edin.",
    );
  }
  if (ext !== "xer" && ext !== "xml") return fail(`${name} is not a programme file. Use a Primavera P6 .xer or .xml file, or an MS Project .xml file.`, `${name} qrafik faylı deyil. Primavera P6 .xer və ya .xml, yaxud MS Project .xml faylından istifadə edin.`);
  if (!file.size) return fail("The file is empty.", "Fayl boşdur.");
  let buf: Uint8Array;
  try {
    buf = new Uint8Array(await file.arrayBuffer());
  } catch {
    return fail("The file could not be opened.", "Faylı açmaq mümkün olmadı.");
  }
  if (isOle(buf)) {
    return fail("This is a binary MS Project file. Save it as XML from MS Project: File → Save As → XML.", "Bu ikili MS Project faylıdır. Onu MS Project-də XML kimi saxlayın: Fayl → Fərqli saxla → XML.");
  }
  try {
    const text = decodeBytes(buf);
    if (ext === "xer") return parseXer(text, name, file.size);
    const doc = parseXml(text);
    if (!doc) return fail("The XML in this file is damaged and cannot be read.", "Bu fayldakı XML zədələnib və oxuna bilmir.");
    const rootName = doc.documentElement.localName;
    if (rootName === "Project") return parseMspdi(doc, name, file.size);
    if (rootName === "APIBusinessObjects") return parseP6Xml(doc, name, file.size);
    return fail("This XML is not an MS Project (MSPDI) or Primavera P6 file.", "Bu XML MS Project (MSPDI) və ya Primavera P6 faylı deyil.");
  } catch {
    return fail("The file could not be read. Check that it is a complete export from P6 or MS Project.", "Faylı oxumaq mümkün olmadı. P6 və ya MS Project-dən tam ixrac edildiyini yoxlayın.");
  }
}

// ---------------------------------------------------------------- preview and import

export type ImportMode = "NEW" | "REVISION";

export type ImportPreview = {
  finishFile: string | null;
  startFile: string | null;
  finishBefore: string | null;
  done: number;
  inProgress: number;
  notStarted: number;
  milestones: number;
  /** Duration-weighted share done in the file, 0–100. */
  progress: number;
  /** Revision only: compared with the activities the project has now (matched by activity ID). */
  changed: number;
  added: number;
  removed: number;
  same: number;
  current: number;
};

export type ImportResult = {
  programmeId: string;
  revId: string;
  finishBefore: string | null;
  finishAfter: string | null;
  changed: number;
  added: number;
  removed: number;
};

const fileFinish = (p: ParsedProgramme) => p.tasks.reduce<string | null>((m, t) => (!m || t.end > m ? t.end : m), null);
const fileStart = (p: ParsedProgramme) => p.tasks.reduce<string | null>((m, t) => (!m || t.start < m ? t.start : m), null);
const currentFinish = (acts: Activity[]) => acts.reduce<string | null>((m, a) => (!m || a.end > m ? a.end : m), null);

function weightedProgress(tasks: ParsedTask[]) {
  let w = 0;
  let e = 0;
  for (const t of tasks) {
    if (t.milestone) continue;
    const d = Math.max(1, diffDays(t.bStart, t.bEnd));
    w += d;
    e += (d * t.pct) / 100;
  }
  return w > 0 ? Math.round((e / w) * 1000) / 10 : 0;
}

/** Matches file tasks to the project's activities: by activity ID first, then by a unique name. */
function matchTasks(tasks: ParsedTask[], acts: Activity[]) {
  const byCode = new Map(acts.map((a) => [a.code, a]));
  const nameCount = new Map<string, number>();
  for (const a of acts) nameCount.set(a.name.en, (nameCount.get(a.name.en) ?? 0) + 1);
  const byName = new Map(acts.filter((a) => nameCount.get(a.name.en) === 1).map((a) => [a.name.en, a]));
  const used = new Set<string>();
  const match = new Map<string, Activity>();
  const fileCodes = new Set(tasks.map((t) => t.code));
  for (const t of tasks) {
    const a = byCode.get(t.code);
    if (a && !used.has(a.id)) {
      match.set(t.key, a);
      used.add(a.id);
    }
  }
  for (const t of tasks) {
    if (match.has(t.key)) continue;
    const a = byName.get(t.name);
    if (a && !used.has(a.id) && !fileCodes.has(a.code)) {
      match.set(t.key, a);
      used.add(a.id);
    }
  }
  return { match, used };
}

export function previewImport(p: ParsedProgramme, mode: ImportMode): ImportPreview {
  const s = useOps.getState();
  const done = p.tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgress = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;
  let changed = 0;
  let added = 0;
  let removed = 0;
  let same = 0;
  if (mode === "REVISION") {
    const { match, used } = matchTasks(p.tasks, s.activities);
    for (const t of p.tasks) {
      const a = match.get(t.key);
      if (!a) added++;
      else if (a.start !== t.start || a.end !== t.end || a.pct !== t.pct || a.name.en !== t.name) changed++;
      else same++;
    }
    removed = s.activities.filter((a) => !used.has(a.id)).length;
  }
  return {
    finishFile: fileFinish(p),
    startFile: fileStart(p),
    finishBefore: currentFinish(s.activities),
    done,
    inProgress,
    notStarted: p.tasks.length - done - inProgress,
    milestones: p.tasks.filter((t) => t.milestone).length,
    progress: weightedProgress(p.tasks),
    changed,
    added,
    removed,
    same,
    current: s.activities.length,
  };
}

const pad = (n: number) => String(n).padStart(4, "0");

/** WBS ids the BOQ derives are rebuilt on every load and never saved; once the user's WBS is saved they must become real nodes. */
export function materialise(wbs: WbsNode[], activities: Activity[]) {
  if (!wbs.some((w) => w.id.startsWith(DERIVED_WBS))) return { wbs, activities, changed: false };
  const map = new Map<string, string>();
  for (const w of wbs) if (w.id.startsWith(DERIVED_WBS)) map.set(w.id, `W-${w.id.slice(DERIVED_WBS.length)}`);
  const re = (id: string | null) => (id && map.has(id) ? map.get(id)! : id);
  return {
    wbs: wbs.map((w) => ({ ...w, id: re(w.id)!, parentId: re(w.parentId) })),
    activities: activities.map((a) => (map.has(a.wbsId) ? { ...a, wbsId: map.get(a.wbsId)! } : a)),
    changed: true,
  };
}

const snapshotOf = (acts: Activity[]) => acts.map((a) => ({ code: a.code, name: a.name.en, start: a.start, end: a.end, pct: a.pct }));

/**
 * Saves a read file into the project.
 * NEW: the file's activities, links, WBS and milestones replace the project's (the old ones are kept as a saved point).
 * REVISION: activities are updated by activity ID, new ones added and (if asked) ones missing from the file removed.
 */
export function importProgramme(p: ParsedProgramme, opts: { mode: ImportMode; name: string; removeMissing: boolean }): ImportResult {
  const s = useOps.getState();
  const seq = { ...s.seq };
  const next = (kind: string) => {
    seq[kind] = (seq[kind] ?? 0) + 1;
    return seq[kind]!;
  };
  const matchBuilding = buildingMatcher();
  const finishBefore = currentFinish(s.activities);
  const revisions: ProgrammeRev[] = [...s.revisions];
  const nextRev = () => revisions.reduce((m, r) => Math.max(m, r.rev), 0) + 1;
  const current = s.programmes.find((x) => x.current);

  // Keep what the project looked like before.
  if (s.activities.length) {
    revisions.push({ id: `REV-${next("REV")}`, programmeId: current?.id ?? "", rev: nextRev(), label: same(`Kept before importing ${p.file}`), kind: "KEPT", file: null, at: nowStamp(), by: me(), finish: finishBefore ?? "", activities: s.activities.length, snapshot: snapshotOf(s.activities) });
  }

  // ---- WBS
  let wbs: WbsNode[];
  let activities: Activity[];
  const wbsIdOf = new Map<string, string>();
  const parsedWbs = new Map(p.wbs.map((w) => [w.key, w]));
  const buildingOfWbs = new Map<string, string | null>();
  const wbsBuilding = (key: string | null, guard = 0): string | null => {
    if (!key || guard > 60) return null;
    if (buildingOfWbs.has(key)) return buildingOfWbs.get(key)!;
    const w = parsedWbs.get(key);
    // The top item is the whole project: its name says nothing about one building.
    const b = w && w.parentKey ? (matchBuilding(w.name) ?? wbsBuilding(w.parentKey, guard + 1)) : null;
    buildingOfWbs.set(key, b);
    return b;
  };

  if (opts.mode === "NEW") {
    wbs = [];
    for (const w of p.wbs) wbsIdOf.set(w.key, `PW-${next("PW")}`);
    for (const w of p.wbs) wbs.push({ id: wbsIdOf.get(w.key)!, parentId: w.parentKey ? (wbsIdOf.get(w.parentKey) ?? null) : null, code: w.code, name: same(w.name), building: wbsBuilding(w.key) });
    activities = [];
  } else {
    const base = materialise(s.wbs, s.activities);
    wbs = [...base.wbs];
    activities = base.activities;
    const byCode = new Map(wbs.map((w) => [w.code, w.id]));
    const root = wbs.find((w) => w.parentId === null);
    for (const w of p.wbs) {
      const hit = w.parentKey === null && root ? root.id : byCode.get(w.code);
      if (hit) wbsIdOf.set(w.key, hit);
    }
    for (const w of p.wbs) {
      if (wbsIdOf.has(w.key)) continue;
      const id = `PW-${next("PW")}`;
      wbsIdOf.set(w.key, id);
    }
    for (const w of p.wbs) {
      const id = wbsIdOf.get(w.key)!;
      if (wbs.some((x) => x.id === id)) continue;
      wbs.push({ id, parentId: w.parentKey ? (wbsIdOf.get(w.parentKey) ?? root?.id ?? null) : null, code: w.code, name: same(w.name), building: wbsBuilding(w.key) });
    }
  }

  // ---- activities
  const idOf = new Map<string, string>();
  let changed = 0;
  let added = 0;
  let removedIds: string[] = [];
  const fresh = (t: ParsedTask): Activity => {
    const id = `A-${pad(next("A"))}`;
    return {
      id,
      code: t.code,
      wbsId: (t.wbsKey && wbsIdOf.get(t.wbsKey)) || "",
      name: same(t.name),
      building: matchBuilding(t.name) ?? wbsBuilding(t.wbsKey) ?? "",
      section: null,
      start: t.start,
      end: t.end,
      bStart: t.bStart,
      bEnd: t.bEnd,
      aStart: t.aStart,
      aEnd: t.aEnd,
      pct: t.pct,
      status: t.status,
      priority: "MEDIUM",
      isMilestone: t.milestone,
      owner: "",
      budget: 0,
      crew: 0,
      blockedReason: null,
    };
  };
  if (opts.mode === "NEW") {
    for (const t of p.tasks) {
      const a = fresh(t);
      idOf.set(t.key, a.id);
      activities.push(a);
    }
    added = activities.length;
    removedIds = s.activities.map((a) => a.id);
  } else {
    const { match, used } = matchTasks(p.tasks, activities);
    const updated = new Map<string, Activity>();
    for (const t of p.tasks) {
      const a = match.get(t.key);
      if (!a) continue;
      idOf.set(t.key, a.id);
      const moved = a.start !== t.start || a.end !== t.end || a.pct !== t.pct || a.name.en !== t.name;
      if (moved) changed++;
      updated.set(a.id, {
        ...a,
        code: t.code,
        name: a.name.en === t.name ? a.name : same(t.name),
        wbsId: (t.wbsKey && wbsIdOf.get(t.wbsKey)) || a.wbsId,
        start: t.start,
        end: t.end,
        aStart: t.aStart,
        aEnd: t.aEnd,
        pct: t.pct,
        // A blocked activity stays blocked until someone clears it.
        status: a.status === "BLOCKED" && t.status !== "COMPLETED" ? "BLOCKED" : t.status,
        isMilestone: t.milestone,
      });
    }
    removedIds = opts.removeMissing ? activities.filter((a) => !used.has(a.id)).map((a) => a.id) : [];
    const gone = new Set(removedIds);
    activities = activities.filter((a) => !gone.has(a.id)).map((a) => updated.get(a.id) ?? a);
    for (const t of p.tasks) {
      if (idOf.has(t.key)) continue;
      const a = fresh(t);
      idOf.set(t.key, a.id);
      activities.push(a);
      added++;
    }
  }
  const gone = new Set(removedIds);

  // ---- links
  const fileLinks: Dependency[] = [];
  const seen = new Set<string>();
  for (const l of p.links) {
    const from = idOf.get(l.from);
    const to = idOf.get(l.to);
    if (!from || !to) continue;
    const k = `${from}>${to}>${l.type}`;
    if (seen.has(k)) continue;
    seen.add(k);
    fileLinks.push({ id: `PL-${next("PL")}`, from, to, type: l.type, lag: l.lag });
  }
  let links: Dependency[];
  if (opts.mode === "NEW") links = fileLinks;
  else {
    const inFile = new Set(idOf.values());
    // Links between activities of the file come from the file; links to activities kept by hand stay.
    links = [...s.links.filter((l) => !gone.has(l.from) && !gone.has(l.to) && !(inFile.has(l.from) && inFile.has(l.to))), ...fileLinks];
  }

  // ---- milestones from milestone activities
  let milestones: Milestone[] = opts.mode === "NEW" ? [] : s.milestones.map((m) => ({ ...m, drivers: m.drivers.filter((d) => !gone.has(d)) }));
  for (const t of p.tasks.filter((x) => x.milestone)) {
    const actId = idOf.get(t.key);
    if (!actId) continue;
    const existing = milestones.find((m) => m.code === t.code || m.drivers.includes(actId));
    const actual = t.status === "COMPLETED" ? (t.aEnd ?? t.end) : null;
    if (existing) {
      milestones = milestones.map((m) => (m === existing ? { ...m, name: m.name.en === t.name ? m.name : same(t.name), forecast: t.end, actual: actual ?? m.actual, drivers: m.drivers.includes(actId) ? m.drivers : [...m.drivers, actId] } : m));
    } else {
      milestones.push({ id: `MS-${pad(next("MS"))}`, code: t.code, name: same(t.name), baseline: t.bEnd, target: t.bEnd, forecast: t.end, actual, payment: null, drivers: [actId] });
    }
  }

  // ---- programme record and saved point
  const finishAfter = currentFinish(activities);
  const progress = weightedProgress(p.tasks);
  const dataDate = p.dataDate ?? TODAY;
  const programmeId = opts.mode === "NEW" || !current ? `PRG-${next("PRG")}` : current.id;
  const programme: Programme = {
    id: programmeId,
    name: opts.name.trim() || p.projectName || p.file.replace(/\.[^.]+$/, ""),
    tool: p.tool,
    file: p.file,
    projectCode: p.projectCode,
    dataDate,
    contractFinish: s.setup.contractFinish ?? p.mustFinish ?? "",
    finish: finishAfter ?? "",
    activities: p.tasks.length,
    links: fileLinks.length,
    wbsLevels: p.wbsLevels,
    calendars: p.calendars,
    donePct: progress,
    updatedAt: TODAY,
    current: true,
    warnings: p.warnings,
  };
  const programmes = opts.mode === "NEW" || !current ? [...s.programmes.map((x) => ({ ...x, current: false })), programme] : s.programmes.map((x) => (x.id === programmeId ? { ...programme, name: opts.name.trim() || x.name } : { ...x, current: false }));
  const revId = `REV-${next("REV")}`;
  revisions.push({ id: revId, programmeId, rev: nextRev(), label: same(`Imported ${p.file}`), kind: "IMPORTED", file: p.file, at: nowStamp(), by: me(), finish: finishAfter ?? "", activities: activities.length, snapshot: snapshotOf(activities) });

  // Imported WBS replaces the one derived from the BOQ; the BOQ one is rebuilt only while the project has no WBS of its own.
  const wbsOut = opts.mode === "NEW" ? wbs : materialise(wbs, activities).wbs;

  useOps.setState({
    activities,
    links,
    wbs: wbsOut,
    milestones,
    programmes,
    revisions,
    dataDate,
    resources: s.resources.map((r) => ({ ...r, activityIds: r.activityIds.filter((id) => !gone.has(id)) })),
    constraints: s.constraints.filter((c) => !gone.has(c.activityId)),
    seq,
  });
  if (gone.size) dropConstraints(gone);
  const toolName = p.tool === "P6" ? "Primavera P6" : "MS Project";
  useOps.getState().pushFeed("PM", { en: `${toolName} file imported: ${p.file} (${p.tasks.length} activities)`, az: `${toolName} faylı idxal edildi: ${p.file} (${p.tasks.length} iş)` }, opts.mode === "NEW" ? "pm/planning/programmes" : "pm/planning/changes");

  return { programmeId, revId, finishBefore, finishAfter, changed, added, removed: removedIds.length };
}

/** Days a finish lies after a contract date (negative = early); null when either is unknown. */
export function lateAgainst(contract: string | null | undefined, finish: string | null) {
  if (!contract || !finish) return null;
  return diffDays(contract, finish);
}

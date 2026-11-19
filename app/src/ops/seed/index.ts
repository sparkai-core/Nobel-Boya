import { data } from "../../data";
import { TODAY } from "../dates";
import type { CalendarDay, Material, OpsData, ProjectSetup, Trade, WbsNode } from "../types";
import { qtyByRateMap, rateFor, rateName, round, T } from "./util";

/**
 * The operations data starts empty: the client fills it in. Only what the active project's own
 * BOQ already says is derived (materials and a WBS of its buildings and sections). Nothing is invented.
 */

/** WBS nodes derived from the BOQ carry this id prefix; they are rebuilt from the project and never saved. */
export const DERIVED_WBS = "BOQ-";

const TRADES: Trade[] = ["Concrete", "Reinforcement", "Steel", "Earthworks and bases", "Masonry", "Finishes", "Roofing", "Doors and windows", "External works", "Building services"];

/** One material per BOQ rate line that the bill actually uses, priced at the bill rate. */
export function buildMaterials(): Material[] {
  const qty = qtyByRateMap();
  const out: Material[] = [];
  for (const [key, q] of qty) {
    if (q <= 0) continue;
    const r = data.rates?.[key];
    const item = data.items.find((i) => i.rate === key);
    const group = r?.group as Trade | undefined;
    out.push({
      key,
      name: rateName(key),
      unit: r?.unit ?? item?.unit ?? "",
      trade: group && TRADES.includes(group) ? group : "Finishes",
      rate: rateFor(key),
      budgetQty: round(q, 2),
    });
  }
  return out.sort((a, b) => a.name.en.localeCompare(b.name.en));
}

/** Project → buildings → BOQ sections that have measured items, all taken from the BOQ. */
export function buildWbs(): WbsNode[] {
  const p = data.project;
  if (!p) return [];
  const root: WbsNode = { id: `${DERIVED_WBS}0`, parentId: null, code: "1", name: T(p.nameEn || p.name, p.name || p.nameEn), building: null };
  const nodes: WbsNode[] = [root];
  (data.buildings ?? []).forEach((b, bi) => {
    const sections = (data.sections ?? []).filter((sec) => data.items.some((i) => i.building === b.id && i.section === sec.id));
    if (!sections.length) return;
    const bId = `${DERIVED_WBS}${b.id}`;
    nodes.push({ id: bId, parentId: root.id, code: `1.${bi + 1}`, name: T(b.en, b.az), building: b.id });
    sections.forEach((sec, si) => nodes.push({ id: `${DERIVED_WBS}${b.id}-${sec.id}`, parentId: bId, code: `1.${bi + 1}.${si + 1}`, name: T(sec.en, sec.az), building: b.id }));
  });
  return nodes;
}

/** Azerbaijan public holidays (official days off), for the working calendar. */
const HOLIDAYS: [string, string, string][] = [
  ["2026-11-08", "Victory Day", "Zəfər Günü"],
  ["2026-11-09", "National Flag Day", "Dövlət Bayrağı Günü"],
  ["2026-12-31", "World Azerbaijanis Solidarity Day", "Dünya Azərbaycanlılarının Həmrəyliyi Günü"],
  ["2027-01-01", "New Year", "Yeni il"],
  ["2027-01-02", "New Year", "Yeni il"],
  ["2027-03-08", "International Women's Day", "Beynəlxalq Qadınlar Günü"],
  ["2027-03-10", "Ramadan holiday", "Ramazan bayramı"],
  ["2027-03-11", "Ramadan holiday", "Ramazan bayramı"],
  ["2027-03-20", "Novruz", "Novruz bayramı"],
  ["2027-03-22", "Novruz", "Novruz bayramı"],
  ["2027-03-23", "Novruz", "Novruz bayramı"],
  ["2027-03-24", "Novruz", "Novruz bayramı"],
  ["2027-05-09", "Victory over Fascism Day", "Faşizm üzərində Qələbə Günü"],
  ["2027-05-17", "Gurban holiday", "Qurban bayramı"],
  ["2027-05-18", "Gurban holiday", "Qurban bayramı"],
  ["2027-05-28", "Independence Day", "Müstəqillik Günü"],
  ["2027-06-15", "National Salvation Day", "Milli Qurtuluş Günü"],
  ["2027-06-26", "Armed Forces Day", "Silahlı Qüvvələr Günü"],
];

export const EMPTY_SETUP: ProjectSetup = { company: "", plannedStart: null, contractFinish: null, contractValue: null, cashAvailable: null };

/** A fresh, empty operations dataset for the active project. */
export function makeSeed(): OpsData {
  const calendar: CalendarDay[] = HOLIDAYS.map(([date, en, az]) => ({ date, name: T(en, az), kind: "HOLIDAY" }));
  return {
    vendors: [],
    materials: buildMaterials(),
    mrs: [],
    rfqs: [],
    quotes: [],
    approvals: [],
    pos: [],
    grns: [],
    stock: [],
    movements: [],
    exceptions: [],
    payments: [],

    wbs: buildWbs(),
    activities: [],
    links: [],
    milestones: [],
    delays: [],
    impacts: [],
    recovery: [],
    reports: [],
    zones: [],
    parties: [],
    subs: [],
    rfis: [],
    changes: [],
    inspections: [],
    ipcs: [],
    calendar,
    workweek: [1, 2, 3, 4, 5, 6],

    programmes: [],
    revisions: [],
    resources: [],
    snapshots: [],
    dataDate: TODAY,
    invoices: [],
    payRuns: [],
    agreements: [],
    priceSeries: [],
    invites: [],
    equipment: [],
    workers: [],
    attendance: [],
    incidents: [],
    permits: [],
    toolbox: [],
    ppeChecks: [],
    submittals: [],
    constraints: [],
    projects: [],
    templates: [],
    expedites: [],

    feed: [],
    seq: {},
    setup: { ...EMPTY_SETUP },
  };
}

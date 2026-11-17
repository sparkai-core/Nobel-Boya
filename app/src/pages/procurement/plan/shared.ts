import { data } from "../../../data";
import { addDays, diffDays, monthShort, TODAY } from "../../../ops/dates";
import { cpm, poReceivedShare, type Cpm, type Tone } from "../../../ops/select";
import type { Activity, MaterialRequest, OpsData, PurchaseOrder, Quotation, Rfq, Trade, Txt } from "../../../ops/types";
import type { Lang } from "../../../lib/i18n";

// ---------------------------------------------------------------- planning allowances

/** Days allowed for the RFQ window and for approval before the latest PO date. */
export const RFQ_DAYS = 10;
export const APPROVAL_DAYS = 3;
/** Safety days between delivery and the activity start. */
export const BUFFER_DAYS = 2;

const T = (en: string, az: string): Txt => ({ en, az });

/** BOQ sections each trade buys for (used to find the activity a delivery feeds). */
export const TRADE_SECTIONS: Record<Trade, string[]> = {
  Concrete: ["sub", "frame"],
  Reinforcement: ["rebar"],
  Steel: ["steel"],
  "Earthworks and bases": ["sub"],
  Masonry: ["masonry"],
  Finishes: ["finish"],
  Roofing: ["roof"],
  "Doors and windows": ["openings"],
  "External works": ["ext"],
  "Building services": ["elec", "hvac", "plumb", "fire", "lowcur", "alarm", "pa"],
};

// ---------------------------------------------------------------- procurement packages

type PkgDef = {
  key: string;
  name: Txt;
  /** Activity code whose start is the "required on site" date. */
  need: string;
  /** Other activities whose requests belong to this package. */
  also?: string[];
  building: string | null;
  sections: string[];
  /** Restrict to these BOQ rate keys (default: every rate in the building × sections). */
  materials?: string[];
  trade: Trade;
};

const DEFS: PkgDef[] = [
  { key: "wh-footings", name: T("Ready-mix for warehouse footings", "Anbar bünövrələri üçün hazır beton"), need: "WH-120", building: "WH", sections: ["sub"], materials: ["conc_fdn", "conc_blind"], trade: "Concrete" },
  { key: "rebar", name: T("Rebar for footings, columns and frame", "Bünövrə, dirək və karkas armaturu"), need: "WH-125", also: ["AD-125"], building: null, sections: ["rebar"], trade: "Reinforcement" },
  { key: "embeds", name: T("Anchor bolts and embedded plates", "Anker boltları və gömülü lövhələr"), need: "WH-140", building: "WH", sections: ["steel"], materials: ["steel_embed"], trade: "Steel" },
  { key: "wh-columns", name: T("Ready-mix for warehouse columns", "Anbar dirəkləri üçün hazır beton"), need: "WH-140", building: "WH", sections: ["frame"], materials: ["conc_col"], trade: "Concrete" },
  { key: "ad-frame", name: T("Ready-mix for the admin frame", "İnzibati bina karkası üçün hazır beton"), need: "AD-130", also: ["AD-140", "AD-150"], building: "AD", sections: ["frame"], trade: "Concrete" },
  { key: "trusses", name: T("Steel trusses and bracing", "Metal fermalar və bərkidicilər"), need: "WH-160", also: ["WH-150"], building: "WH", sections: ["steel"], materials: ["steel_struct"], trade: "Steel" },
  { key: "limestone", name: T("Sawn limestone for warehouse walls", "Anbar divarları üçün kəsilmiş əhəng daşı"), need: "WH-180", building: "WH", sections: ["masonry"], materials: ["wall_limestone"], trade: "Masonry" },
  { key: "roof", name: T("Roof sheeting and rainwater goods", "Dam örtüyü və su axıdıcılar"), need: "WH-170", building: "WH", sections: ["roof"], materials: ["roof_sheet", "gutter", "downpipe", "flashing", "rain_elbow", "rain_funnel", "rain_clamp"], trade: "Roofing" },
  { key: "fire-pumps", name: T("Fire pumps and pump-station pipework", "Yanğın nasosları və nasosxana boruları"), need: "PS-120", building: "PS", sections: ["plumb"], trade: "Building services" },
  { key: "wh-elec", name: T("Warehouse electrical and low current", "Anbar elektrik və zəif cərəyan sistemləri"), need: "WH-210", building: "WH", sections: ["elec", "lowcur"], trade: "Building services" },
  { key: "ad-elec", name: T("Admin electrical: cables and boards", "İnzibati bina elektriki: kabellər və lövhələr"), need: "AD-190", also: ["AD-220"], building: "AD", sections: ["elec"], trade: "Building services" },
  { key: "wh-fire", name: T("Warehouse firefighting and fire alarm", "Anbar yanğınsöndürmə və siqnalizasiya"), need: "WH-220", building: "WH", sections: ["fire", "alarm"], trade: "Building services" },
  { key: "pvc", name: T("PVC windows and doors, admin building", "İnzibati bina üçün PVC pəncərə və qapılar"), need: "AD-180", building: "AD", sections: ["openings"], trade: "Doors and windows" },
  { key: "tiles", name: T("Porcelain and ceramic tiles", "Keramoqranit və keramik plitələr"), need: "AD-210", building: "AD", sections: ["finish"], materials: ["floor_porcelain", "floor_tile", "wall_tile"], trade: "Finishes" },
  { key: "asphalt", name: T("Asphalt and kerbs for the yard", "Həyət üçün asfalt və bordyurlar"), need: "SW-130", also: ["SW-120"], building: "SITE", sections: ["ext"], materials: ["asphalt_coarse", "asphalt_fine", "kerb"], trade: "External works" },
];

export type PkgStatus = "NONE" | "MR" | "RFQ" | "QUOTED" | "ORDERED" | "DELIVERED";
export const PKG_PATH: PkgStatus[] = ["NONE", "MR", "RFQ", "QUOTED", "ORDERED", "DELIVERED"];
export const PKG_STATUS: Record<PkgStatus, { label: string; tone: Tone }> = {
  NONE: { label: "Not started", tone: "muted" },
  MR: { label: "MR raised", tone: "info" },
  RFQ: { label: "RFQ out", tone: "brand" },
  QUOTED: { label: "Quoted", tone: "brand" },
  ORDERED: { label: "Ordered", tone: "ok" },
  DELIVERED: { label: "Delivered", tone: "ok" },
};

export type LeadSource = "submittal" | "index" | "vendors";

export type Pkg = {
  key: string;
  name: Txt;
  act: Activity;
  actIds: string[];
  building: string | null;
  trade: Trade;
  materials: string[];
  /** BOQ value of the package at sample rates. */
  value: number;
  required: string;
  lead: number;
  leadSource: LeadSource;
  latestRfq: string;
  latestPo: string;
  /** Days from today to the latest PO date (negative = passed). */
  float: number;
  status: PkgStatus;
  mrs: MaterialRequest[];
  rfqs: Rfq[];
  quotes: Quotation[];
  pos: PurchaseOrder[];
  approvalPending: boolean;
  /** Pending approval on one of the package quotes, if any. */
  approvalId: string | null;
  /** Latest PO date passed with no order placed. */
  late: boolean;
  /** Latest PO date falls within the next 14 days and nothing is ordered. */
  dueSoon: boolean;
  /** If ordered today: when it would be on site. */
  ifToday: string;
  /** First PO issue date and expected delivery, when ordered. */
  orderedAt: string | null;
  expectedAt: string | null;
  cpm: Cpm | undefined;
};

const median = (xs: number[]) => {
  if (!xs.length) return 14;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

/** Lead time a trade's approved vendors usually need (median of their average delivery days). */
export function tradeLead(s: Pick<OpsData, "vendors">, trade: Trade) {
  return median(s.vendors.filter((v) => v.status === "APPROVED" && v.trade === trade).map((v) => v.avgDeliveryDays));
}

/** The procurement packages: one per activity that needs bought materials, back-scheduled from its start. */
export function buildPackages(s: OpsData): Pkg[] {
  const cp = cpm(s.activities, s.links);
  const taken = new Set<string>();
  const out: Pkg[] = [];
  for (const def of DEFS) {
    const act = s.activities.find((a) => a.code === def.need);
    if (!act) continue;
    const actIds = [act.id, ...(def.also ?? []).map((c) => s.activities.find((a) => a.code === c)?.id).filter((x): x is string => !!x)];
    const items = data.items.filter((it) => (!def.building || it.building === def.building) && def.sections.includes(it.section) && (!def.materials || def.materials.includes(it.rate)));
    const materials = def.materials ?? [...new Set(items.map((i) => i.rate))];
    const mats = new Set(materials);
    const value = items.reduce((a, it) => a + it.qty * (data.rates[it.rate]?.rate ?? 0), 0);
    const hit = (lines: { material: string | null }[]) => lines.some((l) => l.material != null && mats.has(l.material));

    const mrs = s.mrs.filter((m) => m.status !== "CANCELLED" && hit(m.lines) && ((m.activityId != null && actIds.includes(m.activityId)) || !def.building || m.building === def.building));
    const mrIds = new Set(mrs.map((m) => m.id));
    const rfqs = s.rfqs.filter((r) => r.status !== "CANCELLED" && ((r.mrId != null && mrIds.has(r.mrId)) || (r.mrId == null && hit(r.lines) && !def.building)));
    const rfqIds = new Set(rfqs.map((r) => r.id));
    const quotes = s.quotes.filter((q) => !q.duplicate && q.rfqId != null && rfqIds.has(q.rfqId));
    const pos = s.pos.filter((p) => {
      if (p.status === "CANCELLED") return false;
      if ((p.mrId && mrIds.has(p.mrId)) || (p.rfqId && rfqIds.has(p.rfqId))) return true;
      // A direct order with no request belongs to the first package whose materials it buys.
      if (!p.mrId && !p.rfqId && !taken.has(p.id) && hit(p.lines)) {
        taken.add(p.id);
        return true;
      }
      return false;
    });
    const pendingApproval = s.approvals.find((a) => a.status === "PENDING" && quotes.some((q) => q.id === a.quoteId));
    const approvalPending = !!pendingApproval;

    const sub = s.submittals.find((x) => (x.material != null && mats.has(x.material)) || (x.activityId != null && actIds.includes(x.activityId)));
    const series = s.priceSeries.find((p) => p.material != null && mats.has(p.material));
    const lead = sub ? sub.leadDays : series ? series.leadDays : tradeLead(s, def.trade);
    const leadSource: LeadSource = sub ? "submittal" : series ? "index" : "vendors";

    const required = act.start;
    const latestPo = addDays(required, -(lead + BUFFER_DAYS));
    const latestRfq = addDays(latestPo, -(RFQ_DAYS + APPROVAL_DAYS));
    const delivered = pos.length > 0 && pos.every((p) => p.status === "CLOSED" || poReceivedShare(p) >= 0.999);
    const status: PkgStatus = delivered ? "DELIVERED" : pos.length ? "ORDERED" : quotes.length ? "QUOTED" : rfqs.length ? "RFQ" : mrs.length ? "MR" : "NONE";
    const float = diffDays(TODAY, latestPo);
    const ordered = status === "ORDERED" || status === "DELIVERED";
    const firstPo = [...pos].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))[0];
    const lastExpected = pos.reduce<string | null>((m, p) => (m == null || p.expectedAt > m ? p.expectedAt : m), null);
    out.push({
      key: def.key,
      name: def.name,
      act,
      actIds,
      building: def.building,
      trade: def.trade,
      materials,
      value,
      required,
      lead,
      leadSource,
      latestRfq,
      latestPo,
      float,
      status,
      mrs,
      rfqs,
      quotes,
      pos,
      approvalPending,
      approvalId: pendingApproval?.id ?? null,
      late: !ordered && float < 0,
      dueSoon: !ordered && float >= 0 && float <= 14,
      ifToday: addDays(TODAY, lead),
      orderedAt: firstPo?.issuedAt ?? null,
      expectedAt: lastExpected,
      cpm: cp.get(act.id),
    });
  }
  return out.sort((a, b) => a.required.localeCompare(b.required));
}

// ---------------------------------------------------------------- deliveries

/** Delivery date after chasing: the latest promised date on the chase log, else the PO date. */
export function expectedOf(s: Pick<OpsData, "expedites">, po: PurchaseOrder) {
  const promised = s.expedites
    .filter((e) => e.poId === po.id && e.newDate)
    .sort((a, b) => b.at.localeCompare(a.at))[0]?.newDate;
  return promised ?? po.expectedAt;
}

export type NeedSource = "request" | "submittal" | "trade";

/** The programme activity an order feeds: via its request, a submittal for the material, or the trade. */
export function needOf(s: OpsData, po: PurchaseOrder): { act: Activity; source: NeedSource } | null {
  const mr = po.mrId ? s.mrs.find((m) => m.id === po.mrId) : undefined;
  const viaMr = mr?.activityId ? s.activities.find((a) => a.id === mr.activityId) : undefined;
  if (viaMr) return { act: viaMr, source: "request" };
  const mats = new Set(po.lines.map((l) => l.material).filter((x): x is string => !!x));
  const sub = s.submittals.find((x) => x.material != null && mats.has(x.material) && x.activityId);
  const viaSub = sub ? s.activities.find((a) => a.id === sub.activityId) : undefined;
  if (viaSub) return { act: viaSub, source: "submittal" };
  const firstMat = po.lines.find((l) => l.material)?.material;
  const trade = (firstMat && s.materials.find((m) => m.key === firstMat)?.trade) || s.vendors.find((v) => v.id === po.vendorId)?.trade;
  if (!trade) return null;
  const secs = TRADE_SECTIONS[trade] ?? [];
  const act = s.activities
    .filter((a) => a.status !== "COMPLETED" && a.section != null && secs.includes(a.section))
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return act ? { act, source: "trade" } : null;
}

/** When the site needs it: the activity start, or today when the activity is already running. */
export const needDate = (a: Activity) => (a.start > TODAY ? a.start : TODAY);

export type DueLine = {
  key: string;
  po: PurchaseOrder;
  line: PurchaseOrder["lines"][number];
  outstanding: number;
  expected: string;
  need: string | null;
  act: Activity | null;
  source: NeedSource | null;
  /** Expected − need, in days (positive = arrives after the site needs it). */
  gap: number | null;
};

/** Every open order line with quantity still to come. */
export function dueLines(s: OpsData): DueLine[] {
  const out: DueLine[] = [];
  for (const po of s.pos) {
    if (po.status !== "ISSUED" && po.status !== "PART_RECEIVED") continue;
    const expected = expectedOf(s, po);
    const nd = needOf(s, po);
    const need = nd ? needDate(nd.act) : null;
    for (const l of po.lines) {
      const outstanding = Math.max(0, l.qty - l.received);
      if (outstanding < 1e-6) continue;
      out.push({ key: l.key, po, line: l, outstanding, expected, need, act: nd?.act ?? null, source: nd?.source ?? null, gap: need ? diffDays(need, expected) : null });
    }
  }
  return out.sort((a, b) => a.expected.localeCompare(b.expected));
}

/** On-time record per vendor: posted receipts against the PO date, plus open balances already past due. */
export function vendorOnTime(s: OpsData) {
  const map = new Map<string, { onTime: number; total: number; inFull: number }>();
  const bump = (id: string, on: boolean, full: boolean) => {
    const r = map.get(id) ?? { onTime: 0, total: 0, inFull: 0 };
    r.total += 1;
    if (on) r.onTime += 1;
    if (on && full) r.inFull += 1;
    map.set(id, r);
  };
  for (const g of s.grns) {
    if (g.status === "DRAFT" || !g.receivedAt) continue;
    const po = s.pos.find((p) => p.id === g.poId);
    if (!po) continue;
    const full = !g.lines.some((l) => l.shortReason);
    bump(g.vendorId, g.receivedAt <= po.expectedAt, full);
  }
  for (const po of s.pos) {
    if ((po.status === "ISSUED" || po.status === "PART_RECEIVED") && expectedOf(s, po) < TODAY) bump(po.vendorId, false, false);
  }
  return map;
}

// ---------------------------------------------------------------- months

export const monthOf = (iso: string) => iso.slice(0, 7);
export function monthLabel(m: string, lang: Lang, withYear = false) {
  const label = monthShort(Number(m.slice(5, 7)) - 1, lang);
  return withYear ? `${label} ${m.slice(2, 4)}` : label;
}
export function monthsFrom(from: string, to: string) {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4));
  const em = Number(to.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Downloads text as a file (no server involved). */
export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿", text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

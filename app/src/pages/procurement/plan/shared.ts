import { data } from "../../../data";
import { addDays, diffDays, monthShort, TODAY } from "../../../ops/dates";
import { cpm, poReceivedShare, tradeName, type Cpm, type Tone } from "../../../ops/select";
import type { Activity, MaterialRequest, OpsData, PurchaseOrder, Quotation, Rfq, Trade, Txt } from "../../../ops/types";
import type { Lang } from "../../../lib/i18n";

// ---------------------------------------------------------------- planning allowances

/** Days allowed for the RFQ window and for approval before the latest PO date. */
export const RFQ_DAYS = 10;
export const APPROVAL_DAYS = 3;
/** Safety days between delivery and the activity start. */
export const BUFFER_DAYS = 2;

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

/**
 * Procurement packages come from the project's own BOQ: one per trade that has priced materials.
 * The date the site needs them is the start of the earliest programme activity in the BOQ sections
 * where those materials are measured; with no such activity, the earliest needed-by date on a request
 * for them; else the date the user sets. Nothing is assumed.
 */

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

export type LeadSource = "submittal" | "index" | "vendors" | "user";
export type NeedSource = "user" | "activity" | "request";

export type Pkg = {
  key: string;
  name: Txt;
  /** Earliest open programme activity that uses the package's materials, if any. */
  act: Activity | null;
  actIds: string[];
  building: string | null;
  trade: Trade;
  materials: string[];
  /** BOQ value of the package at the bill rates. */
  value: number;
  required: string | null;
  requiredFrom: NeedSource | null;
  lead: number | null;
  leadSource: LeadSource | null;
  latestRfq: string | null;
  latestPo: string | null;
  /** Days from today to the latest PO date (negative = passed). */
  float: number | null;
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
  ifToday: string | null;
  /** First PO issue date and expected delivery, when ordered. */
  orderedAt: string | null;
  expectedAt: string | null;
  cpm: Cpm | undefined;
};

/** A package with every date known (it can be drawn on the timeline). */
export type DatedPkg = Pkg & { required: string; lead: number; latestRfq: string; latestPo: string; float: number; ifToday: string };
export const isDated = (p: Pkg): p is DatedPkg => p.required != null && p.lead != null && p.latestPo != null && p.latestRfq != null;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

/** Lead time a trade's approved vendors usually need (median of the delivery days recorded on them), if any. */
export function tradeLead(s: Pick<OpsData, "vendors">, trade: Trade) {
  return median(s.vendors.filter((v) => v.status === "APPROVED" && v.avgDeliveryDays > 0 && (v.trade === trade || v.trades.includes(trade))).map((v) => v.avgDeliveryDays));
}

/** The procurement packages: one per BOQ trade, back-scheduled from the day the site needs it when that is known. */
export function buildPackages(s: OpsData, overrides: (key: string) => { needBy: string | null; leadDays: number | null } = () => ({ needBy: null, leadDays: null })): Pkg[] {
  const cp = cpm(s.activities, s.links);
  const taken = new Set<string>();
  const out: Pkg[] = [];
  const trades = [...new Set(s.materials.filter((m) => m.rate > 0 && m.budgetQty > 0).map((m) => m.trade))];
  for (const trade of trades) {
    const key = trade;
    const mats = new Set(s.materials.filter((m) => m.trade === trade).map((m) => m.key));
    const materials = [...mats];
    const items = data.items.filter((it) => mats.has(it.rate));
    const sections = new Set(items.map((i) => i.section));
    const buildings = new Set(items.map((i) => i.building));
    const value = s.materials.filter((m) => mats.has(m.key)).reduce((a, m) => a + m.rate * m.budgetQty, 0);
    const hit = (lines: { material: string | null }[]) => lines.some((l) => l.material != null && mats.has(l.material));

    const linked = s.activities.filter((a) => !a.isMilestone && a.section != null && sections.has(a.section) && (!a.building || buildings.has(a.building)));
    const mrs = s.mrs.filter((m) => m.status !== "CANCELLED" && hit(m.lines));
    for (const m of mrs) {
      const a = m.activityId ? s.activities.find((x) => x.id === m.activityId) : undefined;
      if (a && !linked.includes(a)) linked.push(a);
    }
    const open = linked.filter((a) => a.status !== "COMPLETED").sort((a, b) => a.start.localeCompare(b.start));
    const act = open[0] ?? [...linked].sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
    const actIds = linked.map((a) => a.id);

    const mrIds = new Set(mrs.map((m) => m.id));
    const rfqs = s.rfqs.filter((r) => r.status !== "CANCELLED" && ((r.mrId != null && mrIds.has(r.mrId)) || (r.mrId == null && hit(r.lines))));
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

    const ov = overrides(key);
    const mrNeed = mrs.map((m) => m.neededBy).filter(Boolean).sort()[0] ?? null;
    const required = ov.needBy ?? (act ? act.start : mrNeed);
    const requiredFrom: NeedSource | null = ov.needBy ? "user" : act ? "activity" : mrNeed ? "request" : null;

    const sub = s.submittals.find((x) => (x.material != null && mats.has(x.material)) || (x.activityId != null && actIds.includes(x.activityId)));
    const series = s.priceSeries.find((p) => p.material != null && mats.has(p.material));
    const vendorLead = tradeLead(s, trade);
    const lead = ov.leadDays ?? (sub ? sub.leadDays : series ? series.leadDays : vendorLead);
    const leadSource: LeadSource | null = ov.leadDays != null ? "user" : sub ? "submittal" : series ? "index" : vendorLead != null ? "vendors" : null;

    const latestPo = required != null && lead != null ? addDays(required, -(lead + BUFFER_DAYS)) : null;
    const latestRfq = latestPo ? addDays(latestPo, -(RFQ_DAYS + APPROVAL_DAYS)) : null;
    const delivered = pos.length > 0 && pos.every((p) => p.status === "CLOSED" || poReceivedShare(p) >= 0.999);
    const status: PkgStatus = delivered ? "DELIVERED" : pos.length ? "ORDERED" : quotes.length ? "QUOTED" : rfqs.length ? "RFQ" : mrs.length ? "MR" : "NONE";
    const float = latestPo ? diffDays(TODAY, latestPo) : null;
    const ordered = status === "ORDERED" || status === "DELIVERED";
    const firstPo = [...pos].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))[0];
    const lastExpected = pos.reduce<string | null>((m, p) => (m == null || p.expectedAt > m ? p.expectedAt : m), null);
    out.push({
      key,
      name: { en: tradeName(trade, "en"), az: tradeName(trade, "az") },
      act,
      actIds,
      building: buildings.size === 1 ? [...buildings][0]! : null,
      trade,
      materials,
      value,
      required,
      requiredFrom,
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
      approvalPending: !!pendingApproval,
      approvalId: pendingApproval?.id ?? null,
      late: !ordered && float != null && float < 0,
      dueSoon: !ordered && float != null && float >= 0 && float <= 14,
      ifToday: lead != null ? addDays(TODAY, lead) : null,
      orderedAt: firstPo?.issuedAt ?? null,
      expectedAt: lastExpected,
      cpm: act ? cp.get(act.id) : undefined,
    });
  }
  return out.sort((a, b) => (a.required ?? "9999").localeCompare(b.required ?? "9999") || b.value - a.value);
}

// ---------------------------------------------------------------- deliveries

/** Delivery date after chasing: the latest promised date on the chase log, else the PO date. */
export function expectedOf(s: Pick<OpsData, "expedites">, po: PurchaseOrder) {
  const promised = s.expedites
    .filter((e) => e.poId === po.id && e.newDate)
    .sort((a, b) => b.at.localeCompare(a.at))[0]?.newDate;
  return promised ?? po.expectedAt;
}

export type DeliveryNeedSource = "request" | "submittal" | "trade";

/** The programme activity an order feeds: via its request, a submittal for the material, or the trade. */
export function needOf(s: OpsData, po: PurchaseOrder): { act: Activity; source: DeliveryNeedSource } | null {
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
  source: DeliveryNeedSource | null;
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

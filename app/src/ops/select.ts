import { data, P } from "../data";
import { addDays, diffDays, maxDate, PROJECT_FINISH, PROJECT_START, TODAY } from "./dates";
import { round, sectionValue } from "./seed/util";
import type {
  Activity,
  Dependency,
  GoodsReceipt,
  Milestone,
  OpsData,
  Payment,
  PurchaseOrder,
  Quotation,
  Risk,
  Txt,
  Vendor,
} from "./types";

// ---------------------------------------------------------------- links

/** Absolute route for a module-relative path ("procurement/orders/PO-0001"). */
export const to = (rel: string) => `${P}/${rel}`;

export const R = {
  proc: to("procurement"),
  requests: to("procurement/requests"),
  request: (id: string) => to(`procurement/requests/${id}`),
  newRequest: to("procurement/requests/new"),
  rfqs: to("procurement/rfqs"),
  rfq: (id: string) => to(`procurement/rfqs/${id}`),
  newRfq: (mrId?: string) => to(`procurement/rfqs/new${mrId ? `?mr=${mrId}` : ""}`),
  quotes: to("procurement/quotes"),
  quote: (id: string) => to(`procurement/quotes/${id}`),
  uploadQuote: (rfqId?: string) => to(`procurement/quotes/upload${rfqId ? `?rfq=${rfqId}` : ""}`),
  compare: (rfqId?: string) => to(`procurement/compare${rfqId ? `?rfq=${rfqId}` : ""}`),
  approvals: to("procurement/approvals"),
  approval: (id: string) => to(`procurement/approvals/${id}`),
  orders: to("procurement/orders"),
  order: (id: string) => to(`procurement/orders/${id}`),
  receipts: to("procurement/receipts"),
  receipt: (id: string) => to(`procurement/receipts/${id}`),
  inventory: to("procurement/inventory"),
  exceptions: to("procurement/exceptions"),
  payments: to("procurement/payments"),
  payment: (id: string) => to(`procurement/payments/${id}`),
  vendors: to("procurement/vendors"),
  vendor: (id: string) => to(`procurement/vendors/${id}`),
  newVendor: to("procurement/vendors/new"),
  budget: to("procurement/budget"),

  pm: to("pm"),
  programme: (task?: string) => to(`pm/programme${task ? `?task=${task}` : ""}`),
  wbs: to("pm/wbs"),
  milestones: to("pm/milestones"),
  critical: to("pm/critical-path"),
  dependencies: to("pm/dependencies"),
  calendar: to("pm/calendar"),
  finishRisk: to("pm/finish-risk"),
  delays: to("pm/delays"),
  live: to("pm/live"),
  recovery: to("pm/recovery"),
  health: to("pm/health"),
  progress: to("pm/progress"),
  reports: to("pm/daily-reports"),
  report: (id: string) => to(`pm/daily-reports/${id}`),
  aiScheduling: to("pm/ai-scheduling"),
  rfis: to("pm/rfis"),
  rfi: (id: string) => to(`pm/rfis/${id}`),
  changes: to("pm/changes"),
  change: (id: string) => to(`pm/changes/${id}`),
  inspections: to("pm/inspections"),
  inspection: (id: string) => to(`pm/inspections/${id}`),
  billing: to("pm/billing"),
  ipc: (id: string) => to(`pm/billing/${id}`),
  parties: to("pm/parties"),
  subs: to("pm/subcontractors"),

  vendorPortal: "/vendor",

  // phase 2
  planning: (tab?: string) => to(`pm/planning${tab ? `/${tab}` : ""}`),
  progressTracking: to("pm/progress-tracking"),
  lookahead: to("pm/lookahead"),
  submittals: to("pm/submittals"),
  submittal: (id: string) => to(`pm/submittals/${id}`),
  equipment: to("pm/equipment"),
  workforce: to("pm/workforce"),
  safety: to("pm/safety"),
  schedule: to("procurement/schedule"),
  deliveries: to("procurement/deliveries"),
  forecast: to("procurement/forecast"),
  analytics: to("procurement/analytics"),
  newOrder: (q?: string) => to(`procurement/orders/new${q ? `?${q}` : ""}`),
  agreements: to("procurement/agreements"),
  agreement: (id: string) => to(`procurement/agreements/${id}`),
  catalogue: to("procurement/catalogue"),
  material: (key: string) => to(`procurement/catalogue/${encodeURIComponent(key)}`),
  onboarding: to("procurement/vendors/onboarding"),
  invoices: to("procurement/invoices"),
  invoice: (id: string) => to(`procurement/invoices/${id}`),
  invoiceInbox: to("procurement/invoices/inbox"),
  payRun: to("procurement/pay-run"),
};

// ---------------------------------------------------------------- status metadata

export type Tone = "neutral" | "brand" | "info" | "ok" | "warn" | "bad" | "muted";
type Meta = { label: Txt; tone: Tone };
const m = (en: string, az: string, tone: Tone): Meta => ({ label: { en, az }, tone });

export const STATUS: Record<string, Record<string, Meta>> = {
  mr: { DRAFT: m("Draft", "Qaralama", "muted"), SUBMITTED: m("Submitted", "Göndərilib", "info"), SOURCING: m("Sourcing", "Təchizat axtarılır", "brand"), FULFILLED: m("Fulfilled", "Təmin olunub", "ok"), CANCELLED: m("Cancelled", "Ləğv edilib", "muted") },
  rfq: { DRAFT: m("Draft", "Qaralama", "muted"), OPEN: m("Open", "Açıq", "brand"), CLOSED: m("Closed", "Bağlı", "info"), AWARDED: m("Awarded", "Qalib seçilib", "ok"), CANCELLED: m("Cancelled", "Ləğv edilib", "muted") },
  invite: { INVITED: m("No answer", "Cavab yoxdur", "muted"), ACKNOWLEDGED: m("Opened", "Açılıb", "info"), SUBMITTED: m("Quoted", "Təklif verib", "ok"), DECLINED: m("Declined", "İmtina edib", "bad") },
  quote: { PROCESSING: m("Reading", "Oxunur", "info"), NEEDS_REVIEW: m("To check", "Yoxlanmalı", "warn"), EXTRACTED: m("Ready", "Hazırdır", "ok"), MANUAL: m("Typed", "Əl ilə", "neutral") },
  approval: { PENDING: m("Waiting", "Gözləyir", "warn"), APPROVED: m("Approved", "Təsdiqlənib", "ok"), REJECTED: m("Rejected", "Rədd edilib", "bad") },
  po: { DRAFT: m("Draft", "Qaralama", "muted"), ISSUED: m("Issued", "Verilib", "brand"), PART_RECEIVED: m("Part received", "Qismən alınıb", "warn"), CLOSED: m("Closed", "Bağlanıb", "ok"), CANCELLED: m("Cancelled", "Ləğv edilib", "muted") },
  grn: { DRAFT: m("At the gate", "Darvazada", "info"), PART_RECEIVED: m("Part received", "Qismən qəbul", "warn"), RECEIVED: m("Received", "Qəbul edilib", "ok"), REJECTED: m("Rejected", "Rədd edilib", "bad") },
  payment: { SCHEDULED: m("Scheduled", "Planlaşdırılıb", "neutral"), READY: m("Ready to pay", "Ödənişə hazır", "brand"), PAID: m("Paid", "Ödənilib", "ok"), ON_HOLD: m("On hold", "Saxlanılıb", "bad") },
  exception: { open: m("To do", "Görülməli", "warn"), assigned: m("Taken", "Götürülüb", "info"), resolved: m("Resolved", "Həll olunub", "ok"), dismissed: m("Dismissed", "Ləğv edilib", "muted") },
  vendor: { APPROVED: m("Approved", "Təsdiqlənib", "ok"), ON_HOLD: m("On hold", "Dayandırılıb", "warn"), DISQUALIFIED: m("Disqualified", "Diskvalifikasiya", "bad") },
  risk: { LOW: m("Low risk", "Aşağı risk", "ok"), MEDIUM: m("Medium risk", "Orta risk", "warn"), HIGH: m("High risk", "Yüksək risk", "bad"), CRITICAL: m("Critical risk", "Kritik risk", "bad") },
  priority: { LOW: m("Low", "Aşağı", "muted"), MEDIUM: m("Medium", "Orta", "neutral"), HIGH: m("High", "Yüksək", "warn"), URGENT: m("Urgent", "Təcili", "bad"), CRITICAL: m("Critical", "Kritik", "bad") },
  activity: { NOT_STARTED: m("Not started", "Başlanmayıb", "muted"), IN_PROGRESS: m("In progress", "İcrada", "brand"), COMPLETED: m("Done", "Bitib", "ok"), BLOCKED: m("Blocked", "Bloklanıb", "bad") },
  milestone: { DONE: m("Done", "Bitib", "ok"), ON_TRACK: m("On track", "Qrafikdə", "ok"), WATCH: m("Watch", "Diqqət", "warn"), AT_RISK: m("At risk", "Risk altında", "bad"), LATE: m("Forecast late", "Gecikəcək", "bad") },
  delay: { OPEN: m("Open", "Açıq", "bad"), UNDER_REVIEW: m("Under review", "Baxılır", "warn"), CONFIRMED: m("Confirmed", "Təsdiqlənib", "warn"), MITIGATED: m("Mitigated", "Yumşaldılıb", "info"), RESOLVED: m("Resolved", "Həll olunub", "ok"), REJECTED: m("Rejected", "Rədd edilib", "muted") },
  impact: { REPORTED: m("Reported", "Bildirilib", "warn"), UNDER_REVIEW: m("Under review", "Baxılır", "info"), CONFIRMED: m("Confirmed", "Təsdiqlənib", "bad"), MITIGATED: m("Mitigated", "Yumşaldılıb", "info"), RESOLVED: m("In programme", "Qrafikdə", "ok"), REJECTED: m("Rejected", "Rədd edilib", "muted") },
  scenario: { DRAFT: m("Draft", "Qaralama", "muted"), CALCULATED: m("Calculated", "Hesablanıb", "info"), UNDER_REVIEW: m("For approval", "Təsdiqdə", "warn"), APPROVED: m("Approved", "Təsdiqlənib", "ok"), APPLIED: m("Applied", "Tətbiq edilib", "brand"), REJECTED: m("Rejected", "Rədd edilib", "muted") },
  report: { DRAFT: m("Draft", "Qaralama", "muted"), SUBMITTED: m("Sent for approval", "Təsdiqə göndərilib", "warn"), APPROVED: m("Approved", "Təsdiqlənib", "ok"), REJECTED: m("Rejected", "Rədd edilib", "bad") },
  rfi: { OPEN: m("Open", "Açıq", "warn"), ANSWERED: m("Answered", "Cavablanıb", "info"), CLOSED: m("Closed", "Bağlanıb", "ok"), OVERDUE: m("Overdue", "Gecikir", "bad") },
  change: { DRAFT: m("Draft", "Qaralama", "muted"), SUBMITTED: m("Submitted", "Göndərilib", "info"), UNDER_REVIEW: m("Under review", "Baxılır", "warn"), APPROVED: m("Approved", "Təsdiqlənib", "ok"), REJECTED: m("Rejected", "Rədd edilib", "bad") },
  inspection: { REQUESTED: m("Requested", "Tələb edilib", "info"), PASSED: m("Passed", "Keçib", "ok"), PASSED_WITH_COMMENTS: m("Passed with comments", "Qeydlərlə keçib", "warn"), FAILED: m("Failed", "Keçməyib", "bad"), OPEN: m("Open", "Açıq", "bad"), CLOSED: m("Closed", "Bağlanıb", "ok") },
  ipc: { DRAFT: m("Draft", "Qaralama", "muted"), SUBMITTED: m("Submitted", "Göndərilib", "warn"), CERTIFIED: m("Certified", "Təsdiqlənib", "brand"), PAID: m("Paid", "Ödənilib", "ok") },
  sub: { ACTIVE: m("Active", "Aktiv", "ok"), SUSPENDED: m("Suspended", "Dayandırılıb", "bad"), COMPLETED: m("Completed", "Bitib", "muted") },
};

export function statusMeta(kind: keyof typeof STATUS | string, status: string): Meta {
  return STATUS[kind]?.[status] ?? { label: { en: status, az: status }, tone: "neutral" };
}

/** Status order used by the stage paths on list pages. */
export const PATHS = {
  mr: ["DRAFT", "SUBMITTED", "SOURCING", "FULFILLED"],
  rfq: ["DRAFT", "OPEN", "CLOSED", "AWARDED"],
  quote: ["PROCESSING", "NEEDS_REVIEW", "EXTRACTED"],
  approval: ["PENDING", "APPROVED"],
  po: ["DRAFT", "ISSUED", "PART_RECEIVED", "CLOSED"],
  grn: ["DRAFT", "PART_RECEIVED", "RECEIVED"],
  payment: ["SCHEDULED", "READY", "PAID"],
  change: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"],
  rfi: ["OPEN", "ANSWERED", "CLOSED"],
  report: ["DRAFT", "SUBMITTED", "APPROVED"],
  ipc: ["DRAFT", "SUBMITTED", "CERTIFIED", "PAID"],
} as const;

export const TRADE_AZ: Record<string, string> = {
  Concrete: "Beton",
  Reinforcement: "Armatur",
  Steel: "Metal konstruksiyalar",
  "Earthworks and bases": "Torpaq işləri və əsaslar",
  Masonry: "Hörgü",
  Finishes: "Bəzək işləri",
  Roofing: "Dam örtüyü",
  "Doors and windows": "Qapı və pəncərələr",
  "External works": "Abadlaşdırma",
  "Building services": "Mühəndis sistemləri",
};
export const tradeName = (t: string, lang: "az" | "en") => (lang === "az" ? (TRADE_AZ[t] ?? t) : t);
export const TRADES = Object.keys(TRADE_AZ);

// ---------------------------------------------------------------- money

export const quoteNet = (q: Pick<Quotation, "lines">) => q.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
export const quoteTotal = (q: Quotation) => round(quoteNet(q) * (1 + q.vatRate) + q.shipping, 2);
export const poNet = (po: PurchaseOrder) => po.lines.reduce((a, l) => a + l.qty * l.rate, 0);
export const poTotal = (po: PurchaseOrder) => round(poNet(po) * (1 + po.vatRate) + po.shipping, 2);
export const poReceivedShare = (po: PurchaseOrder) => {
  const net = poNet(po) || 1;
  return po.lines.reduce((a, l) => a + Math.min(l.received, l.qty) * l.rate, 0) / net;
};
export const poPaid = (s: Pick<OpsData, "payments">, poId: string) => s.payments.filter((p) => p.poId === poId && p.status === "PAID").reduce((a, p) => a + p.amount, 0);
export const poLate = (po: PurchaseOrder) => (po.status === "ISSUED" || po.status === "PART_RECEIVED") && po.expectedAt < TODAY;

/** Budget value of a set of lines at BOQ sample rates. */
export function budgetOf(s: Pick<OpsData, "materials">, lines: { material: string | null; qty: number }[]) {
  return lines.reduce((a, l) => a + l.qty * (l.material ? (s.materials.find((x) => x.key === l.material)?.rate ?? 0) : 0), 0);
}

/** Gate for a payment: why it can or cannot be paid now. */
export function paymentGate(s: Pick<OpsData, "pos">, p: Payment): { key: "clear" | "goods" | "released" | "hold" | "paid"; label: Txt; tone: Tone } {
  if (p.status === "PAID") return { key: "paid", label: { en: "Paid", az: "Ödənilib" }, tone: "ok" };
  if (p.status === "ON_HOLD") return { key: "hold", label: { en: "On hold", az: "Saxlanılıb" }, tone: "bad" };
  if (p.status === "READY") return { key: "clear", label: { en: "Clear to pay", az: "Ödəmək olar" }, tone: "brand" };
  const po = s.pos.find((x) => x.id === p.poId);
  if (po && po.status !== "CLOSED" && poReceivedShare(po) < 0.999) return { key: "goods", label: { en: "Waiting for goods", az: "Mal gözlənilir" }, tone: "warn" };
  return { key: "released", label: { en: "Not released", az: "Buraxılmayıb" }, tone: "neutral" };
}

// ---------------------------------------------------------------- trail

export type TrailStep = { kind: "MR" | "RFQ" | "QUOTE" | "APPROVAL" | "PO" | "GRN" | "PAYMENT"; id: string; ref: string; status: string; href: string; label: Txt };

const KIND_LABEL: Record<TrailStep["kind"], Txt> = {
  MR: { en: "Request", az: "Sorğu" },
  RFQ: { en: "RFQ", az: "RFQ" },
  QUOTE: { en: "Quote", az: "Təklif" },
  APPROVAL: { en: "Approval", az: "Təsdiq" },
  PO: { en: "Order", az: "Sifariş" },
  GRN: { en: "Receipt", az: "Qəbul" },
  PAYMENT: { en: "Payment", az: "Ödəniş" },
};

/** The full chain a record belongs to, MR → RFQ → Quote → Approval → PO → GRN → Payment. */
export function trailOf(s: OpsData, kind: TrailStep["kind"], id: string): TrailStep[] {
  let mrId: string | null = null;
  let rfqId: string | null = null;
  let quoteId: string | null = null;
  let poId: string | null = null;
  if (kind === "MR") mrId = id;
  if (kind === "RFQ") rfqId = id;
  if (kind === "QUOTE") quoteId = id;
  if (kind === "APPROVAL") quoteId = s.approvals.find((a) => a.id === id)?.quoteId ?? null;
  if (kind === "PO") poId = id;
  if (kind === "GRN") poId = s.grns.find((g) => g.id === id)?.poId ?? null;
  if (kind === "PAYMENT") poId = s.payments.find((p) => p.id === id)?.poId ?? null;
  if (poId) {
    const po = s.pos.find((p) => p.id === poId);
    quoteId = po?.quoteId ?? quoteId;
    rfqId = po?.rfqId ?? rfqId;
    mrId = po?.mrId ?? mrId;
  }
  if (quoteId) rfqId = s.quotes.find((q) => q.id === quoteId)?.rfqId ?? rfqId;
  if (rfqId) mrId = s.rfqs.find((r) => r.id === rfqId)?.mrId ?? mrId;
  if (!quoteId && rfqId) {
    const rfq = s.rfqs.find((r) => r.id === rfqId);
    quoteId = rfq?.awardedQuoteId ?? s.approvals.find((a) => a.rfqId === rfqId)?.quoteId ?? null;
  }
  const approval = quoteId ? s.approvals.find((a) => a.quoteId === quoteId) : undefined;
  if (!poId && approval?.poId) poId = approval.poId;
  if (!poId && mrId) poId = s.pos.find((p) => p.mrId === mrId)?.id ?? null;

  const steps: TrailStep[] = [];
  const push = (k: TrailStep["kind"], rid: string, ref: string, status: string, href: string) => steps.push({ kind: k, id: rid, ref, status, href, label: KIND_LABEL[k] });
  const mr = mrId ? s.mrs.find((x) => x.id === mrId) : undefined;
  if (mr) push("MR", mr.id, mr.ref, mr.status, R.request(mr.id));
  const rfq = rfqId ? s.rfqs.find((x) => x.id === rfqId) : undefined;
  if (rfq) push("RFQ", rfq.id, rfq.ref, rfq.status, R.rfq(rfq.id));
  const q = quoteId ? s.quotes.find((x) => x.id === quoteId) : undefined;
  if (q) push("QUOTE", q.id, q.id, q.status, R.quote(q.id));
  if (approval) push("APPROVAL", approval.id, approval.ref, approval.status, R.approval(approval.id));
  const po = poId ? s.pos.find((x) => x.id === poId) : undefined;
  if (po) {
    push("PO", po.id, po.ref, po.status, R.order(po.id));
    for (const g of s.grns.filter((x) => x.poId === po.id)) push("GRN", g.id, g.ref, g.status, R.receipt(g.id));
    for (const p of s.payments.filter((x) => x.poId === po.id)) push("PAYMENT", p.id, p.ref, p.status, R.payment(p.id));
  }
  return steps;
}

// ---------------------------------------------------------------- vendor comparison

export const FACTORS = ["price", "delivery", "record", "reliability", "risk", "completeness"] as const;
export type Factor = (typeof FACTORS)[number];
export type Weights = Record<Factor, number>;
export const FACTOR_LABEL: Record<Factor, Txt> = {
  price: { en: "Price", az: "Qiymət" },
  delivery: { en: "Delivery", az: "Çatdırılma" },
  record: { en: "Vendor record", az: "Təchizatçı tarixçəsi" },
  reliability: { en: "Reliability", az: "Etibarlılıq" },
  risk: { en: "Risk", az: "Risk" },
  completeness: { en: "Completeness", az: "Tamlıq" },
};
export const PRESETS: Record<"best" | "cost" | "fast" | "safe", { label: Txt; weights: Weights }> = {
  best: { label: { en: "Best overall", az: "Ən yaxşı ümumi" }, weights: { price: 30, delivery: 15, record: 25, reliability: 10, risk: 10, completeness: 5 } },
  cost: { label: { en: "Lowest cost", az: "Ən ucuz" }, weights: { price: 50, delivery: 10, record: 15, reliability: 10, risk: 10, completeness: 5 } },
  fast: { label: { en: "Fastest delivery", az: "Ən sürətli" }, weights: { price: 15, delivery: 40, record: 15, reliability: 10, risk: 10, completeness: 10 } },
  safe: { label: { en: "Lowest risk", az: "Ən az risk" }, weights: { price: 10, delivery: 10, record: 25, reliability: 15, risk: 25, completeness: 5 } },
};
const RISK_SCORE: Record<Risk, number> = { LOW: 95, MEDIUM: 70, HIGH: 40, CRITICAL: 15 };

export type Scored = { quote: Quotation; vendor: Vendor; total: number; factors: Record<Factor, number>; score: number; rank: number; tags: ("top" | "cheapest" | "fastest" | "check")[] };

/** Scores competing quotes 0–100 on six factors and ranks them with the given weights. */
export function scoreQuotes(s: Pick<OpsData, "vendors">, quotes: Quotation[], weights: Weights): Scored[] {
  const live = quotes.filter((q) => !q.duplicate);
  if (!live.length) return [];
  const totals = live.map(quoteTotal);
  const minTotal = Math.min(...totals);
  const minDays = Math.min(...live.map((q) => q.deliveryDays));
  const wsum = FACTORS.reduce((a, f) => a + weights[f], 0) || 1;
  const rows = live.map((q, i) => {
    const vendor = s.vendors.find((v) => v.id === q.vendorId)!;
    const priced = q.lines.filter((l) => l.unitPrice > 0).length / Math.max(1, q.lines.length);
    const factors: Record<Factor, number> = {
      price: Math.round((minTotal / totals[i]!) * 100),
      delivery: Math.round((Math.max(1, minDays) / Math.max(1, q.deliveryDays)) * 100),
      record: Math.round((vendor?.overall ?? 6) * 10),
      reliability: vendor?.scores.reliability ?? 60,
      risk: Math.round((RISK_SCORE[q.risk] + RISK_SCORE[vendor?.risk ?? "MEDIUM"]) / 2 - (vendor?.status === "ON_HOLD" ? 25 : 0)),
      completeness: Math.round(priced * q.confidence * 100),
    };
    const score = Math.round(FACTORS.reduce((a, f) => a + factors[f] * weights[f], 0) / wsum);
    return { quote: q, vendor, total: totals[i]!, factors, score, rank: 0, tags: [] as Scored["tags"] };
  });
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));
  const cheapest = rows.reduce((a, b) => (b.total < a.total ? b : a));
  const fastest = rows.reduce((a, b) => (b.quote.deliveryDays < a.quote.deliveryDays ? b : a));
  rows[0]!.tags.push("top");
  cheapest.tags.push("cheapest");
  fastest.tags.push("fastest");
  for (const r of rows) if (r.factors.risk < 50 || r.quote.checks.some((c) => c.result === "FAILED")) r.tags.push("check");
  return rows;
}

// ---------------------------------------------------------------- programme maths

export type Cpm = { es: number; ef: number; ls: number; lf: number; tf: number; ff: number; critical: boolean; near: boolean; dur: number };

/** Critical path on the current programme (calendar days from project start). */
export function cpm(activities: Activity[], links: Dependency[], finish = PROJECT_FINISH): Map<string, Cpm> {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const preds = new Map<string, Dependency[]>();
  const succs = new Map<string, Dependency[]>();
  for (const l of links) {
    if (!byId.has(l.from) || !byId.has(l.to)) continue;
    preds.set(l.to, [...(preds.get(l.to) ?? []), l]);
    succs.set(l.from, [...(succs.get(l.from) ?? []), l]);
  }
  const order: Activity[] = [];
  const seen = new Set<string>();
  const visit = (a: Activity, stack = new Set<string>()) => {
    if (seen.has(a.id) || stack.has(a.id)) return;
    stack.add(a.id);
    for (const l of preds.get(a.id) ?? []) visit(byId.get(l.from)!, stack);
    seen.add(a.id);
    order.push(a);
  };
  activities.forEach((a) => visit(a));
  const out = new Map<string, Cpm>();
  for (const a of order) {
    const dur = Math.max(0, diffDays(a.start, a.end));
    let es = diffDays(PROJECT_START, a.start);
    for (const l of preds.get(a.id) ?? []) {
      const p = out.get(l.from);
      if (!p) continue;
      if (l.type === "FS") es = Math.max(es, p.ef + l.lag);
      if (l.type === "SS") es = Math.max(es, p.es + l.lag);
      if (l.type === "FF") es = Math.max(es, p.ef + l.lag - dur);
      if (l.type === "SF") es = Math.max(es, p.es + l.lag - dur);
    }
    out.set(a.id, { es, ef: es + dur, ls: 0, lf: 0, tf: 0, ff: 0, critical: false, near: false, dur });
  }
  const projectEnd = Math.max(diffDays(PROJECT_START, finish), ...[...out.values()].map((c) => c.ef));
  for (const a of [...order].reverse()) {
    const c = out.get(a.id)!;
    let lf = projectEnd;
    let minSuccEs = Infinity;
    for (const l of succs.get(a.id) ?? []) {
      const sc = out.get(l.to);
      if (!sc) continue;
      if (l.type === "FS") lf = Math.min(lf, sc.ls - l.lag);
      if (l.type === "SS") lf = Math.min(lf, sc.ls - l.lag + c.dur);
      if (l.type === "FF") lf = Math.min(lf, sc.lf - l.lag);
      if (l.type === "SF") lf = Math.min(lf, sc.lf - l.lag + c.dur);
      minSuccEs = Math.min(minSuccEs, l.type === "FS" ? sc.es - l.lag : sc.es);
    }
    c.lf = lf;
    c.ls = lf - c.dur;
    c.tf = c.ls - c.es;
    c.ff = minSuccEs === Infinity ? projectEnd - c.ef : Math.max(0, minSuccEs - c.ef);
    c.critical = c.tf <= 0;
    c.near = !c.critical && c.tf <= 10;
  }
  return out;
}

/** Budget-weighted planned share of an activity at a date, using baseline dates. */
function plannedShare(a: Activity, date: string, useBaseline = true) {
  const s = useBaseline ? a.bStart : a.start;
  const e = useBaseline ? a.bEnd : a.end;
  if (date <= s) return 0;
  if (date >= e) return 1;
  return diffDays(s, date) / Math.max(1, diffDays(s, e));
}

export type ProgrammeStats = { plannedPct: number; actualPct: number; spi: number; forecastFinish: string; varianceDays: number; daysLeft: number; budget: number; earned: number; planned: number };

export function programmeStats(activities: Activity[], date = TODAY): ProgrammeStats {
  const budget = activities.reduce((a, x) => a + x.budget, 0) || 1;
  const planned = activities.reduce((a, x) => a + x.budget * plannedShare(x, date), 0);
  const earned = activities.reduce((a, x) => a + (x.budget * x.pct) / 100, 0);
  const forecastFinish = activities.reduce((a, x) => maxDate(a, x.end), PROJECT_START);
  return {
    plannedPct: planned / budget,
    actualPct: earned / budget,
    spi: planned > 0 ? earned / planned : 1,
    forecastFinish,
    varianceDays: diffDays(PROJECT_FINISH, forecastFinish),
    daysLeft: diffDays(date, forecastFinish),
    budget,
    earned,
    planned,
  };
}

export type CurvePoint = { date: string; planned: number; actual: number | null; forecast: number | null };

/** Planned vs actual S-curve, weekly. Actual history is scaled from today's earned share. */
export function sCurve(activities: Activity[], step = 7): CurvePoint[] {
  const st = programmeStats(activities);
  const ratio = st.plannedPct > 0 ? st.actualPct / st.plannedPct : 1;
  const budget = st.budget;
  const end = maxDate(PROJECT_FINISH, st.forecastFinish);
  const pts: CurvePoint[] = [];
  for (let d = PROJECT_START; d <= addDays(end, step); d = addDays(d, step)) {
    const date = d > end ? end : d;
    const planned = activities.reduce((a, x) => a + x.budget * plannedShare(x, date), 0) / budget;
    const forecast = activities.reduce((a, x) => a + x.budget * plannedShare(x, date, false), 0) / budget;
    pts.push({ date, planned, actual: date <= TODAY ? planned * (date === TODAY ? ratio : 1 - (1 - ratio) * (diffDays(PROJECT_START, date) / Math.max(1, diffDays(PROJECT_START, TODAY)))) : null, forecast: date >= TODAY ? Math.max(forecast, st.actualPct) : null });
    if (date === end) break;
  }
  // Exact point at today.
  const i = pts.findIndex((p) => p.date > TODAY);
  if (i > 0 && pts[i - 1]!.date !== TODAY) pts.splice(i, 0, { date: TODAY, planned: st.plannedPct, actual: st.actualPct, forecast: st.actualPct });
  return pts;
}

export type MilestoneState = "DONE" | "ON_TRACK" | "WATCH" | "AT_RISK" | "LATE";

/** Live forecast of a milestone from the activities that drive it. */
export function milestoneForecast(mst: Milestone, activities: Activity[]) {
  const ends = mst.drivers.map((id) => activities.find((a) => a.id === id)).filter(Boolean) as Activity[];
  const done = ends.length > 0 && ends.every((a) => a.status === "COMPLETED");
  const forecast = ends.length ? ends.map((a) => (a.status === "COMPLETED" ? (a.aEnd ?? a.end) : a.end)).reduce((a, b) => maxDate(a, b)) : mst.forecast;
  const slip = diffDays(mst.target, forecast);
  const state: MilestoneState = done ? "DONE" : slip <= 0 ? "ON_TRACK" : slip <= 5 ? "WATCH" : slip <= 10 ? "AT_RISK" : "LATE";
  return { forecast, slip, state, done };
}

// ---------------------------------------------------------------- health

export type HealthArea = { key: string; label: Txt; score: number | null; link: string };
export type HealthDriver = { area: string; text: Txt; impact: number; link: string; attention: boolean };

/** Project health 0–100 across eight areas, with signed drivers that explain the score. */
export function projectHealth(s: OpsData) {
  const st = programmeStats(s.activities);
  const drivers: HealthDriver[] = [];
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const blocked = s.activities.filter((a) => a.status === "BLOCKED").length;
  const late = s.milestones.filter((x) => milestoneForecast(x, s.activities).state === "LATE").length;
  const schedule = clamp(st.spi * 100 - blocked * 6 - late * 4);
  if (st.spi < 0.95) drivers.push({ area: "schedule", text: { en: `Work is ${Math.round((1 - st.spi) * 100)}% behind the planned value`, az: `İş planlaşdırılmış dəyərdən ${Math.round((1 - st.spi) * 100)}% geridədir` }, impact: -Math.round((1 - st.spi) * 60), link: R.pm, attention: st.spi < 0.85 });
  if (blocked) drivers.push({ area: "schedule", text: { en: `${blocked} ${blocked > 1 ? "activities" : "activity"} blocked on the critical path`, az: `Kritik yolda ${blocked} iş bloklanıb` }, impact: -blocked * 6, link: R.programme(), attention: true });

  const committed = s.pos.filter((p) => p.status !== "CANCELLED").reduce((a, p) => a + poNet(p), 0);
  const budgeted = s.pos.filter((p) => p.status !== "CANCELLED").reduce((a, p) => a + budgetOf(s, p.lines), 0);
  const costVar = budgeted > 0 ? committed / budgeted - 1 : 0;
  const cost = clamp(92 - Math.max(0, costVar) * 300 + Math.max(0, -costVar) * 60);
  if (costVar < 0) drivers.push({ area: "cost", text: { en: `Orders placed ${Math.round(-costVar * 100)}% under the BOQ budget`, az: `Sifarişlər smetadan ${Math.round(-costVar * 100)}% aşağı verilib` }, impact: Math.round(-costVar * 40), link: R.budget, attention: false });

  const today = s.reports.filter((r) => r.date <= TODAY).slice(-1)[0];
  const crewPlanned = s.activities.filter((a) => a.status === "IN_PROGRESS").reduce((a, x) => a + x.crew, 0);
  const crewOnSite = today ? today.labour.reduce((a, l) => a + l.count, 0) : crewPlanned;
  const manpower = clamp((crewOnSite / Math.max(1, crewPlanned)) * 90);
  const shortage = s.impacts.filter((i) => i.kind === "MANPOWER_SHORTAGE" && i.status !== "RESOLVED").length;
  if (shortage) drivers.push({ area: "manpower", text: { en: "Steel fixers short on the admin foundations", az: "İnzibati bina bünövrəsində armaturçu çatışmır" }, impact: -4, link: R.live, attention: false });

  const low = s.stock.filter((x) => x.reorder > 0 && x.onHand < x.reorder).length;
  const latePos = s.pos.filter(poLate).length;
  const materials = clamp(95 - low * 4 - latePos * 10);
  if (latePos) drivers.push({ area: "materials", text: { en: `${latePos} purchase order${latePos > 1 ? "s" : ""} late on delivery`, az: `${latePos} sifarişin çatdırılması gecikir` }, impact: -latePos * 10, link: R.orders, attention: true });
  if (low) drivers.push({ area: "materials", text: { en: `${low} stock items below the reorder line`, az: `${low} material ehtiyat həddindən aşağıdır` }, impact: -low * 2, link: R.inventory, attention: false });

  const broken = s.impacts.filter((i) => i.kind === "EQUIPMENT_FAILURE" && i.status !== "RESOLVED").length;
  const equipment = clamp(92 - broken * 18);
  if (broken) drivers.push({ area: "equipment", text: { en: "Mobile crane 50 t out of service", az: "50 t avtokran işlək deyil" }, impact: -broken * 8, link: R.live, attention: true });

  const ncrOpen = s.inspections.filter((i) => i.kind === "NCR" && i.status === "OPEN").length;
  const safety = clamp(94 - ncrOpen * 2);

  const wir = s.inspections.filter((i) => i.kind !== "NCR" && i.inspectedAt);
  const passRate = wir.length ? wir.filter((i) => i.status === "PASSED" || i.status === "PASSED_WITH_COMMENTS").length / wir.length : 1;
  const quality = clamp(passRate * 100 - ncrOpen * 5);
  if (ncrOpen) drivers.push({ area: "quality", text: { en: `${ncrOpen} non-conformance${ncrOpen > 1 ? "s" : ""} open`, az: `${ncrOpen} uyğunsuzluq açıqdır` }, impact: -ncrOpen * 5, link: R.inspections, attention: false });
  if (passRate > 0.7) drivers.push({ area: "quality", text: { en: `${Math.round(passRate * 100)}% of inspections passed`, az: `Yoxlamaların ${Math.round(passRate * 100)}%-i keçib` }, impact: 4, link: R.inspections, attention: false });

  const overdueRfi = s.rfis.filter((r) => r.status === "OPEN" && r.dueAt < TODAY).length;
  const pendingApprovals = s.approvals.filter((a) => a.status === "PENDING").length;
  const risk = clamp(90 - overdueRfi * 14 - pendingApprovals * 3);
  if (overdueRfi) drivers.push({ area: "risk", text: { en: `${overdueRfi} RFI${overdueRfi > 1 ? "s" : ""} overdue with the designer`, az: `Layihəçidə ${overdueRfi} RFI gecikir` }, impact: -overdueRfi * 14, link: R.rfis, attention: true });

  const areas: HealthArea[] = [
    { key: "schedule", label: { en: "Schedule", az: "Qrafik" }, score: schedule, link: R.programme() },
    { key: "cost", label: { en: "Cost & cash flow", az: "Xərc və pul axını" }, score: cost, link: R.budget },
    { key: "manpower", label: { en: "Manpower", az: "İşçi qüvvəsi" }, score: manpower, link: R.reports },
    { key: "materials", label: { en: "Materials", az: "Materiallar" }, score: materials, link: R.inventory },
    { key: "equipment", label: { en: "Equipment", az: "Texnika" }, score: equipment, link: R.live },
    { key: "safety", label: { en: "Safety", az: "Təhlükəsizlik" }, score: safety, link: R.inspections },
    { key: "quality", label: { en: "Quality", az: "Keyfiyyət" }, score: quality, link: R.inspections },
    { key: "risk", label: { en: "Risk & approvals", az: "Risk və təsdiqlər" }, score: risk, link: R.rfis },
  ];
  const weights = { schedule: 0.25, cost: 0.15, manpower: 0.1, materials: 0.15, equipment: 0.08, safety: 0.09, quality: 0.08, risk: 0.1 } as Record<string, number>;
  const score = Math.round(areas.reduce((a, x) => a + (x.score ?? 0) * (weights[x.key] ?? 0), 0));
  const status: Txt = score >= 85 ? { en: "Healthy", az: "Sağlam" } : score >= 72 ? { en: "On track", az: "Qrafikdə" } : score >= 60 ? { en: "Watch", az: "Diqqət" } : score >= 45 ? { en: "At risk", az: "Risk altında" } : { en: "Critical", az: "Kritik" };
  const tone: Tone = score >= 72 ? "ok" : score >= 60 ? "warn" : "bad";
  drivers.sort((a, b) => a.impact - b.impact);
  return { score, status, tone, areas, drivers, stats: st };
}

// ---------------------------------------------------------------- billing

/** Value of a building × section at sample rates (for IPC and budget pages). */
export const sectionWorth = (building: string, section: string) => sectionValue.get(`${building}/${section}`) ?? 0;
export const sectionName = (id: string, lang: "az" | "en") => {
  const s = data.sections.find((x) => x.id === id);
  return s ? (lang === "az" ? s.az : s.en) : id;
};

export function ipcAmounts(ipc: OpsData["ipcs"][number]) {
  const gross = ipc.lines.reduce((a, l) => a + sectionWorth(l.building, l.section) * l.pctToDate, 0);
  const prev = ipc.lines.reduce((a, l) => a + sectionWorth(l.building, l.section) * l.pctPrev, 0);
  const thisPeriod = gross - prev;
  const retention = thisPeriod * ipc.retention;
  const advance = thisPeriod * ipc.advanceRecovery;
  const vat = (thisPeriod - retention - advance) * 0.18;
  return { gross, prev, thisPeriod, retention, advance, vat, due: thisPeriod - retention - advance + vat };
}

// ---------------------------------------------------------------- vendors

export function vendorStats(s: OpsData, vendorId: string) {
  const pos = s.pos.filter((p) => p.vendorId === vendorId && p.status !== "CANCELLED");
  const quotes = s.quotes.filter((q) => q.vendorId === vendorId && !q.duplicate);
  const paid = s.payments.filter((p) => p.vendorId === vendorId && p.status === "PAID").reduce((a, p) => a + p.amount, 0);
  const ordered = pos.reduce((a, p) => a + poTotal(p), 0);
  const quoted = quotes.reduce((a, q) => a + quoteTotal(q), 0);
  const won = quotes.filter((q) => q.outcome === "WON").length;
  const invites = s.rfqs.reduce((a, r) => a + r.invitations.filter((i) => i.vendorId === vendorId).length, 0);
  return { pos, quotes, paid, ordered, quoted, won, invites, late: pos.filter(poLate).length };
}

export const grnShort = (g: GoodsReceipt) => g.lines.some((l) => l.prior + l.accepted < l.ordered - 1e-6 && g.status !== "DRAFT");

/** Initials for avatars. */
export const initials = (nm: string) =>
  nm
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

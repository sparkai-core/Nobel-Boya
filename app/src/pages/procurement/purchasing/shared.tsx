import { data } from "../../../data";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { poLate, poReceivedShare, poTotal, R, to, trailOf, type Tone, type TrailStep } from "../../../ops/select";
import type { Agreement, Material, OpsData, PurchaseOrder, Trade, Txt, Vendor } from "../../../ops/types";
import type { LifeStep, useL } from "../../../components/kit";

/** Helpers for Procurement · Purchasing (new order, framework agreements, catalogue, onboarding) and the lifecycle strip. */

export type L = ReturnType<typeof useL>;

// ---------------------------------------------------------------- routes

export const PR = {
  newOrder: (q: { agreement?: string; from?: string; mr?: string; material?: string } = {}) => {
    const qs = Object.entries(q)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
      .join("&");
    return to(`procurement/orders/new${qs ? `?${qs}` : ""}`);
  },
  agreements: to("procurement/agreements"),
  agreement: (id: string) => to(`procurement/agreements/${id}`),
  catalogue: to("procurement/catalogue"),
  material: (key: string) => to(`procurement/catalogue/${encodeURIComponent(key)}`),
  onboarding: to("procurement/vendors/onboarding"),
};

export const VAT = 0.18;

// ---------------------------------------------------------------- agreements

export type AgrState = "ACTIVE" | "EXPIRING" | "EXPIRED" | "DRAFT";
export const AGR_META: Record<AgrState, { label: Txt; tone: Tone }> = {
  ACTIVE: { label: { en: "Active", az: "Qüvvədədir" }, tone: "ok" },
  EXPIRING: { label: { en: "Expiring soon", az: "Müddəti bitir" }, tone: "warn" },
  EXPIRED: { label: { en: "Expired", az: "Müddəti bitib" }, tone: "muted" },
  DRAFT: { label: { en: "Draft", az: "Qaralama" }, tone: "neutral" },
};

/** Live state of an agreement: drafts and closed ones as stored, otherwise from the dates (45-day warning). */
export function agrState(a: Agreement): AgrState {
  if (a.status === "DRAFT") return "DRAFT";
  if (a.status === "EXPIRED" || a.to < TODAY) return "EXPIRED";
  if (diffDays(TODAY, a.to) <= 45) return "EXPIRING";
  return "ACTIVE";
}
export const agrOpen = (a: Agreement) => {
  const st = agrState(a);
  return (st === "ACTIVE" || st === "EXPIRING") && a.from <= TODAY;
};

export const agrPos = (s: Pick<OpsData, "pos">, a: Agreement) => a.poIds.map((id) => s.pos.find((p) => p.id === id)).filter((p): p is PurchaseOrder => !!p && p.status !== "CANCELLED");
export const agrUsed = (s: Pick<OpsData, "pos">, a: Agreement) => agrPos(s, a).reduce((x, p) => x + poTotal(p), 0);

/** Money saved against BOQ rates on the call-offs placed so far (net). */
export function agrSaved(s: Pick<OpsData, "pos" | "materials">, a: Agreement) {
  return agrPos(s, a).reduce(
    (x, p) =>
      x +
      p.lines.reduce((y, l) => {
        const m = l.material ? s.materials.find((mm) => mm.key === l.material) : undefined;
        return y + (m ? (m.rate - l.rate) * l.qty : 0);
      }, 0),
    0,
  );
}

export const agreementOfPo = (s: Pick<OpsData, "agreements">, poId: string) => s.agreements.find((a) => a.poIds.includes(poId));
/** The open agreement that lists a material (first one), if any. */
export const agreementFor = (s: Pick<OpsData, "agreements">, key: string) => s.agreements.find((a) => agrOpen(a) && a.rates.some((r) => r.material === key));

/** Adds whole months to an ISO date. */
export function addMonths(iso: string, n: number) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  const dd = Math.min(Number(iso.slice(8, 10)), last);
  return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- materials

export const matOf = (s: Pick<OpsData, "materials">, key: string | null | undefined) => (key ? s.materials.find((m) => m.key === key) : undefined);

export type Funnel = { boq: number; requested: number; ordered: number; received: number; issued: number; toBuy: number };

/** BOQ → requested → ordered → received → issued, for one material. */
export function funnelOf(s: Pick<OpsData, "mrs" | "pos" | "movements" | "materials">, key: string): Funnel {
  const m = matOf(s, key);
  const requested = s.mrs.filter((r) => r.status !== "CANCELLED").reduce((a, r) => a + r.lines.filter((l) => l.material === key).reduce((b, l) => b + l.qty, 0), 0);
  const live = s.pos.filter((p) => p.status !== "CANCELLED");
  const ordered = live.reduce((a, p) => a + p.lines.filter((l) => l.material === key).reduce((b, l) => b + l.qty, 0), 0);
  const received = live.reduce((a, p) => a + p.lines.filter((l) => l.material === key).reduce((b, l) => b + l.received, 0), 0);
  const issued = -s.movements.filter((v) => v.key === key && v.type === "ISSUE").reduce((a, v) => a + v.qty, 0);
  const boq = m?.budgetQty ?? 0;
  return { boq, requested, ordered, received, issued, toBuy: Math.max(0, boq - ordered) };
}

export type PricePoint = { date: string; rate: number; poId: string; vendorId: string };
/** Prices paid on purchase orders, oldest first. */
export function pricesPaid(s: Pick<OpsData, "pos">, key: string): PricePoint[] {
  return s.pos
    .filter((p) => p.status !== "CANCELLED")
    .flatMap((p) => p.lines.filter((l) => l.material === key).map((l) => ({ date: p.issuedAt, rate: l.rate, poId: p.id, vendorId: p.vendorId })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Market series for a material, converted to the material's unit where the series uses tonnes. */
export function seriesOf(s: Pick<OpsData, "priceSeries">, m: Material) {
  const ps = s.priceSeries.find((x) => x.material === m.key);
  if (!ps) return null;
  const f = ps.unit === m.unit ? 1 : ps.unit === "t" && m.unit === "kg" ? 1 / 1000 : ps.unit === "t" && m.key === "x-cement" ? 1 / 20 : null;
  if (f == null) return null;
  return { ...ps, history: ps.history.map((h) => ({ ...h, price: h.price * f })), forecast: ps.forecast.map((h) => ({ ...h, price: h.price * f, low: h.low * f, high: h.high * f })) };
}

/** Vendors that supply a material: those already ordered from, then those whose trades cover it. */
export function suppliersOf(s: Pick<OpsData, "vendors" | "pos">, m: Material): Vendor[] {
  const ordered = new Set(s.pos.filter((p) => p.lines.some((l) => l.material === m.key)).map((p) => p.vendorId));
  const list = s.vendors.filter((v) => ordered.has(v.id) || v.trade === m.trade || v.trades.includes(m.trade));
  return list.sort((a, b) => Number(ordered.has(b.id)) - Number(ordered.has(a.id)) || b.overall - a.overall);
}

/** BOQ sections and buildings where a material is measured. */
export function placesOf(key: string) {
  const sections = new Set<string>();
  const buildings = new Set<string>();
  for (const it of data.items) {
    if (it.rate !== key) continue;
    sections.add(it.section);
    buildings.add(it.building);
  }
  return { sections, buildings };
}

/** On-time share of a vendor's deliveries: first posted receipt on or before the expected date. */
export function onTimeOf(s: Pick<OpsData, "grns">, pos: PurchaseOrder[]) {
  let done = 0;
  let ok = 0;
  for (const p of pos) {
    const first = s.grns.filter((g) => g.poId === p.id && g.receivedAt && g.status !== "DRAFT").sort((a, b) => (a.receivedAt ?? "").localeCompare(b.receivedAt ?? ""))[0];
    if (!first) continue;
    done++;
    if ((first.receivedAt ?? "").slice(0, 10) <= p.expectedAt) ok++;
  }
  return { done, ok, share: done ? ok / done : null };
}

/** Sheet prefix used as stand-in photos for a trade (the drawing renders of the package). */
export function photoSheets(seed: string, trade: Trade | null, n = 3) {
  const prefix = trade === "Concrete" || trade === "Reinforcement" || trade === "Steel" || trade === "Earthworks and bases" ? "KS-" : trade === "External works" ? "BP-" : trade === "Building services" ? "MEP-" : "AR-";
  const pool = data.sheets.map((x) => x.id).filter((id) => id.startsWith(prefix));
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const id = pool[(h + i * 7) % pool.length]!;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------- lifecycle

/**
 * The record's life across the chain, with real dates:
 * request → RFQ → quotes → approval → order → vendor → receipt → invoice → paid.
 */
export function lifeSteps(s: OpsData, kind: TrailStep["kind"], id: string, l: Pick<L, "t" | "d">): LifeStep[] {
  const { t, d } = l;
  const trail = trailOf(s, kind, id);
  const pick = (k: TrailStep["kind"]) => trail.find((x) => x.kind === k)?.id;
  const mr = s.mrs.find((x) => x.id === pick("MR"));
  // trailOf walks up the chain; also follow it down from a request to its RFQ, approval and order.
  const rfq = s.rfqs.find((x) => x.id === pick("RFQ")) ?? (mr ? s.rfqs.find((x) => x.mrId === mr.id && x.status !== "CANCELLED") : undefined);
  const approval = s.approvals.find((x) => x.id === pick("APPROVAL")) ?? (rfq ? s.approvals.find((x) => x.rfqId === rfq.id) : undefined);
  const po = s.pos.find((x) => x.id === pick("PO")) ?? (approval?.poId ? s.pos.find((x) => x.id === approval.poId) : rfq ? s.pos.find((x) => x.rfqId === rfq.id) : undefined);
  const quoteId = pick("QUOTE");
  const quotes = rfq ? s.quotes.filter((q) => q.rfqId === rfq.id && !q.duplicate) : s.quotes.filter((q) => q.id === quoteId);
  const grns = po ? s.grns.filter((g) => g.poId === po.id && g.status !== "DRAFT" && g.receivedAt) : [];
  const invoices = po ? s.invoices.filter((i) => i.poId === po.id && !i.duplicate) : [];
  const pays = po ? s.payments.filter((p) => p.poId === po.id) : [];
  const direct = !!po && !po.rfqId && !po.quoteId;
  const fmt = (v: string | null | undefined) => (v ? d(v, false) : undefined);
  const steps: LifeStep[] = [];

  // 1 request
  if (mr) steps.push({ label: t("Request"), date: fmt(mr.submittedAt ?? mr.createdAt), state: mr.status === "DRAFT" ? "current" : mr.status === "CANCELLED" ? "skipped" : "done", href: R.request(mr.id), note: mr.status === "DRAFT" ? t("Draft") : mr.ref });
  else steps.push({ label: t("Request"), state: po || rfq ? "skipped" : "todo", note: po || rfq ? t("None") : undefined });

  // 2 RFQ
  if (rfq) steps.push({ label: t("RFQ sent"), date: fmt(rfq.createdAt), state: rfq.status === "DRAFT" ? "current" : rfq.status === "CANCELLED" ? "skipped" : "done", href: R.rfq(rfq.id), note: rfq.ref });
  else steps.push({ label: t("RFQ sent"), state: direct ? "skipped" : "todo", note: direct ? t("Direct order") : undefined });

  // 3 quotes
  const lastQuote = quotes.map((q) => q.receivedAt).sort().slice(-1)[0];
  const rfqOpen = rfq && rfq.status === "OPEN";
  if (quotes.length) steps.push({ label: t("Quotes in"), date: fmt(lastQuote), state: rfqOpen && !approval && !po ? "current" : "done", href: rfq ? R.compare(rfq.id) : R.quote(quotes[0]!.id), note: rfq ? t("{a} of {b}", { a: quotes.length, b: rfq.invitations.length }) : quotes[0]!.id });
  else steps.push({ label: t("Quotes in"), state: direct ? "skipped" : rfq && rfq.dueDate < TODAY ? "late" : "todo", date: rfq ? t("due {d}", { d: d(rfq.dueDate, false) }) : undefined });

  // 4 approval
  if (approval) steps.push({ label: t("Approval"), date: fmt(approval.finalAt ?? approval.firstAt ?? approval.requestedAt), state: approval.status === "APPROVED" ? "done" : approval.status === "REJECTED" ? "late" : "current", href: R.approval(approval.id), note: approval.status === "PENDING" ? t("{a} of {b} signed", { a: approval.level, b: approval.requiredLevels }) : approval.ref });
  else steps.push({ label: t("Approval"), state: direct ? "skipped" : "todo", note: direct ? t("Under the limit") : undefined });

  // 5 order
  if (po) steps.push({ label: t("Order issued"), date: fmt(po.issuedAt), state: po.status === "CANCELLED" ? "late" : "done", href: R.order(po.id), note: po.ref });
  else steps.push({ label: t("Order issued"), state: "todo" });

  // 6 vendor
  if (po && po.dispatchedAt) steps.push({ label: t("Dispatched"), date: fmt(po.dispatchedAt), state: "done", note: t("Accepted by vendor") });
  else if (po && po.vendorAck === "ACCEPTED") steps.push({ label: t("Vendor accepted"), state: "done", note: t("In the portal") });
  else steps.push({ label: t("Vendor accepted"), state: po && po.status !== "CANCELLED" ? "current" : "todo", note: po ? t("Waiting") : undefined });

  // 7 receipt
  const share = po ? poReceivedShare(po) : 0;
  const lastGrn = grns.map((g) => g.receivedAt ?? "").sort().slice(-1)[0];
  if (po && (po.status === "CLOSED" || share >= 0.999)) steps.push({ label: t("Goods received"), date: fmt(lastGrn), state: "done", href: grns.length ? R.receipt(grns[grns.length - 1]!.id) : undefined, note: t("{n} receipts", { n: grns.length }) });
  else if (po && po.status !== "CANCELLED") {
    const late = poLate(po);
    steps.push({ label: t("Goods received"), date: lastGrn ? fmt(lastGrn) : t("due {d}", { d: d(po.expectedAt, false) }), state: late ? "late" : share > 0 ? "current" : "todo", href: grns.length ? R.receipt(grns[grns.length - 1]!.id) : undefined, note: late ? t("{n} days late", { n: diffDays(po.expectedAt, TODAY) }) : share > 0 ? t("{p}% in", { p: Math.round(share * 100) }) : undefined });
  } else steps.push({ label: t("Goods received"), state: "todo" });

  // 8 invoice
  const inv = invoices.sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  if (inv) {
    const ok = inv.status === "SIGN_OFF" || inv.status === "BOOKED" || inv.status === "PAID";
    const bad = inv.status === "MISMATCH" || inv.status === "REJECTED" || inv.status === "CREDIT_REQUESTED";
    steps.push({ label: t("Invoice"), date: fmt(inv.date), state: ok ? "done" : bad ? "late" : "current", href: to(`procurement/invoices/${inv.id}`), note: ok ? inv.ref : bad ? t("Does not match") : t("To match") });
  } else steps.push({ label: t("Invoice"), state: "todo" });

  // 9 paid
  const live = pays.filter((p) => p.amount > 0);
  const paidAll = live.length > 0 && live.every((p) => p.status === "PAID");
  const paidSome = live.some((p) => p.status === "PAID");
  const hold = live.find((p) => p.status === "ON_HOLD");
  const lastPaid = live.map((p) => p.paidAt ?? "").sort().slice(-1)[0];
  const nextDue = live.filter((p) => p.status !== "PAID").map((p) => p.dueDate).sort()[0];
  if (paidAll) steps.push({ label: t("Paid"), date: fmt(lastPaid), state: "done", href: R.payment(live[live.length - 1]!.id) });
  else if (hold) steps.push({ label: t("Paid"), state: "late", href: R.payment(hold.id), note: t("On hold") });
  else steps.push({ label: t("Paid"), date: nextDue ? t("due {d}", { d: d(nextDue, false) }) : undefined, state: paidSome ? "current" : "todo", href: live[0] ? R.payment(live[0].id) : undefined, note: paidSome ? t("Part paid") : undefined });

  // The first open step is "now" when nothing else is.
  if (!steps.some((x) => x.state === "current" || x.state === "late")) {
    const i = steps.findIndex((x) => x.state === "todo");
    if (i >= 0) steps[i] = { ...steps[i]!, state: "current" };
  }
  return steps;
}

/** Monthly keys "YYYY-MM" from a to b inclusive. */
export function monthsFrom(a: string, b: string) {
  const out: string[] = [];
  for (let m = `${a.slice(0, 7)}-01`; m.slice(0, 7) <= b.slice(0, 7); m = `${addDays(`${m.slice(0, 7)}-28`, 7).slice(0, 7)}-01`) out.push(m.slice(0, 7));
  return out;
}

// ---------------------------------------------------------------- invoices (labels for links from purchasing and receipts)

export const INVOICE_META: Record<string, { label: Txt; tone: Tone }> = {
  TO_MATCH: { label: { en: "To match", az: "Uyğunlaşdırılmalı" }, tone: "info" },
  MISMATCH: { label: { en: "Does not match", az: "Uyğun deyil" }, tone: "bad" },
  CREDIT_REQUESTED: { label: { en: "Credit note requested", az: "Kredit notu istənilib" }, tone: "warn" },
  SIGN_OFF: { label: { en: "For sign-off", az: "İmzada" }, tone: "brand" },
  BOOKED: { label: { en: "Booked", az: "Uçota alınıb" }, tone: "ok" },
  PAID: { label: { en: "Paid", az: "Ödənilib" }, tone: "ok" },
  REJECTED: { label: { en: "Rejected", az: "Rədd edilib" }, tone: "bad" },
};
export const invoiceHref = (id: string) => to(`procurement/invoices/${id}`);

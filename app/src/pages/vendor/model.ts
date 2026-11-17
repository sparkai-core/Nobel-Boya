import { useMemo } from "react";
import { useOps, type OpsState } from "../../ops/store";
import { addDays, diffDays, TODAY } from "../../ops/dates";
import { poReceivedShare, poTotal, R, type Tone } from "../../ops/select";
import { docUploadsOf } from "../../ops/ext/vendor";
import type { GoodsReceipt, Invitation, Invoice, Payment, PurchaseOrder, Quotation, Rfq, Txt, Vendor } from "../../ops/types";

/** Derived, vendor-side views of the shared ops store. Everything here is read-only. */

export const BUYER = "Qobu Tikinti MMC";

const B = R.vendorPortal;
export const VP = {
  home: B,
  rfqs: `${B}/rfqs`,
  rfq: (id: string) => `${B}/rfqs/${id}`,
  quotes: `${B}/quotes`,
  orders: `${B}/orders`,
  order: (id: string) => `${B}/orders/${id}`,
  deliveries: `${B}/deliveries`,
  payments: `${B}/payments`,
  invoices: `${B}/invoices`,
  documents: `${B}/documents`,
  accept: (invite?: string) => `${B}/accept${invite ? `?invite=${invite}` : ""}`,
  profile: `${B}/profile`,
};

/** An invoice the vendor can still act on or follow (a replaced or rejected one is history). */
const live = (i: Invoice) => i.status !== "REJECTED";

/** Maps a buyer-side feed link to the matching portal page. */
export function portalLink(link: string | null): string | null {
  if (!link) return null;
  const path = link.split("?")[0]!;
  const m = path.match(/^procurement\/(\w+)\/?([\w-]*)/);
  if (!m) return null;
  const [, area, id] = m;
  if (area === "rfqs") return id ? VP.rfq(id) : VP.rfqs;
  if (area === "orders") return id ? VP.order(id) : VP.orders;
  if (area === "quotes") return VP.quotes;
  if (area === "payments") return VP.payments;
  if (area === "invoices") return VP.invoices;
  if (area === "receipts") return VP.deliveries;
  if (area === "vendors") return VP.profile;
  return null;
}

// ---------------------------------------------------------------- invitations

export type Bucket = "answer" | "sent" | "closed";
export type InviteRow = { rfq: Rfq; inv: Invitation; bucket: Bucket; daysLeft: number; quote: Quotation | null; neededBy: string | null };

export function inviteBucket(rfq: Rfq, inv: Invitation): Bucket {
  if (rfq.status === "OPEN" && (inv.status === "INVITED" || inv.status === "ACKNOWLEDGED")) return "answer";
  if (inv.status === "SUBMITTED" && (rfq.status === "OPEN" || rfq.status === "CLOSED")) return "sent";
  return "closed";
}

export const BUCKET_LABEL: Record<Bucket, string> = { answer: "To answer", sent: "Quote sent", closed: "Closed" };
export const BUCKET_TONE: Record<Bucket, Tone> = { answer: "brand", sent: "ok", closed: "muted" };

// ---------------------------------------------------------------- the vendor's slice of the store

export type VendorView = {
  vendor: Vendor;
  invites: InviteRow[];
  quotes: Quotation[];
  pos: PurchaseOrder[];
  grns: GoodsReceipt[];
  payments: Payment[];
  invoices: Invoice[];
};

const BUCKET_ORDER: Record<Bucket, number> = { answer: 0, sent: 1, closed: 2 };

export function vendorView(s: OpsState, id: string): VendorView | null {
  const vendor = s.vendors.find((v) => v.id === id);
  if (!vendor) return null;
  const quotes = s.quotes.filter((q) => q.vendorId === id && !q.duplicate).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const invites: InviteRow[] = s.rfqs
    .filter((r) => r.status !== "DRAFT")
    .flatMap((rfq) =>
      rfq.invitations
        .filter((i) => i.vendorId === id)
        .map((inv) => ({
          rfq,
          inv,
          bucket: inviteBucket(rfq, inv),
          daysLeft: diffDays(TODAY, rfq.dueDate),
          quote: quotes.find((q) => q.rfqId === rfq.id) ?? null,
          neededBy: rfq.mrId ? (s.mrs.find((m) => m.id === rfq.mrId)?.neededBy ?? null) : null,
        })),
    )
    .sort((a, b) => BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || (a.bucket === "closed" ? b.rfq.dueDate.localeCompare(a.rfq.dueDate) : a.rfq.dueDate.localeCompare(b.rfq.dueDate)));
  return {
    vendor,
    invites,
    quotes,
    pos: s.pos.filter((p) => p.vendorId === id && p.status !== "CANCELLED").sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id.localeCompare(a.id)),
    grns: s.grns.filter((g) => g.vendorId === id).sort((a, b) => (b.receivedAt ?? "9999").localeCompare(a.receivedAt ?? "9999") || b.id.localeCompare(a.id)),
    payments: s.payments.filter((p) => p.vendorId === id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    invoices: s.invoices.filter((i) => i.vendorId === id).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
  };
}

/** The vendor the portal shows: the demo switcher's pick, else V-02 (Qafqaz Armatur, the default demo vendor). */
export function portalVendorId(s: Pick<OpsState, "vendors" | "vendorAs">) {
  if (s.vendors.some((v) => v.id === s.vendorAs)) return s.vendorAs;
  return s.vendors.some((v) => v.id === "V-02") ? "V-02" : (s.vendors[0]?.id ?? "V-02");
}

/** The whole store plus the vendor the portal is showing. */
export function useVendor() {
  const s = useOps();
  const id = portalVendorId(s);
  const view = useMemo(() => vendorView(s, id), [s, id]);
  return { s, view };
}

// ---------------------------------------------------------------- quote journey

export type JourneyStep = { key: "sent" | "read" | "buyer" | "order"; label: string; state: "done" | "current" | "todo" | "rejected"; at: string | null; note: string | null };
export type Outcome = { key: "paid" | "ordered" | "won" | "lost" | "approval" | "reading" | "buyer"; label: string; tone: Tone };

export function quoteJourney(s: OpsState, q: Quotation) {
  const approval = s.approvals.find((a) => a.quoteId === q.id) ?? null;
  const po = s.pos.find((p) => p.quoteId === q.id && p.status !== "CANCELLED") ?? null;
  const pays = po ? s.payments.filter((p) => p.poId === po.id) : [];
  const paid = pays.length > 0 && pays.every((p) => p.status === "PAID");
  const read = q.status === "EXTRACTED" || q.status === "MANUAL";
  const lost = !po && (q.outcome === "LOST" || approval?.status === "REJECTED");
  const buyerDone = !!po || approval?.status === "APPROVED" || q.outcome === "WON";
  const steps: JourneyStep[] = [
    { key: "sent", label: "Sent", state: "done", at: q.receivedAt, note: null },
    { key: "read", label: "Read", state: read ? "done" : "current", at: read ? q.receivedAt : null, note: read ? "Lines checked" : "Being read" },
    {
      key: "buyer",
      label: "With the buyer",
      state: lost ? "rejected" : buyerDone ? "done" : read ? "current" : "todo",
      at: approval?.finalAt ?? approval?.requestedAt ?? null,
      note: lost ? "Not selected" : approval?.status === "PENDING" ? "Approval pending" : buyerDone ? "Approved" : read ? "Comparing quotes" : null,
    },
    { key: "order", label: "Order", state: po ? "done" : "todo", at: po?.issuedAt ?? null, note: po ? po.ref : null },
  ];
  const outcome: Outcome = paid
    ? { key: "paid", label: "Order paid", tone: "ok" }
    : po
      ? { key: "ordered", label: "Order issued", tone: "brand" }
      : q.outcome === "WON"
        ? { key: "won", label: "Won", tone: "ok" }
        : lost
          ? { key: "lost", label: "Not selected", tone: "muted" }
          : approval?.status === "PENDING"
            ? { key: "approval", label: "Approval pending", tone: "warn" }
            : !read
              ? { key: "reading", label: "Being read", tone: "info" }
              : { key: "buyer", label: "With the buyer", tone: "info" };
  return { steps, outcome, approval, po };
}

// ---------------------------------------------------------------- orders

export type OrderStage = "accept" | "dispatch" | "onway" | "gate" | "balance" | "invoice" | "waitpay" | "paid" | "cancelled";
export const STAGE_META: Record<OrderStage, { label: string; tone: Tone }> = {
  accept: { label: "Waiting for your acceptance", tone: "warn" },
  dispatch: { label: "To dispatch", tone: "brand" },
  onway: { label: "On the way", tone: "info" },
  gate: { label: "At the site gate", tone: "info" },
  balance: { label: "Balance to send", tone: "warn" },
  invoice: { label: "To invoice", tone: "brand" },
  waitpay: { label: "Invoiced", tone: "info" },
  paid: { label: "Paid", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export function orderState(s: OpsState, po: PurchaseOrder, invoices: Invoice[]) {
  const grns = s.grns.filter((g) => g.poId === po.id);
  const posted = grns.filter((g) => g.status !== "DRAFT" && g.receivedAt);
  const lastRec = posted.map((g) => g.receivedAt!).sort().pop() ?? null;
  const atGate = grns.some((g) => g.status === "DRAFT");
  const share = poReceivedShare(po);
  const open = po.status === "ISSUED" || po.status === "PART_RECEIVED";
  const onWay = open && !!po.dispatchedAt && (!lastRec || lastRec < po.dispatchedAt.slice(0, 10));
  const pays = s.payments.filter((p) => p.poId === po.id);
  const unpaid = pays.filter((p) => p.status !== "PAID");
  const invoice = invoices.find((i) => i.poId === po.id && live(i)) ?? null;
  let stage: OrderStage;
  if (po.status === "CANCELLED") stage = "cancelled";
  else if (po.vendorAck === "PENDING") stage = "accept";
  else if (atGate) stage = "gate";
  else if (onWay) stage = "onway";
  else if (open && share < 0.001) stage = "dispatch";
  else if (open) stage = "balance";
  else if (unpaid.length && !invoice) stage = "invoice";
  else if (unpaid.length) stage = "waitpay";
  else stage = "paid";
  return { stage, grns, posted, atGate, onWay, share, pays, unpaid, invoice, late: open && po.expectedAt < TODAY };
}

/** Can the vendor invoice this order now: goods received, something unpaid, no invoice sent yet. */
export function canInvoice(s: OpsState, po: PurchaseOrder, invoices: Invoice[]) {
  const unpaid = s.payments.filter((p) => p.poId === po.id && p.status !== "PAID");
  return (poReceivedShare(po) > 0 || po.status === "CLOSED") && unpaid.length > 0 && !invoices.some((i) => i.poId === po.id && live(i));
}

/** Money on an order from the vendor's side: paid, coming (invoiced or released) and not yet invoiced. */
export function orderMoney(s: OpsState, po: PurchaseOrder, invoices: Invoice[]) {
  const total = poTotal(po);
  const pays = s.payments.filter((p) => p.poId === po.id);
  const paid = pays.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0);
  const share = poReceivedShare(po);
  const invoiced = invoices.some((i) => i.poId === po.id && live(i)) || share > 0 || po.status === "CLOSED";
  const unpaid = pays.filter((p) => p.status !== "PAID");
  const coming = unpaid.filter((p) => invoiced || p.status === "READY" || p.status === "ON_HOLD" || p.kind === "ADVANCE").reduce((a, p) => a + p.amount, 0);
  return {
    total,
    paid,
    coming: Math.min(coming, Math.max(0, total - paid)),
    rest: Math.max(0, total - paid - coming),
    hold: unpaid.some((p) => p.status === "ON_HOLD"),
    delivered: total * share,
    share,
  };
}

export type PayState = "paid" | "hold" | "late" | "coming";
export const payState = (p: Payment): PayState => (p.status === "PAID" ? "paid" : p.status === "ON_HOLD" ? "hold" : p.dueDate < TODAY ? "late" : "coming");

// ---------------------------------------------------------------- documents on file

export type DocState = "valid" | "expiring" | "expired" | "missing";
export type VendorDoc = { key: string; label: Txt; ref: string | null; expires: string | null; state: DocState; sentAt: string | null; file: string | null; required: boolean; daysLeft: number | null };

const INSURANCE_DAYS: Record<string, number> = { "V-03": 12, "V-02": -6, "V-06": 26, "V-13": -48 };
const ISO_DAYS: Record<string, number> = { "V-02": 20, "V-08": -15 };

/** Compliance documents the buyer keeps on file for a vendor, with expiry flags; uploads renew them. */
export function vendorDocs(s: OpsState, v: Vendor): VendorDoc[] {
  const n = Number(v.id.slice(2)) || 1;
  const uploads = docUploadsOf(s.feed, v.id);
  const raw: Omit<VendorDoc, "state" | "sentAt" | "file" | "daysLeft">[] = [
    { key: "licence", label: { en: "Trade licence", az: "Ticarət lisenziyası" }, ref: v.licence, expires: v.licence ? addDays(TODAY, 140 + n * 17) : null, required: true },
    { key: "vat", label: { en: "VAT registration certificate", az: "ƏDV qeydiyyat şəhadətnaməsi" }, ref: v.trn, expires: null, required: true },
    { key: "insurance", label: { en: "Public liability insurance", az: "Mülki məsuliyyət sığortası" }, ref: `SG-2026-${1000 + n * 311}`, expires: addDays(TODAY, INSURANCE_DAYS[v.id] ?? 45 + ((n * 29) % 200)), required: true },
    { key: "iso", label: { en: "ISO 9001 quality certificate", az: "ISO 9001 keyfiyyət sertifikatı" }, ref: n % 5 === 4 ? null : `ISO-9001-${7000 + n * 41}`, expires: n % 5 === 4 ? null : addDays(TODAY, ISO_DAYS[v.id] ?? 210 + n * 11), required: false },
    { key: "hse", label: { en: "HSE policy", az: "ƏMSE siyasəti" }, ref: `HSE-${2025 + (n % 2)}-${String(n).padStart(2, "0")}`, expires: addDays(TODAY, 60 + ((n * 23) % 280)), required: true },
  ];
  return raw.map((d) => {
    const up = uploads.get(d.key);
    const expires = up?.expires ?? d.expires;
    const ref = up ? (d.ref ?? up.file) : d.ref;
    const left = expires ? diffDays(TODAY, expires) : null;
    const state: DocState = !ref ? "missing" : left != null && left < 0 ? "expired" : left != null && left <= 30 ? "expiring" : "valid";
    return { ...d, ref, expires, state, sentAt: up?.at ?? null, file: up?.file ?? null, daysLeft: left };
  });
}

export const DOC_META: Record<DocState, { label: string; tone: Tone }> = {
  valid: { label: "Valid", tone: "ok" },
  expiring: { label: "Expires soon", tone: "warn" },
  expired: { label: "Expired", tone: "bad" },
  missing: { label: "Missing", tone: "bad" },
};

/** Invoices where the buyer has a question for the vendor. */
export const queried = (i: Invoice) => i.status === "MISMATCH" || i.status === "CREDIT_REQUESTED";

// ---------------------------------------------------------------- counts for the shell and the switcher

export function vendorCounts(s: OpsState, view: VendorView) {
  const rfqs = view.invites.filter((i) => i.bucket === "answer").length;
  const stages = view.pos.map((p) => orderState(s, p, view.invoices).stage);
  const accept = stages.filter((x) => x === "accept").length;
  const dispatch = stages.filter((x) => x === "dispatch" || x === "balance").length;
  const invoice = view.pos.filter((p) => canInvoice(s, p, view.invoices)).length;
  const docs = vendorDocs(s, view.vendor).filter((d) => d.required && d.state !== "valid").length;
  const queries = view.invoices.filter(queried).length;
  return { rfqs, accept, dispatch, invoice, docs, queries, orders: accept + dispatch, total: rfqs + accept + dispatch + invoice + queries };
}


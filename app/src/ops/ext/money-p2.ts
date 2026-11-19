import { useOps } from "../store";
import { matchInvoice } from "../store-phase2";
import { diffDays, nowStamp, TODAY } from "../dates";
import { round } from "../seed/util";
import { to, type Tone } from "../select";
import type { HistoryEvent, Invoice, InvoiceLine, OpsData, PurchaseOrder, Txt } from "../types";

/**
 * Supplier-invoice helpers shared by the buyer's money pages and the vendor portal:
 * status words for both sides, totals, the three-way match summary and two small store edits
 * the shared store has no action for (accept the correct amount, reject a duplicate, replace a queried bill).
 */

// ---------------------------------------------------------------- routes

export const MONEY = {
  invoices: to("procurement/invoices"),
  invoice: (id: string) => to(`procurement/invoices/${id}`),
  inbox: to("procurement/invoices/inbox"),
  payRun: to("procurement/pay-run"),
};

// ---------------------------------------------------------------- status words

type Meta = { label: Txt; tone: Tone };
const m = (en: string, az: string, tone: Tone): Meta => ({ label: { en, az }, tone });

/** Buyer-side words for an invoice status (STATUS in ops/select has no invoice kind). */
export const INV_STATUS: Record<Invoice["status"], Meta> = {
  TO_MATCH: m("To match", "Uyğunlaşdırılmalı", "info"),
  MISMATCH: m("Mismatch", "Uyğunsuzluq", "bad"),
  CREDIT_REQUESTED: m("Credit requested", "Kredit notu istənilib", "warn"),
  SIGN_OFF: m("Sign-off", "İmzada", "warn"),
  BOOKED: m("Booked", "Uçota alınıb", "brand"),
  PAID: m("Paid", "Ödənilib", "ok"),
  REJECTED: m("Rejected", "Rədd edilib", "muted"),
};
export const INV_PATH = ["TO_MATCH", "SIGN_OFF", "BOOKED", "PAID"] as const;
export const INV_EXTRAS: Invoice["status"][] = ["MISMATCH", "CREDIT_REQUESTED", "REJECTED"];

/** Vendor-side words: what the supplier needs to know, not the buyer's internal steps. */
export const VENDOR_INV_STATUS: Record<Invoice["status"], Meta> = {
  TO_MATCH: m("Received", "Qəbul edilib", "info"),
  MISMATCH: m("Query raised", "Sual yaranıb", "bad"),
  CREDIT_REQUESTED: m("Query raised", "Sual yaranıb", "bad"),
  SIGN_OFF: m("Being checked", "Yoxlanılır", "warn"),
  BOOKED: m("Approved for payment", "Ödənişə təsdiqlənib", "brand"),
  PAID: m("Paid", "Ödənilib", "ok"),
  REJECTED: m("Rejected", "Rədd edilib", "muted"),
};

export const SOURCE_LABEL: Record<Invoice["source"], Txt> = {
  PORTAL: { en: "Vendor portal", az: "Təchizatçı portalı" },
  UPLOAD: { en: "Entered by hand", az: "Əl ilə daxil edilib" },
  EMAIL: { en: "E-mail", az: "E-poçt" },
};

// ---------------------------------------------------------------- money

export const invNet = (inv: Pick<Invoice, "lines">) => round(inv.lines.reduce((a, l) => a + l.qty * l.rate, 0), 2);
export const invTotal = (inv: Pick<Invoice, "lines" | "vatRate">) => round(invNet(inv) * (1 + inv.vatRate), 2);
export const isSettled = (inv: Invoice) => inv.status === "PAID" || inv.status === "REJECTED";

/** Invoices that still count as money the project owes. */
export const OWED: Invoice["status"][] = ["BOOKED", "SIGN_OFF", "MISMATCH"];

/** The PO and the line-by-line match for an invoice. */
export function matchOf(s: Pick<OpsData, "pos">, inv: Invoice) {
  const po = s.pos.find((p) => p.id === inv.poId);
  return { po, m: matchInvoice(inv, po) };
}

export type InvFlags = { dup: boolean; noGrn: boolean; overBilled: boolean; over: number; ok: boolean };

export function invFlags(s: Pick<OpsData, "pos" | "grns">, inv: Invoice): InvFlags {
  const { m: mt } = matchOf(s, inv);
  const noGrn = !s.grns.some((g) => g.poId === inv.poId && g.status !== "DRAFT");
  return { dup: inv.duplicate, noGrn, overBilled: mt.over > 0.005, over: mt.over, ok: mt.ok };
}

/** What the bill should be: received quantity at the order rate, plus VAT. */
export function fairAmount(inv: Invoice, po: PurchaseOrder | undefined) {
  if (!po) return invTotal(inv);
  const net = inv.lines.reduce((a, l) => {
    const pl = po.lines.find((x) => x.key === l.poLineKey);
    if (!pl) return a + l.qty * l.rate;
    return a + Math.min(l.qty, pl.received) * pl.rate;
  }, 0);
  return round(net * (1 + inv.vatRate), 2);
}

/** Days until due (negative = overdue). */
export const dueIn = (inv: Pick<Invoice, "dueDate">) => diffDays(TODAY, inv.dueDate);

/** Dates the invoice reached each step, read from its history. */
export function invDates(inv: Invoice, paidAt: string | null) {
  const find = (re: RegExp) => inv.history.find((h) => re.test(h.text.en))?.at ?? null;
  const matched = inv.history.find((h) => h.actor === "SYSTEM")?.at ?? null;
  return {
    received: inv.history[0]?.at ?? inv.date,
    matched,
    signOff: find(/sent for sign-off|match passed|Match run again: passed/i),
    booked: find(/booked/i),
    paid: find(/^paid/i) ?? paidAt,
  };
}

/** The buyer's open question to the vendor about this bill, in plain words. */
export function vendorQuery(s: Pick<OpsData, "pos">, inv: Invoice): Txt | null {
  if (inv.status !== "MISMATCH" && inv.status !== "CREDIT_REQUESTED") return null;
  const note = [...inv.history].reverse().find((h) => h.actor === "USER" && /credit note|not matching/i.test(h.text.en));
  if (inv.status === "CREDIT_REQUESTED" && note) return note.text;
  const { po, m: mt } = matchOf(s, inv);
  const bad = mt.lines.filter((l) => !l.ok);
  if (!bad.length) return note?.text ?? { en: "The buyer is checking a difference on this bill.", az: "Alıcı bu fakturada fərqi yoxlayır." };
  const parts = bad.map((l) => {
    const line = inv.lines.find((x) => x.key === l.key);
    const name = line?.description ?? { en: "a line", az: "bir sətir" };
    const unit = line?.unit ?? "";
    if (Math.abs(l.qtyDiff) > 1e-6)
      return {
        en: `${name.en}: billed ${fmt(l.billed)} ${unit}, received ${fmt(l.received)} ${unit}`,
        az: `${name.az}: ${fmt(l.billed)} ${unit} fakturalanıb, ${fmt(l.received)} ${unit} qəbul edilib`,
      };
    const p = l.poRate ? Math.round((l.rateDiff / l.poRate) * 1000) / 10 : 0;
    return { en: `${name.en}: rate ${p > 0 ? "+" : ""}${p}% against ${po?.ref ?? "the order"}`, az: `${name.az}: qiymət ${po?.ref ?? "sifariş"} ilə müqayisədə ${p > 0 ? "+" : ""}${p}%` };
  });
  return { en: parts.map((p) => p.en).join("; "), az: parts.map((p) => p.az).join("; ") };
}

const fmt = (v: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(v);

// ---------------------------------------------------------------- store edits

const ev = (actor: HistoryEvent["actor"], en: string, az: string): HistoryEvent => ({ at: nowStamp(), actor, text: { en, az } });

/** Accept the correct amount: billed quantity set to what was received, at the order rate; then match again. */
export function acceptCorrectAmount(id: string) {
  const s = useOps.getState();
  const inv = s.invoices.find((x) => x.id === id);
  const po = inv ? s.pos.find((p) => p.id === inv.poId) : undefined;
  if (!inv || !po) return;
  const lines: InvoiceLine[] = inv.lines.map((l) => {
    const pl = po.lines.find((x) => x.key === l.poLineKey);
    return pl ? { ...l, qty: pl.received, rate: pl.rate } : l;
  });
  const before = invTotal(inv);
  const after = invTotal({ lines, vatRate: inv.vatRate });
  s.patchItem("invoices", id, {
    lines,
    duplicate: false,
    history: [...inv.history, ev("USER", `Accepted the correct amount: ${fmt(after)} AZN instead of ${fmt(before)} AZN`, `Düzgün məbləğ qəbul edildi: ${fmt(before)} AZN əvəzinə ${fmt(after)} AZN`)],
  });
  useOps.getState().rematchInvoice(id);
}

/** Reject a duplicate without touching the payment of the original bill. */
export function rejectDuplicate(id: string, ofRef: string) {
  const s = useOps.getState();
  s.patchItem("invoices", id, { paymentId: null });
  useOps.getState().setInvoiceStatus(id, "REJECTED", `Duplicate of ${ofRef}`);
}

/** Vendor portal: send an invoice for an order (a real invoice, matched three ways at once). */
export function sendPortalInvoice(vendorId: string, poId: string, ref: string, lines: InvoiceLine[], replaces?: string | null) {
  const s = useOps.getState();
  if (replaces) {
    const old = s.invoices.find((x) => x.id === replaces);
    if (old) s.patchItem("invoices", replaces, { status: "REJECTED", paymentId: null, history: [...old.history, ev("VENDOR", `Replaced by the corrected invoice ${ref}`, `Düzəldilmiş ${ref} fakturası ilə əvəz edildi`)] });
  }
  return useOps.getState().submitInvoice({ vendorId, poId, ref, lines, source: "PORTAL" });
}

/** Lines for a new invoice from what was received on the order (ordered qty when nothing came yet). */
export function linesFromPo(po: PurchaseOrder, idPrefix: string, useReceived = true): InvoiceLine[] {
  return po.lines.map((l, i) => ({ key: `${idPrefix}-${i}`, description: l.description, unit: l.unit, qty: useReceived ? l.received : l.qty, rate: l.rate, poLineKey: l.key }));
}

// ---------------------------------------------------------------- export

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map((c) => (typeof c === "number" ? String(c) : `"${c.replace(/"/g, '""')}"`)).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

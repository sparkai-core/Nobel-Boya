import { useEffect, useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { useL } from "../../../components/kit";
import { data } from "../../../data";
import { diffDays, TODAY } from "../../../ops/dates";
import { quoteTotal, statusMeta, type Scored } from "../../../ops/select";
import type { Approval, Invitation, InvitationStatus, OpsData, Quotation, Rfq, Trade, Vendor } from "../../../ops/types";

/** Helpers shared by the sourcing pages (requests, RFQs, quotes, comparison). */

export type TFn = ReturnType<typeof useL>["t"];
export type XFn = ReturnType<typeof useL>["x"];

export const BUILDINGS = data.buildings.map((b) => b.id);

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Live (non-duplicate) quotes that answer an RFQ. */
export const liveQuotes = (quotes: Quotation[], rfqId: string) => quotes.filter((q) => q.rfqId === rfqId && !q.duplicate);

/** Approval already raised for any quote in the list (pending or approved first). */
export function approvalFor(approvals: Approval[], quoteIds: string[]): Approval | undefined {
  const hits = approvals.filter((a) => quoteIds.includes(a.quoteId));
  return hits.find((a) => a.status === "PENDING") ?? hits.find((a) => a.status === "APPROVED") ?? hits[0];
}

/** Vendors that sell a trade (primary or secondary). */
export const vendorsFor = (vendors: Vendor[], trade: Trade) => vendors.filter((v) => v.trade === trade || v.trades.includes(trade));

/** Average delivery days of the approved vendors of a trade. */
export function tradeLeadDays(vendors: Vendor[], trade: Trade) {
  const list = vendorsFor(vendors, trade).filter((v) => v.status === "APPROVED");
  if (!list.length) return null;
  return Math.round(list.reduce((a, v) => a + v.avgDeliveryDays, 0) / list.length);
}

/** "closes in 4 days" / "closed 2 days ago" with a tone. */
export function closing(t: TFn, due: string, open = true): { text: string; tone: "bad" | "warn" | "brand" | "muted" } {
  const n = diffDays(TODAY, due);
  if (!open) return { text: t("closed to new quotes"), tone: "muted" };
  if (n < 0) return { text: t("closed {n} days ago", { n: -n }), tone: "bad" };
  if (n === 0) return { text: t("closes today"), tone: "warn" };
  if (n === 1) return { text: t("closes tomorrow"), tone: "warn" };
  return { text: t("closes in {n} days", { n }), tone: n <= 3 ? "warn" : "brand" };
}

const ANSWER_ICON: Record<InvitationStatus, typeof Check> = { SUBMITTED: Check, ACKNOWLEDGED: Clock, INVITED: Clock, DECLINED: X };

/** Vendor chip with the vendor's answer drawn as an icon. */
export function AnswerChip({ vendor, inv, compact }: { vendor: Vendor | undefined; inv: Invitation; compact?: boolean }) {
  const { x } = useL();
  const Icon = ANSWER_ICON[inv.status];
  const meta = statusMeta("invite", inv.status);
  const name = vendor?.name ?? inv.vendorId;
  return (
    <span className={`ps-answer ps-answer-${inv.status.toLowerCase()}`} title={`${name} · ${x(meta.label)}${inv.reason ? ` · ${inv.reason}` : ""}`}>
      <i aria-hidden="true">
        <Icon size={10} strokeWidth={3} />
      </i>
      <span className="truncate">{compact ? name.split(" ")[0] : name}</span>
    </span>
  );
}

/** Types a text in, holding the full text's space so nothing below moves. */
export function useTyped(text: string, runKey: unknown, active = true, speed = 14) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) {
      setN(0);
      return;
    }
    if (reducedMotion()) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 2;
      setN(Math.min(i, text.length));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, runKey, active, speed]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

export function TypedText({ text, runKey, active = true, className }: { text: string; runKey: unknown; active?: boolean; className?: string }) {
  const { shown, done } = useTyped(text, runKey, active);
  return (
    <p className={`ps-typed${className ? ` ${className}` : ""}`} aria-label={text}>
      <span className="ps-typed-ghost" aria-hidden="true">
        {text}
      </span>
      <span className={`ps-typed-live${done ? "" : " k-typing"}`} aria-hidden="true">
        {active ? shown : ""}
      </span>
    </p>
  );
}

/** Steps through `count` items, one every `ms`, restarting when runKey changes. Returns how many are lit. */
export function useSequence(count: number, runKey: unknown, ms = 400, active = true) {
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (!active) {
      setLit(0);
      return;
    }
    if (reducedMotion()) {
      setLit(count);
      return;
    }
    setLit(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setLit(i);
      if (i >= count) window.clearInterval(id);
    }, ms);
    return () => window.clearInterval(id);
  }, [count, runKey, ms, active]);
  return lit;
}

const money = (v: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(v));
const pctOf = (a: number, b: number) => Math.round((Math.abs(a - b) / Math.max(1, b)) * 100);

/**
 * The "why this pick" story, written from the actual numbers of the ranked quotes:
 * price gap, delivery days, vendor score and risk. Returns the summary and the win / give-up chips.
 */
export function pickStory(rows: Scored[], t: TFn, x: XFn): { summary: string; wins: string[]; gives: string[] } {
  const top = rows[0];
  if (!top) return { summary: "", wins: [], gives: [] };
  const second = rows[1];
  const parts: string[] = [];
  parts.push(t("{vendor} comes out on top with {score} out of 100.", { vendor: top.vendor.name, score: top.score }));
  if (!second) {
    parts.push(t("It is the only priced quote, so there is nothing to weigh it against yet."));
    parts.push(t("Its total is {total} AZN with delivery in {days} days.", { total: money(top.total), days: top.quote.deliveryDays }));
    return { summary: parts.join(" "), wins: [], gives: [] };
  }
  const cheapest = rows.reduce((a, b) => (b.total < a.total ? b : a));
  if (cheapest === top) {
    parts.push(t("At {total} AZN it is {gap}% below {other}, {diff} AZN less.", { total: money(top.total), gap: pctOf(top.total, second.total), other: second.vendor.name, diff: money(second.total - top.total) }));
  } else {
    parts.push(t("It costs {gap}% more than the cheapest quote from {other}, {diff} AZN more.", { gap: pctOf(top.total, cheapest.total), other: cheapest.vendor.name, diff: money(top.total - cheapest.total) }));
  }
  const dd = second.quote.deliveryDays - top.quote.deliveryDays;
  if (dd > 0) parts.push(t("It delivers in {days} days, {n} days sooner than {other}.", { days: top.quote.deliveryDays, n: dd, other: second.vendor.name }));
  else if (dd < 0) parts.push(t("It needs {days} days to deliver, {n} days longer than {other}.", { days: top.quote.deliveryDays, n: -dd, other: second.vendor.name }));
  else parts.push(t("Delivery matches {other} at {days} days.", { days: top.quote.deliveryDays, other: second.vendor.name }));
  parts.push(t("Its vendor record scores {a} out of 10 against {b} for {other}.", { a: top.vendor.overall.toFixed(1), b: second.vendor.overall.toFixed(1), other: second.vendor.name }));
  const riskLabel = x(statusMeta("risk", top.quote.risk === "LOW" ? top.vendor.risk : top.quote.risk).label);
  parts.push(top.factors.risk >= 80 ? t("{risk} on both the vendor and the quote.", { risk: riskLabel }) : t("Watch the risk: {risk} on the vendor or the quote.", { risk: riskLabel.toLowerCase() }));
  if (top.score - second.score <= 3) parts.push(t("The race is close: {other} is only {n} points behind.", { other: second.vendor.name, n: top.score - second.score }));
  if (top.tags.includes("check")) parts.push(t("Clear the flagged checks before sending it for approval."));

  const wins: string[] = [];
  const gives: string[] = [];
  const add = (cond: number, win: string, give: string) => (cond > 0 ? wins.push(win) : cond < 0 ? gives.push(give) : null);
  add(second.total - top.total, t("{p}% cheaper", { p: pctOf(top.total, second.total) }), t("{p}% dearer", { p: pctOf(top.total, second.total) }));
  add(dd, t("{n} days faster", { n: Math.abs(dd) }), t("{n} days slower", { n: Math.abs(dd) }));
  add(top.vendor.overall - second.vendor.overall, t("Stronger vendor record"), t("Weaker vendor record"));
  add(top.factors.reliability - second.factors.reliability, t("More reliable"), t("Less reliable"));
  add(top.factors.risk - second.factors.risk, t("Lower risk"), t("Higher risk"));
  add(top.factors.completeness - second.factors.completeness, t("More complete reading"), t("Less complete reading"));
  return { summary: parts.join(" "), wins, gives };
}

/** "+12% over lowest" / "Lowest". */
export function gapWords(t: TFn, total: number, lowest: number) {
  if (total <= lowest + 0.005) return t("Lowest");
  return t("+{p}% over lowest", { p: Math.max(1, Math.round((total / Math.max(1, lowest) - 1) * 100)) });
}

/** Deterministic 0–1 hash used to vary the simulated vendor document. */
export function hash01(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return (h % 10_000) / 10_000;
}

export const totalOf = quoteTotal;

/** All RFQs in the order the buyer works them: open first, then closed, then awarded. */
export function rfqOrder(rfqs: Rfq[]) {
  const rank: Record<string, number> = { OPEN: 0, CLOSED: 1, DRAFT: 2, AWARDED: 3, CANCELLED: 4 };
  return [...rfqs].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.id.localeCompare(b.id));
}

export type Sourcing = Pick<OpsData, "rfqs" | "quotes" | "vendors" | "approvals">;

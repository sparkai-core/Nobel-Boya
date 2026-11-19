import { useOps } from "../store";
import { nowStamp } from "../dates";
import type { Quotation } from "../types";

/**
 * Store helpers for the sourcing pages (Procurement · Sourcing).
 *
 * editQuotePrices: the buyer changes unit prices on a quote that was typed in (nothing is read
 * from files any more). The lines are saved, the change goes on the quote's history, and a quote still
 * marked "to review" is marked as checked by hand.
 */
export function editQuotePrices(quoteId: string, lines: Quotation["lines"]) {
  const s = useOps.getState();
  const q = s.quotes.find((x) => x.id === quoteId);
  if (!q) return;
  s.patchItem("quotes", quoteId, {
    lines: lines.map((l) => ({ ...l, confidence: 1, match: "MATCHED" as const })),
    confidence: 1,
    status: q.status === "NEEDS_REVIEW" ? "MANUAL" : q.status,
    checks: q.checks.filter((c) => c.label.en !== "Reading confidence"),
    history: [...q.history, { at: nowStamp(), actor: "USER", text: { en: "Unit prices changed by hand", az: "Vahid qiymətlər əl ilə dəyişdirildi" } }],
  });
}

/** Kept for older callers: confirming a quote is now just saving its prices. */
export const confirmReading = (quoteId: string, lines?: Quotation["lines"]) => {
  const q = useOps.getState().quotes.find((x) => x.id === quoteId);
  if (q) editQuotePrices(quoteId, lines ?? q.lines);
};

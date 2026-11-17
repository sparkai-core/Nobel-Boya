import { useOps } from "../store";
import type { Quotation } from "../types";

/**
 * Store helpers for the sourcing pages (Procurement · Sourcing).
 *
 * confirmReading: the store's confirmQuote raises the reading confidence and resolves the
 * low-confidence exception, but leaves the quote's "Reading confidence" check as it was read.
 * This confirms the quote and then re-marks that check from the confirmed confidence, so the
 * "To check" count and the quote's rule score update with it.
 */
export function confirmReading(quoteId: string, lines?: Quotation["lines"]) {
  useOps.getState().confirmQuote(quoteId, lines);
  useOps.setState((s) => ({
    quotes: s.quotes.map((q) => {
      if (q.id !== quoteId) return q;
      const pct = Math.round(q.confidence * 100);
      return {
        ...q,
        checks: q.checks.map((c) =>
          c.label.en === "Reading confidence"
            ? { ...c, result: q.confidence < 0.75 ? "FAILED" : q.confidence < 0.88 ? "WARNING" : "PASSED", detail: { en: `${pct}% after the buyer checked the reading.`, az: `Alıcı oxunuşu yoxladıqdan sonra ${pct}%.` } }
            : c,
        ),
      };
    }),
  }));
}

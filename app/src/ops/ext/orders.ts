import { useOps } from "../store";
import type { ShortReason } from "../types";

/**
 * Store helpers owned by the Procurement · Orders pages. They compose the shared store actions
 * and patch only what those actions cannot express.
 */

/** Posts a goods receipt, then records the arrival date the storekeeper entered (the store stamps TODAY). */
export function postReceiptOn(
  grnId: string,
  input: { lines: { key: string; accepted: number; shortReason: ShortReason | null }[]; receivedBy: string; remarks: string; closeShort: boolean },
  arrivedOn: string,
) {
  useOps.getState().postReceipt(grnId, input);
  if (!arrivedOn) return;
  useOps.setState((s) => ({ grns: s.grns.map((g) => (g.id === grnId ? { ...g, receivedAt: arrivedOn } : g)) }));
}

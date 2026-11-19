import type { Txt } from "../types";

/** A bill of quantities line picked on the Bill page, handed to the new material request form. */
export type BillPick = { material: string | null; description: Txt; qty: number; unit: string; building: string; code: string };

const KEY = "nobel.mr.fromBill";

/** Keeps the picked bill lines for the request form (survives the route change, not a new tab). */
export function sendBillLines(lines: BillPick[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage blocked: the form opens empty */
  }
}

/** Reads the picked bill lines once; later reads get nothing. */
export function takeBillLines(): BillPick[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as BillPick[]).filter((l) => l && typeof l.qty === "number" && l.description) : [];
  } catch {
    return [];
  }
}

import type { OpsData } from "../types";
import { seedPm } from "./pm";
import { buildMaterials, seedProcurement } from "./procurement";
import { seedPhase2 } from "./phase2";

/** Builds the full demo dataset. Deterministic: every reset gives the same records. */
export function makeSeed(): OpsData {
  const pm = seedPm();
  const byCode = new Map(pm.activities.map((a) => [a.code, a]));
  const proc = seedProcurement(byCode, buildMaterials());
  const p2 = seedPhase2({ ...proc, ...pm });
  return {
    ...proc,
    ...pm,
    ...p2,
    seq: { MR: 12, RFQ: 8, QT: 15, APR: 6, PO: 8, GRN: 7, PAY: 9, EX: 5, IS: 20, DL: 6, RFI: 8, VO: 5, WIR: 5, MIR: 3, NCR: 2, IPC: 2, LI: 3, RS: 3, MV: 14, F: 10, V: 14, PRG: 3, REV: 3, PS: 4, INV: 6, RUN: 1, AGR: 4, INVT: 3, EXP: 2, INC: 3, PTW: 13, TBT: 4, PPE: 4, SUB: 8, CN: 10, PRJ: 4, WK: 24 },
  };
}

export { PEOPLE, SUBS, WBS } from "./pm";
export { VENDORS } from "./procurement";

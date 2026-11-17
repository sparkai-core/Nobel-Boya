import { useOps } from "../store";
import type { ProgressZone } from "../types";

/**
 * Store helpers for the PM control pages. They compose existing actions and patch state immutably.
 */

/** addCapture with the AI reading's own confidence and source (the store action fixes 0.88 / PHONE). */
export function addCaptureWith(zoneId: string, pct: number, note: string, photo: string, confidence: number, source: ProgressZone["captures"][number]["source"]) {
  useOps.getState().addCapture(zoneId, pct, note, photo);
  useOps.setState((s) => ({
    zones: s.zones.map((z) => (z.id !== zoneId ? z : { ...z, captures: z.captures.map((c, i) => (i === z.captures.length - 1 ? { ...c, confidence, source } : c)) })),
  }));
}

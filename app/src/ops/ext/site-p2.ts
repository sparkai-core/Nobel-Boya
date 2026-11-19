import { useOps } from "../store";
import type { AttendanceStatus, Equipment, Subcontractor, Worker } from "../types";

/**
 * Store helpers for the site pages (equipment, workforce, safety).
 */

export const SHIFT_HOURS: Record<AttendanceStatus, number> = { PRESENT: 9, HALF: 4.5, ABSENT: 0, LEAVE: 0, INJURY: 0 };

/**
 * Set (or clear, with null) one worker's attendance on one day without a feed event.
 * Used by the attendance grid where a click cycles a single cell; rollCall() would post a feed line per click.
 */
export function setAttendance(date: string, workerId: string, status: AttendanceStatus | null) {
  useOps.setState((s) => {
    const rest = s.attendance.filter((a) => !(a.date === date && a.workerId === workerId));
    if (!status) return { attendance: rest };
    const w = s.workers.find((x) => x.id === workerId);
    return { attendance: [...rest, { date, workerId, status, hours: SHIFT_HOURS[status], activityId: w?.activityId ?? null }] };
  });
}

/**
 * A worker as the site pages save it. `phone` is optional and kept on the record alongside the shared
 * Worker fields (the shared type has no phone yet).
 */
export type SiteWorker = Worker & { phone?: string };
export const workerPhone = (w: Worker) => (w as SiteWorker).phone ?? "";

/**
 * A machine as the site pages save it. `supplier` is the hire firm typed as free text when it is not one
 * of the vendors in procurement (the shared type only links a vendor id).
 */
export type SiteEquipment = Equipment & { supplier?: string };
export const equipmentSupplier = (e: Equipment) => (e as SiteEquipment).supplier ?? "";

/**
 * Who employs a worker: a subcontractor (by id), a company typed as free text, or, when empty, the
 * user's own company.
 */
export function employerName(employer: string, subs: Subcontractor[], company: string, ownLabel: string) {
  if (!employer) return company || ownLabel;
  return subs.find((s) => s.id === employer)?.name ?? employer;
}

/** Removes a worker together with their attendance rows. */
export function removeWorker(id: string) {
  useOps.setState((s) => ({ workers: s.workers.filter((w) => w.id !== id), attendance: s.attendance.filter((a) => a.workerId !== id) }));
}

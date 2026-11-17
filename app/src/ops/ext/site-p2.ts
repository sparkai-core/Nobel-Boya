import { useOps } from "../store";
import type { AttendanceStatus } from "../types";

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

import { useL } from "../../../components/kit";
import { data } from "../../../data";
import { addDays, diffDays, maxDate, minDate, TODAY } from "../../../ops/dates";
import { to, type CurvePoint, type Tone } from "../../../ops/select";
import { useOps } from "../../../ops/store";
import type { Activity, MaterialRequest, OpsData, ProgressSnapshot, Submittal, SubmittalStatus, Txt } from "../../../ops/types";

/** Routes of the pages in this folder (and the site pages they link to). */
export const RP = {
  tracking: to("pm/progress-tracking"),
  lookahead: to("pm/lookahead"),
  submittals: to("pm/submittals"),
  submittal: (id: string) => to(`pm/submittals/${id}`),
  safety: to("pm/safety"),
  equipment: to("pm/equipment"),
  material: (key: string) => to(`procurement/catalogue/${key}`),
};

/** Buildings of the project (from the BOQ) that carry at least one of the activities, in BOQ order, then any others. */
export function buildingsOf(activities: Activity[]) {
  const used = new Set(activities.map((a) => a.building).filter(Boolean));
  const known = data.buildings.map((b) => b.id).filter((id) => used.has(id));
  return [...known, ...[...used].filter((b) => !known.includes(b)).sort()];
}

// ---------------------------------------------------------------- maths

/** Planned share (0–1) of an activity at a date, on its baseline dates. */
export function plannedAt(a: Pick<Activity, "bStart" | "bEnd">, date = TODAY) {
  if (date <= a.bStart) return 0;
  if (date >= a.bEnd) return 1;
  return diffDays(a.bStart, date) / Math.max(1, diffDays(a.bStart, a.bEnd));
}

/** Weight of an activity in a progress roll-up: its budget, or an equal share when the set carries no budget. */
export function weightOf(acts: Activity[]) {
  const total = acts.reduce((x, a) => x + Math.max(0, a.budget), 0);
  return (a: Activity) => (total > 0 ? Math.max(0, a.budget) : 1);
}

/** Planned and actual share (0–1) of a set of activities at a date; SPI is null while nothing is planned yet. */
export function progressOf(acts: Activity[], date = TODAY) {
  const w = weightOf(acts);
  const sum = acts.reduce((x, a) => x + w(a), 0);
  if (!sum) return { planned: 0, actual: 0, spi: null as number | null };
  const planned = acts.reduce((x, a) => x + w(a) * plannedAt(a, date), 0) / sum;
  const actual = acts.reduce((x, a) => x + (w(a) * a.pct) / 100, 0) / sum;
  return { planned, actual, spi: planned > 0 ? actual / planned : null };
}

/** % complete of an activity on a past date, read from the submitted weekly updates. */
function recordedPct(a: Activity, date: string, snaps: ProgressSnapshot[]) {
  let before: number | null = null;
  let after: number | null = null;
  for (const sn of snaps) {
    const l = sn.lines.find((x) => x.activityId === a.id);
    if (!l) continue;
    if (sn.dataDate <= date) before = l.pct;
    else if (after == null) after = l.pctBefore;
  }
  if (before != null) return before;
  if (after != null) return after;
  return a.aStart && a.aStart <= date ? a.pct : 0;
}

/**
 * Planned / actual / forecast curve of a set of activities. Planned follows the baseline dates; actual is
 * only drawn where it was recorded (each weekly update, and today); forecast follows the current dates.
 */
export function curveOf(acts: Activity[], snapshots: ProgressSnapshot[], step = 7): CurvePoint[] {
  if (!acts.length) return [];
  const w = weightOf(acts);
  const sum = acts.reduce((x, a) => x + w(a), 0) || 1;
  const snaps = [...snapshots].sort((a, b) => a.dataDate.localeCompare(b.dataDate) || a.submittedAt.localeCompare(b.submittedAt));
  const ids = new Set(acts.map((a) => a.id));
  const recorded = new Set(snaps.filter((sn) => sn.dataDate < TODAY && sn.lines.some((l) => ids.has(l.activityId))).map((sn) => sn.dataDate));
  const start = minDate(TODAY, ...acts.map((a) => a.bStart), ...acts.map((a) => a.start));
  const end = maxDate(TODAY, ...acts.map((a) => a.bEnd), ...acts.map((a) => a.end));
  const now = acts.reduce((x, a) => x + (w(a) * a.pct) / 100, 0) / sum;
  const current = (a: Activity, d: string) => (a.status === "COMPLETED" ? 1 : plannedAt({ bStart: a.start, bEnd: a.end }, d));
  const dates = new Set<string>([TODAY, end, ...recorded]);
  for (let d = start; d < end; d = addDays(d, step)) dates.add(d);
  return [...dates]
    .sort()
    .map((d) => ({
      date: d,
      planned: acts.reduce((x, a) => x + w(a) * plannedAt(a, d), 0) / sum,
      actual: d === TODAY ? now : recorded.has(d) ? acts.reduce((x, a) => x + (w(a) * recordedPct(a, d, snaps)) / 100, 0) / sum : null,
      forecast: d >= TODAY ? Math.max(now, acts.reduce((x, a) => x + w(a) * current(a, d), 0) / sum) : null,
    }));
}

/**
 * Actual cost (AC): payments made on orders raised from material requests. `pick` narrows to the
 * requests of a building or a set of activities; without it every paid amount counts.
 */
export function paidCost(s: Pick<OpsData, "payments" | "pos" | "mrs">, pick?: (mr: MaterialRequest) => boolean) {
  const mrOf = new Map(s.mrs.map((m) => [m.id, m]));
  const poOf = new Map(s.pos.map((p) => [p.id, p]));
  return s.payments
    .filter((p) => p.status === "PAID")
    .filter((p) => {
      if (!pick) return true;
      const po = poOf.get(p.poId);
      const mr = po?.mrId ? mrOf.get(po.mrId) : undefined;
      return mr ? pick(mr) : false;
    })
    .reduce((x, p) => x + p.amount, 0);
}

/** Weekly window: Monday to Sunday of the week `offset` weeks from today. */
export function weekOf(offset: number) {
  const dow = new Date(`${TODAY}T00:00:00Z`).getUTCDay();
  const monday = addDays(TODAY, -((dow + 6) % 7));
  const from = addDays(monday, offset * 7);
  return { from, to: addDays(from, 6) };
}

/**
 * A reference that is not used yet: asks the store counter for the next number and skips any id
 * already present (seeded records may share the counter).
 */
export function freshRef(kind: string, taken: (id: string) => boolean, width?: number) {
  const next = useOps.getState().nextRef;
  let id = next(kind, width);
  for (let i = 0; i < 50 && taken(id); i++) id = next(kind, width);
  return id;
}

// ---------------------------------------------------------------- submittals

export const SUB_META: Record<SubmittalStatus, { label: string; az: string; tone: Tone }> = {
  DRAFT: { label: "Draft", az: "qaralama", tone: "muted" },
  SUBMITTED: { label: "Submitted", az: "göndərilib", tone: "info" },
  UNDER_REVIEW: { label: "Under review", az: "baxılır", tone: "warn" },
  APPROVED: { label: "Approved", az: "təsdiqlənib", tone: "ok" },
  APPROVED_AS_NOTED: { label: "Approved as noted", az: "qeydlərlə təsdiqlənib", tone: "ok" },
  REVISE: { label: "Revise and resubmit", az: "düzəliş üçün qaytarılıb", tone: "bad" },
  REJECTED: { label: "Rejected", az: "rədd edilib", tone: "bad" },
};
export const SUB_PATH: SubmittalStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"];
export const SUB_EXTRAS: SubmittalStatus[] = ["APPROVED_AS_NOTED", "REVISE", "REJECTED"];

export const subApproved = (s: Pick<Submittal, "status">) => s.status === "APPROVED" || s.status === "APPROVED_AS_NOTED";

/** Dates of a submittal: required on site follows the live activity start; final due = required − lead time. */
export function subDates(s: Submittal, activities: Activity[]) {
  const act = s.activityId ? activities.find((a) => a.id === s.activityId) : undefined;
  const required = act ? act.start : s.requiredOnSite;
  const finalDue = addDays(required, -s.leadDays);
  const late = !subApproved(s) && finalDue < TODAY;
  const daysToDue = diffDays(TODAY, finalDue);
  return { act, required, finalDue, late, daysToDue };
}

export function SubBadge({ status }: { status: SubmittalStatus }) {
  const { t } = useL();
  const m = SUB_META[status];
  return (
    <span className={`k-badge k-tone-${m.tone}`}>
      <i aria-hidden="true" />
      {t(m.label)}
    </span>
  );
}

/** Stage arrows for submittals (own labels; the shared status map has no submittal kind). */
export function SubStagePath({ counts, value, onChange }: { counts: Record<string, number>; value: string | null; onChange: (v: string | null) => void }) {
  const { t } = useL();
  return (
    <div className="k-stagepath" role="group" aria-label={t("Filter by stage")}>
      <div className="k-stagepath-arrows">
        {SUB_PATH.map((st, i) => {
          const m = SUB_META[st];
          const on = value === st;
          return (
            <button key={st} type="button" className={`k-stage k-tone-${m.tone}${on ? " on" : ""}${value && !on ? " dim" : ""}`} style={{ zIndex: SUB_PATH.length - i }} aria-pressed={on} onClick={() => onChange(on ? null : st)}>
              <span>{t(m.label)}</span>
              <b className="num-inline">{counts[st] ?? 0}</b>
            </button>
          );
        })}
      </div>
      {SUB_EXTRAS.filter((e) => counts[e]).map((e) => {
        const on = value === e;
        return (
          <button key={e} type="button" className={`k-stage-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? null : e)}>
            {t(SUB_META[e].label)} <b className="num-inline">{counts[e]}</b>
          </button>
        );
      })}
    </div>
  );
}

/** MR most likely raised for a submittal: same activity, preferring a line with the same material. */
export function mrForSubmittal(s: Submittal, mrs: OpsData["mrs"]) {
  if (!s.activityId) return undefined;
  const cands = mrs.filter((m) => m.activityId === s.activityId && m.status !== "CANCELLED").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return cands.find((m) => s.material && m.lines.some((l) => l.material === s.material)) ?? cands[0];
}

export const tt = (en: string, az: string): Txt => ({ en, az });

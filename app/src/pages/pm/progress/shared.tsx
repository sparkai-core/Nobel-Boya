import { useL } from "../../../components/kit";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { to, type Tone } from "../../../ops/select";
import { useOps } from "../../../ops/store";
import type { Activity, OpsData, Submittal, SubmittalStatus, Txt } from "../../../ops/types";

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

export const BUILDINGS = ["WH", "AD", "PS", "TK", "SITE"] as const;

// ---------------------------------------------------------------- maths

/** Planned share (0–1) of an activity at a date, on its baseline dates. */
export function plannedAt(a: Pick<Activity, "bStart" | "bEnd">, date = TODAY) {
  if (date <= a.bStart) return 0;
  if (date >= a.bEnd) return 1;
  return diffDays(a.bStart, date) / Math.max(1, diffDays(a.bStart, a.bEnd));
}

/** Deterministic small number from a string. */
export const hashOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Cost performance assumed for a subset: around 0.98 with a small fixed variation per key. */
export const cpiOf = (key: string) => Math.round((0.98 + ((hashOf(key) % 9) - 4) * 0.011) * 100) / 100;

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

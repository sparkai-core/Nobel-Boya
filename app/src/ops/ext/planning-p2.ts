import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useApp } from "../../lib/store";
import { useOps } from "../store";
import { PEOPLE } from "../people";

/**
 * Planning page helpers (Phase 2).
 * - setCurrentProgramme: flips the `current` flag so exactly one programme is followed.
 * - usePlanExtras: P6-style activity constraints, kept in their own small persisted store because the
 *   shared Activity type has no constraint field. Keys are "<project id>:<activity id>", so two
 *   projects never share a constraint.
 */

export function setCurrentProgramme(id: string) {
  const s = useOps.getState();
  const p = s.programmes.find((x) => x.id === id);
  if (!p || p.current) return;
  useOps.setState({ programmes: s.programmes.map((x) => ({ ...x, current: x.id === id })) });
  s.pushFeed("PM", { en: `Project now follows "${p.name}"`, az: `Layihə indi "${p.name}" qrafikinə əsaslanır` }, "pm/planning/programmes", PEOPLE.planner);
}

export type ConstraintKind = "NONE" | "SNET" | "FNLT" | "MFO" | "ALAP";
export type ActivityConstraint = { kind: ConstraintKind; date: string | null };

/** Store key of an activity's constraint in the open project. */
export const constraintKey = (activityId: string) => `${useApp.getState().activeProjectId || "default"}:${activityId}`;

type Extras = {
  constraints: Record<string, ActivityConstraint>;
  setConstraint: (activityId: string, c: ActivityConstraint) => void;
};

export const usePlanExtras = create<Extras>()(
  persist(
    (set) => ({
      constraints: {},
      setConstraint: (activityId, c) => set((s) => ({ constraints: { ...s.constraints, [constraintKey(activityId)]: c } })),
    }),
    // v1 held sample-demo constraints and is cleared by the ops store on load.
    { name: "nobel.ops.planning.v2" },
  ),
);

/** Removes the constraints of deleted activities of the open project. */
export function dropConstraints(activityIds: Iterable<string>) {
  const keys = new Set([...activityIds].map(constraintKey));
  if (!keys.size) return;
  const cur = usePlanExtras.getState().constraints;
  if (![...keys].some((k) => k in cur)) return;
  usePlanExtras.setState({ constraints: Object.fromEntries(Object.entries(cur).filter(([k]) => !keys.has(k))) });
}

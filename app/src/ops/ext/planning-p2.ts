import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useOps } from "../store";
import { PEOPLE } from "../seed";

/**
 * Planning page helpers (Phase 2).
 * - setCurrentProgramme: flips the `current` flag so exactly one programme is followed.
 * - usePlanExtras: P6-style activity constraints, kept in their own small persisted store because the
 *   shared Activity type has no constraint field.
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

type Extras = {
  constraints: Record<string, ActivityConstraint>;
  setConstraint: (activityId: string, c: ActivityConstraint) => void;
};

export const usePlanExtras = create<Extras>()(
  persist(
    (set) => ({
      constraints: {},
      setConstraint: (activityId, c) => set((s) => ({ constraints: { ...s.constraints, [activityId]: c } })),
    }),
    { name: "nobel.ops.planning.v1" },
  ),
);

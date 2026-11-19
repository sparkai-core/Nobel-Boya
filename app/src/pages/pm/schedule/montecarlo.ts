import { diffDays, TODAY } from "../../../ops/dates";
import type { Activity, Dependency } from "../../../ops/types";

/**
 * Monte-Carlo finish simulation for the remaining work. Each run samples a duration for every
 * unfinished activity from a triangular distribution (optimistic −10 %, most likely = planned,
 * pessimistic +25 % to +40 % by trade) and forward-passes the logic. Day numbers are relative to today.
 */

export type McResult = {
  runs: number;
  /** False when there is no unfinished work to simulate: every figure below is then empty. */
  hasWork: boolean;
  /** Finish day (from today) of every run, sorted. */
  finishes: number[];
  /** Finish with every duration at its most likely value. */
  likely: number;
  /** How many runs each activity sat on the driving chain to the finish. */
  critical: Map<string, number>;
  pct: (p: number) => number;
};

/** Small deterministic RNG so a result stays put until the user runs again. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function triangular(u: number, a: number, m: number, b: number) {
  if (b <= a) return m;
  const c = (m - a) / (b - a);
  return u < c ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m));
}

/** Pessimistic stretch by trade: steel and roofing are exposed to wind and supply, groundwork to rain. */
export function pessimism(a: Activity) {
  if (a.section === "steel" || a.section === "roof") return 0.4;
  if (a.section === "ext" || a.section === "sub" || a.section === "masonry" || a.section === "frame" || a.section === "rebar") return 0.3;
  if (a.status === "BLOCKED") return 0.4;
  return 0.25;
}
export const OPTIMISM = 0.1;

export function simulate(activities: Activity[], links: Dependency[], runs: number, seed: number): McResult {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const preds = new Map<string, Dependency[]>();
  for (const l of links) if (byId.has(l.from) && byId.has(l.to)) preds.set(l.to, [...(preds.get(l.to) ?? []), l]);

  // Topological order (Kahn); activities caught in an accidental loop follow in list order.
  const succ = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const [to, ls] of preds) for (const l of ls) {
    succ.set(l.from, [...(succ.get(l.from) ?? []), to]);
    indeg.set(to, (indeg.get(to) ?? 0) + 1);
  }
  const order: Activity[] = activities.filter((a) => !indeg.get(a.id));
  const placed = new Set(order.map((a) => a.id));
  for (let i = 0; i < order.length; i++) {
    for (const to of succ.get(order[i]!.id) ?? []) {
      const n = (indeg.get(to) ?? 0) - 1;
      indeg.set(to, n);
      if (n === 0 && !placed.has(to)) {
        placed.add(to);
        order.push(byId.get(to)!);
      }
    }
  }
  if (order.length < activities.length) for (const a of activities) if (!placed.has(a.id)) order.push(a);

  const rel = (d: string) => diffDays(TODAY, d);
  const prep = order.map((a) => {
    const dur = Math.max(1, diffDays(a.start, a.end));
    const done = a.status === "COMPLETED";
    const running = !done && (a.status === "IN_PROGRESS" || a.status === "BLOCKED" || !!a.aStart);
    const ml = done ? 0 : running ? Math.max(1, Math.round(dur * (1 - a.pct / 100))) : dur;
    return {
      a,
      done,
      running,
      ml,
      lo: ml * (1 - OPTIMISM),
      hi: ml * (1 + pessimism(a)),
      fixedS: rel(a.aStart ?? a.start),
      fixedF: rel(a.aEnd ?? a.end),
      // Open starts keep their planned start; linked work starts as soon as the logic allows.
      floor: (preds.get(a.id) ?? []).length ? 0 : Math.max(0, rel(a.start)),
      preds: preds.get(a.id) ?? [],
    };
  });

  const S = new Map<string, number>();
  const F = new Map<string, number>();
  const drv = new Map<string, string | null>();

  const pass = (sample: (i: number) => number) => {
    let finish = -Infinity;
    let last = "";
    prep.forEach((p, i) => {
      if (p.done) {
        S.set(p.a.id, p.fixedS);
        F.set(p.a.id, p.fixedF);
        drv.set(p.a.id, null);
      } else if (p.running) {
        S.set(p.a.id, p.fixedS);
        F.set(p.a.id, sample(i));
        drv.set(p.a.id, null);
      } else {
        const dur = sample(i);
        let es = p.floor;
        let by: string | null = null;
        for (const l of p.preds) {
          const ps = S.get(l.from) ?? 0;
          const pf = F.get(l.from) ?? 0;
          const c = l.type === "FS" ? pf + l.lag : l.type === "SS" ? ps + l.lag : l.type === "FF" ? pf + l.lag - dur : ps + l.lag - dur;
          if (c > es) {
            es = c;
            by = l.from;
          }
        }
        S.set(p.a.id, es);
        F.set(p.a.id, es + dur);
        drv.set(p.a.id, by);
      }
      const f = F.get(p.a.id)!;
      if (f > finish) {
        finish = f;
        last = p.a.id;
      }
    });
    return { finish: Number.isFinite(finish) ? Math.round(finish) : 0, last };
  };
  const hasWork = prep.some((p) => !p.done);
  if (!hasWork) return { runs: 0, hasWork, finishes: [], likely: 0, critical: new Map(), pct: () => 0 };

  const likely = pass((i) => prep[i]!.ml).finish;
  const rnd = mulberry32(seed * 7919 + 17);
  const finishes: number[] = [];
  const critical = new Map<string, number>();
  for (let r = 0; r < runs; r++) {
    const { finish, last } = pass((i) => {
      const p = prep[i]!;
      return Math.round(triangular(rnd(), p.lo, p.ml, p.hi));
    });
    finishes.push(finish);
    for (let cur: string | null = last; cur; cur = drv.get(cur) ?? null) critical.set(cur, (critical.get(cur) ?? 0) + 1);
  }
  finishes.sort((a, b) => a - b);
  const pct = (p: number) => finishes[Math.min(finishes.length - 1, Math.max(0, Math.round(p * (finishes.length - 1))))] ?? likely;
  return { runs, hasWork, finishes, likely, critical, pct };
}

import { memo, useMemo, type ReactNode } from "react";
import { addDays } from "../../../ops/dates";
import type { Activity } from "../../../ops/types";
import { plannedPctAt, shownPctAt } from "./shared";

/**
 * Stylised isometric model of the Qobu site, drawn in SVG and driven by the programme:
 * every block belongs to an activity and takes a state from its progress on the scrubbed date.
 */

export type BlockState = "built" | "asplan" | "ahead" | "behind" | "due" | "ghost";
export const STATE_ORDER: BlockState[] = ["built", "asplan", "ahead", "behind", "due", "ghost"];
export const STATE_LABEL: Record<BlockState, string> = {
  built: "Built",
  asplan: "Built as planned",
  ahead: "Ahead",
  behind: "Planned by now but not built",
  due: "Due in the next 2 weeks",
  ghost: "Not started",
};

type V3 = [number, number, number];
type Box = { t: "box"; x: number; y: number; z: number; w: number; d: number; h: number; grow?: boolean };
type Roof = { t: "roof"; x: number; y: number; w: number; d: number; z: number; rise: number };
type Truss = { t: "truss"; x: number; y: number; d: number; z: number; rise: number };
type Cyl = { t: "cyl"; cx: number; cy: number; r: number; z: number; h: number; grow?: boolean };
type Fence = { t: "fence"; pts: [number, number][] };
type El = { key: string; code: string; f: number; g: Box | Roof | Truss | Cyl | Fence; z: number; depth: number };

const K = 8;
const C = 0.866 * K;
const S = 0.5 * K;
const P = (x: number, y: number, z: number) => [(x - y) * C, (x + y) * S - z * K] as const;
const pts = (vs: V3[]) => vs.map(([x, y, z]) => P(x, y, z).map((n) => n.toFixed(1)).join(",")).join(" ");

/** Builds the element list once: warehouse hall, admin building, pump station, tanks and site works. */
function buildElements(): El[] {
  const out: El[] = [];
  const add = (code: string, i: number, n: number, g: El["g"], key?: string) => {
    let z = 0;
    let depth = 0;
    if (g.t === "box") {
      z = g.z + (g.h < 0.5 ? -0.01 : 0);
      depth = g.x + g.w / 2 + g.y + g.d / 2;
    } else if (g.t === "roof") {
      z = g.z + 0.5;
      depth = g.x + g.w / 2 + g.y + g.d / 2;
    } else if (g.t === "truss") {
      z = g.z + 0.2;
      depth = g.x + g.y + g.d / 2;
    } else if (g.t === "cyl") {
      z = g.z + (g.h < 0.5 ? -0.01 : 0);
      depth = g.cx + g.cy;
    } else {
      z = -2;
      depth = 0;
    }
    out.push({ key: key ?? `${code}-${i}`, code, f: ((i + 0.5) / n) * 100, g, z, depth });
  };

  // Site set-up
  add("G-020", 0, 1, { t: "fence", pts: [[-5, -5], [86, -5], [86, 37], [-5, 37], [-5, -5]] });
  add("G-010", 0, 2, { t: "box", x: -2, y: 30, z: 0, w: 6, d: 2.6, h: 2.6 });
  add("G-010", 1, 2, { t: "box", x: 5, y: 30, z: 0, w: 6, d: 2.6, h: 2.6 });

  // ---------------- warehouse 48 × 24, column lines every 6 m along x, two lines along y
  const xs = Array.from({ length: 9 }, (_, i) => i * 6);
  const ys = [0, 24];
  add("WH-110", 0, 1, { t: "box", x: -2, y: -2, z: -0.25, w: 52, d: 28, h: 0.25 });
  let n = 0;
  for (const x of xs) for (const y of ys) add("WH-120", n++, 18, { t: "box", x: x - 1, y: y - 1, z: 0, w: 2, d: 2, h: 0.9 });
  n = 0;
  for (const y of ys) for (let i = 0; i < 8; i++) add("WH-130", n++, 16, { t: "box", x: xs[i]! + 1, y: y - 0.3, z: 0.3, w: 4, d: 0.6, h: 0.6 });
  for (let i = 0; i < 8; i++) add("WH-190", i, 8, { t: "box", x: xs[i]!, y: 0, z: 0.9, w: 6, d: 24, h: 0.2 });
  // back walls (inside faces visible)
  for (let i = 0; i < 8; i++) add("WH-180", i, 12, { t: "box", x: xs[i]! + 0.3, y: -0.3, z: 0.9, w: 5.4, d: 0.3, h: 7 });
  for (let i = 0; i < 4; i++) add("WH-180", 8 + i, 12, { t: "box", x: -0.3, y: i * 6 + 0.3, z: 0.9, w: 0.3, d: 5.4, h: 7 });
  n = 0;
  for (const x of xs) for (const y of ys) add("WH-140", n++, 18, { t: "box", x: x - 0.3, y: y - 0.3, z: 0.9, w: 0.6, d: 0.6, h: 7 });
  xs.forEach((x, i) => add("WH-160", i, 9, { t: "truss", x, y: 0, d: 24, z: 7.9, rise: 2.2 }));
  for (let i = 0; i < 8; i++) add("WH-170", i, 8, { t: "roof", x: xs[i]!, y: 0, w: 6, d: 24, z: 7.9, rise: 2.2 });

  // ---------------- admin building 18 × 12, two storeys
  const ax = [56, 62, 68, 74];
  const ay = [0, 6, 12];
  add("AD-110", 0, 1, { t: "box", x: 54, y: -2, z: -0.25, w: 22, d: 16, h: 0.25 });
  const strips: Box[] = [
    { t: "box", x: 55.6, y: -0.4, z: 0, w: 18.8, d: 0.8, h: 0.9 },
    { t: "box", x: 55.6, y: -0.4, z: 0, w: 0.8, d: 12.8, h: 0.9 },
    { t: "box", x: 55.6, y: 5.6, z: 0, w: 18.8, d: 0.8, h: 0.9 },
    { t: "box", x: 73.6, y: -0.4, z: 0, w: 0.8, d: 12.8, h: 0.9 },
    { t: "box", x: 55.6, y: 11.6, z: 0, w: 18.8, d: 0.8, h: 0.9 },
  ];
  strips.forEach((g, i) => add("AD-120", i, strips.length, g));
  n = 0;
  for (const x of ax) for (const y of ay) add("AD-130", n++, 12, { t: "box", x: x - 0.25, y: y - 0.25, z: 0.9, w: 0.5, d: 0.5, h: 3.3 });
  for (let i = 0; i < 3; i++) add("AD-170", i, 10, { t: "box", x: ax[i]! + 0.25, y: -0.2, z: 0.9, w: 5.5, d: 0.2, h: 3.3 });
  for (let i = 0; i < 2; i++) add("AD-170", 3 + i, 10, { t: "box", x: 55.8, y: ay[i]! + 0.25, z: 0.9, w: 0.2, d: 5.5, h: 3.3 });
  for (let i = 0; i < 3; i++) add("AD-140", i, 3, { t: "box", x: ax[i]!, y: 0, z: 4.2, w: 6, d: 12, h: 0.3 });
  n = 0;
  for (const x of ax) for (const y of ay) add("AD-150", n++, 15, { t: "box", x: x - 0.25, y: y - 0.25, z: 4.5, w: 0.5, d: 0.5, h: 3.3 });
  for (let i = 0; i < 3; i++) add("AD-150", 12 + i, 15, { t: "box", x: ax[i]!, y: 0, z: 7.8, w: 6, d: 12, h: 0.3 });
  for (let i = 0; i < 3; i++) add("AD-170", 5 + i, 10, { t: "box", x: ax[i]! + 0.25, y: -0.2, z: 4.5, w: 5.5, d: 0.2, h: 3.3 });
  for (let i = 0; i < 2; i++) add("AD-170", 8 + i, 10, { t: "box", x: 55.8, y: ay[i]! + 0.25, z: 4.5, w: 0.2, d: 5.5, h: 3.3 });
  for (let i = 0; i < 3; i++) add("AD-160", i, 3, { t: "roof", x: ax[i]!, y: 0, w: 6, d: 12, z: 8.1, rise: 1.6 });

  // ---------------- pump station, tanks and pipework
  add("PS-110", 0, 1, { t: "box", x: 56, y: 20, z: 0, w: 7, d: 7, h: 3.2, grow: true });
  add("PS-130", 0, 1, { t: "box", x: 58, y: 28.4, z: 0, w: 2.4, d: 1.6, h: 2.2, grow: true });
  add("PS-120", 0, 1, { t: "box", x: 63, y: 23.2, z: 0.1, w: 5.4, d: 0.6, h: 0.6 });
  add("TK-110", 0, 2, { t: "cyl", cx: 72, cy: 24, r: 3.4, z: 0, h: 0.35 });
  add("TK-110", 1, 2, { t: "cyl", cx: 80, cy: 24, r: 3.4, z: 0, h: 0.35 });
  add("TK-120", 0, 1, { t: "cyl", cx: 72, cy: 24, r: 3.1, z: 0.35, h: 4.4, grow: true }, "TK-120-a");
  add("TK-120", 0, 1, { t: "cyl", cx: 80, cy: 24, r: 3.1, z: 0.35, h: 4.4, grow: true }, "TK-120-b");
  add("TK-130", 0, 1, { t: "box", x: 75, y: 23.7, z: 0.4, w: 2, d: 0.6, h: 0.6 });

  // ---------------- roads and yard
  for (let i = 0; i < 6; i++) add("SW-130", i, 6, { t: "box", x: 16 + i * 11, y: 32, z: -0.05, w: 11, d: 4, h: 0.05 });
  for (let i = 0; i < 4; i++) add("SW-110", i, 4, { t: "box", x: 50, y: 4 + i * 7, z: -0.06, w: 0.6, d: 6, h: 0.06 });

  return out.sort((a, b) => a.z - b.z || a.depth - b.depth);
}

const ELEMENTS = buildElements();

export function stateFor(a: Activity, f: number, date: string): BlockState {
  const shown = shownPctAt(a, date);
  const plan = plannedPctAt(a, date);
  if (shown >= f) {
    if (shown >= 100) return "built";
    return plan >= f ? "asplan" : "ahead";
  }
  if (plan >= f) return "behind";
  if (plannedPctAt(a, addDays(date, 14)) >= f) return "due";
  return "ghost";
}

/** Counts of block states on a date (for the legend). */
export function stateCounts(activities: Activity[], date: string) {
  const byCode = new Map(activities.map((a) => [a.code, a]));
  const out: Record<BlockState, number> = { built: 0, asplan: 0, ahead: 0, behind: 0, due: 0, ghost: 0 };
  for (const el of ELEMENTS) {
    const a = byCode.get(el.code);
    if (!a || el.g.t === "fence") continue;
    out[stateFor(a, el.f, date)]++;
  }
  return out;
}

function boxFaces(b: { x: number; y: number; z: number; w: number; d: number; h: number }) {
  const { x, y, z, w, d, h } = b;
  return {
    top: pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]),
    fx: pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]),
    fy: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]),
  };
}

function BoxShape({ b, st }: { b: { x: number; y: number; z: number; w: number; d: number; h: number }; st: BlockState }) {
  const f = boxFaces(b);
  return (
    <g className={`st-${st}`}>
      <polygon points={f.fx} className="fx" />
      <polygon points={f.fy} className="fy" />
      <polygon points={f.top} className="ft" />
    </g>
  );
}

function cylPaths(c: { cx: number; cy: number; r: number; z: number; h: number }) {
  const N = 28;
  const ring = (z: number, a0: number, a1: number) => Array.from({ length: N + 1 }, (_, i) => a0 + ((a1 - a0) * i) / N).map((a) => P(c.cx + Math.cos(a) * c.r, c.cy + Math.sin(a) * c.r, z));
  const a0 = -Math.PI / 4;
  const a1 = (3 * Math.PI) / 4;
  const bottom = ring(c.z, a0, a1);
  const top = ring(c.z + c.h, a1, a0);
  const side = [...bottom, ...top].map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  const lid = ring(c.z + c.h, 0, Math.PI * 2).map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  return { side, lid };
}

function CylShape({ c, st }: { c: { cx: number; cy: number; r: number; z: number; h: number }; st: BlockState }) {
  const p = cylPaths(c);
  return (
    <g className={`st-${st}`}>
      <polygon points={p.side} className="fx" />
      <polygon points={p.lid} className="ft" />
    </g>
  );
}

/** Single blocks (chamber, tanks) grow in height with progress; the gap to plan shows hatched. */
function growSegments(a: Activity, date: string) {
  const shown = shownPctAt(a, date) / 100;
  const plan = plannedPctAt(a, date) / 100;
  const soon = plannedPctAt(a, addDays(date, 14)) / 100;
  const segs: { from: number; to: number; st: BlockState }[] = [];
  if (shown > 0) segs.push({ from: 0, to: shown, st: shown >= 1 ? "built" : shown >= plan ? (shown - plan > 0.05 ? "ahead" : "asplan") : "asplan" });
  if (plan > shown) segs.push({ from: shown, to: plan, st: "behind" });
  const top = Math.max(shown, plan);
  if (top < 1) segs.push({ from: top, to: 1, st: soon > top ? "due" : "ghost" });
  return segs.filter((s) => s.to - s.from > 0.001);
}

export const SiteModel = memo(function SiteModel({
  activities,
  date,
  selected,
  focus,
  onSelect,
  labels,
  titleOf,
}: {
  activities: Activity[];
  date: string;
  selected: string | null;
  /** Activity ids picked on the level rail: everything else dims. */
  focus: Set<string> | null;
  onSelect: (activityId: string) => void;
  labels: { WH: string; AD: string; PS: string; TK: string };
  titleOf: (a: Activity) => string;
}) {
  const byCode = useMemo(() => new Map(activities.map((a) => [a.code, a])), [activities]);
  const shapes: ReactNode[] = [];
  for (const el of ELEMENTS) {
    const a = byCode.get(el.code);
    if (!a) continue;
    const cls = `pmc-el${selected === a.id ? " sel" : ""}${focus && !focus.has(a.id) ? " dim" : ""}`;
    const title = titleOf(a);
    const g = el.g;
    let body: ReactNode = null;
    if (g.t === "fence") {
      const st = stateFor(a, el.f, date);
      body = <polyline points={g.pts.map(([x, y]) => P(x, y, 0).map((v) => v.toFixed(1)).join(",")).join(" ")} className={`pmc-fence st-${st}`} />;
    } else if (g.t === "box" && g.grow) {
      body = growSegments(a, date).map((s, i) => <BoxShape key={i} b={{ ...g, z: g.z + g.h * s.from, h: g.h * (s.to - s.from) }} st={s.st} />);
    } else if (g.t === "box") {
      body = <BoxShape b={g} st={stateFor(a, el.f, date)} />;
    } else if (g.t === "cyl" && g.grow) {
      body = growSegments(a, date).map((s, i) => <CylShape key={i} c={{ ...g, z: g.z + g.h * s.from, h: g.h * (s.to - s.from) }} st={s.st} />);
    } else if (g.t === "cyl") {
      body = <CylShape c={g} st={stateFor(a, el.f, date)} />;
    } else if (g.t === "truss") {
      const st = stateFor(a, el.f, date);
      const { x, y, d, z, rise } = g;
      const top = (k: number) => z + rise * (1 - Math.abs(k * 2 - 1));
      const chord = pts([[x, y, z], [x, y + d, z]]);
      const rafter = pts([[x, y, z], [x, y + d / 2, z + rise], [x, y + d, z]]);
      const webs = Array.from({ length: 7 }, (_, i) => (i + 1) / 8).map((k) => [P(x, y + d * k, z), P(x, y + d * k, top(k))] as const);
      body = (
        <g className={`pmc-truss st-${st}`}>
          <polyline points={chord} />
          <polyline points={rafter} />
          {webs.map(([p1, p2], i) => (
            <line key={i} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} />
          ))}
        </g>
      );
    } else if (g.t === "roof") {
      const st = stateFor(a, el.f, date);
      const { x, y, w, d, z, rise } = g;
      body = (
        <g className={`st-${st}`}>
          <polygon points={pts([[x, y, z], [x + w, y, z], [x + w, y + d / 2, z + rise], [x, y + d / 2, z + rise]])} className="ft" />
          <polygon points={pts([[x, y + d / 2, z + rise], [x + w, y + d / 2, z + rise], [x + w, y + d, z], [x, y + d, z]])} className="fx" />
        </g>
      );
    }
    shapes.push(
      <g key={el.key} className={cls} onClick={() => onSelect(a.id)}>
        <title>{title}</title>
        {body}
      </g>,
    );
  }
  const label = (x: number, y: number, z: number, text: string) => {
    const [sx, sy] = P(x, y, z);
    return (
      <text x={sx} y={sy} className="pmc-model-label" textAnchor="middle">
        {text}
      </text>
    );
  };
  const [ox] = P(-6, 38, 0);
  const [ex] = P(87, -6, 0);
  const [, oy] = P(-6, -6, 12);
  const [, ey] = P(87, 38, -1);
  return (
    <svg viewBox={`${ox.toFixed(0)} ${oy.toFixed(0)} ${(ex - ox).toFixed(0)} ${(ey - oy).toFixed(0)}`} className="pmc-model" role="img" aria-label="Site model">
      <defs>
        <pattern id="pmc-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="var(--redline-soft)" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--redline)" strokeWidth="2" />
        </pattern>
      </defs>
      <polygon points={pts([[-6, -6, -0.3], [87, -6, -0.3], [87, 38, -0.3], [-6, 38, -0.3]])} className="pmc-ground" />
      {shapes}
      {label(24, 12, 13, labels.WH)}
      {label(65, 6, 12.5, labels.AD)}
      {label(59.5, 23.5, 6, labels.PS)}
      {label(76, 24, 7.5, labels.TK)}
    </svg>
  );
});

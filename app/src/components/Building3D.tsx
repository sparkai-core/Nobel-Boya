import { useEffect, useRef, useState } from "react";

type Vec = [number, number, number];
type Face = { pts: Vec[]; cull: boolean };
type Part = { order: number; stage: number; anim: "grow" | "drop" | "fade"; faces: (p: number) => Face[]; tone: number };

const STAGES = [
  "Pad footings MB-1, 31 no.",
  "Ground slab, 1,109 m²",
  "Columns Ms-1 to Ms-4",
  "Ring beam and rigels",
  "Steel trusses F-1, 7 no.",
  "Roof sheeting, 1,181 m²",
  "Admin building",
];

const BOX_FACES: { idx: number[] }[] = [
  { idx: [4, 5, 6, 7] },
  { idx: [0, 3, 2, 1] },
  { idx: [0, 1, 5, 4] },
  { idx: [1, 2, 6, 5] },
  { idx: [2, 3, 7, 6] },
  { idx: [3, 0, 4, 7] },
];

function box(x: number, y: number, z: number, w: number, d: number, h: number): Face[] {
  const c: Vec[] = [
    [x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z],
    [x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h],
  ];
  return BOX_FACES.map((f) => ({ pts: f.idx.map((i) => c[i]!), cull: true }));
}

/** The Qobu warehouse (48 × 24 m, 6 m bays) and the attached admin block, in metres. */
function model(): Part[] {
  const parts: Part[] = [];
  let order = 0;
  const add = (stage: number, anim: Part["anim"], tone: number, faces: (p: number) => Face[]) => parts.push({ order: order++, stage, anim, tone, faces });

  const grid: [number, number][] = [];
  for (let i = 0; i <= 8; i++) for (const y of [0, 12, 24]) grid.push([i * 6, y]);
  for (const x of [0, 48]) for (const y of [6, 18]) grid.push([x, y]);

  grid.forEach(([x, y]) => add(0, "drop", 0.9, () => box(x - 0.75, y - 1.2, -1.2, 1.5, 2.4, 0.5)));
  add(1, "drop", 1, () => box(-0.2, -0.2, -0.15, 48.4, 24.4, 0.15));
  grid.forEach(([x, y]) => {
    const top = y === 12 ? 8 : 7;
    add(2, "grow", 0.82, (p) => box(x - 0.2, y - 0.25, 0, 0.4, 0.5, top * p));
  });
  for (const [x, y, w, d] of [[0, -0.2, 48, 0.4], [0, 23.8, 48, 0.4], [-0.2, 0, 0.4, 24], [47.8, 0, 0.4, 24]] as const)
    add(3, "drop", 0.75, () => box(x, y, 3.6, w, d, 0.25));
  for (const [x, y, w, d, z] of [[0, -0.2, 48, 0.4, 6.5], [0, 23.8, 48, 0.4, 6.5], [0, 11.8, 48, 0.4, 7.5], [-0.2, 0, 0.4, 24, 6.5], [47.8, 0, 0.4, 24, 6.5]] as const)
    add(3, "drop", 0.75, () => box(x, y, z, w, d, 0.5));
  for (let i = 1; i <= 7; i++) {
    const x = i * 6;
    add(4, "fade", 0.7, () => [
      { pts: [[x, 0, 7], [x, 24, 7], [x, 12, 9.14]], cull: false },
    ]);
  }
  for (let i = 0; i < 8; i++) {
    const x0 = i * 6;
    const x1 = x0 + 6;
    add(5, "drop", 1.05, () => [
      { pts: [[x0, -0.6, 6.85], [x1, -0.6, 6.85], [x1, 12, 9.14], [x0, 12, 9.14]], cull: false },
      { pts: [[x0, 12, 9.14], [x1, 12, 9.14], [x1, 24.6, 6.85], [x0, 24.6, 6.85]], cull: false },
    ]);
  }
  add(6, "drop", 1, () => box(-8, -0.1, -0.15, 8, 24.2, 0.15));
  for (const x of [-8, -2, 0]) for (const y of [-0.1, 8.3, 16.5, 24.1]) add(6, "grow", 0.82, (p) => box(x - 0.2, y - 0.2, 0, 0.4, 0.4, 3.3 * p));
  add(6, "drop", 0.95, () => box(-8.3, -0.4, 3.3, 8.3, 24.8, 0.2));
  return parts;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

export function Building3D({ className = "", caption = true }: { className?: string; caption?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const parts = model();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = 34;
    const settle = 520;
    const buildMs = parts.length * step + settle;
    const holdMs = 2600;
    const fadeMs = 700;
    const cycle = buildMs + holdMs + fadeMs;
    const light: Vec = norm([-0.4, -0.75, 0.9]);
    const center: Vec = [20, 12, 3.6];
    let raf = 0;
    let start = performance.now();
    let w = 0;
    let h = 0;
    let lastStage = -1;
    let lastDone = false;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now: number) => {
      let t = reduced ? buildMs : now - start;
      if (t > cycle) {
        start = now;
        t = 0;
      }
      const placing = Math.min(parts.length - 1, Math.floor(t / step));
      const isDone = t >= buildMs;
      const s = parts[placing]!.stage;
      if (s !== lastStage) {
        lastStage = s;
        setStage(s);
      }
      if (isDone !== lastDone) {
        lastDone = isDone;
        setDone(isDone);
      }
      const fade = t > buildMs + holdMs ? 1 - (t - buildMs - holdMs) / fadeMs : 1;
      const yaw = -0.72 + (reduced ? 0 : Math.sin(now / 6000) * 0.12);
      const pitch = 0.52;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const scale = Math.min(w / 62, h / 34);
      const cam = 120;
      const project = (v: Vec): [number, number, number] => {
        const x = v[0] - center[0];
        const y = v[1] - center[1];
        const z = v[2] - center[2];
        const rx = x * cy - y * sy;
        const ry = x * sy + y * cy;
        const vy = ry * cp - z * sp;
        const vz = ry * sp + z * cp;
        const k = cam / (cam + vy);
        return [w / 2 + rx * scale * k, h / 2 - vz * scale * k, vy];
      };
      const view: Vec = [sy * cp, cy * cp, -sp];

      const polys: { pts: [number, number][]; depth: number; fill: string }[] = [];
      for (const part of parts) {
        const local = (t - part.order * step) / settle;
        const p = ease(local);
        if (p <= 0) continue;
        const dz = part.anim === "drop" ? (1 - p) * 2.2 : 0;
        const alphaBase = part.anim === "fade" ? 0.55 : part.stage === 5 ? 0.78 : 0.95;
        const glow = local < 1.6 ? 0.16 * Math.max(0, 1 - Math.abs(local - 0.8) / 0.8) : 0;
        for (const f of part.faces(p)) {
          const pts = f.pts.map((q) => [q[0], q[1], q[2] + dz] as Vec);
          const n = norm(cross(sub(pts[1]!, pts[0]!), sub(pts[2]!, pts[0]!)));
          if (f.cull && dot(n, view) > 0.02) continue;
          const lit = Math.abs(dot(n, light));
          const shade = Math.min(1.1, (0.62 + 0.38 * lit) * part.tone + glow);
          const base: [number, number, number] = part.stage === 5 ? [196, 186, 232] : part.stage === 4 ? [120, 96, 190] : [222, 216, 242];
          const [r, g, b] = base.map((c) => Math.min(255, Math.round(c * shade)));
          const proj = pts.map(project);
          polys.push({
            pts: proj.map((q) => [q[0], q[1]]),
            depth: proj.reduce((a, q) => a + q[2], 0) / proj.length,
            fill: `rgba(${r},${g},${b},${(alphaBase * Math.min(1, p * 1.4) * fade).toFixed(3)})`,
          });
        }
      }
      polys.sort((a, b) => b.depth - a.depth);
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = "round";
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = `rgba(43,2,102,${(0.22 * fade).toFixed(3)})`;
      for (const poly of polys) {
        ctx.beginPath();
        ctx.moveTo(poly.pts[0]![0], poly.pts[0]![1]);
        for (let i = 1; i < poly.pts.length; i++) ctx.lineTo(poly.pts[i]![0], poly.pts[i]![1]);
        ctx.closePath();
        ctx.fillStyle = poly.fill;
        ctx.fill();
        ctx.stroke();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`b3d ${className}`.trim()}>
      <canvas ref={ref} className="b3d-canvas" aria-hidden="true" />
      {caption ? (
        <div className="b3d-caption" aria-live="polite">
          <div className="b3d-steps" aria-hidden="true">
            {STAGES.map((_, i) => (
              <span key={i} className={done || i < stage ? "done" : i === stage ? "on" : ""} />
            ))}
          </div>
          <span key={done ? "done" : stage}>{done ? "Warehouse and admin building" : STAGES[stage]}</span>
        </div>
      ) : null}
    </div>
  );
}

function sub(a: Vec, b: Vec): Vec {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec, b: Vec): Vec {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: Vec, b: Vec) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(v: Vec): Vec {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

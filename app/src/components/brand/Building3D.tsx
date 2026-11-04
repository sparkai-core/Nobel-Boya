import { useEffect, useRef, useState } from "react";

type Kind = "footing" | "column" | "beam" | "slab" | "truss";
type Box = { kind: Kind; order: number; storey: number; x: number; y: number; z: number; w: number; d: number; h: number };
type Vec = [number, number, number];

const BAY_X = 6.0; // 6m column grid matching Qobu warehouse
const BAY_Y = 4.8;
const NX = 3;
const NY = 2;
const STOREY = 3.3; // 3.3m storey height matching Qobu admin building
const SLAB = 0.2;
const STAGES = [
  "Foundation pad footings (31 units)",
  "Ground floor columns (+0.00)",
  "Inter-storey beams and tie members",
  "Intermediate slab (+3.30 level)",
  "Structural steel roof trusses F-1",
  "Purlins and roof bracing system",
];

function generateModel(): Box[] {
  const boxes: Box[] = [];
  let order = 0;
  const grid: [number, number][] = [];
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NY; j++) {
      grid.push([i * BAY_X, j * BAY_Y]);
    }
  }

  // 1. Foundation footings
  grid.forEach(([x, y]) => {
    boxes.push({ kind: "footing", order: order++, storey: -1, x: x - 0.9, y: y - 0.9, z: -0.7, w: 1.8, d: 1.8, h: 0.6 });
  });

  // 2. Ground floor columns
  const z0 = -0.1;
  const colTop = STOREY - SLAB;
  grid.forEach(([x, y]) => {
    boxes.push({ kind: "column", order: order++, storey: 0, x: x - 0.25, y: y - 0.25, z: z0, w: 0.5, d: 0.5, h: colTop - z0 });
  });

  // 3. Ground / Level 1 Beams
  const beamZ = colTop - 0.45;
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i < NX; i++) {
      boxes.push({ kind: "beam", order: order++, storey: 0, x: i * BAY_X + 0.25, y: j * BAY_Y - 0.15, z: beamZ, w: BAY_X - 0.5, d: 0.3, h: 0.45 });
    }
  }
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j < NY; j++) {
      boxes.push({ kind: "beam", order: order++, storey: 0, x: i * BAY_X - 0.15, y: j * BAY_Y + 0.25, z: beamZ, w: 0.3, d: BAY_Y - 0.5, h: 0.45 });
    }
  }

  // 4. Intermediate Floor Slab (+3.30)
  boxes.push({ kind: "slab", order: order++, storey: 0, x: -0.6, y: -0.6, z: colTop, w: NX * BAY_X + 1.2, d: NY * BAY_Y + 1.2, h: SLAB });

  // 5. Upper level columns (admin & truss pedestals)
  const z1 = colTop + SLAB;
  const roofTop = z1 + STOREY * 0.85;
  grid.forEach(([x, y]) => {
    boxes.push({ kind: "column", order: order++, storey: 1, x: x - 0.2, y: y - 0.2, z: z1, w: 0.4, d: 0.4, h: roofTop - z1 });
  });

  // 6. Roof Trusses (F-1) spanning warehouse bays
  for (let i = 0; i <= NX; i++) {
    boxes.push({ kind: "truss", order: order++, storey: 1, x: i * BAY_X - 0.15, y: -0.5, z: roofTop, w: 0.3, d: NY * BAY_Y + 1.0, h: 0.8 });
  }

  return boxes;
}

const FACES: { n: Vec; idx: number[] }[] = [
  { n: [0, 0, 1], idx: [4, 5, 6, 7] }, // top
  { n: [0, 0, -1], idx: [0, 3, 2, 1] }, // bottom
  { n: [0, -1, 0], idx: [0, 1, 5, 4] }, // front
  { n: [1, 0, 0], idx: [1, 2, 6, 5] }, // right
  { n: [0, 1, 0], idx: [2, 3, 7, 6] }, // back
  { n: [-1, 0, 0], idx: [3, 0, 4, 7] }, // left
];

const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function dot(a: Vec, b: Vec) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v: Vec): Vec {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

type Props = {
  className?: string;
  showCaption?: boolean;
};

/** High-precision 3D structural frame built floor-by-floor in isometric perspective. */
export function Building3D({ className = "", showCaption = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState(STAGES[0]!);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const boxes = generateModel();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = 45;
    const settle = 500;
    const buildMs = boxes.length * step + settle;
    const holdMs = 2800;
    const fadeMs = 600;
    const cycleMs = buildMs + holdMs + fadeMs;

    const cx = (NX * BAY_X) / 2;
    const cy = (NY * BAY_Y) / 2;
    const cz = STOREY;
    const light: Vec = normalize([-0.5, -0.65, 0.85]);

    let raf = 0;
    let start = performance.now();
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now: number) => {
      let t = reduced ? buildMs : now - start;
      if (t > cycleMs) {
        start = now;
        t = 0;
      }

      const placing = Math.min(boxes.length - 1, Math.floor(t / step));
      const done = t >= buildMs;

      // Caption progression
      const currentBox = boxes[placing];
      let captionText = STAGES[0]!;
      let stageIndex = 0;
      if (done) {
        captionText = "Structural takeoff verified • 323 elements";
        stageIndex = STAGES.length;
      } else if (currentBox) {
        if (currentBox.kind === "footing") {
          captionText = STAGES[0]!;
          stageIndex = 0;
        } else if (currentBox.kind === "column" && currentBox.storey === 0) {
          captionText = STAGES[1]!;
          stageIndex = 1;
        } else if (currentBox.kind === "beam") {
          captionText = STAGES[2]!;
          stageIndex = 2;
        } else if (currentBox.kind === "slab") {
          captionText = STAGES[3]!;
          stageIndex = 3;
        } else if (currentBox.kind === "column" && currentBox.storey === 1) {
          captionText = STAGES[4]!;
          stageIndex = 4;
        } else if (currentBox.kind === "truss") {
          captionText = STAGES[5]!;
          stageIndex = 5;
        }
      }
      setLabel(captionText);
      setStage(stageIndex);

      const fade = t > buildMs + holdMs ? 1 - (t - buildMs - holdMs) / fadeMs : 1;
      const yaw = -0.65 + (reduced ? 0 : Math.sin(now / 5600) * 0.12);
      const pitch = 0.52;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const span = NX * BAY_X * 1.5;
      const scale = Math.min(width, height * 1.3) / span;
      const camDist = 52;

      const project = (p: Vec): [number, number, number] => {
        const x = p[0] - cx;
        const y = p[1] - cy;
        const z = p[2] - cz;
        const rx = x * cosY - y * sinY;
        const ry = x * sinY + y * cosY;
        const vy = ry * cosP - z * sinP;
        const vz = ry * sinP + z * cosP;
        const persp = camDist / (camDist + vy);
        return [width / 2 + rx * scale * persp, height / 2 - vz * scale * persp + height * 0.05, vy];
      };

      const viewDir: Vec = [sinY * cosP, cosY * cosP, -sinP];

      type Poly = { pts: [number, number][]; depth: number; fill: string; edge: string };
      const polys: Poly[] = [];

      for (const b of boxes) {
        const local = (t - b.order * step) / settle;
        const p = ease(local);
        if (p <= 0) continue;

        let { z, h } = b;
        if (b.kind === "column") h = b.h * p;
        else if (b.kind === "slab" || b.kind === "beam" || b.kind === "truss") z += (1 - p) * 2.0;
        else z -= (1 - p) * 1.0;

        const corners: Vec[] = [
          [b.x, b.y, z],
          [b.x + b.w, b.y, z],
          [b.x + b.w, b.y + b.d, z],
          [b.x, b.y + b.d, z],
          [b.x, b.y, z + h],
          [b.x + b.w, b.y, z + h],
          [b.x + b.w, b.y + b.d, z + h],
          [b.x, b.y + b.d, z + h],
        ];
        const proj = corners.map(project);

        // Elegant architectural palette: crisp steel blue & concrete slate
        const baseColor: [number, number, number] =
          b.kind === "truss" ? [59, 130, 246] : b.kind === "slab" ? [226, 232, 240] : [203, 213, 225];
        const edgeColor = b.kind === "truss" ? "rgba(37, 99, 235, 0.6)" : "rgba(100, 116, 139, 0.4)";

        for (const face of FACES) {
          if (dot(face.n, viewDir) > 0.02) continue;
          const shade = Math.min(1.15, 0.65 + 0.35 * Math.max(0, dot(face.n, light)));
          const alpha = 0.92 * Math.min(1, p * 1.5) * fade;
          const [r, g, bl] = baseColor.map((c) => Math.min(255, Math.round(c * shade)));
          polys.push({
            pts: face.idx.map((i) => [proj[i]![0], proj[i]![1]]),
            depth: face.idx.reduce((s, i) => s + proj[i]![2], 0) / 4,
            fill: `rgba(${r},${g},${bl},${alpha.toFixed(3)})`,
            edge: edgeColor,
          });
        }
      }

      polys.sort((a, b) => b.depth - a.depth);

      ctx.clearRect(0, 0, width, height);
      ctx.lineJoin = "round";
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = fade;

      for (const poly of polys) {
        ctx.beginPath();
        ctx.moveTo(poly.pts[0]![0], poly.pts[0]![1]);
        for (let i = 1; i < poly.pts.length; i++) {
          ctx.lineTo(poly.pts[i]![0], poly.pts[i]![1]);
        }
        ctx.closePath();
        ctx.fillStyle = poly.fill;
        ctx.fill();
        ctx.strokeStyle = poly.edge;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`building-3d-wrap ${className}`.trim()}>
      <canvas ref={canvasRef} className="building-3d-canvas" aria-hidden="true" />
      {showCaption ? (
        <div className="building-3d-caption">
          <div className="building-3d-steps">
            {Array.from({ length: STAGES.length + 1 }, (_, i) => (
              <span key={i} className={i === stage ? "active" : i < stage ? "done" : ""} />
            ))}
          </div>
          <span className="building-3d-label">{label}</span>
        </div>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, RotateCw } from "lucide-react";

type Kind = "footing" | "column" | "beam" | "slab" | "truss" | "bracing";
type Box = {
  id: string;
  kind: Kind;
  order: number;
  storey: number;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  label: string;
  spec: string;
};
type Vec = [number, number, number];

const BAY_X = 6.0; // 6m bay matching Qobu warehouse
const BAY_Y = 4.8;
const NX = 4; // 4 bays in length
const NY = 2; // 2 bays in width
const STOREY = 3.3; // 3.3m floor height
const SLAB = 0.22;

export type LayerFilter = "all" | "footing" | "column" | "slab" | "truss" | "bracing";

function generateQobuModel(): Box[] {
  const boxes: Box[] = [];
  let order = 0;
  const grid: [number, number][] = [];
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NY; j++) {
      grid.push([i * BAY_X, j * BAY_Y]);
    }
  }

  // 1. 31 Pad Footings (F-1: 1.8m x 1.8m x 0.6m)
  grid.forEach(([x, y], idx) => {
    boxes.push({
      id: `f-${idx}`,
      kind: "footing",
      order: order++,
      storey: -1,
      x: x - 0.9,
      y: y - 0.9,
      z: -0.7,
      w: 1.8,
      d: 1.8,
      h: 0.6,
      label: `Pad Footing F-1 (#${idx + 1})`,
      spec: "1.80 × 1.80 × 0.60 m • B25 Concrete (1.94 m³)",
    });
  });

  // 2. Ground Floor Columns K-1 (500x500mm)
  const z0 = -0.1;
  const colTop = STOREY - SLAB;
  grid.forEach(([x, y], idx) => {
    boxes.push({
      id: `c0-${idx}`,
      kind: "column",
      order: order++,
      storey: 0,
      x: x - 0.25,
      y: y - 0.25,
      z: z0,
      w: 0.5,
      d: 0.5,
      h: colTop - z0,
      label: `Column K-1 (#${idx + 1})`,
      spec: "500 × 500 mm • Rebar A500C 16Ø • 0.77 m³",
    });
  });

  // 3. Ground / Level 1 Tie Beams MR-1 & MR-2
  const beamZ = colTop - 0.45;
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i < NX; i++) {
      boxes.push({
        id: `bm-x-${i}-${j}`,
        kind: "beam",
        order: order++,
        storey: 0,
        x: i * BAY_X + 0.25,
        y: j * BAY_Y - 0.15,
        z: beamZ,
        w: BAY_X - 0.5,
        d: 0.3,
        h: 0.45,
        label: `Tie Beam MR-1`,
        spec: "300 × 450 mm • B25 Concrete • Longitudinal",
      });
    }
  }
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j < NY; j++) {
      boxes.push({
        id: `bm-y-${i}-${j}`,
        kind: "beam",
        order: order++,
        storey: 0,
        x: i * BAY_X - 0.15,
        y: j * BAY_Y + 0.25,
        z: beamZ,
        w: 0.3,
        d: BAY_Y - 0.5,
        h: 0.45,
        label: `Transverse Tie Beam`,
        spec: "300 × 450 mm • B25 Concrete",
      });
    }
  }

  // 4. Admin Building Intermediate Floor Slab (+3.30 level)
  boxes.push({
    id: "slab-1",
    kind: "slab",
    order: order++,
    storey: 0,
    x: -0.6,
    y: -0.6,
    z: colTop,
    w: NX * BAY_X + 1.2,
    d: NY * BAY_Y + 1.2,
    h: SLAB,
    label: "Admin Floor Slab (+3.30m)",
    spec: "h = 220 mm • Monolithic Concrete B25",
  });

  // 5. Upper Storey Columns
  const z1 = colTop + SLAB;
  const roofTop = z1 + STOREY * 0.85;
  grid.forEach(([x, y], idx) => {
    boxes.push({
      id: `c1-${idx}`,
      kind: "column",
      order: order++,
      storey: 1,
      x: x - 0.2,
      y: y - 0.2,
      z: z1,
      w: 0.4,
      d: 0.4,
      h: roofTop - z1,
      label: `Upper Column K-2 (#${idx + 1})`,
      spec: "400 × 400 mm • B25 Concrete",
    });
  });

  // 6. Steel Roof Trusses F-1 spanning transverse bays (24m span equivalent)
  for (let i = 0; i <= NX; i++) {
    boxes.push({
      id: `truss-${i}`,
      kind: "truss",
      order: order++,
      storey: 1,
      x: i * BAY_X - 0.15,
      y: -0.6,
      z: roofTop,
      w: 0.3,
      d: NY * BAY_Y + 1.2,
      h: 0.95,
      label: `Steel Roof Truss F-1 (#${i + 1})`,
      spec: "Pitched Triangular Truss • Span 24.0m • A500C (3,161 kg)",
    });
  }

  // 7. Roof Purlins and Diagonal Bracing (Şr-1, Şr-2)
  for (let k = 0; k < 3; k++) {
    boxes.push({
      id: `bracing-${k}`,
      kind: "bracing",
      order: order++,
      storey: 1,
      x: -0.5,
      y: k * 3.2 - 0.2,
      z: roofTop + 0.85,
      w: NX * BAY_X + 1.0,
      d: 0.2,
      h: 0.15,
      label: `Roof Bracing & Purlin Run`,
      spec: "CHS Pipe Profile 108×4 mm • Steel C245",
    });
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

function dot(a: Vec, b: Vec): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v: Vec): Vec {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

type Props = {
  className?: string;
  showCaption?: boolean;
};

export function Building3D({ className = "", showCaption = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filter, setFilter] = useState<LayerFilter>("all");
  const [hoveredBox] = useState<Box | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  // Camera angles
  const yawRef = useRef(-0.65);
  const pitchRef = useRef(0.48);
  const zoomRef = useRef(1.0);
  const isDraggingRef = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const boxesRef = useRef<Box[]>(generateQobuModel());

  // Handle Drag to Rotate
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setAutoRotate(false);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    yawRef.current += dx * 0.008;
    pitchRef.current = Math.max(0.15, Math.min(1.2, pitchRef.current + dy * 0.008));
  }, []);

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.65, Math.min(1.8, zoomRef.current - e.deltaY * 0.001));
  };

  const resetCamera = () => {
    yawRef.current = -0.65;
    pitchRef.current = 0.48;
    zoomRef.current = 1.0;
    setAutoRotate(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const boxes = boxesRef.current;
    const cx = (NX * BAY_X) / 2;
    const cy = (NY * BAY_Y) / 2;
    const cz = STOREY;
    const light: Vec = normalize([-0.5, -0.7, 0.9]);

    let raf = 0;
    let width = 0;
    let height = 0;
    let lastTime = performance.now();

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

    const render = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      if (autoRotate && !isDraggingRef.current) {
        yawRef.current += dt * 0.00035;
      }

      ctx.clearRect(0, 0, width, height);

      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const span = NX * BAY_X * 1.45;
      const scale = (Math.min(width, height * 1.25) / span) * zoomRef.current;

      const project = (p: Vec): [number, number, number] => {
        const x = p[0] - cx;
        const y = p[1] - cy;
        const z = p[2] - cz;
        const rx = x * cosY - y * sinY;
        const ry = x * sinY + y * cosY;
        const rz = z;
        const sy = ry * cosP - rz * sinP;
        const sz = ry * sinP + rz * cosP;
        const px = width / 2 + rx * scale;
        const py = height / 2 - sz * scale + 15;
        return [px, py, sy];
      };

      // Draw Blueprint Stage Ground Grid
      ctx.strokeStyle = "rgba(59, 130, 246, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -1; i <= NX + 1; i++) {
        const p1 = project([i * BAY_X, -BAY_Y, -0.7]);
        const p2 = project([i * BAY_X, (NY + 1) * BAY_Y, -0.7]);
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
      }
      for (let j = -1; j <= NY + 1; j++) {
        const p1 = project([-BAY_X, j * BAY_Y, -0.7]);
        const p2 = project([(NX + 1) * BAY_X, j * BAY_Y, -0.7]);
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
      }
      ctx.stroke();

      // Collect renderable faces
      type RenderFace = {
        poly: [number, number][];
        depth: number;
        fill: string;
        stroke: string;
        strokeWidth: number;
      };
      const renderedFaces: RenderFace[] = [];

      for (const b of boxes) {
        const isMatch = filter === "all" || b.kind === filter;
        const isHovered = hoveredBox?.id === b.id;

        const x0 = b.x;
        const x1 = b.x + b.w;
        const y0 = b.y;
        const y1 = b.y + b.d;
        const z0 = b.z;
        const z1 = b.z + b.h;

        const verts: Vec[] = [
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y1, z0],
          [x0, y1, z0],
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ];

        const proj = verts.map(project);

        // Styling based on element kind & filter state in Obsidian & Bronze palette
        let baseR = 180;
        let baseG = 83;
        let baseB = 9; // Architectural Bronze (#2563eb)
        let alpha = isMatch ? 0.88 : 0.12;

        if (b.kind === "footing") {
          baseR = 71;
          baseG = 85;
          baseB = 105; // Slate Foundation (#475569)
        } else if (b.kind === "truss") {
          baseR = 217;
          baseG = 119;
          baseB = 6; // Amber Structural Steel (#D97706)
        } else if (b.kind === "slab") {
          baseR = 148;
          baseG = 163;
          baseB = 184; // Neutral Concrete Slab (#94A3B8)
        }

        if (isHovered) {
          baseR = 245;
          baseG = 158;
          baseB = 11; // Luminous Amber Highlight (#F59E0B)
          alpha = 1.0;
        }

        for (const face of FACES) {
          const fn = face.n;
          const ry = fn[0] * sinY + fn[1] * cosY;
          const rz = fn[2];
          const sz = ry * sinP + rz * cosP;
          if (sz <= 0) continue; // backface culling

          const diff = Math.max(0.15, dot(fn, light));
          const fR = Math.round(Math.min(255, baseR * (0.6 + 0.4 * diff)));
          const fG = Math.round(Math.min(255, baseG * (0.6 + 0.4 * diff)));
          const fB = Math.round(Math.min(255, baseB * (0.6 + 0.4 * diff)));

          const poly = face.idx.map((i) => [proj[i]![0], proj[i]![1]] as [number, number]);
          const depth = face.idx.reduce((a, i) => a + proj[i]![2], 0) / face.idx.length;

          renderedFaces.push({
            poly,
            depth,
            fill: `rgba(${fR}, ${fG}, ${fB}, ${alpha})`,
            stroke: isMatch
              ? isHovered
                ? "#ffffff"
                : `rgba(255, 255, 255, ${alpha * 0.7})`
              : "rgba(148, 163, 184, 0.15)",
            strokeWidth: isHovered ? 1.8 : 1,
          });
        }
      }

      // Painter's algorithm
      renderedFaces.sort((a, z) => a.depth - z.depth);

      for (const f of renderedFaces) {
        ctx.fillStyle = f.fill;
        ctx.strokeStyle = f.stroke;
        ctx.lineWidth = f.strokeWidth;
        ctx.beginPath();
        ctx.moveTo(f.poly[0]![0], f.poly[0]![1]);
        for (let i = 1; i < f.poly.length; i++) {
          ctx.lineTo(f.poly[i]![0], f.poly[i]![1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [autoRotate, filter, hoveredBox]);

  return (
    <div className={`building-3d-root ${className}`}>
      {/* Interactive Layer Filter Toolbar */}
      <div className="b3d-layer-bar">
        <div className="b3d-filter-pills" role="tablist" aria-label="Structural layers">
          <button
            type="button"
            className={`b3d-pill${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All Elements
          </button>
          <button
            type="button"
            className={`b3d-pill pill-footing${filter === "footing" ? " active" : ""}`}
            onClick={() => setFilter("footing")}
          >
            Footings F-1
          </button>
          <button
            type="button"
            className={`b3d-pill pill-column${filter === "column" ? " active" : ""}`}
            onClick={() => setFilter("column")}
          >
            Columns K-1
          </button>
          <button
            type="button"
            className={`b3d-pill pill-truss${filter === "truss" ? " active" : ""}`}
            onClick={() => setFilter("truss")}
          >
            Trusses F-1
          </button>
          <button
            type="button"
            className={`b3d-pill pill-slab${filter === "slab" ? " active" : ""}`}
            onClick={() => setFilter("slab")}
          >
            Floor Slabs
          </button>
        </div>

        <div className="b3d-view-controls">
          <button
            type="button"
            className={`b3d-icon-btn${autoRotate ? " active" : ""}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? "Pause auto-rotation" : "Enable 360° spin"}
          >
            <RotateCw size={14} className={autoRotate ? "spin-icon" : ""} />
          </button>
          <button
            type="button"
            className="b3d-icon-btn"
            onClick={resetCamera}
            title="Reset default isometric angle"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div
        className="b3d-canvas-wrap"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        title="Click and drag to orbit in 3D • Scroll to zoom"
      >
        <canvas ref={canvasRef} className="b3d-canvas" />

        {/* HUD Coordinate Stamp */}
        <div className="b3d-hud-specs">
          <div className="hud-line">
            <span className="hud-tag">ASSET</span>
            <span className="hud-val">Qobu Warehouse &amp; Admin</span>
          </div>
          <div className="hud-line">
            <span className="hud-tag">GRID</span>
            <span className="hud-val">48.0m × 24.0m Hall • 6.0m Bays</span>
          </div>
          <div className="hud-line">
            <span className="hud-tag">TRUSS</span>
            <span className="hud-val">9 × F-1 (Span 24m) • 28,450 kg</span>
          </div>
        </div>

        {/* Orbit hint pill */}
        <div className="b3d-orbit-hint">
          <span>Drag to orbit • Scroll to zoom</span>
        </div>
      </div>

      {showCaption ? (
        <div className="b3d-footer-status">
          <div className="status-indicator">
            <span className="status-live-dot" />
            <span className="status-text">
              Digital Twin Active • 31 Footings, 31 Columns, 9 Steel Trusses F-1
            </span>
          </div>
          <span className="status-badge">Working Design 2026</span>
        </div>
      ) : null}
    </div>
  );
}

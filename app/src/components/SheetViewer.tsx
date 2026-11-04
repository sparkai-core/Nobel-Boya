import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { sheetImage } from "../data";
import type { Box, Sheet } from "../data/types";

export type ViewerMark = { key: string; box: Box; tone: "red" | "blue" | "muted"; active?: boolean; label?: string };

export type ViewerHandle = { flyTo: (box: Box) => void; fit: () => void };

type View = { x: number; y: number; s: number };

type Props = {
  sheet: Sheet;
  marks: ViewerMark[];
  focus?: Box | null;
  onMark?: (key: string) => void;
};

/** Pan and zoom over a rendered sheet. Coordinates are PDF points; s is points per screen pixel. */
export const SheetViewer = forwardRef<ViewerHandle, Props>(function SheetViewer({ sheet, marks, focus, onMark }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 1 });
  const [loaded, setLoaded] = useState(false);
  const anim = useRef<number | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e!.contentRect.width, h: e!.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitView = useCallback((): View => {
    const s = Math.max(sheet.w / size.w, sheet.h / size.h) * 1.06;
    return { s, x: sheet.w / 2 - (size.w * s) / 2, y: sheet.h / 2 - (size.h * s) / 2 };
  }, [sheet.w, sheet.h, size.w, size.h]);

  const boxView = useCallback(
    (box: Box): View => {
      const [x0, y0, x1, y1] = box;
      const bw = Math.max(x1 - x0, 40);
      const bh = Math.max(y1 - y0, 20);
      const s = Math.min(Math.max(bw / (size.w * 0.42), bh / (size.h * 0.3)), Math.max(sheet.w / size.w, sheet.h / size.h));
      return { s, x: (x0 + x1) / 2 - (size.w * s) / 2, y: (y0 + y1) / 2 - (size.h * s) / 2 };
    },
    [size.w, size.h, sheet.w, sheet.h],
  );

  const animateTo = useCallback((target: View, ms = 520) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setView(target);
      return;
    }
    let from: View | null = null;
    const t0 = performance.now();
    const tick = (t: number) => {
      setView((cur) => {
        from ??= cur;
        const k = Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);
        const ls = Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * e;
        const s = Math.exp(ls);
        const cx0 = from.x + (size.w * from.s) / 2;
        const cy0 = from.y + (size.h * from.s) / 2;
        const cx1 = target.x + (size.w * target.s) / 2;
        const cy1 = target.y + (size.h * target.s) / 2;
        const cx = cx0 + (cx1 - cx0) * e;
        const cy = cy0 + (cy1 - cy0) * e;
        return { s, x: cx - (size.w * s) / 2, y: cy - (size.h * s) / 2 };
      });
      if (t - t0 < ms) anim.current = requestAnimationFrame(tick);
    };
    anim.current = requestAnimationFrame(tick);
  }, [size.w, size.h]);

  useImperativeHandle(ref, () => ({ flyTo: (b) => animateTo(boxView(b)), fit: () => animateTo(fitView()) }), [animateTo, boxView, fitView]);

  useEffect(() => {
    setLoaded(false);
  }, [sheet.id]);

  useEffect(() => {
    if (size.w < 10) return;
    if (focus) {
      setView(fitView());
      const id = window.setTimeout(() => animateTo(boxView(focus), 640), 120);
      return () => window.clearTimeout(id);
    }
    setView(fitView());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.id, size.w, size.h, focus?.join(",")]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (anim.current) cancelAnimationFrame(anim.current);
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      setView((v) => {
        const maxS = Math.max(sheet.w / size.w, sheet.h / size.h) * 1.6;
        const s = Math.min(maxS, Math.max(0.05, v.s * factor));
        const px = v.x + mx * v.s;
        const py = v.y + my * v.s;
        return { s, x: px - mx * s, y: py - my * s };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [sheet.w, sheet.h, size.w, size.h]);

  const zoomBy = (f: number) =>
    animateTo(
      (() => {
        const s = view.s * f;
        const cx = view.x + (size.w * view.s) / 2;
        const cy = view.y + (size.h * view.s) / 2;
        return { s, x: cx - (size.w * s) / 2, y: cy - (size.h * s) / 2 };
      })(),
      240,
    );

  const vb = `${view.x} ${view.y} ${size.w * view.s} ${size.h * view.s}`;
  const zoomPct = Math.round((1 / view.s) * 100 / 2) * 2;

  return (
    <div
      ref={host}
      className={`viewer${drag.current?.moved ? " dragging" : ""}`}
      onPointerDown={(e) => {
        if ((e.target as Element).closest(".viewer-tools")) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        if (anim.current) cancelAnimationFrame(anim.current);
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        setView((v) => ({ ...v, x: d.vx - dx * v.s, y: d.vy - dy * v.s }));
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onDoubleClick={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const s = view.s / 2.2;
        animateTo({ s, x: view.x + mx * view.s - mx * s, y: view.y + my * view.s - my * s }, 260);
      }}
    >
      <svg className="viewer-svg" viewBox={vb} preserveAspectRatio="none">
        <rect className="paper-shadow" x={4} y={6} width={sheet.w} height={sheet.h} />
        <rect x={0} y={0} width={sheet.w} height={sheet.h} fill="#fff" />
        <image
          key={sheet.id}
          href={sheetImage(sheet.id)}
          width={sheet.w}
          height={sheet.h}
          preserveAspectRatio="none"
          className={loaded ? "sheet-img ready" : "sheet-img"}
          onLoad={() => setLoaded(true)}
        />
        {marks.map((m) => (
          <g key={m.key} className={`vmark vmark-${m.tone}${m.active ? " active" : ""}`} onClick={() => onMark?.(m.key)}>
            <rect
              x={m.box[0]}
              y={m.box[1]}
              width={m.box[2] - m.box[0]}
              height={m.box[3] - m.box[1]}
              rx={1.5}
              pathLength={1}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>
      {!loaded ? <div className="viewer-loading">Loading sheet</div> : null}
      <div className="viewer-tools">
        <button type="button" onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom in">
          <Plus size={16} />
        </button>
        <span className="viewer-zoom num">{zoomPct}%</span>
        <button type="button" onClick={() => zoomBy(1.5)} aria-label="Zoom out">
          <Minus size={16} />
        </button>
        <button type="button" onClick={() => animateTo(fitView())} aria-label="Fit sheet">
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
});

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { sheetImage } from "../data";
import type { Box, Sheet } from "../data/types";

export type ViewerMark = {
  key: string;
  box: Box;
  tone: "red" | "blue" | "green" | "amber" | "muted";
  active?: boolean;
  label?: string;
  tag?: string;
  approved?: boolean;
};

export type ViewerHandle = { flyTo: (box: Box) => void; fit: () => void };

type View = { x: number; y: number; s: number };

type Props = {
  sheet: Sheet;
  marks: ViewerMark[];
  focus?: Box | null;
  onMark?: (key: string) => void;
};

/** Pan and zoom blueprint canvas with interactive element tag highlights and redline verification. */
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
    const s = Math.max(sheet.w / size.w, sheet.h / size.h) * 1.05;
    return { s, x: sheet.w / 2 - (size.w * s) / 2, y: sheet.h / 2 - (size.h * s) / 2 };
  }, [sheet.w, sheet.h, size.w, size.h]);

  const boxView = useCallback(
    (box: Box): View => {
      const [x0, y0, x1, y1] = box;
      const bw = Math.max(x1 - x0, 50);
      const bh = Math.max(y1 - y0, 30);
      const s = Math.min(Math.max(bw / (size.w * 0.35), bh / (size.h * 0.28)), Math.max(sheet.w / size.w, sheet.h / size.h));
      return { s, x: (x0 + x1) / 2 - (size.w * s) / 2, y: (y0 + y1) / 2 - (size.h * s) / 2 };
    },
    [size.w, size.h, sheet.w, sheet.h],
  );

  const animateTo = useCallback(
    (target: View, ms = 480) => {
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
          // Apple cubic-bezier easing (0.16, 1, 0.3, 1) approximation
          const e = 1 - Math.pow(1 - k, 3.2);
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
    },
    [size.w, size.h],
  );

  useImperativeHandle(ref, () => ({ flyTo: (b) => animateTo(boxView(b)), fit: () => animateTo(fitView()) }), [animateTo, boxView, fitView]);

  useEffect(() => {
    setLoaded(false);
  }, [sheet.id]);

  useEffect(() => {
    if (size.w < 10) return;
    if (focus) {
      setView(fitView());
      const id = window.setTimeout(() => animateTo(boxView(focus), 560), 100);
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
      const factor = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
      setView((v) => {
        const maxS = Math.max(sheet.w / size.w, sheet.h / size.h) * 1.8;
        const s = Math.min(maxS, Math.max(0.04, v.s * factor));
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
      220,
    );

  const vb = `${view.x} ${view.y} ${size.w * view.s} ${size.h * view.s}`;
  const zoomPct = Math.round((1 / view.s) * 100 / 2) * 2;

  return (
    <div
      ref={host}
      className={`viewer modern-viewer${drag.current?.moved ? " dragging" : ""}`}
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
        const s = view.s / 2.0;
        animateTo({ s, x: view.x + mx * view.s - mx * s, y: view.y + my * view.s - my * s }, 240);
      }}
    >
      <svg className="viewer-svg" viewBox={vb} preserveAspectRatio="none">
        {/* Architectural Drafting Shadow & Backing */}
        <rect className="paper-shadow" x={5} y={8} width={sheet.w} height={sheet.h} rx={2} />
        <rect x={0} y={0} width={sheet.w} height={sheet.h} fill="#ffffff" rx={2} />

        <image
          key={sheet.id}
          href={sheetImage(sheet.id)}
          width={sheet.w}
          height={sheet.h}
          preserveAspectRatio="none"
          className={loaded ? "sheet-img ready" : "sheet-img"}
          onLoad={() => setLoaded(true)}
        />

        {/* Interactive Element Tags & Evidence Highlights */}
        {marks.map((m) => {
          const bw = m.box[2] - m.box[0];
          const bh = m.box[3] - m.box[1];
          const tagY = m.box[1] - 4;
          const pillText = m.tag ? `${m.tag}${m.label ? ` • ${m.label}` : ""}` : m.label;

          return (
            <g
              key={m.key}
              className={`vmark vmark-${m.tone}${m.active ? " active" : ""}${m.approved ? " approved" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onMark?.(m.key);
              }}
            >
              {/* Highlight bounding box */}
              <rect
                x={m.box[0]}
                y={m.box[1]}
                width={bw}
                height={bh}
                rx={2}
                pathLength={1}
                className="vmark-rect"
                vectorEffect="non-scaling-stroke"
              />

              {/* Tag Pin Badge for discovered items */}
              {pillText ? (
                <g className="vmark-pin" transform={`translate(${m.box[0]}, ${tagY})`}>
                  <rect
                    x={0}
                    y={-14}
                    width={Math.max(48, pillText.length * 6.2 + 14)}
                    height={14}
                    rx={3}
                    className="vmark-pin-bg"
                  />
                  <text x={7} y={-4} className="vmark-pin-text">
                    {pillText}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>

      {!loaded ? (
        <div className="viewer-loading">
          <span className="spinner" />
          <span>Rendering drawing sheet {sheet.id}...</span>
        </div>
      ) : null}

      {/* Floating Canvas Controls */}
      <div className="viewer-tools">
        <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom in" title="Zoom In (+)">
          <Plus size={15} />
        </button>
        <span className="viewer-zoom num">{zoomPct}%</span>
        <button type="button" onClick={() => zoomBy(1.4)} aria-label="Zoom out" title="Zoom Out (-)">
          <Minus size={15} />
        </button>
        <div className="viewer-tool-sep" />
        <button type="button" onClick={() => animateTo(fitView())} aria-label="Fit sheet" title="Fit to Viewport (Space)">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Sheet Metadata Banner */}
      <div className="viewer-meta-pill">
        <span className="pill-code">{sheet.id}</span>
        <span className="pill-title">{sheet.titleEn || sheet.title}</span>
        <span className="pill-count">
          {marks.length} {marks.length === 1 ? "element" : "elements"} highlighted
        </span>
      </div>
    </div>
  );
});

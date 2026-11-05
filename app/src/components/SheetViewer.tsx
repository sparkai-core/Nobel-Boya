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

  // References to preserve state across frames and prevent animation clobbering
  const viewRef = useRef<View>({ x: 0, y: 0, s: 1 });
  const animRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const prevSheetRef = useRef<string>(sheet.id);
  const prevFocusRef = useRef<string | null>(null);
  const didPanRef = useRef<boolean>(false);

  // Keep viewRef synchronized with view state
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e?.contentRect) {
        setSize({ w: Math.max(300, e.contentRect.width), h: Math.max(200, e.contentRect.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute full-sheet fit view
  const fitView = useCallback((): View => {
    const s = Math.max(sheet.w / size.w, sheet.h / size.h) * 1.05;
    return { s, x: sheet.w / 2 - (size.w * s) / 2, y: sheet.h / 2 - (size.h * s) / 2 };
  }, [sheet.w, sheet.h, size.w, size.h]);

  // Compute focused box view
  const boxView = useCallback(
    (box: Box): View => {
      const [x0, y0, x1, y1] = box;
      const bw = Math.max(x1 - x0, 50);
      const bh = Math.max(y1 - y0, 30);
      const s = Math.min(
        Math.max(bw / (size.w * 0.35), bh / (size.h * 0.28)),
        Math.max(sheet.w / size.w, sheet.h / size.h),
      );
      return { s, x: (x0 + x1) / 2 - (size.w * s) / 2, y: (y0 + y1) / 2 - (size.h * s) / 2 };
    },
    [size.w, size.h, sheet.w, sheet.h],
  );

  // High-performance smooth camera animation
  const animateTo = useCallback(
    (target: View, ms = 420) => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || ms <= 0) {
        viewRef.current = target;
        setView(target);
        return;
      }

      const from = { ...viewRef.current };
      const t0 = performance.now();

      const tick = (now: number) => {
        const elapsed = now - t0;
        const progress = Math.min(1, elapsed / ms);
        // Smooth Apple quintic ease-out: 1 - (1 - t)^3.5
        const ease = 1 - Math.pow(1 - progress, 3.5);

        const ls = Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * ease;
        const s = Math.exp(ls);

        const cx0 = from.x + (size.w * from.s) / 2;
        const cy0 = from.y + (size.h * from.s) / 2;
        const cx1 = target.x + (size.w * target.s) / 2;
        const cy1 = target.y + (size.h * target.s) / 2;
        const cx = cx0 + (cx1 - cx0) * ease;
        const cy = cy0 + (cy1 - cy0) * ease;

        const nextView: View = {
          s,
          x: cx - (size.w * s) / 2,
          y: cy - (size.h * s) / 2,
        };

        viewRef.current = nextView;
        setView(nextView);

        if (progress < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          animRef.current = null;
        }
      };

      animRef.current = requestAnimationFrame(tick);
    },
    [size.w, size.h],
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (b) => animateTo(boxView(b), 420),
      fit: () => animateTo(fitView(), 360),
    }),
    [animateTo, boxView, fitView],
  );

  // Reliable native image preloader
  useEffect(() => {
    let active = true;
    const url = sheetImage(sheet.id);
    const img = new Image();
    img.src = url;
    if (img.complete) {
      setLoaded(true);
    } else {
      img.onload = () => {
        if (active) setLoaded(true);
      };
      img.onerror = () => {
        if (active) setLoaded(true);
      };
    }
    return () => {
      active = false;
    };
  }, [sheet.id]);

  // Clean viewport initialization and focus management
  useEffect(() => {
    if (size.w < 10) return;

    const focusKey = focus ? focus.join(",") : null;
    const isNewSheet = prevSheetRef.current !== sheet.id;

    if (isNewSheet) {
      prevSheetRef.current = sheet.id;
      prevFocusRef.current = focusKey;
      if (focus) {
        const target = boxView(focus);
        viewRef.current = target;
        setView(target);
      } else {
        const target = fitView();
        viewRef.current = target;
        setView(target);
      }
      return;
    }

    // Same sheet: smooth fly if focused item changed
    if (focus && focusKey !== prevFocusRef.current) {
      prevFocusRef.current = focusKey;
      animateTo(boxView(focus), 420);
    } else if (!focusKey && prevFocusRef.current) {
      prevFocusRef.current = null;
    }
  }, [sheet.id, size.w, size.h, focus, boxView, fitView, animateTo]);

  // Mouse wheel zoom
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
      setView((v) => {
        const maxS = Math.max(sheet.w / size.w, sheet.h / size.h) * 2.2;
        const s = Math.min(maxS, Math.max(0.02, v.s * factor));
        const px = v.x + mx * v.s;
        const py = v.y + my * v.s;
        const next = { s, x: px - mx * s, y: py - my * s };
        viewRef.current = next;
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [sheet.w, sheet.h, size.w, size.h]);

  // Clean unmount
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const zoomBy = (f: number) => {
    const cur = viewRef.current;
    const s = Math.min(
      Math.max(sheet.w / size.w, sheet.h / size.h) * 2.2,
      Math.max(0.02, cur.s * f),
    );
    const cx = cur.x + (size.w * cur.s) / 2;
    const cy = cur.y + (size.h * cur.s) / 2;
    animateTo({ s, x: cx - (size.w * s) / 2, y: cy - (size.h * s) / 2 }, 260);
  };

  const vb = `${view.x} ${view.y} ${size.w * view.s} ${size.h * view.s}`;
  const zoomPct = Math.round((1 / view.s) * 100 / 2) * 2;

  return (
    <div
      ref={host}
      className={`viewer modern-viewer${dragRef.current?.moved ? " dragging" : ""}`}
      onPointerDown={(e) => {
        if ((e.target as Element).closest(".viewer-tools")) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        if (animRef.current) {
          cancelAnimationFrame(animRef.current);
          animRef.current = null;
        }
        dragRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
        didPanRef.current = false;
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) {
          d.moved = true;
          didPanRef.current = true;
        }
        const next = { ...viewRef.current, x: d.vx - dx * viewRef.current.s, y: d.vy - dy * viewRef.current.s };
        viewRef.current = next;
        setView(next);
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onDoubleClick={(e) => {
        if ((e.target as Element).closest(".viewer-tools")) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const cur = viewRef.current;
        const s = Math.max(0.02, cur.s * 0.55);
        animateTo({ s, x: cur.x + mx * cur.s - mx * s, y: cur.y + my * cur.s - my * s }, 260);
      }}
    >
      <svg className="viewer-svg" viewBox={vb} preserveAspectRatio="none">
        {/* Architectural Drafting Shadow & Backing */}
        <rect className="paper-shadow" x={5} y={8} width={sheet.w} height={sheet.h} rx={2} />
        <rect x={0} y={0} width={sheet.w} height={sheet.h} fill="#ffffff" rx={2} />

        {/* Blueprint Vector Drawing Sheet */}
        <image
          key={sheet.id}
          href={sheetImage(sheet.id)}
          xlinkHref={sheetImage(sheet.id)}
          width={sheet.w}
          height={sheet.h}
          preserveAspectRatio="none"
          className="sheet-img ready"
          onLoad={() => setLoaded(true)}
        />

        {/* Interactive Element Tags & Evidence Highlights */}
        {marks.map((m) => {
          const bw = Math.max(m.box[2] - m.box[0], 10);
          const bh = Math.max(m.box[3] - m.box[1], 10);
          const pillText = m.tag ? `${m.tag}${m.label ? ` • ${m.label}` : ""}` : m.label;
          const pillW = pillText ? Math.max(48, pillText.length * 6.2 + 14) : 0;

          // Clamp badge vertically: if box is near top edge, place badge below the box
          const pinBelow = m.box[1] < 22;
          const pinY = pinBelow ? m.box[3] + 16 : m.box[1] - 4;
          // Clamp badge horizontally: ensure it never renders outside the sheet width
          const pinX = Math.max(4, Math.min(sheet.w - pillW - 4, m.box[0]));

          return (
            <g
              key={m.key}
              className={`vmark vmark-${m.tone}${m.active ? " active" : ""}${m.approved ? " approved" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (didPanRef.current) return;
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
                <g className="vmark-pin" transform={`translate(${pinX}, ${pinY})`}>
                  <rect
                    x={0}
                    y={-14}
                    width={pillW}
                    height={14}
                    rx={3}
                    className="vmark-pin-bg"
                  />
                  <text x={7} y={-3.5} className="vmark-pin-text">
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
        <button type="button" onClick={() => animateTo(fitView(), 360)} aria-label="Fit sheet" title="Fit to Viewport (Space)">
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

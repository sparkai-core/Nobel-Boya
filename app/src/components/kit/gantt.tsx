import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { addDays, diffDays, monthShort, toDate } from "../../ops/dates";
import type { Tone } from "../../ops/select";
import { useL } from "./core";
import { toneColor } from "./charts";

export type GanttBar = {
  start: string;
  end: string;
  /** current = solid programme bar; baseline = thin grey under-bar; actual = progress fill; forecast = dashed outline; ghost = moved-from outline. */
  kind: "current" | "baseline" | "actual" | "forecast" | "ghost";
  tone?: Tone;
  /** 0–100 progress fill on a current bar. */
  pct?: number;
  label?: string;
};
export type GanttRow = {
  id: string;
  label: ReactNode;
  sub?: ReactNode;
  level?: number;
  group?: boolean;
  bars: GanttBar[];
  milestones?: { date: string; filled?: boolean; tone?: Tone; title?: string }[];
  critical?: boolean;
  dim?: boolean;
  /** Extra cells after the label (e.g. % done, owner). */
  cells?: ReactNode[];
};
export type GanttLink = { from: string; to: string; critical?: boolean };
export type Zoom = "week" | "month" | "quarter";

const PX: Record<Zoom, number> = { week: 16, month: 5, quarter: 2 };

/**
 * Shared programme timeline: sticky label column, month/week header, today line, bars by kind,
 * milestone diamonds and elbow links. Scrolls horizontally; the today line is scrolled into view.
 */
export function GanttCore({
  rows,
  from,
  to,
  zoom = "month",
  today,
  links = [],
  onRowClick,
  selected,
  labelWidth = 280,
  rowHeight = 34,
  cellHeaders = [],
  markers = [],
  height,
}: {
  rows: GanttRow[];
  from: string;
  to: string;
  zoom?: Zoom;
  today: string;
  links?: GanttLink[];
  onRowClick?: (id: string) => void;
  selected?: string | null;
  labelWidth?: number;
  rowHeight?: number;
  cellHeaders?: ReactNode[];
  markers?: { date: string; label: string; tone?: Tone }[];
  height?: number;
}) {
  const { lang, t } = useL();
  const px = PX[zoom];
  const days = Math.max(1, diffDays(from, to));
  const width = days * px;
  const X = (d: string) => diffDays(from, d) * px;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, X(today) - el.clientWidth * 0.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, from]);

  const ticks = useMemo(() => {
    const out: { x: number; label: string; major: boolean }[] = [];
    if (zoom === "week") {
      let d = from;
      const dow = toDate(d).getUTCDay();
      d = addDays(d, (8 - dow) % 7);
      for (; d <= to; d = addDays(d, 7)) out.push({ x: X(d), label: `${toDate(d).getUTCDate()} ${monthShort(toDate(d).getUTCMonth(), lang)}`, major: toDate(d).getUTCDate() <= 7 });
    } else {
      const start = toDate(from);
      let y = start.getUTCFullYear();
      let m = start.getUTCMonth();
      for (;;) {
        const iso = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        if (iso > to) break;
        if (iso >= from && (zoom === "month" || m % 3 === 0)) out.push({ x: X(iso), label: zoom === "quarter" ? `Q${Math.floor(m / 3) + 1} ${String(y).slice(2)}` : `${monthShort(m, lang)} ${String(y).slice(2)}`, major: m === 0 });
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, zoom, lang]);

  const rowIndex = new Map(rows.map((r, i) => [r.id, i]));
  const barEnd = (r: GanttRow) => {
    const cur = r.bars.find((b) => b.kind === "current") ?? r.bars[0];
    return cur ? { s: X(cur.start), e: X(cur.end) } : null;
  };

  return (
    <div className="k-gantt" style={{ ["--gl" as string]: `${labelWidth}px`, ["--gr" as string]: `${rowHeight}px`, maxHeight: height }}>
      <div className="k-gantt-scroll" ref={scroller}>
        <div className="k-gantt-inner" style={{ width: labelWidth + width }}>
          <div className="k-gantt-head">
            <div className="k-gantt-corner">
              <span>{t("Activity")}</span>
              {cellHeaders.map((h, i) => (
                <span key={i} className="k-gantt-cellh">
                  {h}
                </span>
              ))}
            </div>
            <div className="k-gantt-scale" style={{ width }}>
              {ticks.map((tk, i) => (
                <span key={i} className={`k-tick${tk.major ? " major" : ""}`} style={{ left: tk.x }}>
                  {tk.label}
                </span>
              ))}
            </div>
          </div>
          <div className="k-gantt-body" style={{ height: rows.length * rowHeight }}>
            <div className="k-gantt-grid" style={{ left: labelWidth, width }}>
              {ticks.map((tk, i) => (
                <i key={i} style={{ left: tk.x }} className={tk.major ? "major" : undefined} />
              ))}
              <b className="k-gantt-today" style={{ left: X(today) }}>
                <span>{t("Today")}</span>
              </b>
              {markers.map((m, i) => (
                <b key={i} className="k-gantt-marker" style={{ left: X(m.date), borderColor: toneColor(m.tone ?? "neutral") }}>
                  <span style={{ color: toneColor(m.tone ?? "neutral") }}>{m.label}</span>
                </b>
              ))}
            </div>
            <svg className="k-gantt-links" style={{ left: labelWidth, width, height: rows.length * rowHeight }}>
              {links.map((l, i) => {
                const a = rowIndex.get(l.from);
                const b = rowIndex.get(l.to);
                if (a == null || b == null) return null;
                const pa = barEnd(rows[a]!);
                const pb = barEnd(rows[b]!);
                if (!pa || !pb) return null;
                const y1 = a * rowHeight + rowHeight / 2;
                const y2 = b * rowHeight + rowHeight / 2;
                const x1 = pa.e;
                const x2 = pb.s;
                const mid = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
                return <path key={i} d={`M${x1} ${y1} H${mid} V${y2} H${x2 - 2}`} className={`k-link${l.critical ? " crit" : ""}`} markerEnd="url(#k-arrow)" />;
              })}
              <defs>
                <marker id="k-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0 0 L6 3 L0 6z" fill="currentColor" />
                </marker>
              </defs>
            </svg>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className={`k-gantt-row${r.group ? " group" : ""}${r.dim ? " dim" : ""}${selected === r.id ? " sel" : ""}${r.critical ? " crit" : ""}`}
                style={{ top: i * rowHeight }}
                onClick={onRowClick ? () => onRowClick(r.id) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r.id) : undefined}
              >
                <div className="k-gantt-label" style={{ paddingLeft: 12 + (r.level ?? 0) * 16 }}>
                  <span className="k-gantt-name truncate">{r.label}</span>
                  {r.sub ? <small className="truncate">{r.sub}</small> : null}
                  {r.cells?.map((c, j) => (
                    <span key={j} className="k-gantt-cell">
                      {c}
                    </span>
                  ))}
                </div>
                <div className="k-gantt-lane" style={{ width }}>
                  {r.bars.map((b, j) => {
                    const left = X(b.start);
                    const w = Math.max(r.group ? 2 : 4, X(b.end) - left);
                    const color = toneColor(b.tone ?? (r.critical ? "bad" : "brand"));
                    if (b.kind === "baseline") return <i key={j} className="k-bar-baseline" style={{ left, width: w }} title={b.label} />;
                    if (b.kind === "forecast") return <i key={j} className="k-bar-forecast" style={{ left, width: w, borderColor: color }} title={b.label} />;
                    if (b.kind === "ghost") return <i key={j} className="k-bar-ghost" style={{ left, width: w }} title={b.label} />;
                    if (b.kind === "actual") return <i key={j} className="k-bar-actual" style={{ left, width: w, background: color }} title={b.label} />;
                    return (
                      <i key={j} className={`k-bar${r.group ? " k-bar-group" : ""}`} style={{ left, width: w, ["--bc" as string]: color }} title={b.label}>
                        {b.pct != null ? <em style={{ width: `${Math.max(0, Math.min(100, b.pct))}%` }} /> : null}
                      </i>
                    );
                  })}
                  {r.milestones?.map((m, j) => (
                    <i key={`m${j}`} className={`k-diamond${m.filled ? " filled" : ""}`} style={{ left: X(m.date), ["--bc" as string]: toneColor(m.tone ?? "brand") }} title={m.title} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

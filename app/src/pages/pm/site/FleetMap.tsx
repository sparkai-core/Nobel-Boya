import { useMemo, useState } from "react";
import { toneColor, useL } from "../../../components/kit";
import type { Equipment, EquipmentStatus } from "../../../ops/types";
import { CATEGORY, eqFlags, siteMeta, ZONES } from "./shared";

const W = 760;
const H = 400;

/** Zone rectangles on the stylised site plan (viewBox units). */
const RECTS: Record<string, { x: number; y: number; w: number; h: number; cols: number }> = {
  "Warehouse grid 1–9": { x: 36, y: 36, w: 408, h: 196, cols: 8 },
  "Admin building": { x: 478, y: 36, w: 236, h: 132, cols: 5 },
  "Main store": { x: 478, y: 198, w: 118, h: 96, cols: 2 },
  Workshop: { x: 612, y: 198, w: 102, h: 96, cols: 2 },
  "Site compound": { x: 236, y: 268, w: 208, h: 96, cols: 4 },
  "Main gate yard": { x: 36, y: 268, w: 176, h: 96, cols: 3 },
};
const FALLBACK = "Site compound";

const STATUS_ORDER: EquipmentStatus[] = ["ON_SITE", "IDLE", "MAINTENANCE", "BROKEN_DOWN", "AVAILABLE", "OFF_HIRE"];

/**
 * "Where the fleet is": a drawn plan of the Qobu site with every machine as a mark coloured by its state.
 * Hovering shows the machine, clicking opens it; clicking a zone or a legend entry filters the register.
 */
export function FleetMap({
  items,
  selected,
  onSelect,
  zone,
  onZone,
  status,
  onStatus,
}: {
  items: Equipment[];
  selected: string | null;
  onSelect: (id: string) => void;
  zone: string | null;
  onZone: (z: string | null) => void;
  status: EquipmentStatus | null;
  onStatus: (s: EquipmentStatus | null) => void;
}) {
  const { t, x } = useL();
  const [hover, setHover] = useState<string | null>(null);

  const placed = useMemo(() => {
    const byZone = new Map<string, Equipment[]>();
    for (const e of items) {
      const key = RECTS[e.zone.en] ? e.zone.en : FALLBACK;
      byZone.set(key, [...(byZone.get(key) ?? []), e]);
    }
    const out: { e: Equipment; cx: number; cy: number }[] = [];
    for (const [key, list] of byZone) {
      const r = RECTS[key]!;
      list.forEach((e, i) => {
        const col = i % r.cols;
        const row = Math.floor(i / r.cols);
        out.push({ e, cx: r.x + 30 + col * 44, cy: r.y + 52 + row * 40 });
      });
    }
    return out;
  }, [items]);

  const hovered = placed.find((p) => p.e.id === hover);
  const counts = STATUS_ORDER.map((st) => ({ st, n: items.filter((e) => e.status === st).length }));

  return (
    <div className="st-map">
      <div className="st-map-scroll">
        <div className="st-map-stage">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Site plan with every machine")}>
            <defs>
              <pattern id="st-map-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M16 0H0V16" fill="none" className="st-map-gridline" />
              </pattern>
              <pattern id="st-map-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" className="st-map-hatchline" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={W} height={H} fill="url(#st-map-grid)" className="st-map-bg" />
            <rect x="14" y="14" width={W - 28} height={H - 28} rx="14" className="st-map-boundary" />
            {/* access road from the gate */}
            <path d="M14 380 H 460 V 250 H 740" className="st-map-road" />
            <path d="M14 380 H 460 V 250 H 740" className="st-map-road-dash" />
            <g className="st-map-gate">
              <rect x="6" y="366" width="16" height="28" rx="3" />
              <text x="28" y="396">{t("Site gate")}</text>
            </g>

            {ZONES.map((z) => {
              const r = RECTS[z.key]!;
              const on = zone === z.key;
              const n = items.filter((e) => (RECTS[e.zone.en] ? e.zone.en : FALLBACK) === z.key).length;
              return (
                <g key={z.key} className={`st-zone${on ? " on" : ""}${zone && !on ? " dim" : ""}`} onClick={() => onZone(on ? null : z.key)} role="button" aria-pressed={on} aria-label={x(z.label)}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" className="st-zone-fill" />
                  {z.key === "Workshop" ? <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill="url(#st-map-hatch)" opacity="0.5" /> : null}
                  <text x={r.x + 12} y={r.y + 20} className="st-zone-label">
                    {x(z.label)}
                  </text>
                  <text x={r.x + r.w - 12} y={r.y + 20} textAnchor="end" className="st-zone-count">
                    {n}
                  </text>
                  {z.key === "Warehouse grid 1–9"
                    ? Array.from({ length: 9 }, (_, i) => {
                        const gx = r.x + 16 + (i * (r.w - 32)) / 8;
                        return (
                          <g key={i} className="st-zone-axis">
                            <line x1={gx} x2={gx} y1={r.y + 30} y2={r.y + r.h - 8} />
                            <text x={gx} y={r.y + r.h - 12} textAnchor="middle">
                              {i + 1}
                            </text>
                          </g>
                        );
                      })
                    : null}
                  {z.key === "Site compound"
                    ? [0, 1, 2, 3].map((i) => <rect key={i} x={r.x + 118 + i * 22} y={r.y + r.h - 22} width="16" height="12" rx="2" className="st-zone-cabin" />)
                    : null}
                </g>
              );
            })}

            {placed.map(({ e, cx, cy }, i) => {
              const meta = siteMeta("equipment", e.status);
              const Icon = CATEGORY[e.category].icon;
              const on = selected === e.id;
              const faded = status && e.status !== status;
              const flagged = eqFlags(e).length > 0;
              return (
                <g
                  key={e.id}
                  className={`st-mark${on ? " on" : ""}${faded ? " faded" : ""}${e.status === "BROKEN_DOWN" ? " alarm" : ""}`}
                  style={{ ["--mc" as string]: toneColor(meta.tone), animationDelay: `${i * 40}ms` }}
                  transform={`translate(${cx} ${cy})`}
                  onMouseEnter={() => setHover(e.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(e.id)}
                  onBlur={() => setHover(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelect(e.id);
                  }}
                  onKeyDown={(ev) => ev.key === "Enter" && onSelect(e.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${e.code} ${x(e.name)}`}
                >
                  {e.status === "BROKEN_DOWN" ? <circle r="17" className="st-mark-halo" /> : null}
                  {on ? <circle r="20" className="st-mark-ring" /> : null}
                  <circle r="15" className="st-mark-dot" />
                  <Icon x={-8} y={-8} width={16} height={16} className="st-mark-icon" strokeWidth={2.1} />
                  {e.ownership === "HIRED" ? <circle cx="11" cy="-11" r="5" className="st-mark-hire" /> : null}
                  {flagged && e.status !== "BROKEN_DOWN" ? <circle cx="11" cy="11" r="4" className="st-mark-flag" /> : null}
                  <text y="28" textAnchor="middle" className="st-mark-code">
                    {e.code}
                  </text>
                </g>
              );
            })}
          </svg>
          {hovered ? (
            <div className="st-map-tip" style={{ left: `${(hovered.cx / W) * 100}%`, top: `${(hovered.cy / H) * 100}%` }} role="tooltip">
              <strong>{x(hovered.e.name)}</strong>
              <span>
                {hovered.e.code} · {x(CATEGORY[hovered.e.category].label)} · {hovered.e.ownership === "HIRED" ? t("Hired") : t("Owned")}
              </span>
              <span className={`k-text-${siteMeta("equipment", hovered.e.status).tone}`}>{x(siteMeta("equipment", hovered.e.status).label)}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="st-map-legend" role="group" aria-label={t("Filter by state")}>
        {counts.map(({ st, n }) => {
          const meta = siteMeta("equipment", st);
          const on = status === st;
          return (
            <button key={st} type="button" className={on ? "on" : undefined} aria-pressed={on} onClick={() => onStatus(on ? null : st)} style={{ ["--mc" as string]: toneColor(meta.tone) }} disabled={!n && !on}>
              <i aria-hidden="true" />
              {x(meta.label)}
              <b className="num-inline">{n}</b>
            </button>
          );
        })}
        <span className="st-map-key">
          <i className="hire" aria-hidden="true" />
          {t("Hired")}
        </span>
      </div>
    </div>
  );
}

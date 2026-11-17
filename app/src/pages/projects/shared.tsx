import type { DemoProject, ProjectTemplate, Tool, Txt } from "../../ops/types";
import type { Tone } from "../../ops/select";
import { useL } from "../../components/kit";

export const STATUS_META: Record<DemoProject["status"], { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "brand" },
  PLANNING: { label: "Planning", tone: "info" },
  ON_HOLD: { label: "On hold", tone: "warn" },
  COMPLETED: { label: "Completed", tone: "ok" },
};

export const KIND_LABEL: Record<ProjectTemplate["kind"], string> = {
  GENERAL: "General building",
  WAREHOUSE: "Warehouse",
  VILLA: "Villa",
  HIGH_RISE: "High-rise",
  FIT_OUT: "Fit-out",
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function toolOf(name: string): Tool | null {
  const n = name.toLowerCase();
  if (n.endsWith(".xer")) return "P6";
  if (n.endsWith(".mpp")) return "MSP";
  if (n.endsWith(".xml")) return n.includes("msp") || n.includes("project") ? "MSP" : "P6";
  return null;
}

export type FileRead = { tool: Tool; activities: number; links: number; wbs: number; milestones: number; progress: number; days: number; warnings: Txt[] };

/** Deterministic "what the programme file holds" for a new project. */
export function readProgrammeFile(name: string): FileRead | null {
  const tool = toolOf(name);
  if (!tool) return null;
  const h = hash(name);
  const activities = 60 + (h % 140);
  return {
    tool,
    activities,
    links: Math.round(activities * (1.15 + (h % 20) / 100)),
    wbs: 8 + (h % 9),
    milestones: 4 + (h % 6),
    progress: h % 3 === 0 ? h % 18 : 0,
    days: 200 + (h % 220),
    warnings: [
      ...(tool === "MSP" ? [{ en: "Calendar 'Standard' mapped to a Mon–Sat week", az: "'Standard' təqvimi B.e.–Ş. həftəsinə uyğunlaşdırıldı" }] : []),
      { en: `${2 + (h % 4)} activities have no successor`, az: `${2 + (h % 4)} işin ardıcılı yoxdur` },
      ...(h % 2 ? [{ en: "Resource loading not found; resources start empty", az: "Resurs yüklənməsi tapılmadı; resurslar boş başlayır" }] : []),
    ],
  };
}

/** Mini lane chart: phases on a day axis (template "plan it gives"). */
export function LaneChart({ lanes, days, compact }: { lanes: { name: Txt; start: number; dur: number }[]; days: number; compact?: boolean }) {
  const { t, x } = useL();
  const total = Math.max(days, ...lanes.map((l) => l.start + l.dur), 1);
  const step = total > 300 ? 60 : total > 150 ? 30 : 15;
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step);
  return (
    <div className={`pp-lanes${compact ? " compact" : ""}`}>
      <div className="pp-lanes-axis" aria-hidden="true">
        {ticks.map((d) => (
          <span key={d} style={{ left: `${(d / total) * 100}%` }}>
            {t("day {n}", { n: d })}
          </span>
        ))}
      </div>
      {lanes.map((l, i) => (
        <div key={i} className="pp-lanes-row">
          <span className="pp-lanes-name truncate">{x(l.name)}</span>
          <span className="pp-lanes-track">
            {ticks.map((d) => (
              <i key={d} className="pp-lanes-grid" style={{ left: `${(d / total) * 100}%` }} />
            ))}
            <b className="k-grow-x" style={{ left: `${(l.start / total) * 100}%`, width: `${(l.dur / total) * 100}%`, animationDelay: `${i * 70}ms` }} title={`${x(l.name)}: ${t("day {a} to {b}", { a: l.start, b: l.start + l.dur })}`}>
              {compact ? null : <small className="num-inline">{t("{n}d", { n: l.dur })}</small>}
            </b>
          </span>
        </div>
      ))}
    </div>
  );
}

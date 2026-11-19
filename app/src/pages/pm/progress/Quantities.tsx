import { useMemo } from "react";
import { Boxes } from "lucide-react";
import { Panel, useL } from "../../../components/kit";
import { data } from "../../../data";
import { fmtNum, unitLabel } from "../../../lib/format";
import type { Activity } from "../../../ops/types";
import { plannedAt, weightOf } from "./shared";

const GROUPS: { key: string; label: string; unit: string; match: (rate: string) => boolean }[] = [
  { key: "conc", label: "Concrete", unit: "m³", match: (r) => r.startsWith("conc_") },
  { key: "rebar", label: "Reinforcement", unit: "kg", match: (r) => r.startsWith("rebar_") },
  { key: "steel", label: "Structural steel", unit: "kg", match: (r) => r === "steel_struct" || r === "steel_embed" },
  { key: "masonry", label: "Masonry walls", unit: "m²", match: (r) => r.startsWith("wall_limestone") || r.startsWith("wall_brick") },
  { key: "roof", label: "Roof sheeting", unit: "m²", match: (r) => r === "roof_sheet" },
];

/**
 * Installed quantities of the main measured items: BOQ quantity × the budget-weighted % complete of
 * the activities carrying that building × section, with the planned-by-today share as a marker.
 */
export function Quantities({ activities }: { activities: Activity[] }) {
  const { t, lang } = useL();
  const rows = useMemo(() => {
    const share = new Map<string, { done: number; plan: number }>();
    const keyOf = (b: string, s: string) => `${b}/${s}`;
    for (const it of data.items) {
      const k = keyOf(it.building, it.section);
      if (share.has(k)) continue;
      const acts = activities.filter((a) => a.building === it.building && a.section === it.section);
      const w = weightOf(acts);
      const bud = acts.reduce((x, a) => x + w(a), 0);
      share.set(k, bud > 0 ? { done: acts.reduce((x, a) => x + w(a) * a.pct, 0) / bud / 100, plan: acts.reduce((x, a) => x + w(a) * plannedAt(a), 0) / bud } : { done: 0, plan: 0 });
    }
    return GROUPS.map((g) => {
      const items = data.items.filter((it) => g.match(it.rate));
      const boq = items.reduce((x, it) => x + it.qty, 0);
      const done = items.reduce((x, it) => x + it.qty * (share.get(keyOf(it.building, it.section))?.done ?? 0), 0);
      const plan = items.reduce((x, it) => x + it.qty * (share.get(keyOf(it.building, it.section))?.plan ?? 0), 0);
      return { ...g, boq, done, plan, pct: boq ? done / boq : 0, planPct: boq ? plan / boq : 0 };
    }).filter((r) => r.boq > 0);
  }, [activities]);

  return (
    <Panel title={t("Quantities installed against the BOQ")} icon={<Boxes size={15} />} sub={t("Estimated from the % complete of the activities carrying each BOQ section. The tick marks what the baseline planned by today.")}>
      {!rows.length ? <p className="muted small">{t("The BOQ of this project has no concrete, reinforcement, steel, masonry or roof sheeting items to track.")}</p> : null}
      <ul className="pg-qty">
        {rows.map((r) => {
          const gap = r.pct - r.planPct;
          const tone = r.planPct === 0 && r.pct === 0 ? "muted" : gap >= -0.03 ? "ok" : gap >= -0.1 ? "warn" : "bad";
          return (
            <li key={r.key} className={`pg-qty-row k-tone-${tone}`}>
              <div className="pg-qty-top">
                <b>{t(r.label)}</b>
                <span className="num-inline">
                  <strong>{fmtNum(r.done, 0)}</strong> / {fmtNum(r.boq, 0)} {unitLabel(r.unit, lang)}
                </span>
              </div>
              <div className="pg-qty-track" title={t("Planned by today: {p}%", { p: Math.round(r.planPct * 100) })}>
                {r.planPct > r.pct ? <em style={{ left: `${r.pct * 100}%`, width: `${Math.min(100, r.planPct * 100) - r.pct * 100}%` }} /> : null}
                <i className="k-grow-x" style={{ width: `${Math.min(100, r.pct * 100)}%` }} />
                {r.planPct > 0 ? <b style={{ left: `${Math.min(100, r.planPct * 100)}%` }} /> : null}
              </div>
              <div className="pg-qty-sub">
                <span className="num-inline">{t("{p}% installed", { p: Math.round(r.pct * 100) })}</span>
                <span className="num-inline muted">{r.planPct > 0 ? t("planned {p}%", { p: Math.round(r.planPct * 100) }) : t("not due yet")}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

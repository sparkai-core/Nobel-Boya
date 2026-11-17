import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useL } from "./core";
import { useOps } from "../../ops/store";
import { unitLabel } from "../../lib/format";
import type { Line, Material, Trade } from "../../ops/types";
import { tradeName } from "../../ops/select";

export type DraftLine = Omit<Line, "key"> & { id: string };

let uid = 0;
export const newDraftLine = (m?: Material): DraftLine => ({ id: `d${++uid}`, material: m?.key ?? null, description: m?.name ?? { en: "", az: "" }, spec: null, qty: 0, unit: m?.unit ?? "ədəd" });

/**
 * Editable line items: pick a catalogued material (BOQ rates) or type free text, then qty / unit / spec.
 * Shows the BOQ budget quantity next to each catalogued line.
 */
export function LineItemsEditor({ lines, onChange, trade, showBudget = true }: { lines: DraftLine[]; onChange: (lines: DraftLine[]) => void; trade?: Trade | null; showBudget?: boolean }) {
  const { t, x, lang } = useL();
  const materials = useOps((s) => s.materials);
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const list = materials.filter((m) => !trade || m.trade === trade);
    const s = q.trim().toLowerCase();
    return (s ? list.filter((m) => m.name.en.toLowerCase().includes(s) || m.name.az.toLowerCase().includes(s)) : list).slice(0, 40);
  }, [materials, trade, q]);
  const set = (id: string, patch: Partial<DraftLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <div className="k-lines">
      <table className="k-lines-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t("Material")}</th>
            <th>{t("Spec or grade")}</th>
            <th className="r">{t("Qty")}</th>
            <th>{t("Unit")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const m = l.material ? materials.find((mm) => mm.key === l.material) : null;
            return (
              <tr key={l.id}>
                <td className="muted num-inline">{i + 1}</td>
                <td>
                  {m ? (
                    <div className="k-line-mat">
                      <strong>{x(m.name)}</strong>
                      {showBudget && m.budgetQty > 0 ? <small>{t("BOQ: {q} {u}", { q: m.budgetQty.toLocaleString("en-GB"), u: unitLabel(m.unit, lang) })}</small> : <small>{tradeName(m.trade, lang)}</small>}
                    </div>
                  ) : (
                    <input className="input" value={x(l.description)} placeholder={t("Describe the material")} onChange={(e) => set(l.id, { description: { en: e.target.value, az: e.target.value } })} />
                  )}
                </td>
                <td>
                  <input className="input" value={l.spec ?? ""} placeholder={t("e.g. B25, Ø16")} onChange={(e) => set(l.id, { spec: e.target.value || null })} />
                </td>
                <td className="r">
                  <input className="input num" type="number" min={0} step="any" value={l.qty || ""} onChange={(e) => set(l.id, { qty: Number(e.target.value) })} />
                </td>
                <td>
                  {m ? (
                    <span className="muted">{unitLabel(l.unit, lang)}</span>
                  ) : (
                    <input className="input" value={l.unit} style={{ width: 70 }} onChange={(e) => set(l.id, { unit: e.target.value })} />
                  )}
                </td>
                <td>
                  <button type="button" className="icon-btn" aria-label={t("Remove line")} onClick={() => onChange(lines.filter((x2) => x2.id !== l.id))}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="k-lines-add">
        <input className="input" list="k-materials" value={q} placeholder={t("Add a material from the BOQ catalogue…")} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const m = options.find((o) => x(o.name).toLowerCase() === q.trim().toLowerCase()) ?? options[0];
          if (m) {
            onChange([...lines, newDraftLine(m)]);
            setQ("");
          }
        }} />
        <datalist id="k-materials">
          {options.map((m) => (
            <option key={m.key} value={x(m.name)} />
          ))}
        </datalist>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const m = options.find((o) => x(o.name).toLowerCase() === q.trim().toLowerCase());
            onChange([...lines, m ? newDraftLine(m) : newDraftLine()]);
            setQ("");
          }}
        >
          <Plus size={14} />
          {t("Add line")}
        </button>
      </div>
    </div>
  );
}

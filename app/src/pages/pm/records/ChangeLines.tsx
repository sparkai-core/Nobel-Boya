import { Plus, Trash2 } from "lucide-react";
import { useL } from "../../../components/kit";
import { data } from "../../../data";
import { same } from "../../../ops/dates";
import { qtyByRateMap, rateFor } from "../../../ops/seed/util";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import { rateDesc, rateGroup } from "../../../lib/loc";
import type { ChangeOrder } from "../../../ops/types";
import { changeCost, signed } from "./shared";

export type ChangeLine = ChangeOrder["lines"][number];

const UNITS = ["m²", "m³", "m", "kg", "ədəd", "dəst"];

/** BOQ rate lines of the active project grouped by trade; lines measured in this BOQ come first. Read fresh. */
function rateGroups() {
  const used = qtyByRateMap();
  const m = new Map<string, string[]>();
  for (const [k, r] of Object.entries(data.rates ?? {})) if (!used.size || used.has(k)) m.set(r.group, [...(m.get(r.group) ?? []), k]);
  return [...m.entries()];
}

/** Change order lines: qty Δ × rate = amount. Editable while the change is a draft. */
export function ChangeLines({ lines, onChange, editable }: { lines: ChangeLine[]; onChange?: (lines: ChangeLine[]) => void; editable: boolean }) {
  const { t, x, lang } = useL();
  const total = changeCost({ lines });
  const set = (i: number, patch: Partial<ChangeLine>) => onChange?.(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const addRate = (key: string) => {
    const r = data.rates[key];
    if (!r) return;
    onChange?.([...lines, { itemId: null, description: { en: r.en, az: rateDesc(key, "az") }, unit: r.unit, qtyDelta: 0, rate: rateFor(key) }]);
  };

  return (
    <div className="pmr-lines">
      <div className="pmr-lines-wrap">
        <table className="pmr-lines-table">
          <thead>
            <tr>
              <th>{t("Description")}</th>
              <th className="r">{t("Qty change")}</th>
              <th>{t("Unit")}</th>
              <th className="r">{t("Rate")}</th>
              <th className="r">{t("Amount")}</th>
              {editable ? <th aria-label={t("Remove line")} /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const amt = l.qtyDelta * l.rate;
              return (
                <tr key={i}>
                  <td>
                    {editable ? (
                      <input className="input" value={x(l.description)} onChange={(e) => set(i, { description: same(e.target.value) })} aria-label={t("Description")} />
                    ) : (
                      x(l.description)
                    )}
                  </td>
                  <td className="r">
                    {editable ? (
                      <input className="input num pmr-num" type="number" step="any" value={l.qtyDelta} onChange={(e) => set(i, { qtyDelta: Number(e.target.value) || 0 })} aria-label={t("Qty change")} />
                    ) : (
                      <span className="num-inline">{signed(l.qtyDelta, (n) => fmtQty(n, l.unit))}</span>
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <select className="input select pmr-unit" value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} aria-label={t("Unit")}>
                        {[...new Set([l.unit, ...UNITS])].map((u) => (
                          <option key={u} value={u}>
                            {unitLabel(u, lang)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      unitLabel(l.unit, lang)
                    )}
                  </td>
                  <td className="r">
                    {editable ? (
                      <input className="input num pmr-num" type="number" step="any" min={0} value={l.rate} onChange={(e) => set(i, { rate: Math.max(0, Number(e.target.value) || 0) })} aria-label={t("Rate")} />
                    ) : (
                      <span className="num-inline">{fmtMoney(l.rate)}</span>
                    )}
                  </td>
                  <td className={`r num-inline ${amt > 0 ? "k-text-bad" : amt < 0 ? "k-text-ok" : ""}`}>{signed(amt, fmtMoney)}</td>
                  {editable ? (
                    <td className="r">
                      <button type="button" className="icon-btn" onClick={() => onChange?.(lines.filter((_, j) => j !== i))} aria-label={t("Remove line")}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {!lines.length ? (
              <tr>
                <td colSpan={editable ? 6 : 5} className="muted small pmr-lines-empty">
                  {t("No lines yet. Add a BOQ rate or a blank line.")}
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>{t("Cost change")}</td>
              <td className={`r num-inline ${total > 0 ? "k-text-bad" : total < 0 ? "k-text-ok" : ""}`}>
                {signed(total, fmtMoney)} <small className="k-cur">AZN</small>
              </td>
              {editable ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
      {editable ? (
        <div className="pmr-lines-add">
          <select className="input select" value="" onChange={(e) => e.target.value && addRate(e.target.value)} aria-label={t("Add a line from a BOQ rate")}>
            <option value="">{t("Add a line from a BOQ rate…")}</option>
            {rateGroups().map(([g, keys]) => (
              <optgroup key={g} label={rateGroup(g, lang)}>
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {rateDesc(k, lang)} · {fmtMoney(rateFor(k))} / {unitLabel(data.rates[k]!.unit, lang)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange?.([...lines, { itemId: null, description: same(""), unit: "m²", qtyDelta: 0, rate: 0 }])}>
            <Plus size={13} />
            {t("Blank line")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

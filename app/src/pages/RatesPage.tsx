import { Fragment, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney, fmtNum, fmtQty, unitLabel } from "../lib/format";
import { DEFAULT_MARKUPS, useApp, type Markups } from "../lib/store";
import { PageHead } from "../components/Shell";

const MARKUP_LABEL: Record<keyof Markups, string> = {
  overheads: "Overheads",
  profit: "Profit",
  contingency: "Contingency",
  vat: "VAT",
};

export function RatesPage() {
  const boq = useBoq();
  const rates = useApp((s) => s.rates);
  const markups = useApp((s) => s.markups);
  const setRate = useApp((s) => s.setRate);
  const setMarkup = useApp((s) => s.setMarkup);
  const resetPricing = useApp((s) => s.resetPricing);
  const edited = Object.keys(rates).length;
  const markupEdited = (Object.keys(markups) as (keyof Markups)[]).some((k) => markups[k] !== DEFAULT_MARKUPS[k]);

  const rows = useMemo(() => {
    const usage = new Map<string, { qty: number; amount: number; lines: number }>();
    for (const l of boq.lines) {
      const u = usage.get(l.rateKey) ?? { qty: 0, amount: 0, lines: 0 };
      u.qty += l.qty;
      u.amount += l.amount;
      u.lines += 1;
      usage.set(l.rateKey, u);
    }
    const groups = new Map<string, { key: string; en: string; unit: string; sample: number; usage: { qty: number; amount: number; lines: number } }[]>();
    for (const [key, r] of Object.entries(data.rates)) {
      const u = usage.get(key);
      if (!u) continue;
      const list = groups.get(r.group) ?? [];
      list.push({ key, en: r.en, unit: r.unit, sample: r.rate, usage: u });
      groups.set(r.group, list);
    }
    return [...groups.entries()];
  }, [boq.lines]);

  return (
    <div className="page">
      <PageHead
        title="Rates and mark-ups"
        lead="The package has no prices. These are sample AZN rates so the bill can be totalled. Edit any rate and every line that uses it updates. Changes stay in this browser."
        actions={
          edited || markupEdited ? (
            <button type="button" className="btn btn-ghost" onClick={resetPricing}>
              <RotateCcw size={15} /> Reset to sample rates
            </button>
          ) : null
        }
      />

      <section className="panel markups">
        <header className="panel-head">
          <h2>Mark-ups, in calculation order</h2>
          <span className="muted small">Each step applies to the running total above it</span>
        </header>
        <div className="markup-grid">
          {(Object.keys(MARKUP_LABEL) as (keyof Markups)[]).map((k) => {
            const step = boq.chain.find((c) => c.key === k)!;
            return (
              <label key={k} className="markup">
                <span className="figure-label">{MARKUP_LABEL[k]}</span>
                <span className="markup-input">
                  <PercentInput value={markups[k]} onChange={(v) => setMarkup(k, v)} />
                  <span className="muted">%</span>
                </span>
                <span className="num muted small">{fmtMoney(step.amount)} AZN</span>
              </label>
            );
          })}
          <div className="markup total">
            <span className="figure-label">Total including VAT</span>
            <span className="figure-value num">{fmtMoney(boq.total)}</span>
            <span className="muted small">AZN</span>
          </div>
        </div>
      </section>

      <div className="rates-table scroll">
        <table className="boq rates">
          <thead>
            <tr>
              <th scope="col">Rate</th>
              <th scope="col">Unit</th>
              <th scope="col" className="num">
                Lines
              </th>
              <th scope="col" className="num">
                Quantity
              </th>
              <th scope="col" className="num">
                Sample
              </th>
              <th scope="col" className="num">
                Rate used
              </th>
              <th scope="col" className="num">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([group, list]) => (
              <Fragment key={group}>
                <tr className="row-section">
                  <td colSpan={6}>{group}</td>
                  <td className="num">{fmtMoney(list.reduce((a, r) => a + r.usage.amount, 0))}</td>
                </tr>
                {list.map((r) => (
                  <tr key={r.key} className="row-line">
                    <td className="desc">{r.en}</td>
                    <td className="unit">{unitLabel(r.unit, "en")}</td>
                    <td className="num muted">{r.usage.lines}</td>
                    <td className="num">{fmtQty(r.usage.qty, r.unit)}</td>
                    <td className="num muted">{fmtNum(r.sample)}</td>
                    <td className="num">
                      <RateInput value={rates[r.key] ?? r.sample} edited={rates[r.key] != null} onChange={(v) => setRate(r.key, v === r.sample ? null : v)} />
                    </td>
                    <td className="num amount">{fmtMoney(r.usage.amount)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RateInput({ value, edited, onChange }: { value: number; edited: boolean; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className={`input input-cell num${edited ? " edited" : ""}`}
      inputMode="decimal"
      value={draft ?? fmtNum(value)}
      onFocus={(e) => {
        setDraft(String(value));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = Number(String(draft).replace(",", "."));
        if (draft != null && Number.isFinite(v) && v >= 0) onChange(v);
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      aria-label="Rate"
    />
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="input num"
      inputMode="decimal"
      value={draft ?? fmtNum(value * 100, 1)}
      onFocus={(e) => {
        setDraft(String(Math.round(value * 1000) / 10));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = Number(String(draft).replace(",", "."));
        if (draft != null && Number.isFinite(v) && v >= 0 && v < 100) onChange(v / 100);
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

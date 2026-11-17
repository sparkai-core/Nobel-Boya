import { Fragment, useMemo, useState } from "react";
import { RotateCcw, Upload, CheckCircle2, Plus, X } from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney, fmtNum, fmtQty, unitLabel } from "../lib/format";
import { DEFAULT_MARKUPS, useApp, type Markups } from "../lib/store";
import { PageHead } from "../components/Shell";
import { chainLabel, rateDesc, rateGroup } from "../lib/loc";
import { useT } from "../lib/i18n";
import { uploadRates, updateManualRate } from "../lib/api";

const MARKUP_LABEL: Record<keyof Markups, string> = {
  overheads: "Overheads",
  profit: "Profit",
  contingency: "Contingency",
  vat: "VAT",
};

export function RatesPage() {
  const t = useT();
  const boq = useBoq();
  const rates = useApp((s) => s.rates);
  const activeProjectId = useApp((s) => s.activeProjectId);
  const mergeServerRates = useApp((s) => s.mergeServerRates);
  const addRateItem = useApp((s) => s.addRateItem);
  const lang = useApp((s) => s.lang);
  const markups = useApp((s) => s.markups);
  const setRate = useApp((s) => s.setRate);
  const setMarkup = useApp((s) => s.setMarkup);
  const resetPricing = useApp((s) => s.resetPricing);
  const edited = Object.keys(rates).length;
  const markupEdited = (Object.keys(markups) as (keyof Markups)[]).some((k) => markups[k] !== DEFAULT_MARKUPS[k]);

  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAllRates, setShowAllRates] = useState(false);

  const handleRatesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      if (!activeProjectId) throw new Error(t("Open a project first."));
      const res = await uploadRates(activeProjectId, file);
      mergeServerRates(res.rates || {});
      const rep = res.report || {};
      const parts = [
        t("{n} updated", { n: (rep.updated || []).length }),
        t("{n} added", { n: (rep.added || []).length }),
      ];
      if (rep.unchanged) parts.push(t("{n} unchanged", { n: rep.unchanged }));
      if ((rep.skipped || []).length) parts.push(t("{n} rows skipped", { n: rep.skipped.length }));
      if ((rep.conflicts || []).length) parts.push(t("{n} unit conflicts not applied", { n: rep.conflicts.length }));
      const detail = [...(rep.skipped || []), ...(rep.conflicts || [])]
        .slice(0, 3)
        .map((x: any) => t("row {r}: {why}", { r: x.row, why: x.reason }))
        .join("; ");
      setUploadMsg(`${file.name}: ${parts.join(", ")}${detail ? ` (${detail})` : ""}`);
    } catch (err: any) {
      alert(err.message || "Failed to upload rates");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

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
    for (const [key, r] of Object.entries(data.rates || {})) {
      const u = usage.get(key);
      if (!u && !showAllRates) continue;
      const list = groups.get(r.group || "Other") ?? [];
      list.push({
        key,
        en: r.en,
        unit: r.unit,
        sample: r.rate,
        usage: u || { qty: 0, amount: 0, lines: 0 }
      });
      groups.set(r.group || "Other", list);
    }
    return [...groups.entries()];
  }, [boq.lines, showAllRates, data.rates]);

  return (
    <div className="page">
      <PageHead
        title={t("Rates and mark-ups")}
        lead={t("Rates come from the project rate library: the sample AZN rates, plus any rate schedule you upload. Lines read from the drawings that match no rate show 0.00 until you price them. Edits are saved to the project.")}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <Plus size={15} />
              <span>{t("Add Rate")}</span>
            </button>

            <label className="btn btn-outline" style={{ cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Upload size={15} />
              <span>{uploading ? t("Importing...") : t("Upload Rates (CSV / Excel)")}</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleRatesUpload} style={{ display: "none" }} />
            </label>

            {uploadMsg ? (
              <span className="ok-text small" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(16, 185, 129, 0.1)", padding: "4px 8px", borderRadius: 4, color: "#059669" }}>
                <CheckCircle2 size={14} /> {uploadMsg}
              </span>
            ) : null}

            {edited || markupEdited ? (
              <button type="button" className="btn btn-ghost" onClick={resetPricing}>
                <RotateCcw size={15} /> {t("Reset to sample rates")}
              </button>
            ) : null}
          </div>
        }
      />

      <section className="panel markups">
        <header className="panel-head">
          <h2>{t("Mark-ups, in calculation order")}</h2>
          <span className="muted small">{t("Each step applies to the running total above it")}</span>
        </header>
        <div className="markup-grid">
          {(Object.keys(MARKUP_LABEL) as (keyof Markups)[]).map((k) => {
            const step = boq.chain.find((c) => c.key === k)!;
            return (
              <label key={k} className="markup">
                <span className="figure-label">{chainLabel(k, MARKUP_LABEL[k], lang)}</span>
                <span className="markup-input">
                  <PercentInput value={markups[k]} onChange={(v) => setMarkup(k, v)} />
                  <span className="muted">%</span>
                </span>
                <span className="num muted small">{fmtMoney(step.amount)} AZN</span>
              </label>
            );
          })}
          <div className="markup total">
            <span className="figure-label">{t("Total including VAT")}</span>
            <span className="figure-value num">{fmtMoney(boq.total)}</span>
            <span className="muted small">AZN</span>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${!showAllRates ? "btn-primary" : "btn-outline"}`}
            onClick={() => setShowAllRates(false)}
          >
            {t("Used in Bill")} ({boq.lines.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${showAllRates ? "btn-primary" : "btn-outline"}`}
            onClick={() => setShowAllRates(true)}
          >
            {t("All Library Rates")} ({Object.keys(data.rates || {}).length})
          </button>
        </div>
        <span className="muted small">
          {t("Click any cell under 'Rate used' to adjust rate manually")}
        </span>
      </div>

      <div className="rates-table scroll">
        <table className="boq rates">
          <thead>
            <tr>
              <th scope="col">{t("Rate")}</th>
              <th scope="col">{t("Unit")}</th>
              <th scope="col" className="num">
                {t("Lines")}
              </th>
              <th scope="col" className="num">
                {t("Quantity")}
              </th>
              <th scope="col" className="num">
                {t("Sample")}
              </th>
              <th scope="col" className="num">
                {t("Rate used")}
              </th>
              <th scope="col" className="num">
                {t("Amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([group, list]) => (
              <Fragment key={group}>
                <tr className="row-section">
                  <td colSpan={6}>{rateGroup(group, lang)}</td>
                  <td className="num">{fmtMoney(list.reduce((a, r) => a + r.usage.amount, 0))}</td>
                </tr>
                {list.map((r) => (
                  <tr key={r.key} className="row-line">
                    <td className="desc">{rateDesc(r.key, lang)}</td>
                    <td className="unit">{unitLabel(r.unit, lang)}</td>
                    <td className="num muted">{r.usage.lines || "—"}</td>
                    <td className="num">{r.usage.qty > 0 ? fmtQty(r.usage.qty, r.unit) : "—"}</td>
                    <td className="num muted">{fmtNum(r.sample)}</td>
                    <td className="num">
                      <RateInput
                        value={rates[r.key] ?? r.sample}
                        edited={rates[r.key] != null}
                        onChange={(v) => {
                          setRate(r.key, v === r.sample ? null : v);
                          if (activeProjectId) {
                            updateManualRate(activeProjectId, { key: r.key, rate: v }).catch((err) => alert(err.message || "The rate was not saved."));
                          }
                        }}
                      />
                    </td>
                    <td className="num amount">{r.usage.amount > 0 ? fmtMoney(r.usage.amount) : "—"}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <AddRateModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={(key, item) => {
          addRateItem(key, item);
          setUploadMsg(t("Added rate: {r} ({v} AZN/{u})", { r: item.en, v: item.rate, u: item.unit }));
        }}
      />
    </div>
  );
}

function AddRateModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (key: string, item: any) => void;
}) {
  const t = useT();
  const activeProjectId = useApp((s) => s.activeProjectId);
  const [desc, setDesc] = useState("");
  const [group, setGroup] = useState("Concrete works");
  const [unit, setUnit] = useState("m³");
  const [rateVal, setRateVal] = useState("180.00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) {
      setError(t("Please enter a description for the rate"));
      return;
    }
    const num = parseFloat(rateVal.replace(",", "."));
    if (isNaN(num) || num < 0) {
      setError(t("Please enter a valid numeric rate"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await updateManualRate(activeProjectId, {
        en: desc.trim(),
        az: desc.trim(),
        group,
        unit,
        rate: num,
      });
      onAdded(res.key, res.rate);
      onClose();
    } catch (err: any) {
      setError(err.message || t("Failed to save rate"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <header className="modal-head">
          <div>
            <h2>{t("Add Commercial Rate")}</h2>
            <p className="muted small">{t("Add a new pricing item to this project's rate schedule.")}</p>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} aria-label={t("Close")}>
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: "grid", gap: 14 }}>
          {error ? (
            <div className="alert alert-bad" style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          <label className="field">
            <span>{t("Description / Item Name")} *</span>
            <input
              className="input"
              placeholder={t("e.g. Reinforced concrete C30/37")}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              required
              autoFocus
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field">
              <span>{t("Trade Group")}</span>
              <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="Concrete works">Concrete works</option>
                <option value="Reinforcement">Reinforcement</option>
                <option value="Masonry">Masonry</option>
                <option value="Finishes">Finishes</option>
                <option value="Structural steelwork">Structural steelwork</option>
                <option value="Roofing and cladding">Roofing and cladding</option>
                <option value="Doors and windows">Doors and windows</option>
                <option value="Earthworks">Earthworks</option>
                <option value="Custom rates">Custom rates</option>
              </select>
            </label>

            <label className="field">
              <span>{t("Unit")}</span>
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="m³">m³</option>
                <option value="m²">m²</option>
                <option value="kg">kg</option>
                <option value="t">t</option>
                <option value="m">m</option>
                <option value="no">no</option>
                <option value="pcs">pcs</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>{t("Unit Rate (AZN)")} *</span>
            <input
              className="input num"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={rateVal}
              onChange={(e) => setRateVal(e.target.value)}
              required
            />
          </label>

          <footer className="modal-foot" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              {t("Cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t("Saving...") : t("Add to Schedule")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function RateInput({ value, edited, onChange }: { value: number; edited: boolean; onChange: (v: number) => void }) {
  const t = useT();
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
      aria-label={t("Rate")}
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

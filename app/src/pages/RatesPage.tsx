import { Fragment, useMemo, useState } from "react";
import { RotateCcw, Search, Tag } from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney, fmtNum, fmtQty, unitLabel } from "../lib/format";
import { DEFAULT_MARKUPS, useApp, type Markups } from "../lib/store";
import { t } from "../lib/i18n";
import { PageHead } from "../components/Shell";

export function RatesPage() {
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const rates = useApp((s) => s.rates);
  const markups = useApp((s) => s.markups);
  const setRate = useApp((s) => s.setRate);
  const setMarkup = useApp((s) => s.setMarkup);
  const resetPricing = useApp((s) => s.resetPricing);

  const [query, setQuery] = useState("");
  const editedCount = Object.keys(rates).length;
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
    const groups = new Map<
      string,
      { key: string; en: string; unit: string; sample: number; usage: { qty: number; amount: number; lines: number } }[]
    >();

    const q = query.trim().toLowerCase();

    for (const [key, r] of Object.entries(data.rates)) {
      const u = usage.get(key);
      if (!u) continue;
      if (q && !`${r.en} ${r.group} ${key}`.toLowerCase().includes(q)) continue;

      const list = groups.get(r.group) ?? [];
      list.push({ key, en: r.en, unit: r.unit, sample: r.rate, usage: u });
      groups.set(r.group, list);
    }
    return [...groups.entries()];
  }, [boq.lines, query]);

  const tierMeta: Record<keyof Markups, { enName: string; azName: string; color: string; descEn: string; descAz: string }> = {
    overheads: {
      enName: "Site Overheads & Preliminaries",
      azName: "Ümumi Tikinti Əlavələri (İnşaat Sahəsi)",
      color: "var(--graphite)",
      descEn: "Site accommodation, plant cranes, welfare facilities & site management staff",
      descAz: "Tikinti meydançası xərcləri, kran xərcləri, müvəqqəti binalar və idarəetmə heyəti",
    },
    profit: {
      enName: "Contractor Profit Margin",
      azName: "Podratçının Plan Qazancı",
      color: "var(--stamp)",
      descEn: "Standard general contractor target operating margin applied over subtotal",
      descAz: "Əsas tikinti podratçısının smeta üzrə təsdiq olunmuş mənfəət norması",
    },
    contingency: {
      enName: "Unforeseen Contingency Reserve",
      azName: "Nəzərdə Tutulmamış Xərclər Ehtiyatı",
      color: "var(--muted)",
      descEn: "Risk buffer for working design geotechnical & civil uncertainties",
      descAz: "Geoloji və topoqrafik qeyri-müəyyənliklər üçün ayrılmış risk ehtiyatı",
    },
    vat: {
      enName: "Statutory State VAT",
      azName: "Dövlət Əlavə Dəyər Vergisi (ƏDV)",
      color: "var(--emerald)",
      descEn: "Official Azerbaijani statutory value-added tax levied on cumulative sum",
      descAz: "Azərbaycan Respublikası Vergi Məcəlləsinə uyğun 18% dövlət vergisi",
    },
  };

  const directWorksTotal = boq.works;
  const grossTotal = boq.total;
  const markupUplift = grossTotal - directWorksTotal;

  return (
    <div className="page page-rates modern-rates-page">
      <PageHead
        title={t("ratesTitle", lang)}
        lead={t("ratesLead", lang)}
        actions={
          editedCount || markupEdited ? (
            <button
              type="button"
              className="btn btn-outline btn-sm reset-pricing-btn"
              onClick={resetPricing}
              title="Reset all customized rates and markups to project defaults"
            >
              <RotateCcw size={14} />
              <span>{t("resetPricingBtn", lang)}</span>
            </button>
          ) : null
        }
      />

      {/* Top Architectural Valuation Strip */}
      <div className="rates-kpi-strip">
        <div className="rates-kpi-card">
          <span className="rates-kpi-label">{lang === "az" ? "Birbaşa Tikinti İşləri Bazası" : "Direct Works Baseline"}</span>
          <div className="rates-kpi-val num">{fmtMoney(directWorksTotal)} <span className="rates-kpi-cur">AZN</span></div>
          <span className="rates-kpi-sub">{lang === "az" ? "117 yoxlanılmış iş bəndi üzrə cəm" : "Calculated across 117 verified lines"}</span>
        </div>

        <div className="rates-kpi-card highlight-bronze">
          <span className="rates-kpi-label">{lang === "az" ? "Dövlət Əlavələri Cəmi" : "Statutory Mark-up Uplift"}</span>
          <div className="rates-kpi-val num amount-bronze">+{fmtMoney(markupUplift)} <span className="rates-kpi-cur">AZN</span></div>
          <span className="rates-kpi-sub">{lang === "az" ? "4 ardıcıl pillə (+41.8% məcmu)" : "4 sequential tiers (+41.8% cumulative)"}</span>
        </div>

        <div className="rates-kpi-card highlight-obsidian">
          <span className="rates-kpi-label">{lang === "az" ? "Yekun Müqavilə Qiyməti (ƏDV daxil)" : "Total Contract Valuation (incl. VAT)"}</span>
          <div className="rates-kpi-val num text-white">{fmtMoney(grossTotal)} <span className="rates-kpi-cur">AZN</span></div>
          <span className="rates-kpi-sub text-faint">{lang === "az" ? "Sifarişçiyə təqdim olunan yekun smeta" : "Final executive tender submission"}</span>
        </div>
      </div>

      {/* 4 Sequential Statutory Mark-up Tiers */}
      <section className="rates-tiers-panel">
        <div className="rates-panel-header">
          <div>
            <h2 className="rates-panel-title">{t("statutoryTiersHead", lang)}</h2>
            <p className="rates-panel-sub">{t("statutoryTiersSub", lang)}</p>
          </div>
          <span className="rates-badge-tag">AZ-AZS 2026</span>
        </div>

        <div className="rates-tiers-grid">
          {(Object.keys(tierMeta) as (keyof Markups)[]).map((k) => {
            const step = boq.chain.find((c) => c.key === k)!;
            const meta = tierMeta[k];
            const isCustom = markups[k] !== DEFAULT_MARKUPS[k];

            return (
              <div key={k} className={`rates-tier-card${isCustom ? " custom-tier" : ""}`}>
                <div className="tier-top-row">
                  <span className="tier-name">{lang === "az" ? meta.azName : meta.enName}</span>
                  {isCustom ? <span className="tier-custom-badge">Modified</span> : null}
                </div>

                <p className="tier-desc">{lang === "az" ? meta.descAz : meta.descEn}</p>

                <div className="tier-input-row">
                  <div className="tier-pct-box">
                    <PercentInput value={markups[k]} onChange={(v) => setMarkup(k, v)} />
                    <span className="tier-pct-sym">%</span>
                  </div>
                  <div className="tier-amount-wrap">
                    <span className="tier-sub-amount num">+{fmtMoney(step.amount)} AZN</span>
                    <span className="tier-base-ref">on {fmtMoney(step.base)}</span>
                  </div>
                </div>

                <div className="tier-progress-track">
                  <div
                    className="tier-progress-bar"
                    style={{
                      width: `${Math.min(100, markups[k] * 320)}%`,
                      backgroundColor: meta.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Unit Rates Library Table */}
      <section className="rates-library-panel">
        <div className="rates-panel-header">
          <div>
            <h2 className="rates-panel-title">{lang === "az" ? "Vahid Qiymətlər Bazası" : "Unit Rate Catalog & Overrides"}</h2>
            <p className="rates-panel-sub">
              {lang === "az"
                ? `${rows.reduce((a, [, l]) => a + l.length, 0)} vahid qiymət kodu • İstənilən qiyməti redaktə edin`
                : `${rows.reduce((a, [, l]) => a + l.length, 0)} rate specifications • Click any rate cell to customize`}
            </p>
          </div>

          <div className="rates-search-box">
            <Search size={14} className="rates-search-icon" />
            <input
              type="text"
              className="rates-search-input"
              placeholder={lang === "az" ? "Qiymət təsviri və ya qrup üzrə axtarış..." : "Filter rates by description, group or code..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="rates-table-wrap scroll">
          <table className="boq rates modern-rates-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: "38%" }}>{t("colRateDesc", lang)}</th>
                <th scope="col" style={{ width: "9%" }}>{t("colUnit", lang)}</th>
                <th scope="col" className="num" style={{ width: "8%" }}>{t("colLinesCount", lang)}</th>
                <th scope="col" className="num" style={{ width: "13%" }}>{t("colTotalQty", lang)}</th>
                <th scope="col" className="num" style={{ width: "11%" }}>{t("colBaseRate", lang)}</th>
                <th scope="col" className="num" style={{ width: "11%" }}>{t("colActiveRate", lang)}</th>
                <th scope="col" className="num" style={{ width: "10%" }}>{t("colSubtotal", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([group, list]) => {
                const groupSum = list.reduce((a, r) => a + r.usage.amount, 0);

                return (
                  <Fragment key={group}>
                    <tr className="rates-group-row">
                      <td colSpan={6}>
                        <div className="group-title-cell">
                          <Tag size={13} className="text-bronze" />
                          <strong>{group}</strong>
                          <span className="group-count-badge">{list.length}</span>
                        </div>
                      </td>
                      <td className="num group-total-cell font-mono font-bold">
                        {fmtMoney(groupSum)} AZN
                      </td>
                    </tr>
                    {list.map((r) => {
                      const isEdited = rates[r.key] != null;

                      return (
                        <tr key={r.key} className={`rates-data-row${isEdited ? " row-edited" : ""}`}>
                          <td className="desc">
                            <div className="rate-desc-cell">
                              <span className="rate-title">{r.en}</span>
                              <span className="rate-key-sub font-mono">{r.key}</span>
                            </div>
                          </td>
                          <td className="unit">
                            <span className="rates-unit-badge">{unitLabel(r.unit, lang)}</span>
                          </td>
                          <td className="num muted font-mono">{r.usage.lines}</td>
                          <td className="num font-mono">{fmtQty(r.usage.qty, r.unit)}</td>
                          <td className="num muted font-mono">{fmtNum(r.sample, 2)}</td>
                          <td className="num">
                            <div className="rate-input-cell-wrap">
                              <RateInput
                                value={rates[r.key] ?? r.sample}
                                edited={isEdited}
                                onChange={(v) => setRate(r.key, v === r.sample ? null : v)}
                              />
                              {isEdited ? (
                                <button
                                  type="button"
                                  className="rate-reset-icon-btn"
                                  title={`Reset to base rate (${fmtNum(r.sample, 2)})`}
                                  onClick={() => setRate(r.key, null)}
                                >
                                  <RotateCcw size={12} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className="num amount font-mono font-bold">{fmtMoney(r.usage.amount)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RateInput({ value, edited, onChange }: { value: number; edited: boolean; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className={`input input-cell num${edited ? " edited" : ""}`}
      inputMode="decimal"
      value={draft ?? fmtNum(value, 2)}
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
      className="input tier-pct-input num"
      inputMode="decimal"
      value={draft ?? fmtNum(value * 100, 2)}
      onFocus={(e) => {
        setDraft(String(Math.round(value * 10000) / 100));
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

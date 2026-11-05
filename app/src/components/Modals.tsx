import { Command, Globe, Keyboard, Percent, RotateCcw, Settings, ShieldCheck, X } from "lucide-react";
import { useBoq } from "../lib/boq";
import { fmtMoney, pct } from "../lib/format";
import { DEFAULT_MARKUPS, useApp } from "../lib/store";
import { t } from "../lib/i18n";

export function Modals() {
  const showSettings = useApp((s) => s.showSettings);
  const setShowSettings = useApp((s) => s.setShowSettings);
  const showShortcuts = useApp((s) => s.showShortcuts);
  const setShowShortcuts = useApp((s) => s.setShowShortcuts);

  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const user = useApp((s) => s.user);
  const markups = useApp((s) => s.markups);
  const setMarkup = useApp((s) => s.setMarkup);
  const boq = useBoq();

  return (
    <>
      {/* 1. Platform Settings Modal */}
      {showSettings ? (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal-dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge badge-cobalt">
                  <Settings size={18} />
                </div>
                <div>
                  <h2 className="modal-title">{t("platformSettings", lang)}</h2>
                  <span className="modal-sub">{t("settingsSub", lang)}</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSettings(false)}
                title="Close settings (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scroll">
              {/* Live Contract Valuation Summary Banner */}
              <div className="settings-summary-banner">
                <div className="summary-left">
                  <span className="summary-label">{lang === "az" ? "Yekun Müqavilə Dəyəri (ƏDV daxil)" : "Total Contract Valuation (incl. VAT)"}</span>
                  <div className="summary-val num">{fmtMoney(boq.total)} AZN</div>
                </div>
                <div className="summary-right">
                  <span className="summary-sub">{lang === "az" ? "Birbaşa İşlər Bazası:" : "Direct Works Baseline:"}</span>
                  <strong className="summary-works num">{fmtMoney(boq.works)} AZN</strong>
                </div>
              </div>

              {/* Section 1: Commercial Mark-up Percentages */}
              <div className="settings-section">
                <div className="section-head">
                  <Percent size={15} className="section-icon" />
                  <h3 className="section-title">{t("commercialStructure", lang)}</h3>
                  <button
                    type="button"
                    className="section-reset-btn"
                    onClick={() => {
                      setMarkup("overheads", DEFAULT_MARKUPS.overheads);
                      setMarkup("profit", DEFAULT_MARKUPS.profit);
                      setMarkup("contingency", DEFAULT_MARKUPS.contingency);
                      setMarkup("vat", DEFAULT_MARKUPS.vat);
                    }}
                    title="Reset to default tender baseline"
                  >
                    <RotateCcw size={12} />
                    <span>{t("resetDefaults", lang)}</span>
                  </button>
                </div>

                <div className="settings-sliders-grid">
                  {/* Overheads */}
                  <div className="setting-slider-item">
                    <div className="slider-label-row">
                      <span className="setting-name">{lang === "az" ? "Ümumi Tikinti Əlavələri" : "Site Overheads & Preliminaries"}</span>
                      <span className="setting-pct num">{pct(markups.overheads, 1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.20"
                      step="0.005"
                      value={markups.overheads}
                      onChange={(e) => setMarkup("overheads", parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <div className="slider-range-limits">
                      <span>0%</span>
                      <span>{lang === "az" ? "Baza: 8.0%" : "Tender: 8.0%"}</span>
                      <span>20%</span>
                    </div>
                  </div>

                  {/* Profit */}
                  <div className="setting-slider-item">
                    <div className="slider-label-row">
                      <span className="setting-name">{lang === "az" ? "Podratçının Plan Qazancı" : "Contractor Profit Margin"}</span>
                      <span className="setting-pct num">{pct(markups.profit, 1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.15"
                      step="0.005"
                      value={markups.profit}
                      onChange={(e) => setMarkup("profit", parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <div className="slider-range-limits">
                      <span>0%</span>
                      <span>{lang === "az" ? "Norma: 6.0%" : "Standard: 6.0%"}</span>
                      <span>15%</span>
                    </div>
                  </div>

                  {/* Contingency */}
                  <div className="setting-slider-item">
                    <div className="slider-label-row">
                      <span className="setting-name">{lang === "az" ? "Nəzərdə Tutulmamış Xərclər" : "Unforeseen Contingency Reserve"}</span>
                      <span className="setting-pct num">{pct(markups.contingency, 1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.15"
                      step="0.005"
                      value={markups.contingency}
                      onChange={(e) => setMarkup("contingency", parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <div className="slider-range-limits">
                      <span>0%</span>
                      <span>{lang === "az" ? "Dövlət: 5.0%" : "Statutory: 5.0%"}</span>
                      <span>15%</span>
                    </div>
                  </div>

                  {/* VAT */}
                  <div className="setting-slider-item">
                    <div className="slider-label-row">
                      <span className="setting-name">{lang === "az" ? "Dövlət Əlavə Dəyər Vergisi (ƏDV)" : "Statutory State VAT"}</span>
                      <span className="setting-pct num">{pct(markups.vat, 1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.25"
                      step="0.01"
                      value={markups.vat}
                      onChange={(e) => setMarkup("vat", parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <div className="slider-range-limits">
                      <span>0%</span>
                      <span>{lang === "az" ? "AR Standartı: 18.0%" : "Azerbaijan Standard: 18.0%"}</span>
                      <span>25%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Nomenclature & Localization */}
              <div className="settings-section">
                <div className="section-head">
                  <Globe size={15} className="section-icon" />
                  <h3 className="section-title">{t("languageNorms", lang)}</h3>
                </div>

                <div className="settings-lang-row">
                  <div className="lang-option-card">
                    <label className="lang-label">
                      <input
                        type="radio"
                        name="lang-choice"
                        checked={lang === "en"}
                        onChange={() => setLang("en")}
                      />
                      <div className="lang-info">
                        <strong>English Engineering Norms</strong>
                        <span>Standard international quantity surveying terminology (Default)</span>
                      </div>
                    </label>
                  </div>

                  <div className="lang-option-card">
                    <label className="lang-label">
                      <input
                        type="radio"
                        name="lang-choice"
                        checked={lang === "az"}
                        onChange={() => setLang("az")}
                      />
                      <div className="lang-info">
                        <strong>Azərbaycan Dövlət Şəhərsalma Normaları</strong>
                        <span>Orijinal işçi layihə və smeta nomenklaturası</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 3: Surveyor & Project Specs */}
              <div className="settings-section">
                <div className="section-head">
                  <ShieldCheck size={15} className="section-icon" />
                  <h3 className="section-title">{t("surveyorProfile", lang)}</h3>
                </div>

                <div className="settings-profile-grid">
                  <div className="profile-spec-item">
                    <span className="spec-label">{lang === "az" ? "Baş Smetaçı Mühəndis:" : "Lead Quantity Surveyor:"}</span>
                    <strong className="spec-val">{user?.name || "Elmir Məmmədov"}</strong>
                  </div>
                  <div className="profile-spec-item">
                    <span className="spec-label">{lang === "az" ? "Layihəçi Təşkilat:" : "Design Organization:"}</span>
                    <strong className="spec-val">"Storm Building" MMC</strong>
                  </div>
                  <div className="profile-spec-item">
                    <span className="spec-label">{lang === "az" ? "Baş Layihə Mühəndisi:" : "Chief Project Engineer:"}</span>
                    <strong className="spec-val">G. Musayeva</strong>
                  </div>
                  <div className="profile-spec-item">
                    <span className="spec-label">{lang === "az" ? "Layihə Mərhələsi:" : "Project Stage:"}</span>
                    <strong className="spec-val">{lang === "az" ? "İşçi Layihə (2026)" : "Working Design (2026)"}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <span className="modal-footer-hint">{lang === "az" ? "Bağlamaq üçün Esc və ya Tamam basın" : "Press Esc or click Done to save adjustments"}</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowSettings(false)}
              >
                {t("done", lang)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. Keyboard Shortcuts & Help Cheatsheet Modal */}
      {showShortcuts ? (
        <div className="modal-backdrop" onClick={() => setShowShortcuts(false)}>
          <div className="modal-dialog shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge badge-obsidian">
                  <Keyboard size={18} />
                </div>
                <div>
                  <h2 className="modal-title">{t("shortcutsTitle", lang)}</h2>
                  <span className="modal-sub">{t("shortcutsSub", lang)}</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowShortcuts(false)}
                title="Close guide (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scroll">
              {/* Search shortcut highlight */}
              <div className="shortcuts-hero-box">
                <div className="hero-box-left">
                  <Command size={18} className="hero-cmd-icon" />
                  <div>
                    <strong>{t("globalSearch", lang)}</strong>
                    <span>{lang === "az" ? "İstənilən smeta bəndinə, çertyoj vərəqinə və ya spesifikasiyaya dərhal keçin" : "Instantly jump to any bill line, drawing sheet, or specification"}</span>
                  </div>
                </div>
                <div className="hero-kbd-wrap">
                  <kbd className="kbd-key">⌘</kbd>
                  <kbd className="kbd-key">K</kbd>
                </div>
              </div>

              {/* Shortcuts Groups Grid */}
              <div className="shortcuts-grid">
                {/* 1. Navigation */}
                <div className="shortcut-category-card">
                  <h3 className="category-title">{t("quickNav", lang)}</h3>
                  <div className="shortcut-rows-list">
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Layihə İdarəetmə Paneli (Overview)" : "Project Overview Dashboard"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">1</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Çertyoj Reyestri (205 Vərəq)" : "Drawing Register (205 Sheets)"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">2</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Həcmlər Cədvəli (WBS Ağacı)" : "Bill of Quantities (WBS Tree)"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">3</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Sahələrarası Yoxlamalar və Ziddiyyətlər" : "Discipline Audits & Conflicts"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">4</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Kommersiya Qiymətləri və Əlavələr" : "Commercial Rates & Markups"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">5</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "PDF və Excel Rəsmi Hesabatlar" : "Printable PDF & Excel Reports"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">6</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Surveyor Actions */}
                <div className="shortcut-category-card">
                  <h3 className="category-title">{t("surveyorActions", lang)}</h3>
                  <div className="shortcut-rows-list">
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Həcmi Təsdiq Et / Möhür Vur" : "Approve / Sign Off Quantity"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">A</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Cədvəl Hesablama Düzəlişini Tətbiq Et" : "Apply Schedule Math Correction"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">F</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Növbəti Smeta Bəndinə Keçid" : "Cycle Next Bill Line in Inspector"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">→</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Əvvəlki Smeta Bəndinə Keçid" : "Cycle Previous Bill Line"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">←</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Qaynar Düymələr Bələdçisini Aç" : "Open Keyboard Cheatsheet"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">?</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">{lang === "az" ? "Pəncərəni / Paneli Bağla" : "Close Modal / Inspector Drawer"}</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">Esc</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Evidence Methodology Guide */}
              <div className="guide-legend-section">
                <h3 className="legend-section-title">{t("evidenceLegend", lang)}</h3>
                <div className="legend-cards-grid">
                  <div className="legend-card">
                    <div className="legend-badge badge-schedule">{lang === "az" ? "Spesifikasiya Çıxarışı" : "Schedule Extraction"}</div>
                    <p className="legend-desc">
                      {lang === "az"
                        ? "Vektor CAD spesifikasiya və cədvəllərindən birbaşa oxunmuş dəqiq rəqəmlər (A500C armatur, mühəndis avadanlığı)."
                        : "Values extracted directly from vector CAD schedules and tables (A500C rebar, MEP schedules)."}
                    </p>
                  </div>
                  <div className="legend-card">
                    <div className="legend-badge badge-derived">{lang === "az" ? "Parametrik Hesablama" : "Parametric Takeoff"}</div>
                    <p className="legend-desc">
                      {lang === "az"
                        ? "Həndəsi ölçülər və element sayını birləşdirən mühəndislik düsturları ilə hesablanmış həcmlər."
                        : "Quantities calculated using explicit engineering formulas combining dimensions and member counts."}
                    </p>
                  </div>
                  <div className="legend-card">
                    <div className="legend-badge badge-image">{lang === "az" ? "Plandan Ölçmə" : "Plan Takeoff"}</div>
                    <p className="legend-desc">
                      {lang === "az"
                        ? "Memarlıq mərtəbə planlarından sahə üzrə ölçülmüş və otaq tamamlama cədvəli ilə tutuşdurulmuş həcmlər."
                        : "Measured from architectural floor plans and cross-referenced with room finish schedules."}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Discipline Audits Severity Guide */}
              <div className="guide-legend-section">
                <h3 className="legend-section-title">{t("auditLegend", lang)}</h3>
                <div className="audit-legend-list">
                  <div className="audit-legend-item">
                    <span className="audit-tag tag-error">{lang === "az" ? "Ziddiyyət / Xəta" : "Discrepancy"}</span>
                    <span className="audit-text">
                      {lang === "az"
                        ? "Çertyoj cədvəllərində çap olunmuş hesab xətaları və ya şişirtmələr (məsələn, Əlaqə Şr-2 -400 kq xətası)."
                        : "Arithmetic math errors or overstatements printed inside the drawings (e.g. Bracing Şr-2 -400kg)."}
                    </span>
                  </div>
                  <div className="audit-legend-item">
                    <span className="audit-tag tag-warn">{lang === "az" ? "Sahələrarası Fərq" : "Variance"}</span>
                    <span className="audit-text">
                      {lang === "az"
                        ? "Konstruksiya, memarlıq və kommunikasiya çertyojları arasındakı fərqlər (məsələn, 100 mm vs 150 mm plitə qalınlığı)."
                        : "Discrepancies between structural, architectural, and MEP plans (e.g. 100mm vs 150mm slab thickness)."}
                    </span>
                  </div>
                  <div className="audit-legend-item">
                    <span className="audit-tag tag-info">{lang === "az" ? "Mühəndis Qeydi" : "Note"}</span>
                    <span className="audit-text">
                      {lang === "az"
                        ? "Smetaçı və baş mühəndisin dəqiqləşdirməsi tələb olunan spesifikasiya qeydləri."
                        : "Engineering annotations or items requiring surveyor clarification."}
                    </span>
                  </div>
                  <div className="audit-legend-item">
                    <span className="audit-tag tag-ok">{lang === "az" ? "Təsdiqləndi" : "Verified"}</span>
                    <span className="audit-text">
                      {lang === "az"
                        ? "Müstəqil çertyoj paketləri və spesifikasiyalar arasında 100% tam uyğunluq təsdiqlənib."
                        : "100% agreement confirmed between independent drawing sets and schedules."}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <span className="modal-footer-hint">{lang === "az" ? "Qaynar düymələr bütün çertyoj və smeta səhifələrində aktivdir" : "Shortcuts are active across all drawing and takeoff views"}</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowShortcuts(false)}
              >
                {t("gotIt", lang)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

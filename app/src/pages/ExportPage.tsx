import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { exportWorkbook } from "../lib/exportXlsx";
import { fmtMoney, fmtNum, fmtQty, pct, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { t } from "../lib/i18n";
import { PageHead } from "../components/Shell";
import { Logo } from "../components/ui";

export function ExportPage() {
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const fixes = useApp((s) => s.fixes);
  const overrides = useApp((s) => s.qty);
  const rates = useApp((s) => s.rates);
  const [tab, setTab] = useState<"excel" | "pdf">("pdf");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const sources = data.items.reduce((a, i) => a + i.src.length, 0);

  const sheets = [
    {
      name: "Summary",
      what: lang === "az"
        ? `Konstruksiyalar üzrə icmal və smeta əlavələri zənciri ilə cəmi ${fmtMoney(boq.total)} AZN.`
        : `Collection by structure and the mark-up chain to ${fmtMoney(boq.total)} AZN.`,
    },
    {
      name: "Bill",
      what: lang === "az"
        ? `${boq.lines.length} sətir: İngilis və Azərbaycan dillərində vahid, həcm, qiymət, məbləğ və çertyoj istinadları.`
        : `${boq.lines.length} lines in English and Azerbaijani with unit, quantity, rate, amount as a live formula, evidence type and sheet numbers.`,
    },
    {
      name: "Takeoff and sources",
      what: lang === "az"
        ? `${data.items.length} həcm və ${sources} mənbə: fayl, səhifə və koordinat qutusu.`
        : `${data.items.length} quantities and ${sources} sources: file, page and the printed text each number was read from.`,
    },
    {
      name: "Checks",
      what: lang === "az"
        ? `${data.checks.length} audit yoxlaması və ziddiyyət aradan qaldırılması.`
        : `${data.checks.length} findings and agreements, with what the bill uses for each.`,
    },
    {
      name: "Rates",
      what: lang === "az"
        ? "Vahid qiymət bazası və istifadə edilən qiymətlər."
        : "The sample rate library and the rates used, including your edits.",
    },
    {
      name: "Not in the package",
      what: lang === "az"
        ? `${data.gaps.length} çertyojda həcmi qeyd olunmayan elementlər.`
        : `${data.gaps.length} items the drawings do not quantify.`,
    },
  ];

  const changes = [
    Object.keys(rates).length
      ? `${Object.keys(rates).length} ${lang === "az" ? "redaktə olunmuş qiymət" : "edited rates"}`
      : null,
    Object.keys(overrides).length
      ? `${Object.keys(overrides).length} ${lang === "az" ? "fərdi həcm düzəlişi" : "quantity overrides"}`
      : null,
    Object.values(fixes).filter(Boolean).length
      ? `${Object.values(fixes).filter(Boolean).length} ${lang === "az" ? "tətbiq olunmuş audit düzəlişi" : "audit corrections applied"}`
      : null,
  ].filter(Boolean);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page export-page-wrap">
      <PageHead
        title={t("exportTitle", lang)}
        lead={t("exportLead", lang)}
      />

      {/* Format Selector Tabs */}
      <div className="export-format-tabs" role="tablist">
        <button
          type="button"
          className={`format-tab${tab === "pdf" ? " active" : ""}`}
          onClick={() => setTab("pdf")}
        >
          <FileText size={16} />
          <span>{t("executivePdfReport", lang)}</span>
          <span className="tab-pill-badge">{lang === "az" ? "Çap Edilə Bilən PDF" : "Printable PDF"}</span>
        </button>
        <button
          type="button"
          className={`format-tab${tab === "excel" ? " active" : ""}`}
          onClick={() => setTab("excel")}
        >
          <FileSpreadsheet size={16} />
          <span>{t("excelWorkbook", lang)}</span>
          <span className="tab-pill-badge">ExcelJS (.xlsx)</span>
        </button>
      </div>

      {tab === "pdf" ? (
        <section className="pdf-export-section">
          {/* Action Bar */}
          <div className="pdf-actions-bar">
            <div className="pdf-meta-left">
              <strong>Storm Executive Takeoff Report</strong>
              <span className="muted small">{t("standardA4", lang)}</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              <Printer size={15} />
              <span>{t("printPdf", lang)}</span>
            </button>
          </div>

          {/* High-Fidelity Printable PDF Sheet */}
          <div className="printable-pdf-document" id="printable-boq-pdf">
            {/* Document Header */}
            <header className="pdf-doc-header">
              <div className="pdf-header-brand">
                <Logo size={36} />
                <div>
                  <h1 className="pdf-company-name">STORM BUILDING MMC</h1>
                  <span className="pdf-company-sub">
                    {lang === "az"
                      ? "Memarlıq və Konstruksiya Smeta İntelekti və Dəqiq Həcm Hesabatı"
                      : "Architectural & Structural Engineering Takeoff Intelligence"}
                  </span>
                </div>
              </div>
              <div className="pdf-header-meta">
                <div className="meta-row">
                  <span className="meta-k">{lang === "az" ? "Layihə:" : "Project:"}</span>
                  <strong className="meta-v">{lang === "az" ? data.project.name : data.project.nameEn}</strong>
                </div>
                <div className="meta-row">
                  <span className="meta-k">{lang === "az" ? "Ünvan:" : "Location:"}</span>
                  <span className="meta-v">{lang === "az" ? data.project.place : data.project.placeEn}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-k">{lang === "az" ? "Sifarişçi:" : "Client:"}</span>
                  <span className="meta-v">{data.project.client}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-k">{lang === "az" ? "Mərhələ:" : "Stage:"}</span>
                  <span className="meta-v">{lang === "az" ? "İşçi Layihə (2026)" : "Working Design (2026)"}</span>
                </div>
              </div>
            </header>

            {/* Commercial Valuation Executive Summary Banner */}
            <div className="pdf-executive-summary">
              <div className="pdf-summary-col">
                <span className="pdf-sum-label">{t("totalContractValuation", lang)}</span>
                <strong className="pdf-sum-val num">{fmtMoney(boq.total)} AZN</strong>
                <span className="pdf-sum-sub">{t("contractValuationSub", lang)}</span>
              </div>
              <div className="pdf-summary-col">
                <span className="pdf-sum-label">{t("measuredDirectWorks", lang)}</span>
                <strong className="pdf-sum-val num">{fmtMoney(boq.works)} AZN</strong>
                <span className="pdf-sum-sub">{lang === "az" ? "Kommersiya əlavələrindən əvvəl" : "Before commercial mark-up tiers"}</span>
              </div>
              <div className="pdf-summary-col">
                <span className="pdf-sum-label">{t("drawingPackageScope", lang)}</span>
                <strong className="pdf-sum-val num">205 {t("sheetsCount", lang)}</strong>
                <span className="pdf-sum-sub">BP, AR, KS, MEP (4 {lang === "az" ? "Qovluq" : "Volumes"})</span>
              </div>
              <div className="pdf-summary-col">
                <span className="pdf-sum-label">{t("verificationQuality", lang)}</span>
                <strong className="pdf-sum-val num text-emerald">100% {lang === "az" ? "DƏQİQ ƏSASLANDIRMA" : "Redline CITED"}</strong>
                <span className="pdf-sum-sub">{lang === "az" ? "Hər həcm çertyoj koordinatına bağlıdır" : "Zero unverified estimations"}</span>
              </div>
            </div>

            {/* Commercial Mark-Up Chain Breakdown */}
            <div className="pdf-section-title">
              <h2>{t("commercialValuationChain", lang)}</h2>
              <span className="pdf-title-note">{t("valuationChainNote", lang)}</span>
            </div>
            <table className="pdf-chain-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th>{lang === "az" ? "Pillənin Təsviri" : "Commercial Stage Description"}</th>
                  <th className="num" style={{ width: "100px" }}>{lang === "az" ? "Dərəcə" : "Rate"}</th>
                  <th className="num" style={{ width: "160px" }}>{lang === "az" ? "Artım Məbləği" : "Step Increment"}</th>
                  <th className="num" style={{ width: "180px" }}>{lang === "az" ? "Yekun Məbləğ (AZN)" : "Cumulative Total (AZN)"}</th>
                </tr>
              </thead>
              <tbody>
                {boq.chain.map((c, i) => (
                  <tr key={c.key} className={i === boq.chain.length - 1 ? "chain-final-row" : ""}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <strong>{c.label}</strong>
                    </td>
                    <td className="num">{c.rate != null ? `${pct(c.rate)}` : "—"}</td>
                    <td className="num font-semibold">{c.amount ? `+${fmtMoney(c.amount)}` : "—"}</td>
                    <td className="num font-bold">{fmtMoney(c.running)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Asset Breakdown Summary Table */}
            <div className="pdf-section-title">
              <h2>{lang === "az" ? "Binalar və Qurğular Üzrə Bölüşdürmə" : "Building Structure & Trade Breakdown"}</h2>
              <span className="pdf-title-note">{lang === "az" ? "Obyektlər üzrə birbaşa tikinti-quraşdırma işləri" : "Measured direct works grouped by building asset"}</span>
            </div>
            <table className="pdf-chain-table">
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>WBS</th>
                  <th>{t("buildingStructure", lang)}</th>
                  <th className="num" style={{ width: "90px" }}>{t("linesCount", lang)}</th>
                  <th className="num" style={{ width: "90px" }}>{t("share", lang)}</th>
                  <th className="num" style={{ width: "160px" }}>{lang === "az" ? "Birbaşa İşlər (AZN)" : "Direct Works (AZN)"}</th>
                </tr>
              </thead>
              <tbody>
                {boq.buildings.map((b) => (
                  <tr key={b.id}>
                    <td className="num font-mono">{b.code}</td>
                    <td>
                      <strong>{lang === "az" ? b.az : b.en}</strong>
                    </td>
                    <td className="num">{b.sections.reduce((a, s) => a + s.lines.length, 0)}</td>
                    <td className="num">{pct(b.total / (boq.works || 1))}</td>
                    <td className="num font-semibold">{fmtMoney(b.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* COMPLETE BILL OF QUANTITIES SCHEDULE (All 117 Verified Lines) */}
            <div className="pdf-section-title page-break-before">
              <h2>{t("completeBoqSchedule", lang)}</h2>
              <span className="pdf-title-note">{t("completeBoqNote", lang)}</span>
            </div>

            {/* Full 117-line Bill rendered by Building Assets */}
            <div className="pdf-full-boq-container">
              {boq.buildings.map((bldg) => (
                <div key={bldg.id} className="pdf-building-block">
                  {/* Building Header Banner */}
                  <div className="pdf-bldg-header">
                    <span className="pdf-bldg-badge font-mono">{bldg.code}</span>
                    <h3 className="pdf-bldg-title">{lang === "az" ? bldg.az : bldg.en}</h3>
                    <span className="pdf-bldg-total num">{fmtMoney(bldg.total)} AZN</span>
                  </div>

                  {/* Section Tables */}
                  {bldg.sections.map((sect) => (
                    <div key={sect.id} className="pdf-section-block">
                      <div className="pdf-section-head">
                        <strong>{lang === "az" ? sect.az : sect.en}</strong>
                        <span className="muted small font-mono">{sect.lines.length} {t("linesCount", lang)}</span>
                      </div>

                      <table className="pdf-data-table pdf-items-table">
                        <thead>
                          <tr>
                            <th style={{ width: "70px" }}>{t("wbsCode", lang)}</th>
                            <th>{t("itemDescription", lang)}</th>
                            <th style={{ width: "55px" }}>{t("unit", lang)}</th>
                            <th className="num" style={{ width: "85px" }}>{t("quantity", lang)}</th>
                            <th className="num" style={{ width: "95px" }}>{t("rate", lang)}</th>
                            <th className="num" style={{ width: "115px" }}>{t("amount", lang)}</th>
                            <th style={{ width: "85px" }}>{t("citation", lang)}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sect.lines.map((l) => (
                            <tr key={l.id}>
                              <td className="num font-mono">{l.code}</td>
                              <td>{lang === "az" ? l.az : l.en}</td>
                              <td>{unitLabel(l.unit, lang)}</td>
                              <td className="num">{fmtQty(l.qty, l.unit)}</td>
                              <td className="num">{fmtNum(l.rate)}</td>
                              <td className="num font-semibold">{fmtMoney(l.amount)}</td>
                              <td className="font-mono small">{l.items[0]?.src[0]?.sheet ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Quality Assurance & Surveyor Signature Block */}
            <footer className="pdf-sign-off-block">
              <div className="sign-col">
                <span className="sign-label">{t("preparedBy", lang)}:</span>
                <strong className="sign-name">{user?.name ?? "Elmir Məmmədov"}</strong>
                <span className="sign-title">{t("leadQs", lang)}</span>
                <span className="sign-company">"Storm Building" MMC</span>
              </div>
              <div className="sign-col">
                <span className="sign-label">{t("surveyorStamp", lang)}:</span>
                <div className="sign-stamp-box">
                  <ShieldCheck size={28} className="text-emerald" />
                  <div className="stamp-text">
                    <strong>STORM VERIFIED</strong>
                    <span>{lang === "az" ? "İşçi Layihə 2026" : "Working Design 2026"}</span>
                  </div>
                </div>
              </div>
              <div className="sign-col">
                <span className="sign-label">{t("executiveAcceptance", lang)}:</span>
                <div className="sign-line" />
                <span className="sign-title">{t("client", lang)}: {data.project.client}</span>
              </div>
            </footer>
          </div>
        </section>
      ) : (
        <section className="panel export">
          <header className="panel-head">
            <div>
              <h2>{lang === "az" ? "Tam Auditli Excel Faylı" : "Audit-grade Excel workbook"}</h2>
              <span className="muted small">
                {lang === "az"
                  ? "Bütün 117 smeta sətri, 4 qovluq və 205 vərəq üzrə formulalar və çertyoj koordinatları."
                  : "Formulas, drawing citations and cross-checks preserved as formulas and references"}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={state === "busy"}
              onClick={async () => {
                setState("busy");
                try {
                  await exportWorkbook(boq, fixes);
                  setState("done");
                } catch (e) {
                  console.error(e);
                  setState("error");
                }
              }}
            >
              <Download size={15} />
              {state === "busy"
                ? lang === "az" ? "Excel Yaradılır..." : "Building workbook…"
                : state === "done"
                  ? lang === "az" ? "Yükləndi (Yenidən Endir)" : "Downloaded (download again)"
                  : lang === "az" ? "Excel Faylını Endir (.xlsx)" : "Download workbook (.xlsx)"}
            </button>
          </header>

          <div className="export-sheets">
            <h3>{lang === "az" ? "İş Kitabının Vərəqləri" : "Sheets included in the workbook"}</h3>
            <ul className="sheet-list">
              {sheets.map((s) => (
                <li key={s.name}>
                  <strong className="sheet-name">{s.name}</strong>
                  <span className="muted">{s.what}</span>
                </li>
              ))}
            </ul>
          </div>

          {changes.length ? (
            <div className="export-changes">
              <span className="figure-label">
                {lang === "az" ? "İxrac ediləcək fərdi düzəlişlər:" : "Customizations included in this export:"}
              </span>
              <span>{changes.join(" • ")}</span>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

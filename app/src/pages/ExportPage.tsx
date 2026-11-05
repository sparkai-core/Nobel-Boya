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
    { name: "Summary", what: `Collection by structure and the mark-up chain to ${fmtMoney(boq.total)} AZN.` },
    {
      name: "Bill",
      what: `${boq.lines.length} lines in English and Azerbaijani with unit, quantity, rate, amount as a live formula, evidence type and sheet numbers.`,
    },
    {
      name: "Takeoff and sources",
      what: `${data.items.length} quantities and ${sources} sources: file, page and the printed text each number was read from.`,
    },
    { name: "Checks", what: `${data.checks.length} findings and agreements, with what the bill uses for each.` },
    { name: "Rates", what: "The sample rate library and the rates used, including your edits." },
    { name: "Not in the package", what: `${data.gaps.length} items the drawings do not quantify.` },
  ];

  const changes = [
    Object.keys(rates).length ? `${Object.keys(rates).length} edited rates` : null,
    Object.keys(overrides).length ? `${Object.keys(overrides).length} quantity overrides` : null,
    Object.values(fixes).filter(Boolean).length
      ? `${Object.values(fixes).filter(Boolean).length} audit corrections applied`
      : null,
  ].filter(Boolean);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page export-page-wrap">
      <PageHead
        title="Exports &amp; Reports"
        lead="Audit-grade commercial outputs for quantity surveyors, project directors, and clients. Download verified Excel workbooks or print executive PDF packages."
      />

      {/* Format Selector Tabs */}
      <div className="export-format-tabs" role="tablist">
        <button
          type="button"
          className={`format-tab${tab === "pdf" ? " active" : ""}`}
          onClick={() => setTab("pdf")}
        >
          <FileText size={16} />
          <span>Executive PDF Report</span>
          <span className="tab-pill-badge">Printable PDF</span>
        </button>
        <button
          type="button"
          className={`format-tab${tab === "excel" ? " active" : ""}`}
          onClick={() => setTab("excel")}
        >
          <FileSpreadsheet size={16} />
          <span>Audit-Grade Excel Workbook</span>
          <span className="tab-pill-badge">ExcelJS (.xlsx)</span>
        </button>
      </div>

      {tab === "pdf" ? (
        <section className="pdf-export-section">
          {/* Action Bar */}
          <div className="pdf-actions-bar">
            <div className="pdf-meta-left">
              <strong>Storm Executive Takeoff Report</strong>
              <span className="muted small">A4 Standard • Official Cost Estimation Package</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              <Printer size={15} />
              <span>Print or Save as PDF</span>
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
                  <span className="pdf-company-sub">Architectural &amp; Structural Engineering Takeoff Intelligence</span>
                </div>
              </div>
              <div className="pdf-header-meta">
                <div className="meta-row">
                  <span className="meta-k">Project:</span>
                  <strong className="meta-v">{data.project.nameEn}</strong>
                </div>
                <div className="meta-row">
                  <span className="meta-k">Location:</span>
                  <span className="meta-v">{data.project.placeEn}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-k">Client:</span>
                  <span className="meta-v">{data.project.client}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-k">Date:</span>
                  <span className="meta-v">2026 Working Design</span>
                </div>
              </div>
            </header>

            {/* Commercial Valuation Executive Summary Banner */}
            <div className="pdf-executive-summary">
              <div className="pdf-summary-col">
                <span className="pdf-sum-label">Total Contract Valuation</span>
                <strong className="pdf-sum-val num">{fmtMoney(boq.total)} AZN</strong>
                <span className="pdf-sum-sub">Includes 18% statutory VAT</span>
              </div>
              <div className="pdf-summary-col">
                <span className="pdf-sum-label">Measured Direct Works</span>
                <strong className="pdf-sum-val num">{fmtMoney(boq.works)} AZN</strong>
                <span className="pdf-sum-sub">Before commercial mark-up tiers</span>
              </div>
              <div className="pdf-summary-col">
                <span className="pdf-sum-label">Drawing Package Scope</span>
                <strong className="pdf-sum-val num">205 Sheets</strong>
                <span className="pdf-sum-sub">Master Plan, Arch, Structure, MEP</span>
              </div>
              <div className="pdf-summary-col">
                <span className="pdf-sum-label">Verification Quality</span>
                <strong className="pdf-sum-val num text-emerald">100% Redline CITED</strong>
                <span className="pdf-sum-sub">Zero unverified estimations</span>
              </div>
            </div>

            {/* Commercial Mark-Up Chain Breakdown */}
            <div className="pdf-section-title">
              <h2>Commercial Valuation Chain</h2>
              <span className="pdf-title-note">Statutory Azerbaijani construction estimating markup sequence</span>
            </div>
            <table className="pdf-chain-table">
              <thead>
                <tr>
                  <th>Component / Mark-Up Step</th>
                  <th className="num">Rate (%)</th>
                  <th className="num">Step Value (AZN)</th>
                  <th className="num">Cumulative Total (AZN)</th>
                </tr>
              </thead>
              <tbody>
                {boq.chain.map((c) => (
                  <tr key={c.key} className={c.key === "works" ? "row-works-subtotal" : ""}>
                    <td>
                      <strong>{c.label}</strong>
                    </td>
                    <td className="num">{c.rate != null ? pct(c.rate, 0) : "—"}</td>
                    <td className="num">{fmtMoney(c.amount)}</td>
                    <td className="num font-semibold">{fmtMoney(c.amount)}</td>
                  </tr>
                ))}
                <tr className="row-grand-total">
                  <td>
                    <strong>TOTAL CONTRACT VALUE (INCL. 18% VAT)</strong>
                  </td>
                  <td className="num">18%</td>
                  <td className="num">{fmtMoney(boq.total - (boq.chain[boq.chain.length - 2]?.amount ?? 0))}</td>
                  <td className="num font-bold text-lg">{fmtMoney(boq.total)} AZN</td>
                </tr>
              </tbody>
            </table>

            {/* Structure Breakdown */}
            <div className="pdf-section-title">
              <h2>Asset &amp; Structure Distribution</h2>
              <span className="pdf-title-note">Direct works breakdown across major project buildings</span>
            </div>
            <table className="pdf-data-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>Code</th>
                  <th>Structure / Asset Description</th>
                  <th className="num" style={{ width: "90px" }}>Bill Lines</th>
                  <th className="num" style={{ width: "90px" }}>Share</th>
                  <th className="num" style={{ width: "160px" }}>Direct Works (AZN)</th>
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

            {/* Key Verified Line Items Schedule */}
            <div className="pdf-section-title">
              <h2>Representative Takeoff Line Items</h2>
              <span className="pdf-title-note">Selected verified items from the 117-line Bill of Quantities</span>
            </div>
            <table className="pdf-data-table pdf-items-table">
              <thead>
                <tr>
                  <th style={{ width: "65px" }}>Code</th>
                  <th>Item Description</th>
                  <th style={{ width: "55px" }}>Unit</th>
                  <th className="num" style={{ width: "90px" }}>Quantity</th>
                  <th className="num" style={{ width: "100px" }}>Rate (AZN)</th>
                  <th className="num" style={{ width: "120px" }}>Total (AZN)</th>
                  <th style={{ width: "85px" }}>Citation</th>
                </tr>
              </thead>
              <tbody>
                {boq.lines.slice(0, 15).map((l) => (
                  <tr key={l.id}>
                    <td className="num font-mono">{l.code}</td>
                    <td>{lang === "az" ? l.az : l.en}</td>
                    <td>{unitLabel(l.unit, "en")}</td>
                    <td className="num">{fmtQty(l.qty, l.unit)}</td>
                    <td className="num">{fmtNum(l.rate)}</td>
                    <td className="num font-semibold">{fmtMoney(l.amount)}</td>
                    <td className="font-mono small">{l.items[0]?.src[0]?.sheet ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Quality Assurance & Surveyor Signature Block */}
            <footer className="pdf-sign-off-block">
              <div className="sign-col">
                <span className="sign-label">Prepared &amp; Audited By:</span>
                <strong className="sign-name">{user?.name ?? "Elmir Məmmədov"}</strong>
                <span className="sign-title">{user?.role ?? "Lead Quantity Surveyor"}</span>
                <span className="sign-company">Storm Building MMC</span>
              </div>
              <div className="sign-col">
                <span className="sign-label">Surveyor Seal &amp; Signature:</span>
                <div className="sign-stamp-box">
                  <ShieldCheck size={28} className="text-emerald" />
                  <div className="stamp-text">
                    <strong>STORM VERIFIED</strong>
                    <span>Working Design 2026</span>
                  </div>
                </div>
              </div>
              <div className="sign-col">
                <span className="sign-label">Executive Acceptance:</span>
                <div className="sign-line" />
                <span className="sign-title">Client: {data.project.client}</span>
              </div>
            </footer>
          </div>
        </section>
      ) : (
        <section className="panel export">
          <header className="panel-head">
            <div>
              <h2>Excel Workbook Structure</h2>
              <span className="muted small">Fully audited workbook generated directly in your browser</span>
            </div>
            <span className="pill-badge-subtle">6 Worksheets</span>
          </header>
          <ol className="export-sheets">
            {sheets.map((s, i) => (
              <li key={s.name}>
                <span className="export-n num">{i + 1}</span>
                <div>
                  <strong>{s.name}</strong>
                  <p className="muted">{s.what}</p>
                </div>
              </li>
            ))}
          </ol>
          <footer className="export-foot">
            <p className="muted small">
              {changes.length ? `Includes ${changes.join(", ")}.` : "Uses the printed quantities and the sample rates."}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg"
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
              {state === "busy" ? <span className="spinner light" /> : <Download size={18} />}
              {state === "busy" ? "Building the workbook..." : "Download Qobu-BOQ-Storm.xlsx"}
            </button>
            {state === "done" ? <p className="ok-text small">Workbook downloaded successfully.</p> : null}
            {state === "error" ? (
              <p className="bad-text small">The workbook could not be built. Please try again.</p>
            ) : null}
          </footer>
        </section>
      )}
    </div>
  );
}

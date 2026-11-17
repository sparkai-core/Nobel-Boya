import { useState } from "react";
import { X, CheckCircle2, AlertTriangle, AlertCircle, ArrowUpRight, Scale } from "lucide-react";
import { useT } from "../lib/i18n";
import { fmtNum } from "../lib/format";
import { Link } from "react-router-dom";

type LineResult = {
  code: string;
  description: string;
  unit: string;
  client_qty: number;
  generated_qty: number;
  diff_qty: number;
  pct_variance: number;
  status: "match" | "over_measured" | "under_measured" | "not_in_drawings" | "missing_in_client_boq";
  cited_sheet: string;
  quote: string;
};

type ComparisonSummary = {
  total_client_lines: number;
  total_generated_items: number;
  matches: number;
  over_measured: number;
  under_measured: number;
  missing_in_client_boq: number;
  not_in_drawings: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  filename?: string;
  summary: ComparisonSummary | null;
  lines: LineResult[];
};

export function BoqComparisonModal({ open, onClose, filename, summary, lines }: Props) {
  const t = useT();
  const [filter, setFilter] = useState<string>("all");

  if (!open || !summary) return null;

  const filteredLines = lines.filter((l) => {
    if (filter === "all") return true;
    return l.status === filter;
  });

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 960, width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <header className="modal-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", padding: 8, borderRadius: 8, background: "rgba(43, 2, 102, 0.08)", color: "var(--brand-dark)" }}>
              <Scale size={20} />
            </span>
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>{t("Client BOQ Variance Audit")}</h2>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                {filename ? t("Compared against {f}", { f: filename }) : t("Audit variance between uploaded client BOQ and autonomous drawings takeoff")}
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} aria-label={t("Close")}>
            <X size={18} />
          </button>
        </header>

        {/* Summary Stat Pills */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--sheet-2)", border: "1px solid var(--line)" }}>
            <span className="muted small" style={{ display: "block" }}>{t("Client Lines")}</span>
            <strong style={{ fontSize: 18 }}>{summary.total_client_lines}</strong>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
            <span style={{ color: "#059669", fontSize: 12, display: "block", fontWeight: 600 }}>{t("Matched (≤2%)")}</span>
            <strong style={{ fontSize: 18, color: "#059669" }}>{summary.matches}</strong>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
            <span style={{ color: "#d97706", fontSize: 12, display: "block", fontWeight: 600 }}>{t("Over-Measured")}</span>
            <strong style={{ fontSize: 18, color: "#d97706" }}>{summary.over_measured}</strong>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <span style={{ color: "#dc2626", fontSize: 12, display: "block", fontWeight: 600 }}>{t("Under-Measured")}</span>
            <strong style={{ fontSize: 18, color: "#dc2626" }}>{summary.under_measured}</strong>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
            <span style={{ color: "#4f46e5", fontSize: 12, display: "block", fontWeight: 600 }}>{t("Missing in Client BOQ")}</span>
            <strong style={{ fontSize: 18, color: "#4f46e5" }}>{summary.missing_in_client_boq}</strong>
          </div>
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(107, 114, 128, 0.08)", border: "1px solid rgba(107, 114, 128, 0.2)" }}>
            <span style={{ color: "var(--muted)", fontSize: 12, display: "block", fontWeight: 600 }}>{t("Not in Drawings")}</span>
            <strong style={{ fontSize: 18, color: "var(--muted)" }}>{summary.not_in_drawings}</strong>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: 6, padding: "12px 0 8px", overflowX: "auto" }}>
          {[
            { id: "all", label: t("All Items ({n})", { n: lines.length }) },
            { id: "match", label: t("Matches ({n})", { n: summary.matches }) },
            { id: "over_measured", label: t("Over-measured ({n})", { n: summary.over_measured }) },
            { id: "under_measured", label: t("Under-measured ({n})", { n: summary.under_measured }) },
            { id: "missing_in_client_boq", label: t("Client Missed ({n})", { n: summary.missing_in_client_boq }) },
            { id: "not_in_drawings", label: t("Not In Drawings ({n})", { n: summary.not_in_drawings }) },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn ${filter === tab.id ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 12, padding: "4px 10px", height: 28 }}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Comparison Table */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8, marginTop: 4 }}>
          <table className="boq" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--sheet-2)", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                <th style={{ padding: "8px 10px" }}>{t("Item / Code")}</th>
                <th style={{ padding: "8px 10px" }}>{t("Description")}</th>
                <th style={{ padding: "8px 10px" }}>{t("Unit")}</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>{t("Client Qty")}</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>{t("AI Drawings Qty")}</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>{t("Variance")}</th>
                <th style={{ padding: "8px 10px" }}>{t("Status")}</th>
                <th style={{ padding: "8px 10px" }}>{t("Drawing Evidence")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((row, idx) => {
                let statusBadge = (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#059669", background: "rgba(16, 185, 129, 0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    <CheckCircle2 size={12} /> {t("MATCH")}
                  </span>
                );
                if (row.status === "not_in_drawings") {
                  statusBadge = (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#64748b", background: "rgba(100, 116, 139, 0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      <AlertCircle size={12} /> {t("NOT IN DRAWINGS")}
                    </span>
                  );
                } else if (row.status === "over_measured") {
                  statusBadge = (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#d97706", background: "rgba(245, 158, 11, 0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      <AlertTriangle size={12} /> {t("OVER-MEASURED")}
                    </span>
                  );
                } else if (row.status === "under_measured") {
                  statusBadge = (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#dc2626", background: "rgba(239, 68, 68, 0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      <AlertCircle size={12} /> {t("UNDER-MEASURED")}
                    </span>
                  );
                } else if (row.status === "missing_in_client_boq") {
                  statusBadge = (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#4f46e5", background: "rgba(99, 102, 241, 0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                      <AlertCircle size={12} /> {t("MISSED BY CLIENT")}
                    </span>
                  );
                }

                return (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, fontFamily: "monospace" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <div>{row.description}</div>
                      {row.quote ? <div className="muted small" style={{ fontStyle: "italic", marginTop: 2 }}>"{row.quote}"</div> : null}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{row.unit}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)" }}>{row.client_qty > 0 ? fmtNum(row.client_qty, 2) : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600 }}>{row.generated_qty > 0 ? fmtNum(row.generated_qty, 2) : "—"}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--mono)" }}>
                      <span style={{ color: row.diff_qty > 0 ? "#d97706" : row.diff_qty < 0 ? "#dc2626" : "#059669", fontWeight: 600 }}>
                        {row.diff_qty > 0 ? `+${fmtNum(row.diff_qty, 2)}` : fmtNum(row.diff_qty, 2)}
                        {row.pct_variance ? ` (${row.pct_variance > 0 ? "+" : ""}${row.pct_variance}%)` : ""}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>{statusBadge}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {row.cited_sheet && row.cited_sheet !== "N/A" ? (
                        <Link to={`/drawings/${row.cited_sheet}`} onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: "var(--brand-dark)" }}>
                          <span>{row.cited_sheet}</span>
                          <ArrowUpRight size={12} />
                        </Link>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="modal-foot" style={{ display: "flex", justifyContent: "flex-end", paddingTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t("Close Audit")}
          </button>
        </footer>
      </div>
    </div>
  );
}

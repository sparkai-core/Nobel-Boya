import { useState, type FormEvent } from "react";
import { Upload, X, FileText, CheckCircle2, AlertCircle, ReceiptText, Table2 } from "lucide-react";
import { useT } from "../lib/i18n";
import { createProject, fetchProject } from "../lib/api";
import { useApp } from "../lib/store";
import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function NewProjectModal({ open, onClose, onCreated }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const setActiveProject = useApp((s) => s.setActiveProject);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [designer, setDesigner] = useState("");
  const [place, setPlace] = useState("");
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  const [ratesFile, setRatesFile] = useState<File | null>(null);
  const [boqFile, setBoqFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("Please enter a project title."));
      return;
    }
    if (!drawingFile) {
      setError(t("Please upload a drawing package PDF file."));
      return;
    }

    setLoading(true);
    setError(null);
    setProgressMsg(t("Uploading drawing package and initializing OCR engine..."));

    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("client", client.trim() || "Client");
      fd.append("designer", designer.trim() || "Engineering Office");
      fd.append("place", place.trim() || "Project Location");
      fd.append("drawing_file", drawingFile);

      if (ratesFile) {
        fd.append("rates_file", ratesFile);
      }
      if (boqFile) {
        fd.append("boq_file", boqFile);
      }

      setProgressMsg(t("Rasterizing blueprint sheets and parsing schedules..."));
      const res = await createProject(fd);

      setProgressMsg(t("Loading project workspace..."));
      const proj = await fetchProject(res.project_id);
      setActiveProject(res.project_id, proj.data);
      onCreated();
      onClose();
      navigate("/generate");
    } catch (err: any) {
      setError(err.message || t("Failed to create project. Please ensure drawing is a valid PDF."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <header className="modal-head">
          <div>
            <h2>{t("Create New Project")}</h2>
            <p className="muted small">{t("Upload construction drawing package (PDF) to autonomously generate BOQ.")}</p>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} aria-label={t("Close")}>
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="modal-body" style={{ display: "grid", gap: 16 }}>
          {error ? (
            <div className="alert alert-bad" style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 6, background: "rgba(220, 38, 38, 0.1)", color: "#dc2626", fontSize: 13 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field">
              <span>{t("Project Name")} *</span>
              <input
                className="input"
                placeholder={t("e.g. Dubai Marina Tower")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>{t("Location / City")}</span>
              <input
                className="input"
                placeholder={t("e.g. Downtown Dubai")}
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field">
              <span>{t("Client / Employer")}</span>
              <input
                className="input"
                placeholder={t("e.g. Emaar Properties")}
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("Designer / Consultant")}</span>
              <input
                className="input"
                placeholder={t("e.g. WSP Engineering")}
                value={designer}
                onChange={(e) => setDesigner(e.target.value)}
              />
            </label>
          </div>

          {/* Primary Blueprint Dropzone */}
          <div className="modal-dropzone">
            <div className="dropzone-icon-circle">
              <Upload size={20} strokeWidth={2} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{t("Drawing Package (PDF)")}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#dc2626", background: "rgba(220, 38, 38, 0.08)", padding: "2px 6px", borderRadius: 4 }}>{t("Required")}</span>
            </div>
            <p className="muted small" style={{ margin: "0 0 12px", maxWidth: 420 }}>
              {t("Supported formats: Architectural, Structural, and MEP drawings in vector PDF")}
            </p>
            <input
              type="file"
              accept=".pdf,application/pdf"
              id="file-drawings"
              style={{ display: "none" }}
              onChange={(e) => setDrawingFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="file-drawings" className="btn btn-outline" style={{ cursor: "pointer", display: "inline-flex", gap: 8, alignItems: "center", padding: "8px 16px" }}>
              <FileText size={16} />
              <span>{drawingFile ? drawingFile.name : t("Select PDF Drawing Package")}</span>
            </label>
            {drawingFile ? (
              <p className="ok-text small" style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, color: "#16a34a", fontWeight: 500 }}>
                <CheckCircle2 size={14} /> {(drawingFile.size / (1024 * 1024)).toFixed(1)} MB {t("ready for takeoff")}
              </p>
            ) : null}
          </div>

          {/* Optional Commercial Rates & Client BOQ Upload */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="modal-subcard">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <ReceiptText size={16} style={{ color: "var(--accent)" }} />
                  <strong style={{ fontSize: 13 }}>{t("Custom Rates (Optional)")}</strong>
                </div>
                <p className="muted small" style={{ margin: 0 }}>{t("Upload .csv or .xlsx rate list")}</p>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                id="file-rates"
                style={{ display: "none" }}
                onChange={(e) => setRatesFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="file-rates" className="btn btn-outline btn-sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 8 }}>
                {ratesFile ? (
                  <>
                    <CheckCircle2 size={13} style={{ color: "#16a34a" }} />
                    <span className="truncate">{ratesFile.name}</span>
                  </>
                ) : (
                  <>
                    <Upload size={13} />
                    <span>{t("Choose Rates File")}</span>
                  </>
                )}
              </label>
            </div>

            <div className="modal-subcard">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Table2 size={16} style={{ color: "var(--accent)" }} />
                  <strong style={{ fontSize: 13 }}>{t("Client BOQ (Optional)")}</strong>
                </div>
                <p className="muted small" style={{ margin: 0 }}>{t("Upload .xlsx to compare variances")}</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                id="file-boq"
                style={{ display: "none" }}
                onChange={(e) => setBoqFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="file-boq" className="btn btn-outline btn-sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 8 }}>
                {boqFile ? (
                  <>
                    <CheckCircle2 size={13} style={{ color: "#16a34a" }} />
                    <span className="truncate">{boqFile.name}</span>
                  </>
                ) : (
                  <>
                    <Upload size={13} />
                    <span>{t("Choose BOQ to Compare")}</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "12px 0", color: "var(--graphite)" }}>
              <div className="spinner" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontWeight: 600, fontSize: 13 }}>{progressMsg}</p>
            </div>
          ) : null}

          <footer className="modal-foot" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              {t("Cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t("Generating...") : t("Create & Generate BOQ")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

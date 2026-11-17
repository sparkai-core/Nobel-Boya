import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, FolderKanban, ArrowRight } from "lucide-react";
import { COVER_SHEETS, data, sheetImage } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { projectName, projectPlace } from "../lib/loc";
import { useT } from "../lib/i18n";
import { fetchProjects, fetchProject } from "../lib/api";
import { NewProjectModal } from "../components/NewProjectModal";

const TEXT_LABEL = { true: "Text layer", false: "Image only", partial: "Partly text" } as const;

type ProjectSummary = {
  id: string;
  code: string;
  title: string;
  client: string;
  designer: string;
  place: string;
  created_at: string;
  cover_sheets?: string[];
  cover_images?: string[];
  sheets_count?: number;
  documents_count?: number;
  total_amount?: number;
  documents?: any[];
};

export function ProjectsPage() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useApp((s) => s.lang);
  const user = useApp((s) => s.user);
  const userEmail = useApp((s) => s.userEmail);
  const activeProjectId = useApp((s) => s.activeProjectId);
  const setActiveProject = useApp((s) => s.setActiveProject);
  const boq = useBoq();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await fetchProjects();
      setProjects(res.projects || []);
    } catch (e) {
      console.warn("Failed to load projects:", e);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [userEmail]);

  const handleOpenProject = async (projId: string) => {
    try {
      const proj = await fetchProject(projId);
      if (proj && proj.data) {
        setActiveProject(projId, proj.data);
      } else {
        setActiveProject(projId);
      }
    } catch {
      setActiveProject(projId);
    }
    navigate(`/overview`);
  };

  const handleOpenDrawings = async (projId: string) => {
    try {
      const proj = await fetchProject(projId);
      if (proj && proj.data) {
        setActiveProject(projId, proj.data);
      } else {
        setActiveProject(projId);
      }
    } catch {
      setActiveProject(projId);
    }
    navigate(`/drawings`);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-titles">
          <h1>{t("Projects")}</h1>
          <p className="lead">{t("Each project is one drawing package. Open a project to see its bill, drawings and checks.")}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            <Plus size={16} />
            <span>{t("New Project")}</span>
          </button>
        </div>
      </header>

      <div className="home-grid">
        {/* Render user's active projects */}
        {projects.map((proj) => {
          const isCurrent = proj.id === activeProjectId;
          const p = isCurrent ? data.project : { client: proj.client, designer: proj.designer, issued: proj.created_at.slice(0, 10) };
          const pTitle = isCurrent ? projectName(lang) : proj.title;
          const pPlace = isCurrent ? projectPlace(lang) : proj.place;
          // cover_images are image paths from the server (project folder + sheet id)
          const covers = (proj.cover_images && proj.cover_images.length > 0)
            ? proj.cover_images
            : (isCurrent ? COVER_SHEETS : []);

          return (
            <article key={proj.id} className="project-card card">
              <button
                type="button"
                className={`project-cover${covers.length === 1 ? " single-sheet" : ""}`}
                onClick={() => handleOpenDrawings(proj.id)}
                aria-label={t("Open the drawings of this project")}
              >
                {covers.map((id) => (
                  <img key={id} src={sheetImage(id, true)} alt="" loading="lazy" />
                ))}
              </button>
              <div className="project-body">
                <div className="project-status">
                  <span className="status-dot on" aria-hidden="true" />
                  {t("Bill generated")}
                </div>
                <h2>{pTitle}</h2>
                <p className="muted">{pPlace}</p>
                <dl className="project-facts">
                  <div>
                    <dt>{t("Client")}</dt>
                    <dd>{p.client}</dd>
                  </div>
                  <div>
                    <dt>{t("Designer")}</dt>
                    <dd>{p.designer}</dd>
                  </div>
                  <div>
                    <dt>{t("Issue")}</dt>
                    <dd>{t("Working design, {d}", { d: p.issued })}</dd>
                  </div>
                  <div>
                    <dt>{t("Bill total incl. VAT")}</dt>
                    <dd className="num-inline">
                      {fmtMoney(isCurrent ? boq.total : (proj.total_amount || 0))} AZN
                    </dd>
                  </div>
                </dl>

                <div className="project-files">
                  <div className="project-files-head">
                    <strong>{t("Drawing package")}</strong>
                    <span className="muted small num-inline">
                      {t("{f} files, {s} sheets", {
                        f: proj.documents_count || (isCurrent ? (data.documents || []).length : 1),
                        s: proj.sheets_count || (isCurrent ? (data.sheets || []).length : 1),
                      })}
                    </span>
                  </div>
                  <ul>
                    {(proj.documents && proj.documents.length > 0
                      ? proj.documents
                      : (isCurrent && data.documents ? data.documents : [{ code: "D1", file: `${proj.title}.pdf`, text: true }])
                    ).map((d) => (
                      <li key={d.code}>
                        <FileText size={15} aria-hidden="true" />
                        <span className="truncate">{d.file}</span>
                        <span className="muted num-inline">{d.pages || proj.sheets_count || 1}</span>
                        <span className={`layer layer-${String(d.text ?? true)}`}>
                          {t(TEXT_LABEL[String(d.text ?? true) as "true" | "false" | "partial"])}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="project-actions">
                  <button type="button" className="btn btn-primary" onClick={() => handleOpenProject(proj.id)}>
                    {t("Open project")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleOpenDrawings(proj.id)}>
                    {t("Drawings")}
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {/* Empty state if user has 0 projects */}
        {!loading && projects.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: "center", display: "grid", placeItems: "center", minHeight: 280 }}>
            <FolderKanban size={40} style={{ color: "var(--muted)", marginBottom: 8 }} />
            <h3 style={{ margin: "4px 0" }}>{t("No projects in this workspace")}</h3>
            <p className="muted small" style={{ maxWidth: 360, margin: "0 auto 16px" }}>
              {t("You are signed in as {u}. User workspaces are completely isolated in SQLite. Upload your first PDF drawing set to generate a project.", { u: user || userEmail })}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setShowNewModal(true)}>
              <Plus size={16} />
              <span>{t("Create First Project")}</span>
            </button>
          </div>
        ) : null}

        {/* New Project Action Card */}
        <button
          type="button"
          className="new-project"
          onClick={() => setShowNewModal(true)}
          style={{ cursor: "pointer", border: "2px dashed var(--line)", background: "var(--sheet-2)", textAlign: "left", width: "100%", padding: 24, borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "center" }}
        >
          <span className="new-icon" style={{ display: "inline-flex", padding: 8, borderRadius: "50%", background: "var(--gold-soft)", color: "var(--brand-dark)", width: "fit-content", marginBottom: 12 }}>
            <Plus size={22} />
          </span>
          <h3 style={{ margin: "0 0 6px" }}>{t("New project")}</h3>
          <p className="muted small" style={{ margin: "0 0 14px", lineHeight: 1.5 }}>
            {t("Add a drawing package: PDF drawing sets with optional rate schedules and client BOQ.")}
          </p>
          <span className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start", display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span>{t("Upload Drawing Package")}</span>
            <ArrowRight size={14} />
          </span>
        </button>
      </div>

      <NewProjectModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={() => {
          loadProjects();
        }}
      />
    </div>
  );
}

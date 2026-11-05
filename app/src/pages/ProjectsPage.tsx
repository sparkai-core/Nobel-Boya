import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { COVER_SHEETS, data, P, sheetImage } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { projectName, projectPlace } from "../lib/loc";
import { useT } from "../lib/i18n";

const TEXT_LABEL = { true: "Text layer", false: "Image only", partial: "Partly text" } as const;

export function ProjectsPage() {
  const t = useT();
  const navigate = useNavigate();
  const generated = useApp((s) => s.generated);
  const lang = useApp((s) => s.lang);
  const boq = useBoq();
  const p = data.project;
  const open = (path: string) => navigate(generated ? `${P}/${path}` : `${P}/generate`);

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-titles">
          <h1>{t("Projects")}</h1>
          <p className="lead">{t("Each project is one drawing package. Open a project to see its bill, drawings and checks.")}</p>
        </div>
      </header>

      <div className="home-grid">
        <article className="project-card card">
          <button type="button" className="project-cover" onClick={() => open("drawings")} aria-label={t("Open the drawings of this project")}>
            {COVER_SHEETS.map((id) => (
              <img key={id} src={sheetImage(id, true)} alt="" loading="lazy" />
            ))}
          </button>
          <div className="project-body">
            <div className="project-status">
              <span className={`status-dot${generated ? " on" : ""}`} aria-hidden="true" />
              {generated ? t("Bill generated") : t("Ready to generate")}
            </div>
            <h2>{projectName(lang)}</h2>
            <p className="muted">{projectPlace(lang)}</p>
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
                <dd className="num-inline">{generated ? `${fmtMoney(boq.total)} AZN` : t("Not generated")}</dd>
              </div>
            </dl>

            <div className="project-files">
              <div className="project-files-head">
                <strong>{t("Drawing package")}</strong>
                <span className="muted small num-inline">{t("4 files, 205 sheets")}</span>
              </div>
              <ul>
                {data.documents.map((d) => (
                  <li key={d.code}>
                    <FileText size={15} aria-hidden="true" />
                    <span className="truncate">{d.file}</span>
                    <span className="muted num-inline">{data.sheets.filter((s) => s.doc === d.code).length}</span>
                    <span className={`layer layer-${String(d.text)}`}>{t(TEXT_LABEL[String(d.text) as "true" | "false" | "partial"])}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="project-actions">
              {generated ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => open("bill")}>
                    {t("Open project")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => open("drawings")}>
                    {t("Drawings")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate(`${P}/generate`)}>
                    {t("Generate again")}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => navigate(`${P}/generate`)}>
                  {t("Generate the bill of quantities")}
                </button>
              )}
            </div>
          </div>
        </article>

        <aside className="new-project" aria-disabled="true">
          <span className="new-icon">
            <Plus size={20} />
          </span>
          <h3>{t("New project")}</h3>
          <p className="muted small">{t("Add a drawing package: PDF or DWG sets, with an optional rate list and bill.")}</p>
          <p className="faint small">{t("Uploading is switched off in this demo.")}</p>
        </aside>
      </div>
    </div>
  );
}

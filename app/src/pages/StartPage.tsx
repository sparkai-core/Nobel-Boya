import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { Logo } from "../components/ui";
import { Building3D } from "../components/Building3D";

const TEXT_LABEL = { true: "Text layer", false: "Image only", partial: "Partly text" } as const;

export function StartPage() {
  const navigate = useNavigate();
  const generated = useApp((s) => s.generated);
  const boq = useBoq();
  const p = data.project;

  return (
    <div className="home">
      <header className="home-top">
        <span className="brand-inline">
          <Logo size={34} />
          <span className="brand-words">
            <strong>Nobel BOQ</strong>
            <small>Quantity takeoff platform</small>
          </span>
        </span>
      </header>

      <section className="home-head">
        <h1>Projects</h1>
        <p className="lead">
          Each project is one drawing package. Nobel reads the schedules, places every quantity back on the sheet it came from, checks the drawings
          against each other and prices the bill.
        </p>
      </section>

      <div className="home-grid">
        <article className="project-card card">
          <div className="project-art">
            <Building3D />
          </div>
          <div className="project-body">
            <div className="project-status">
              <span className={`status-dot${generated ? " on" : ""}`} aria-hidden="true" />
              {generated ? "Bill generated" : "Ready to generate"}
            </div>
            <h2>{p.nameEn}</h2>
            <p className="muted">{p.placeEn}</p>
            <dl className="project-facts">
              <div>
                <dt>Client</dt>
                <dd>{p.client}</dd>
              </div>
              <div>
                <dt>Designer</dt>
                <dd>{p.designer}</dd>
              </div>
              <div>
                <dt>Issue</dt>
                <dd>Working design, {p.issued}</dd>
              </div>
              {generated ? (
                <div>
                  <dt>Bill total incl. VAT</dt>
                  <dd className="num-inline">{fmtMoney(boq.total)} AZN</dd>
                </div>
              ) : null}
            </dl>

            <div className="project-files">
              <div className="project-files-head">
                <strong>Drawing package</strong>
                <span className="muted small num-inline">4 files, 205 sheets</span>
              </div>
              <ul>
                {data.documents.map((d) => (
                  <li key={d.code}>
                    <FileText size={15} aria-hidden="true" />
                    <span className="truncate">{d.file}</span>
                    <span className="muted num-inline">{data.sheets.filter((s) => s.doc === d.code).length}</span>
                    <span className={`layer layer-${String(d.text)}`}>{TEXT_LABEL[String(d.text) as "true" | "false" | "partial"]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="project-actions">
              {generated ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => navigate("/overview")}>
                    Open project
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate("/generate")}>
                    Generate again
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => navigate("/generate")}>
                  Generate the bill of quantities
                </button>
              )}
            </div>
          </div>
        </article>

        <aside className="new-project" aria-disabled="true">
          <span className="new-icon">
            <Plus size={20} />
          </span>
          <h3>New project</h3>
          <p className="muted small">Add a drawing package: PDF or DWG sets, with an optional rate list and bill.</p>
          <p className="faint small">Uploading is switched off in this demo.</p>
        </aside>
      </div>
    </div>
  );
}

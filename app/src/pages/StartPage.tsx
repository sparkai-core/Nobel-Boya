import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { data, sheetImage } from "../data";
import { useApp } from "../lib/store";
import { Logo } from "../components/ui";
import { Building3D } from "../components/Building3D";

const TEXT_LABEL = { true: "Text layer on every sheet", false: "No text layer, image only", partial: "Text layer on 4 of 36 sheets" } as const;

export function StartPage() {
  const navigate = useNavigate();
  const generated = useApp((s) => s.generated);
  const p = data.project;

  return (
    <div className="start">
      <header className="start-top">
        <span className="brand-inline">
          <Logo />
          <strong>Tutulan</strong>
        </span>
        {generated ? (
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/overview")}>
            Open the last bill
          </button>
        ) : null}
      </header>

      <section className="start-hero">
        <div className="start-copy">
          <p className="start-place">{p.placeEn}</p>
          <h1>{p.nameEn}</h1>
          <p className="start-lead">
            Four PDF files, 205 sheets in Azerbaijani. Tutulan reads the schedules, places every quantity back on the sheet it came from,
            checks the arithmetic across disciplines, and prices the result.
          </p>
          <dl className="start-facts">
            <div>
              <dt>Client</dt>
              <dd>{p.client}</dd>
            </div>
            <div>
              <dt>Designer</dt>
              <dd>{p.designer}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>Working design, issued {p.issued}</dd>
            </div>
          </dl>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate("/generate")}>
            Generate the bill of quantities
          </button>
        </div>

        <div className="start-art">
          <Building3D />
        </div>

        <ol className="package">
          {data.documents.map((d) => {
            const sheets = data.sheets.filter((s) => s.doc === d.code);
            const cover = sheets.find((s) => s.discipline !== "general") ?? sheets[0]!;
            return (
              <li key={d.code} className="package-file">
                <img src={sheetImage(cover.id, true)} alt="" loading="lazy" />
                <div>
                  <div className="package-name">
                    <FileText size={15} />
                    <span className="truncate">{d.file}</span>
                  </div>
                  <div className="package-title">{d.en}</div>
                  <div className="package-meta">
                    <span className="num">{sheets.length} sheets</span>
                    <span className={`layer layer-${String(d.text)}`}>{TEXT_LABEL[String(d.text) as "true" | "false" | "partial"]}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

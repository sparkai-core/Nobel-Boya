import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, CheckCircle2, FileText, LogIn, Sparkles } from "lucide-react";
import { data, sheetImage } from "../data";
import { useApp } from "../lib/store";
import { Logo } from "../components/ui";

const DISCIPLINE_SPEC = {
  true: "Complete Vector Schedules & Bill of Materials",
  partial: "Architectural Layouts & Room Finish Schedules",
  false: "Civil Setting-Out Plans & Master Site Zoning",
} as const;

export function StartPage() {
  const navigate = useNavigate();
  const generated = useApp((s) => s.generated);
  const user = useApp((s) => s.user);
  const p = data.project;

  return (
    <div className="start modern-start">
      <header className="start-top">
        <div className="brand-inline">
          <Logo size={30} />
          <div>
            <strong>Tutulan</strong>
            <span className="brand-sub">Engineering Takeoff Intelligence</span>
          </div>
        </div>

        <div className="start-top-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate("/login")}>
            <LogIn size={15} />
            <span>{user ? `${user.name} (${user.role})` : "Sign In / Demo Access"}</span>
          </button>
          {generated ? (
            <button type="button" className="btn btn-primary" onClick={() => navigate("/overview")}>
              <span>Resume Open Takeoff</span>
              <ArrowRight size={15} />
            </button>
          ) : null}
        </div>
      </header>

      <section className="start-hero">
        <div className="start-copy">
          <div className="start-project-tag">
            <Building2 size={13} />
            <span>Qobu Settlement, Abşeron District, Baku</span>
          </div>

          <h1>{p.nameEn}</h1>
          <p className="start-lead">
            Automated quantity takeoff, structural schedule correlation, and pixel-level redline verification for Azerbaijani working-design packages. Every single quantity is linked to its exact coordinate bounding box on the original drawings.
          </p>

          <dl className="start-facts">
            <div className="fact-box">
              <dt>Client</dt>
              <dd>{p.client}</dd>
            </div>
            <div className="fact-box">
              <dt>Design Organization</dt>
              <dd>{p.designer}</dd>
            </div>
            <div className="fact-box">
              <dt>Project Stage</dt>
              <dd>Working Design (İşçi Layihə), 2026</dd>
            </div>
          </dl>

          <div className="start-cta-row">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate("/generate")}>
              <Sparkles size={16} />
              <span>Generate Bill of Quantities</span>
              <ArrowRight size={16} />
            </button>
            <button type="button" className="btn btn-outline btn-lg" onClick={() => navigate("/login")}>
              <span>Demo Login Portal</span>
            </button>
          </div>

          <div className="start-trust-badges">
            <div className="trust-badge">
              <CheckCircle2 size={15} className="text-emerald" />
              <span>323 Verified Takeoff Lines</span>
            </div>
            <div className="trust-badge">
              <CheckCircle2 size={15} className="text-emerald" />
              <span>205 Complete Drawing Sheets</span>
            </div>
            <div className="trust-badge">
              <CheckCircle2 size={15} className="text-emerald" />
              <span>16 Automated Discipline Checks</span>
            </div>
          </div>
        </div>

        {/* 4 Drawing Volume Cards */}
        <div className="package-container">
          <div className="package-header">
            <h3>Verified Tender Drawing Volumes</h3>
            <span className="text-muted small">4 Volumes • 205 Sheets</span>
          </div>

          <ol className="package-grid">
            {data.documents.map((d) => {
              const sheets = data.sheets.filter((s) => s.doc === d.code);
              const cover = sheets.find((s) => s.discipline !== "general") ?? sheets[0]!;
              const specDesc = DISCIPLINE_SPEC[String(d.text) as "true" | "false" | "partial"];

              return (
                <li key={d.code} className="package-card">
                  <div className="package-card-thumb">
                    <img src={sheetImage(cover.id, true)} alt={d.en} loading="lazy" />
                    <span className="package-doc-code">{d.code}</span>
                  </div>
                  <div className="package-card-body">
                    <div className="package-card-title-row">
                      <FileText size={15} className="text-muted" />
                      <strong className="truncate">{d.en}</strong>
                    </div>
                    <p className="package-az-title">{d.az}</p>
                    <div className="package-spec-info">
                      <span className="package-sheet-count">{sheets.length} Sheets</span>
                      <span className="package-spec-tag">{specDesc}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}

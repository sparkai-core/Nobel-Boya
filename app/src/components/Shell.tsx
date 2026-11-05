import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ClipboardCheck, FileSpreadsheet, FolderKanban, Gauge, Layers, LogOut, ReceiptText, Settings, Table2 } from "lucide-react";
import { data, P } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useT } from "../lib/i18n";
import { projectName } from "../lib/loc";
import { useApp } from "../lib/store";
import { Logo } from "./ui";

const NAV = [
  { to: `${P}/bill`, label: "Bill of quantities", icon: Table2 },
  { to: `${P}/drawings`, label: "Drawings", icon: Layers },
  { to: `${P}/checks`, label: "Checks", icon: ClipboardCheck },
  { to: `${P}/overview`, label: "Overview", icon: Gauge },
  { to: `${P}/rates`, label: "Rates and mark-ups", icon: ReceiptText },
  { to: `${P}/export`, label: "Export", icon: FileSpreadsheet },
];

export function Shell() {
  const boq = useBoq();
  const t = useT();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const user = useApp((s) => s.user);
  const signOut = useApp((s) => s.signOut);
  const generated = useApp((s) => s.generated);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inProject = pathname.startsWith(P) && generated;
  const open = data.checks.filter((c) => c.severity === "error" || c.severity === "warn").length;
  const link = ({ isActive }: { isActive: boolean }) => `rail-link${isActive ? " active" : ""}`;

  return (
    <div className="app">
      <aside className="rail" aria-label={t("Main navigation")}>
        <button type="button" className="brand" onClick={() => navigate("/projects")}>
          <Logo size={30} />
          <span>
            <strong>Nobel BOQ</strong>
            <small>{t("Quantity takeoff platform")}</small>
          </span>
        </button>

        <nav className="rail-nav">
          <NavLink to="/projects" title={t("Projects")} className={link}>
            <FolderKanban size={17} strokeWidth={1.8} />
            <span>{t("Projects")}</span>
          </NavLink>
        </nav>

        {inProject ? (
          <>
            <div className="rail-project">
              <span className="rail-project-label">{t("Project")}</span>
              <span className="rail-project-name">{projectName(lang)}</span>
              <span className="rail-project-meta">{t("4 files, 205 sheets")}</span>
            </div>
            <nav className="rail-nav">
              {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} title={t(label)} className={link}>
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{t(label)}</span>
                  {to.endsWith("/checks") && open ? <span className="rail-badge">{open}</span> : null}
                </NavLink>
              ))}
            </nav>
            <div className="rail-total">
              <span className="muted small">{t("Bill total incl. VAT")}</span>
              <strong className="num">{fmtMoney(boq.total)}</strong>
              <span className="muted small">{t("{c}, sample rates", { c: data.project.currency })}</span>
            </div>
          </>
        ) : (
          <div className="rail-spacer" />
        )}

        <nav className="rail-nav rail-bottom">
          <NavLink to="/settings" title={t("Settings")} className={link}>
            <Settings size={17} strokeWidth={1.8} />
            <span>{t("Settings")}</span>
          </NavLink>
        </nav>

        <div className="rail-foot">
          <span className="muted small">{t("Language")}</span>
          <div className="lang" role="group" aria-label={t("Interface language")}>
            <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
              EN
            </button>
            <button type="button" aria-pressed={lang === "az"} onClick={() => setLang("az")}>
              AZ
            </button>
          </div>
        </div>
        <div className="rail-user">
          <span className="avatar" aria-hidden="true">
            {(user ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="rail-user-email truncate" title={user ?? ""}>
            {user}
          </span>
          <button
            type="button"
            className="icon-btn"
            title={t("Sign out")}
            aria-label={t("Sign out")}
            onClick={() => {
              signOut();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHead({ title, lead, actions }: { title: string; lead?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-titles">
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

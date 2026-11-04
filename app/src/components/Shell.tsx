import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  FileSpreadsheet,
  Gauge,
  Layers,
  LogOut,
  ReceiptText,
  Table2,
  UserCheck,
} from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { Logo } from "./ui";

const NAV = [
  { to: "/overview", label: "Overview", icon: Gauge },
  { to: "/bill", label: "Bill of Quantities", icon: Table2 },
  { to: "/drawings", label: "Drawing Sheets", icon: Layers },
  { to: "/checks", label: "Discipline Checks", icon: ClipboardCheck },
  { to: "/rates", label: "Rates & Mark-ups", icon: ReceiptText },
  { to: "/export", label: "Excel Export", icon: FileSpreadsheet },
];

export function Shell() {
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const user = useApp((s) => s.user);
  const logout = useApp((s) => s.logout);
  const navigate = useNavigate();

  const openIssues = data.checks.filter((c) => c.severity === "error" || c.severity === "warn").length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app modern-app">
      <aside className="rail" aria-label="Main navigation">
        <button type="button" className="brand" onClick={() => navigate("/")} title="Project Overview">
          <Logo size={28} />
          <div>
            <strong>Tutulan</strong>
            <small>Quantity Takeoff Intelligence</small>
          </div>
        </button>

        <div className="rail-project">
          <span className="rail-project-name">{data.project.nameEn}</span>
          <span className="rail-project-meta">{data.project.placeEn}</span>
        </div>

        <nav className="rail-nav">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {to === "/checks" && openIssues ? <span className="rail-badge">{openIssues}</span> : null}
            </NavLink>
          ))}
        </nav>

        {/* Commercial valuation summary */}
        <div className="rail-total">
          <span className="muted small">Contract Valuation (incl. VAT)</span>
          <strong className="num">{fmtMoney(boq.total)}</strong>
          <span className="muted small">AZN • Azerbaijani Standard Norms</span>
        </div>

        {/* User Session Profile & Language Toggle */}
        <div className="rail-user-section">
          {user ? (
            <div className="user-profile-widget">
              <div className="user-avatar-initials">
                {user.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="user-details truncate">
                <span className="user-name truncate">{user.name}</span>
                <span className="user-role truncate">{user.role}</span>
              </div>
              <button
                type="button"
                className="icon-btn-ghost"
                onClick={handleLogout}
                title="Sign out of session"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-outline btn-sm btn-block"
              onClick={() => navigate("/login")}
            >
              <UserCheck size={14} />
              <span>Sign In as Estimator</span>
            </button>
          )}

          <div className="rail-foot">
            <span className="muted small">Nomenclature</span>
            <div className="lang" role="group" aria-label="Description language">
              <button
                type="button"
                aria-pressed={lang === "az"}
                onClick={() => setLang("az")}
                title="Azərbaycan dilində mühəndislik terminologiyası"
              >
                AZ
              </button>
              <button
                type="button"
                aria-pressed={lang === "en"}
                onClick={() => setLang("en")}
                title="English engineering nomenclature"
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHead({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
}) {
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

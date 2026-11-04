import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ClipboardCheck, FileSpreadsheet, Gauge, Layers, ReceiptText, Table2 } from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { Logo } from "./ui";

const NAV = [
  { to: "/overview", label: "Overview", icon: Gauge },
  { to: "/bill", label: "Bill of quantities", icon: Table2 },
  { to: "/drawings", label: "Drawings", icon: Layers },
  { to: "/checks", label: "Checks", icon: ClipboardCheck },
  { to: "/rates", label: "Rates and mark-ups", icon: ReceiptText },
  { to: "/export", label: "Export", icon: FileSpreadsheet },
];

export function Shell() {
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const navigate = useNavigate();
  const open = data.checks.filter((c) => c.severity === "error" || c.severity === "warn").length;

  return (
    <div className="app">
      <aside className="rail" aria-label="Main navigation">
        <button type="button" className="brand" onClick={() => navigate("/")}>
          <Logo />
          <span>
            <strong>Tutulan</strong>
            <small>Bill of quantities</small>
          </span>
        </button>

        <div className="rail-project">
          <span className="rail-project-name">{data.project.nameEn}</span>
          <span className="rail-project-meta">{data.project.placeEn}</span>
        </div>

        <nav className="rail-nav">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={label} className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {to === "/checks" && open ? <span className="rail-badge">{open}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="rail-total">
          <span className="muted small">Bill total incl. VAT</span>
          <strong className="num">{fmtMoney(boq.total)}</strong>
          <span className="muted small">{data.project.currency}, sample rates</span>
        </div>

        <div className="rail-foot">
          <span className="muted small">Descriptions</span>
          <div className="lang" role="group" aria-label="Description language">
            <button type="button" aria-pressed={lang === "az"} onClick={() => setLang("az")}>
              AZ
            </button>
            <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
              EN
            </button>
          </div>
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

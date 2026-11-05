import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  FileDown,
  Gauge,
  Layers,
  LogOut,
  Pin,
  PinOff,
  ReceiptText,
  Table2,
  UserCheck,
} from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { t } from "../lib/i18n";
import { Logo } from "./ui";

export function Shell() {
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const user = useApp((s) => s.user);
  const logout = useApp((s) => s.logout);
  const navigate = useNavigate();

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(() => localStorage.getItem("storm.dock.pinned") === "1");

  const openIssues = data.checks.filter((c) => c.severity === "error" || c.severity === "warn").length;

  const NAV = [
    { to: "/overview", label: t("navOverview", lang), icon: Gauge, hint: t("navOverviewHint", lang) },
    { to: "/drawings", label: t("navDrawings", lang), icon: Layers, hint: t("navDrawingsHint", lang) },
    { to: "/bill", label: t("navBill", lang), icon: Table2, hint: t("navBillHint", lang) },
    { to: "/checks", label: t("navChecks", lang), icon: ClipboardCheck, hint: t("navChecksHint", lang) },
    { to: "/rates", label: t("navRates", lang), icon: ReceiptText, hint: t("navRatesHint", lang) },
    { to: "/export", label: t("navExport", lang), icon: FileDown, hint: t("navExportHint", lang) },
  ];

  const togglePinned = () => {
    const next = !isPinned;
    setIsPinned(next);
    localStorage.setItem("storm.dock.pinned", next ? "1" : "0");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isExpanded = isPinned || isHovered;

  return (
    <div className={`app modern-app${isPinned ? " dock-pinned" : ""}`}>
      {/* Floating macOS / Linear Style Dock Hub */}
      <aside
        className={`dock-hub${isExpanded ? " expanded" : ""}${isPinned ? " pinned" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Main navigation dock"
      >
        <div className="dock-inner">
          {/* Brand & Pin Header */}
          <div className="dock-brand-bar">
            <button
              type="button"
              className="dock-brand"
              onClick={() => navigate("/overview")}
              title="Storm Takeoff Platform"
            >
              <Logo size={32} />
              <div className="dock-brand-text">
                <strong>Storm</strong>
                <span className="dock-brand-sub">Takeoff &amp; BOQ</span>
              </div>
            </button>
            <button
              type="button"
              className={`dock-pin-btn${isPinned ? " active" : ""}`}
              onClick={togglePinned}
              title={isPinned ? "Unpin navigation dock" : "Pin navigation open"}
              aria-label={isPinned ? "Unpin dock" : "Pin dock"}
            >
              {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          </div>

          {/* Project Active Pill */}
          <div
            className="dock-project-chip clickable"
            onClick={() => navigate("/drawings")}
            title={`${lang === "az" ? data.project.name : data.project.nameEn} • ${lang === "az" ? data.project.place : data.project.placeEn}`}
          >
            <span className="project-status-dot" />
            <div className="dock-project-info">
              <span className="project-title truncate">
                {lang === "az" ? data.project.name : data.project.nameEn}
              </span>
              <span className="project-sub truncate">
                {lang === "az" ? data.project.place : "Absheron, Baku • 2026"}
              </span>
            </div>
          </div>

          {/* Navigation Items (Drawing Register before BOQ) */}
          <nav className="dock-nav">
            {NAV.map(({ to, label, icon: Icon, hint }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `dock-item${isActive ? " active" : ""}`}
              >
                <div className="dock-item-icon-wrap">
                  <Icon size={18} strokeWidth={1.8} />
                  {to === "/checks" && openIssues ? (
                    <span className="dock-mini-badge" title={`${openIssues} active issues`}>
                      {openIssues}
                    </span>
                  ) : null}
                </div>
                <div className="dock-item-label">
                  <span className="dock-label-text">{label}</span>
                  <span className="dock-label-hint">{hint}</span>
                </div>
                {to === "/checks" && openIssues ? (
                  <span className="dock-count-pill">{openIssues}</span>
                ) : null}
                {/* Floating Tooltip in collapsed mode */}
                <div className="dock-floating-tooltip" role="tooltip">
                  <strong>{label}</strong>
                  <span>{hint}</span>
                </div>
              </NavLink>
            ))}
          </nav>

          {/* Commercial valuation quick tile */}
          <div className="dock-total-tile">
            <span className="dock-total-label">{t("contractValuation", lang)}</span>
            <strong className="dock-total-amount num">{fmtMoney(boq.total)} ₼</strong>
            <span className="dock-total-meta">{t("contractValuationSub", lang)}</span>
          </div>

          {/* User Session & Language Switcher */}
          <div className="dock-foot">
            {user ? (
              <div className="dock-user-card">
                <div className="dock-avatar">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="dock-user-info truncate">
                  <span className="dock-user-name truncate">{user.name}</span>
                  <span className="dock-user-role truncate">{user.role}</span>
                </div>
                <button
                  type="button"
                  className="dock-logout-btn"
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
                <span>{t("signIn", lang)}</span>
              </button>
            )}

            {/* Language Switcher */}
            <div className="dock-lang-bar">
              <span className="dock-lang-label">{t("norms", lang)}</span>
              <div className="lang" role="group" aria-label="Nomenclature language">
                <button
                  type="button"
                  aria-pressed={lang === "en"}
                  onClick={() => setLang("en")}
                  title="English engineering nomenclature"
                >
                  EN
                </button>
                <button
                  type="button"
                  aria-pressed={lang === "az"}
                  onClick={() => setLang("az")}
                  title="Azərbaycan dilində mühəndislik terminologiyası"
                >
                  AZ
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
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
    <header className="page-head modern-page-head">
      <div className="page-titles">
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

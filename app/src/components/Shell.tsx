import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ClipboardCheck,
  FileDown,
  HelpCircle,
  Layers,
  LayoutDashboard,
  ReceiptText,
  Search,
  Settings,
  Table2,
} from "lucide-react";
import { data } from "../data";
import { useApp } from "../lib/store";
import { t } from "../lib/i18n";
import { Logo } from "./ui";
import { Modals } from "./Modals";

export function Shell() {
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const user = useApp((s) => s.user);
  const showSettings = useApp((s) => s.showSettings);
  const setShowSettings = useApp((s) => s.setShowSettings);
  const showShortcuts = useApp((s) => s.showShortcuts);
  const setShowShortcuts = useApp((s) => s.setShowShortcuts);
  const location = useLocation();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openIssues = data.checks.filter((c) => c.severity === "error" || c.severity === "warn").length;

  const NAV = [
    { to: "/overview", label: t("navOverview", lang), icon: LayoutDashboard, hint: t("navOverviewHint", lang), shortcut: "1" },
    { to: "/drawings", label: t("navDrawings", lang), icon: Layers, hint: t("navDrawingsHint", lang), shortcut: "2" },
    { to: "/bill", label: t("navBill", lang), icon: Table2, hint: t("navBillHint", lang), shortcut: "3" },
    { to: "/checks", label: t("navChecks", lang), icon: ClipboardCheck, hint: t("navChecksHint", lang), badge: openIssues, shortcut: "4" },
    { to: "/rates", label: t("navRates", lang), icon: ReceiptText, hint: t("navRatesHint", lang), shortcut: "5" },
    { to: "/export", label: t("navExport", lang), icon: FileDown, hint: t("navExportHint", lang), shortcut: "6" },
  ];

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches("input, textarea, select")) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcuts(true);
      } else if (e.key === "Escape") {
        setShowSettings(false);
        setShowShortcuts(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "1") navigate("/overview");
        else if (e.key === "2") navigate("/drawings");
        else if (e.key === "3") navigate("/bill");
        else if (e.key === "4") navigate("/checks");
        else if (e.key === "5") navigate("/rates");
        else if (e.key === "6") navigate("/export");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, setShowSettings, setShowShortcuts]);

  return (
    <div className="platform-viewport">
      {/* 2026 Panze Studio Window Surface */}
      <div className="platform-window">
        {/* Left Sleek Icon Rail */}
        <aside className="platform-rail" aria-label="Main Navigation">
          <div className="rail-top">
            <button
              type="button"
              className="rail-brand-btn"
              onClick={() => navigate("/overview")}
              title="Storm Takeoff Platform"
            >
              <Logo size={28} />
            </button>
          </div>

          <nav className="rail-nav">
            {NAV.map(({ to, label, icon: Icon, badge, shortcut }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `rail-nav-item${isActive ? " active" : ""}`}
                title={`${label} (⌘${shortcut})`}
              >
                <div className="rail-icon-wrap">
                  <Icon size={19} strokeWidth={1.8} />
                  {badge ? <span className="rail-badge">{badge}</span> : null}
                </div>
                <div className="rail-tooltip">
                  <strong>{label}</strong>
                  <span>⌘{shortcut}</span>
                </div>
              </NavLink>
            ))}
          </nav>

          <div className="rail-bottom">
            {/* Language Switcher Pill */}
            <button
              type="button"
              className="rail-lang-btn"
              onClick={() => setLang(lang === "en" ? "az" : "en")}
              title={lang === "en" ? "Switch to Azerbaijani" : "Switch to English"}
            >
              <span>{lang.toUpperCase()}</span>
            </button>

            {/* Shortcuts Guide */}
            <button
              type="button"
              className={`rail-icon-btn${showShortcuts ? " active" : ""}`}
              onClick={() => setShowShortcuts(true)}
              title="Keyboard Shortcuts & Productivity Guide (?)"
            >
              <HelpCircle size={17} />
            </button>

            {/* Platform Settings */}
            <button
              type="button"
              className={`rail-icon-btn${showSettings ? " active" : ""}`}
              onClick={() => setShowSettings(true)}
              title="Platform Settings & Commercial Parameters"
            >
              <Settings size={17} />
            </button>

            {/* User Profile Avatar */}
            <div
              className="rail-user-avatar"
              title={`${user?.name || "Elmir Məmmədov"} (${user?.role || "Lead QS"})`}
              onClick={() => navigate("/login")}
              role="button"
              tabIndex={0}
            >
              {(user?.name || "EM")
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
          </div>
        </aside>

        {/* Right Application Body */}
        <div className="platform-body">
          {/* Top Global Header Bar (Panze Studio Style) */}
          <header className="platform-topbar">
            {/* Left: Project Context */}
            <div
              className="platform-project-lead clickable"
              onClick={() => navigate("/drawings")}
              title="View Qobu Working Design Drawings"
            >
              <span className="project-status-dot" />
              <div className="project-titles-wrap">
                <span className="project-name truncate">
                  {lang === "az" ? data.project.name : data.project.nameEn}
                </span>
                <span className="project-stage-kicker truncate">
                  {lang === "az" ? "İşçi Layihə (2026) • Abşeron, Bakı" : "Working Design (2026) • Absheron, Baku"}
                </span>
              </div>
            </div>

            {/* Center: Panze Studio Segmented Pill Switcher */}
            <div className="platform-scope-pills" role="tablist">
              <button
                type="button"
                className={`scope-pill${location.pathname === "/overview" ? " active" : ""}`}
                onClick={() => navigate("/overview")}
              >
                {t("navOverview", lang)}
              </button>
              <button
                type="button"
                className={`scope-pill${location.pathname.startsWith("/drawings") ? " active" : ""}`}
                onClick={() => navigate("/drawings")}
              >
                {t("navDrawings", lang)} (205)
              </button>
              <button
                type="button"
                className={`scope-pill${location.pathname.startsWith("/bill") ? " active" : ""}`}
                onClick={() => navigate("/bill")}
              >
                {t("navBill", lang)} (117)
              </button>
              <button
                type="button"
                className={`scope-pill${location.pathname.startsWith("/checks") ? " active" : ""}`}
                onClick={() => navigate("/checks")}
              >
                {t("navChecks", lang)} ({openIssues})
              </button>
              <button
                type="button"
                className={`scope-pill${location.pathname.startsWith("/rates") ? " active" : ""}`}
                onClick={() => navigate("/rates")}
              >
                {t("navRates", lang)}
              </button>
            </div>

            {/* Right: Omnibox Search, Notification Bell, User profile */}
            <div className="platform-topbar-actions">
              <div className="topbar-search">
                <Search size={14} className="topbar-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="topbar-search-input"
                  placeholder={t("searchPlaceholder", lang)}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && search.trim()) {
                      navigate(`/bill?q=${encodeURIComponent(search.trim())}`);
                    }
                  }}
                />
                <span className="topbar-search-kbd">⌘K</span>
              </div>

              <button
                type="button"
                className="topbar-action-btn badge-wrap"
                onClick={() => navigate("/checks")}
                title={`${openIssues} active discipline audits`}
              >
                <Bell size={15} />
                {openIssues > 0 ? <span className="topbar-badge-dot" /> : null}
              </button>

              <button
                type="button"
                className={`topbar-action-btn${showSettings ? " active" : ""}`}
                onClick={() => setShowSettings(true)}
                title="Platform Settings & Commercial Parameters"
              >
                <Settings size={15} />
              </button>

              <button
                type="button"
                className={`topbar-action-btn${showShortcuts ? " active" : ""}`}
                onClick={() => setShowShortcuts(true)}
                title="Keyboard Shortcuts (?)"
              >
                <HelpCircle size={15} />
              </button>

              <div
                className="topbar-user-chip"
                onClick={() => navigate("/export")}
                title={`${user?.name || "Elmir Məmmədov"} • Storm Building MMC`}
              >
                <div className="user-avatar-sm">
                  {(user?.name || "EM")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div className="user-info-text">
                  <span className="user-name truncate">{user?.name || "Elmir Məmmədov"}</span>
                  <span className="user-role truncate">{lang === "az" ? "Baş Smetaçı" : "Lead QS"}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Workspace Area */}
          <main className="platform-main">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Global Modals (Settings & Shortcuts) */}
      <Modals />
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

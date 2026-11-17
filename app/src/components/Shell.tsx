import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronsLeft, ChevronsRight, ExternalLink, FolderKanban, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { data, P } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useT } from "../lib/i18n";
import { projectName } from "../lib/loc";
import { useApp } from "../lib/store";
import { MODULES } from "../ops/nav";
import { useOps } from "../ops/store";
import { TODAY } from "../ops/dates";
import { Logo } from "./ui";
import { CommandPalette, NotificationBell, openPalette, Toaster } from "./kit";
import { fmtDate } from "../ops/dates";

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
  const [open, setOpen] = useState(false);
  const inProject = pathname.startsWith(P) && generated;
  const mod = MODULES.find((m) => m.key !== "estimate" && m.match(pathname)) ?? MODULES[0]!;

  const approvals = useOps((s) => s.approvals.filter((a) => a.status === "PENDING").length);
  const exceptions = useOps((s) => s.exceptions.filter((e) => e.status === "open" || e.status === "assigned").length);
  const delays = useOps((s) => s.delays.filter((d) => d.status === "OPEN" || d.status === "CONFIRMED" || d.status === "UNDER_REVIEW").length);
  const rfis = useOps((s) => s.rfis.filter((r) => r.status === "OPEN" && r.dueAt < TODAY).length);
  const checks = data.checks.filter((c) => c.severity === "error" || c.severity === "warn").length;
  const invoices = useOps((s) => s.invoices.filter((i) => i.status === "MISMATCH" || i.status === "TO_MATCH").length);
  const constraints = useOps((s) => s.constraints.filter((c) => c.status === "OPEN" && c.due <= TODAY).length);
  const safety = useOps((s) => s.incidents.filter((i) => i.status !== "CLOSED").length + s.ppeChecks.filter((p) => p.status === "WAITING").length);
  const badges: Record<string, number> = { approvals, exceptions, delays, rfis, checks, invoices, constraints, safety };
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("nobel.rail.closed") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const toggleGroup = (id: string) =>
    setClosed((c) => {
      const nextC = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      try {
        localStorage.setItem("nobel.rail.closed", JSON.stringify(nextC));
      } catch {
        /* ignore */
      }
      return nextC;
    });

  // Sidebar collapse: the user's choice wins; without one, narrow screens (< 1280px) start collapsed.
  const [railPref, setRailPref] = useState<"collapsed" | "expanded" | null>(() => {
    try {
      const v = localStorage.getItem("nobel.rail.pref");
      return v === "collapsed" || v === "expanded" ? v : null;
    } catch {
      return null;
    }
  });
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth <= 1280);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 1280);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const railCollapsed = railPref === "collapsed" || (railPref !== "expanded" && narrow);
  const toggleRail = () => {
    const next = railCollapsed ? "expanded" : "collapsed";
    setRailPref(next);
    try {
      localStorage.setItem("nobel.rail.pref", next);
    } catch {
      /* storage blocked */
    }
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);
  const popRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<React.CSSProperties | null>(null);
  // The menu is portalled to <body> with fixed coordinates so the rail's overflow never clips it.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const place = () => {
      const r = menuRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 264;
      const narrowRail = r.width < 120;
      const left = narrowRail ? r.right + 10 : r.left;
      setMenuPos({
        left: Math.max(8, Math.min(left, window.innerWidth - W - 8)),
        bottom: narrowRail ? Math.max(8, window.innerHeight - r.bottom) : window.innerHeight - r.top + 8,
        width: Math.min(W, window.innerWidth - 16),
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node) && setMenuOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [menuOpen]);

  const link = ({ isActive }: { isActive: boolean }) => `rail-link${isActive ? " active" : ""}`;

  return (
    <div className={`app${open ? " rail-open" : ""}${railCollapsed ? " rail-collapsed" : ""}${!railCollapsed && narrow ? " rail-expanded" : ""}`}>
      <header className="m-bar">
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={t("Open menu")}>
          <Menu size={20} />
        </button>
        <Logo size={26} />
        <span className="m-bar-title truncate">{inProject ? t(mod.label) : t("Projects")}</span>
      </header>
      <div className="rail-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className="rail" aria-label={t("Main navigation")}>
        <div className="rail-top">
          <button type="button" className="brand" onClick={() => navigate("/projects")}>
            <Logo size={30} />
            <span>
              <strong>Nobel BOQ</strong>
              <small>{t("Quantity takeoff platform")}</small>
            </span>
          </button>
          <button type="button" className="icon-btn rail-close" onClick={() => setOpen(false)} aria-label={t("Close menu")}>
            <X size={18} />
          </button>
        </div>

        <div className="rail-scroll">
          <nav className="rail-nav">
            <button type="button" className="rail-link rail-search" onClick={openPalette} title={t("Search everything")}>
              <Search size={17} strokeWidth={1.8} />
              <span>{t("Search")}</span>
              <kbd>Ctrl K</kbd>
            </button>
            <NavLink to="/projects" end title={t("Projects")} className={link}>
              <FolderKanban size={17} strokeWidth={1.8} />
              <span>{t("Projects")}</span>
            </NavLink>
            <NotificationBell />
          </nav>

          {inProject ? (
            <>
              <div className="rail-project">
                <span className="rail-project-label">{t("Project")}</span>
                <span className="rail-project-name">{projectName(lang)}</span>
                <span className="rail-project-meta">{t("4 files, 205 sheets")}</span>
              </div>

              <div className="rail-modules" role="tablist" aria-label={t("Modules")}>
                {MODULES.map((m) => {
                  const Icon = m.icon;
                  const on = m.key === mod.key;
                  return (
                    <button key={m.key} type="button" role="tab" aria-selected={on} className={on ? "on" : undefined} title={t(m.label)} onClick={() => navigate(m.home)}>
                      <Icon size={16} strokeWidth={1.9} />
                      <span>{t(m.short)}</span>
                    </button>
                  );
                })}
              </div>

              {mod.groups.map((g) => {
                const active = g.links.some((l) => (l.end ? pathname === l.to : pathname.startsWith(l.to)));
                const isClosed = !!g.label && closed.includes(g.id) && !active;
                const groupCount = g.links.reduce((a, l) => a + (l.badge ? (badges[l.badge] ?? 0) : 0), 0);
                return (
                <nav key={g.id} className={`rail-nav rail-group${isClosed ? " closed" : ""}`} aria-label={g.label ? t(g.label) : t(mod.label)}>
                  {g.label ? (
                    <button type="button" className="rail-group-label" aria-expanded={!isClosed} onClick={() => toggleGroup(g.id)}>
                      <span>{t(g.label)}</span>
                      {isClosed && groupCount ? <b className="rail-group-count">{groupCount}</b> : null}
                      <ChevronDown size={12} />
                    </button>
                  ) : null}
                  {isClosed ? null : g.links.map(({ to, label, icon: Icon, end, badge }) => (
                    <NavLink key={to} to={to} end={end} title={t(label)} className={link}>
                      <Icon size={17} strokeWidth={1.8} />
                      <RailLabel text={t(label)} />
                      {badge && badges[badge] ? <span className="rail-badge">{badges[badge]}</span> : null}
                    </NavLink>
                  ))}
                </nav>
                );
              })}

              {mod.key === "procurement" ? (
                <a className="rail-link rail-portal" href="#/vendor" target="_blank" rel="noopener" title={t("Open the vendor portal in a new tab")}>
                  <ExternalLink size={17} strokeWidth={1.8} />
                  <RailLabel text={t("Vendor portal")} />
                </a>
              ) : null}

              {mod.key === "estimate" ? (
                <div className="rail-total">
                  <span className="muted small">{t("Bill total incl. VAT")}</span>
                  <strong className="num">{fmtMoney(boq.total)}</strong>
                  <span className="muted small">{t("{c}, sample rates", { c: data.project.currency })}</span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rail-spacer" />
          )}
        </div>

        <div className="rail-user" ref={menuRef}>
          <span className="avatar" aria-hidden="true">
            {(user ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="rail-user-email truncate" title={user ?? ""}>
            {user}
          </span>
          <button type="button" className="icon-btn rail-user-gear" title={t("Settings")} aria-label={t("Settings")} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            <Settings size={17} strokeWidth={1.8} />
          </button>
          {menuOpen && menuPos ? createPortal(
            <div className="rail-menu" role="menu" ref={popRef} style={menuPos}>
              <div className="rail-menu-head">
                <span className="avatar" aria-hidden="true">
                  {(user ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">
                  <strong className="truncate">{user}</strong>
                  <small>{t("Demo workspace")}</small>
                </span>
              </div>
              <div className="rail-menu-row" title={t("The demo runs on a fixed date so the story always reads the same way.")}>
                <span className="rail-demo-dot" aria-hidden="true" />
                <span>{t("Demo date")}</span>
                <b>{fmtDate(TODAY, lang)}</b>
              </div>
              <div className="rail-menu-row">
                <span>{t("Language")}</span>
                <div className="lang" role="group" aria-label={t("Interface language")}>
                  <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
                    EN
                  </button>
                  <button type="button" aria-pressed={lang === "az"} onClick={() => setLang("az")}>
                    AZ
                  </button>
                </div>
              </div>
              <button type="button" role="menuitem" className="rail-menu-item" onClick={() => navigate("/settings")}>
                <Settings size={16} strokeWidth={1.8} />
                {t("Settings")}
              </button>
              <button
                type="button"
                role="menuitem"
                className="rail-menu-item danger"
                onClick={() => {
                  signOut();
                  navigate("/login", { replace: true });
                }}
              >
                <LogOut size={16} strokeWidth={1.8} />
                {t("Sign out")}
              </button>
            </div>,
            document.body,
          ) : null}
        </div>
      </aside>
      <button type="button" className="rail-edge" onClick={toggleRail} aria-label={railCollapsed ? t("Expand sidebar") : t("Collapse sidebar")} aria-expanded={!railCollapsed} title={railCollapsed ? t("Expand sidebar") : t("Collapse sidebar")}>
        {railCollapsed ? <ChevronsRight size={12} strokeWidth={2.25} /> : <ChevronsLeft size={12} strokeWidth={2.25} />}
      </button>
      {!railCollapsed && narrow ? <div className="rail-edge-scrim" onClick={toggleRail} aria-hidden="true" /> : null}
      <main className="main">
        <Outlet />
      </main>
      <Toaster />
      <CommandPalette />
    </div>
  );
}

/** One-line rail label. When the text is cut off, hovering the link slides it right-to-left to show the rest. */
function RailLabel({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => {
      const inner = box.firstElementChild as HTMLElement | null;
      if (!inner) return;
      const over = inner.scrollWidth - box.clientWidth;
      box.style.setProperty("--slide", over > 0 ? `${-(over + 6)}px` : "0px");
      box.style.setProperty("--slide-ms", `${Math.max(500, over * 22)}ms`);
      box.classList.toggle("cut", over > 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);
  return (
    <span className="rail-label" ref={ref}>
      <span>{text}</span>
    </span>
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

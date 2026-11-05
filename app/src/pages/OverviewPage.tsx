import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  Command,
  Globe,
  HelpCircle,
  Keyboard,
  Layers,
  Percent,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
  X,
} from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney, pct } from "../lib/format";
import { DEFAULT_MARKUPS, useApp } from "../lib/store";
import { t } from "../lib/i18n";
import { Logo } from "../components/ui";

export function OverviewPage() {
  const boq = useBoq();
  const navigate = useNavigate();
  const fixes = useApp((s) => s.fixes);
  const setFix = useApp((s) => s.setFix);
  const approved = useApp((s) => s.approved);
  const toggleApprove = useApp((s) => s.toggleApprove);
  const user = useApp((s) => s.user);
  const markups = useApp((s) => s.markups);
  const setMarkup = useApp((s) => s.setMarkup);
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);

  const [taskTab, setTaskTab] = useState<"pending" | "approved">("pending");
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [curveTooltip, setCurveTooltip] = useState<{
    stage: string;
    direct: number;
    gross: number;
    x: number;
    y: number;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const works = boq.works || 1;

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      } else if (e.key === "Escape") {
        setShowSettings(false);
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Asset shares for Donut Chart
  const assetSlices = useMemo(() => {
    const whTotal = boq.buildings.find((b) => b.id === "WH")?.total || 437360;
    const adTotal = boq.buildings.find((b) => b.id === "AD")?.total || 407540;
    const pstkTotal =
      (boq.buildings.find((b) => b.id === "PS")?.total || 0) +
      (boq.buildings.find((b) => b.id === "TK")?.total || 69580);
    const siteTotal = boq.buildings.find((b) => b.id === "SITE")?.total || 79520;

    return [
      {
        id: "WH",
        name: lang === "az" ? "Anbar Binası (48×24m)" : "Warehouse Hall (48×24m)",
        color: "#B45309", // Architectural Bronze
        total: whTotal,
        share: whTotal / works,
      },
      {
        id: "AD",
        name: lang === "az" ? "İnzibati Ofis (2-Mərtəbəli)" : "Admin Office (2-Storey)",
        color: "#18181B", // Obsidian
        total: adTotal,
        share: adTotal / works,
      },
      {
        id: "SITE",
        name: lang === "az" ? "Sahə İşi və Abadlaşdırma" : "Site Works & Landscaping",
        color: "#D97706", // Amber Bronze
        total: siteTotal,
        share: siteTotal / works,
      },
      {
        id: "PS_TK",
        name: lang === "az" ? "Nasosxana və Su Çənləri" : "Pump Station & Reservoirs",
        color: "#71717A", // Warm Slate
        total: pstkTotal,
        share: pstkTotal / works,
      },
    ];
  }, [boq.buildings, works, lang]);

  // Dual curve milestones for Commercial Valuation Progression
  const milestones = [
    { stage: "Substructure", direct: 184000, gross: 274160 },
    { stage: "Frame & Trusses", direct: 452000, gross: 673480 },
    { stage: "Roofing", direct: 598000, gross: 891020 },
    { stage: "Envelope", direct: 742000, gross: 1105580 },
    { stage: "Finishes", direct: 886000, gross: 1320140 },
    { stage: "MEP & Utility", direct: 994000, gross: 1481060 },
  ];

  const width = 360;
  const height = 120;
  const padX = 22;
  const padY = 16;
  const maxVal = 1600000;

  const pointsDirect = milestones.map((m, i) => {
    const x = padX + (i / (milestones.length - 1)) * (width - 2 * padX);
    const y = height - padY - (m.direct / maxVal) * (height - 2 * padY);
    return { x, y, ...m };
  });

  const pointsGross = milestones.map((m, i) => {
    const x = padX + (i / (milestones.length - 1)) * (width - 2 * padX);
    const y = height - padY - (m.gross / maxVal) * (height - 2 * padY);
    return { x, y, ...m };
  });

  const dPathDirect = pointsDirect.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pointsDirect[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  const dPathGross = pointsGross.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pointsGross[i - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  const areaDirect = `${dPathDirect} L ${width - padX} ${height - padY} L ${padX} ${height - padY} Z`;
  const areaGross = `${dPathGross} L ${width - padX} ${height - padY} L ${padX} ${height - padY} Z`;

  // Action status checks
  const isBracingFixed = !!fixes["C-01"];
  const isFootingSigned = !!approved["WH-F1-REBAR"];

  // Open audit issues count
  const openAuditCount = data.checks.filter(
    (c) => c.severity === "error" || c.severity === "warn"
  ).length;

  return (
    <div className="dash-stage">
      {/* Pristine Inset Rounded Stage Canvas */}
      <div className="dash-canvas">
        {/* Top App Bar */}
        <header className="dash-topbar">
          {/* Brand Identity */}
          <div className="dash-topbar-brand" onClick={() => navigate("/overview")} role="button" tabIndex={0}>
            <Logo size={28} />
            <div className="dash-brand-meta">
              <span className="dash-brand-title">Storm</span>
              <span className="dash-brand-tag">Takeoff Platform</span>
            </div>
          </div>

          {/* Right Action Icons & Surveyor Chip */}
          <div className="dash-topbar-actions">
            <button
              type="button"
              className="dash-action-icon-btn badge-wrap"
              onClick={() => navigate("/checks")}
              title={`${openAuditCount} active discipline audits`}
            >
              <Bell size={16} />
              {openAuditCount > 0 ? <span className="dash-badge-pulse" /> : null}
            </button>

            <button
              type="button"
              className={`dash-action-icon-btn${showSettings ? " active" : ""}`}
              onClick={() => setShowSettings(true)}
              title="Platform Settings & Commercial Parameters"
            >
              <Settings size={16} />
            </button>

            <button
              type="button"
              className={`dash-action-icon-btn${showShortcuts ? " active" : ""}`}
              onClick={() => setShowShortcuts(true)}
              title="Keyboard Shortcuts & Productivity Guide (?)"
            >
              <HelpCircle size={16} />
            </button>

            {/* Surveyor User Profile Chip */}
            <div className="dash-user-chip" title={`${user?.name || "Surveyor"} • Storm Building MMC`}>
              <div className="dash-user-avatar">
                {(user?.name || "EM")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div className="dash-user-text">
                <span className="dash-user-name truncate">{user?.name || "Elmir Məmmədov"}</span>
                <span className="dash-user-role truncate">{lang === "az" ? "Baş Smetaçı" : (user?.role || "Lead QS")}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Title & Quick Search Bar */}
        <div className="dash-banner">
          <div className="dash-title-group">
            <span className="dash-kicker">
              {lang === "az" ? `${data.project.name} • ${data.project.place}` : `${data.project.nameEn} • ${data.project.placeEn}`}
            </span>
            <h1 className="dash-title">{t("projectDashboard", lang)}</h1>
          </div>

          <div className="dash-search-container">
            <Search size={14} className="dash-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="dash-search-input"
              placeholder={t("searchPlaceholder", lang)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  navigate(`/bill?q=${encodeURIComponent(search.trim())}`);
                }
              }}
            />
            <span className="dash-search-kbd">⌘K</span>
          </div>
        </div>

        {/* 3-Column Executive Grid (Fitted to viewport) */}
        <div className="dash-grid">
          {/* Column 1: Surveyor Action Queue (My Tasks) */}
          <div className="dash-col dash-col-tasks">
            <div className="dash-card dash-card-tasks">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">{t("actionQueue", lang)}</h2>
                  <span className="dash-pill-counter">
                    {taskTab === "pending"
                      ? (isBracingFixed && isFootingSigned ? "2" : isBracingFixed || isFootingSigned ? "3" : "4")
                      : (isBracingFixed && isFootingSigned ? "18" : "16")}{" "}
                    {t("itemsCount", lang)}
                  </span>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => navigate("/checks")}
                  title={lang === "az" ? "Bütün yoxlamalara bax" : "Inspect all checks"}
                >
                  <ArrowUpRight size={13} />
                </button>
              </div>

              {/* Sub-Filter Tabs */}
              <div className="dash-tab-row">
                <button
                  type="button"
                  className={`dash-pill-tab${taskTab === "pending" ? " active" : ""}`}
                  onClick={() => setTaskTab("pending")}
                >
                  {t("pending", lang)} ({isBracingFixed && isFootingSigned ? "2" : isBracingFixed || isFootingSigned ? "3" : "4"})
                </button>
                <button
                  type="button"
                  className={`dash-pill-tab${taskTab === "approved" ? " active" : ""}`}
                  onClick={() => setTaskTab("approved")}
                >
                  {t("approved", lang)} ({isBracingFixed && isFootingSigned ? "18" : "16"})
                </button>
              </div>

              <div className="dash-status-subhead">
                <span>
                  {taskTab === "pending" ? t("requiredReconciliations", lang) : t("verifiedApprovals", lang)}
                </span>
                <ChevronDown size={13} />
              </div>

              {/* Task Cards List (Compact ~48px each) */}
              <div className="dash-tasks-list">
                {/* Task 1: Bracing Şr-2 profile total */}
                <div className={`dash-task-item${isBracingFixed ? " done" : ""}`}>
                  <div className="dash-task-icon-box box-warning">
                    <AlertTriangle size={14} />
                  </div>
                  <div className="dash-task-text truncate">
                    <h3 className="dash-task-heading truncate">Bracing Şr-2 math overstatement</h3>
                    <span className="dash-task-sub truncate">KS-33 • Overstated by 400 kg</span>
                  </div>
                  <div className="dash-task-action-wrap">
                    {isBracingFixed ? (
                      <button
                        type="button"
                        className="task-circle-btn done"
                        onClick={() => setFix("C-01", false)}
                        title="Correction applied (-400 kg)"
                      >
                        <Check size={13} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="task-circle-btn fix"
                        onClick={() => setFix("C-01", true)}
                        title="Apply 400 kg correction"
                      >
                        <Wrench size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Task 2: Warehouse slab area */}
                <div
                  className="dash-task-item clickable"
                  onClick={() => navigate("/checks/C-02")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-task-icon-box box-variance">
                    <Layers size={14} />
                  </div>
                  <div className="dash-task-text truncate">
                    <h3 className="dash-task-heading truncate">Warehouse slab area variance</h3>
                    <span className="dash-task-sub truncate">KS-03 vs AR-02 • Δ +8.4 m²</span>
                  </div>
                  <div className="dash-task-action-wrap">
                    <span className="task-circle-btn neutral">
                      <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>

                {/* Task 3: Admin ground slab thickness */}
                <div
                  className="dash-task-item clickable"
                  onClick={() => navigate("/checks/C-03")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-task-icon-box box-spec">
                    <SlidersHorizontal size={14} />
                  </div>
                  <div className="dash-task-text truncate">
                    <h3 className="dash-task-heading truncate">Admin ground slab thickness</h3>
                    <span className="dash-task-sub truncate">KS-42 vs AR-14 • 100 vs 150mm</span>
                  </div>
                  <div className="dash-task-action-wrap">
                    <span className="task-circle-btn neutral">
                      <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>

                {/* Task 4: Pad Footing F-1 Rebar */}
                <div className={`dash-task-item${isFootingSigned ? " done" : ""}`}>
                  <div className="dash-task-icon-box box-rebar">
                    <Check size={14} />
                  </div>
                  <div className="dash-task-text truncate">
                    <h3 className="dash-task-heading truncate">Pad Footing F-1 rebar</h3>
                    <span className="dash-task-sub truncate">KS-04 • 32.4 t A500C verified</span>
                  </div>
                  <div className="dash-task-action-wrap">
                    <button
                      type="button"
                      className={`task-circle-btn${isFootingSigned ? " done" : " action"}`}
                      onClick={() => toggleApprove("WH-F1-REBAR")}
                      title={isFootingSigned ? "Approved" : "Sign off"}
                    >
                      <Check size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Analytical Core (Center Column) */}
          <div className="dash-col dash-col-center">
            {/* Top Sub-Grid: 2 cards side by side */}
            <div className="dash-center-top-row">
              {/* Card A: Projects Overview (Donut Chart) */}
              <div className="dash-card dash-card-donut">
                <div className="dash-card-header">
                  <h2 className="dash-card-title">{t("projectsOverview", lang)}</h2>
                  <button
                    type="button"
                    className="dash-mini-btn"
                    onClick={() => navigate("/bill")}
                    title="View Bill of Quantities"
                  >
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="dash-donut-wrap">
                  {/* Compact SVG Donut */}
                  <svg className="dash-donut-svg" viewBox="0 0 130 130">
                    <circle cx="65" cy="65" r="44" fill="none" stroke="#F1F1EE" strokeWidth="14" />
                    {(() => {
                      const radius = 44;
                      const circumference = 2 * Math.PI * radius;
                      let accumulatedOffset = 0;

                      return assetSlices.map((slice) => {
                        const dashLength = slice.share * circumference;
                        const dashOffset = -accumulatedOffset;
                        accumulatedOffset += dashLength;
                        const isHovered = hoveredSlice === slice.id;

                        return (
                          <circle
                            key={slice.id}
                            cx="65"
                            cy="65"
                            r={radius}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth={isHovered ? 17 : 14}
                            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                            strokeDashoffset={dashOffset}
                            className="dash-donut-slice"
                            onMouseEnter={() => setHoveredSlice(slice.id)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            style={{
                              transformOrigin: "center",
                              transform: "rotate(-90deg)",
                              transition: "stroke-width 180ms ease, opacity 180ms ease",
                              opacity: hoveredSlice && !isHovered ? 0.6 : 1,
                              cursor: "pointer",
                            }}
                          />
                        );
                      });
                    })()}

                    {/* Donut Hole Value */}
                    <g className="dash-donut-hole-text">
                      <text x="65" y="60" textAnchor="middle" className="donut-hole-label">
                        DIRECT WORKS
                      </text>
                      <text x="65" y="76" textAnchor="middle" className="donut-hole-val num">
                        {Math.round(works / 1000)}k
                      </text>
                      <text x="65" y="87" textAnchor="middle" className="donut-hole-unit">
                        AZN
                      </text>
                    </g>
                  </svg>
                </div>

                {/* Donut Legend (Compact 2x2 grid) */}
                <div className="dash-donut-legend-compact">
                  {assetSlices.map((s) => (
                    <div
                      key={s.id}
                      className={`dash-legend-item-compact${hoveredSlice === s.id ? " active" : ""}`}
                      onMouseEnter={() => setHoveredSlice(s.id)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() => navigate(`/bill?b=${s.id === "PS_TK" ? "PS" : s.id}`)}
                    >
                      <span className="legend-dot" style={{ backgroundColor: s.color }} />
                      <span className="legend-name truncate">{s.name.split(" ")[0]}</span>
                      <span className="legend-pct num">{pct(s.share, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card B: Income VS Expense (Commercial Progression) */}
              <div className="dash-card dash-card-curve">
                <div className="dash-card-header">
                  <div className="dash-header-title-wrap">
                    <h2 className="dash-card-title">{t("incomeVsExpense", lang)}</h2>
                    <div className="dash-curve-legend-inline">
                      <span className="curve-dot dot-bronze" />
                      <span className="curve-legend-label">{t("directBaseline", lang)}</span>
                      <span className="curve-dot dot-obsidian" />
                      <span className="curve-legend-label">{t("grossTotal", lang)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dash-mini-btn"
                    onClick={() => navigate("/export")}
                    title="Export financial report"
                  >
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="dash-curve-container">
                  <svg
                    className="dash-curve-svg"
                    viewBox={`0 0 ${width} ${height}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="bronzeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#B45309" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#B45309" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="obsidianGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#18181B" stopOpacity="0.14" />
                        <stop offset="100%" stopColor="#18181B" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Reference Grid Guides */}
                    <line x1={padX} y1={padY} x2={width - padX} y2={padY} stroke="rgba(24, 24, 27, 0.05)" strokeDasharray="3 3" />
                    <line x1={padX} y1={(padY + height - padY) / 2} x2={width - padX} y2={(padY + height - padY) / 2} stroke="rgba(24, 24, 27, 0.05)" strokeDasharray="3 3" />
                    <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="rgba(24, 24, 27, 0.08)" />

                    {/* Area fills */}
                    <path d={areaGross} fill="url(#obsidianGradient)" />
                    <path d={areaDirect} fill="url(#bronzeGradient)" />

                    {/* Spline Lines */}
                    <path
                      d={dPathGross}
                      fill="none"
                      stroke="#18181B"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d={dPathDirect}
                      fill="none"
                      stroke="#B45309"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />

                    {/* Data Points */}
                    {pointsGross.map((p) => (
                      <circle
                        key={`g-${p.stage}`}
                        cx={p.x}
                        cy={p.y}
                        r={3.5}
                        fill="#FFFFFF"
                        stroke="#18181B"
                        strokeWidth="1.8"
                        className="curve-point"
                        onMouseEnter={() => setCurveTooltip(p)}
                        onMouseLeave={() => setCurveTooltip(null)}
                      />
                    ))}

                    {pointsDirect.map((p) => (
                      <circle
                        key={`d-${p.stage}`}
                        cx={p.x}
                        cy={p.y}
                        r={3.5}
                        fill="#FFFFFF"
                        stroke="#B45309"
                        strokeWidth="1.8"
                        className="curve-point"
                        onMouseEnter={() => setCurveTooltip(p)}
                        onMouseLeave={() => setCurveTooltip(null)}
                      />
                    ))}
                  </svg>

                  {/* Curve Hover Tooltip */}
                  {curveTooltip ? (
                    <div
                      className="dash-curve-tooltip"
                      style={{
                        left: `${(curveTooltip.x / width) * 100}%`,
                        top: `${(curveTooltip.y / height) * 100}%`,
                      }}
                    >
                      <strong className="tooltip-stage">{curveTooltip.stage}</strong>
                      <div className="tooltip-row">
                        <span className="tooltip-tag bronze">Direct:</span>
                        <span className="num">{fmtMoney(curveTooltip.direct)} ₼</span>
                      </div>
                      <div className="tooltip-row">
                        <span className="tooltip-tag obsidian">Gross:</span>
                        <span className="num">{fmtMoney(curveTooltip.gross)} ₼</span>
                      </div>
                    </div>
                  ) : null}

                  {/* X Axis Stages */}
                  <div className="dash-curve-stages">
                    {milestones.map((m) => (
                      <span key={m.stage} className="dash-stage-label" title={m.stage}>
                        {m.stage.length > 7 ? m.stage.slice(0, 6) + "…" : m.stage}
                      </span>
                    ))}
                  </div>

                  {/* Bottom Progression KPI Strip (Eliminates empty space and balances with Donut card) */}
                  <div className="dash-curve-kpi-row">
                    <div className="curve-kpi-item">
                      <span className="curve-kpi-label">
                        <span className="curve-dot dot-bronze" />
                        {t("directBaseline", lang)}
                      </span>
                      <strong className="curve-kpi-val num">{fmtMoney(boq.works)} ₼</strong>
                    </div>
                    <div className="curve-kpi-item">
                      <span className="curve-kpi-label">
                        <span className="curve-dot dot-obsidian" />
                        {t("grossTotal", lang)}
                      </span>
                      <strong className="curve-kpi-val num">{fmtMoney(boq.total)} ₼</strong>
                    </div>
                    <div className="curve-kpi-item">
                      <span className="curve-kpi-label">{lang === "az" ? "Əlavə Həcmi" : "Markup Uplift"}</span>
                      <strong className="curve-kpi-val num text-emerald">
                        +{pct((boq.total - boq.works) / (boq.works || 1), 1)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Card: Invoice Overview (Statutory Markups Meter Bars) */}
            <div className="dash-card dash-card-markups">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">{t("invoiceOverview", lang)}</h2>
                  <span className="dash-subtext-muted">{t("statutoryMarkupsSequence", lang)}</span>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => setShowSettings(true)}
                  title="Configure markup percentages in Settings"
                >
                  <SlidersHorizontal size={13} />
                </button>
              </div>

              {/* Horizontal Progress Meter Bars (Clean & Compact) */}
              <div className="dash-meter-bars">
                {/* 1. Direct Works Scope */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">{t("directWorksScope", lang)}</span>
                  <div className="dash-meter-bar-track">
                    <div className="dash-meter-bar-fill bar-bronze" style={{ width: "100%" }} />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(boq.works)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 2. Overheads */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">{t("overheadsName", lang)} ({pct(markups.overheads, 0)})</span>
                  <div className="dash-meter-bar-track">
                    <div
                      className="dash-meter-bar-fill bar-obsidian"
                      style={{ width: `${(boq.chain[1]?.amount ?? 79520) / boq.total * 100 * 3.5}%` }}
                    />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(boq.chain[1]?.amount ?? 79520)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 3. Contractor Profit */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">{t("profitName", lang)} ({pct(markups.profit, 0)})</span>
                  <div className="dash-meter-bar-track">
                    <div
                      className="dash-meter-bar-fill bar-amber"
                      style={{ width: `${(boq.chain[2]?.amount ?? 59640) / boq.total * 100 * 3.5}%` }}
                    />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(boq.chain[2]?.amount ?? 59640)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 4. Contingency */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">{t("contingencyName", lang)} ({pct(markups.contingency, 0)})</span>
                  <div className="dash-meter-bar-track">
                    <div
                      className="dash-meter-bar-fill bar-slate"
                      style={{ width: `${(boq.chain[3]?.amount ?? 49700) / boq.total * 100 * 3.5}%` }}
                    />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(boq.chain[3]?.amount ?? 49700)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 5. Statutory VAT */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">{t("vatName", lang)} ({pct(markups.vat, 0)})</span>
                  <div className="dash-meter-bar-track">
                    <div
                      className="dash-meter-bar-fill bar-emerald"
                      style={{ width: `${(boq.chain[4]?.amount ?? 298200) / boq.total * 100}%` }}
                    />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(boq.chain[4]?.amount ?? 298200)} <span className="currency">AZN</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Package Registry & Discipline Audits (Right Column) */}
          <div className="dash-col dash-col-right">
            {/* Top Card: Drawing Packages (Drawing Packages Registry) */}
            <div className="dash-card dash-card-packages">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">{t("drawingPackages", lang)}</h2>
                  <span className="dash-pill-counter">{t("packagesCount", lang)}</span>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => navigate("/drawings")}
                  title="Open drawing register"
                >
                  <Layers size={13} />
                </button>
              </div>

              <div className="dash-packages-list">
                {/* 1. Master Plan */}
                <div
                  className="dash-pkg-item-compact"
                  onClick={() => navigate("/drawings?doc=BP")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-pkg-code-badge-compact badge-bp">BP</div>
                  <div className="dash-pkg-content truncate">
                    <h3 className="dash-pkg-title truncate">{lang === "az" ? "Qobu Baş plan" : "Qobu Master Plan"}</h3>
                    <span className="dash-pkg-meta">8 {t("sheetsCount", lang)} • 0.9998 ha Site</span>
                  </div>
                  <ArrowUpRight size={13} className="dash-pkg-arrow" />
                </div>

                {/* 2. Architecture */}
                <div
                  className="dash-pkg-item-compact"
                  onClick={() => navigate("/drawings?doc=AR")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-pkg-code-badge-compact badge-ar">AR</div>
                  <div className="dash-pkg-content truncate">
                    <h3 className="dash-pkg-title truncate">{lang === "az" ? "Memarlıq hissəsi" : "Architecture"}</h3>
                    <span className="dash-pkg-meta">36 {t("sheetsCount", lang)} • Architecture</span>
                  </div>
                  <ArrowUpRight size={13} className="dash-pkg-arrow" />
                </div>

                {/* 3. Structure */}
                <div
                  className="dash-pkg-item-compact"
                  onClick={() => navigate("/drawings?doc=KS")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-pkg-code-badge-compact badge-ks">KS</div>
                  <div className="dash-pkg-content truncate">
                    <h3 className="dash-pkg-title truncate">{lang === "az" ? "Konstruksiya hissəsi" : "Structure"}</h3>
                    <span className="dash-pkg-meta">61 {t("sheetsCount", lang)} • Structure</span>
                  </div>
                  <ArrowUpRight size={13} className="dash-pkg-arrow" />
                </div>

                {/* 4. MEP */}
                <div
                  className="dash-pkg-item-compact"
                  onClick={() => navigate("/drawings?doc=MEP")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-pkg-code-badge-compact badge-mep">MEP</div>
                  <div className="dash-pkg-content truncate">
                    <h3 className="dash-pkg-title truncate">{lang === "az" ? "Mühəndis sistemləri" : "Building Utilities"}</h3>
                    <span className="dash-pkg-meta">100 {t("sheetsCount", lang)} • Utilities</span>
                  </div>
                  <ArrowUpRight size={13} className="dash-pkg-arrow" />
                </div>
              </div>

              <div className="dash-packages-footer">
                <Link to="/drawings" className="dash-see-all-link">
                  {t("seeAllSheets", lang)}
                </Link>
              </div>
            </div>

            {/* Bottom Card: Open Tickets (Discipline Audits) */}
            <div className="dash-card dash-card-audits">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">{t("disciplineAudits", lang)}</h2>
                  <span className="dash-pill-counter">{openAuditCount} {t("activeFindings", lang)}</span>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => navigate("/checks")}
                  title="Inspect all checks"
                >
                  <ArrowUpRight size={13} />
                </button>
              </div>

              {/* Tickets List */}
              <div className="dash-audits-list">
                {/* Finding 1 */}
                <div className="dash-audit-ticket-compact">
                  <div className="dash-reviewer-avatar">KS</div>
                  <div className="dash-ticket-content truncate">
                    <h3 className="dash-ticket-title truncate">Bracing Şr-2 math overstatement</h3>
                    <span className="dash-ticket-sub truncate">Sheet KS-33 • -400 kg error</span>
                  </div>
                  <button
                    type="button"
                    className="dash-ticket-btn-compact"
                    onClick={() => navigate("/checks/C-01")}
                  >
                    {t("checkBtn", lang)}
                  </button>
                </div>

                {/* Finding 2 */}
                <div className="dash-audit-ticket-compact">
                  <div className="dash-reviewer-avatar">AR</div>
                  <div className="dash-ticket-content truncate">
                    <h3 className="dash-ticket-title truncate">Admin ground slab thickness</h3>
                    <span className="dash-ticket-sub truncate">KS 100mm vs AR 150mm</span>
                  </div>
                  <button
                    type="button"
                    className="dash-ticket-btn-compact"
                    onClick={() => navigate("/checks/C-03")}
                  >
                    {t("checkBtn", lang)}
                  </button>
                </div>

                {/* Finding 3 */}
                <div className="dash-audit-ticket-compact">
                  <div className="dash-reviewer-avatar">MEP</div>
                  <div className="dash-ticket-content truncate">
                    <h3 className="dash-ticket-title truncate">Booster pump rating note</h3>
                    <span className="dash-ticket-sub truncate">Kommunikasiya schedule</span>
                  </div>
                  <button
                    type="button"
                    className="dash-ticket-btn-compact"
                    onClick={() => navigate("/checks/C-05")}
                  >
                    {t("checkBtn", lang)}
                  </button>
                </div>
              </div>

              <div className="dash-audits-footer">
                <span className="dash-audits-foot-text">
                  {lang === "az" ? "Daha 4 qeyd və 7 təsdiqlənmiş çarpaz yoxlama." : "4 more notes, and 7 cross-checks verified."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          1. Platform Settings Modal (Opened by Gear Icon)
          ========================================================================= */}
      {showSettings ? (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal-dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge badge-bronze">
                  <Settings size={18} />
                </div>
                <div>
                  <h2 className="modal-title">{t("platformSettings", lang)}</h2>
                  <span className="modal-sub">{t("settingsSub", lang)}</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowSettings(false)}
                title="Close settings (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scroll">
              {/* Live Contract Valuation Summary Banner */}
              <div className="settings-summary-banner">
                <div className="summary-left">
                  <span className="summary-label">Total Contract Valuation (incl. VAT)</span>
                  <div className="summary-val num">{fmtMoney(boq.total)} AZN</div>
                </div>
                <div className="summary-right">
                  <span className="summary-sub">Direct Works Baseline:</span>
                  <strong className="summary-works num">{fmtMoney(boq.works)} AZN</strong>
                </div>
              </div>

              {/* Section 1: Commercial Mark-up Percentages */}
              <div className="settings-section">
                <div className="section-head">
                  <Percent size={15} className="section-icon" />
                  <h3 className="section-title">{t("commercialStructure", lang)}</h3>
                  <button
                    type="button"
                    className="section-reset-btn"
                    onClick={() => {
                      setMarkup("overheads", DEFAULT_MARKUPS.overheads);
                      setMarkup("profit", DEFAULT_MARKUPS.profit);
                      setMarkup("contingency", DEFAULT_MARKUPS.contingency);
                      setMarkup("vat", DEFAULT_MARKUPS.vat);
                    }}
                    title="Reset to default tender baseline"
                  >
                    <RotateCcw size={12} />
                    <span>{t("resetDefaults", lang)}</span>
                  </button>
                </div>

                <div className="settings-sliders-grid">
                  {/* Overheads */}
                  <div className="setting-slider-item">
                    <div className="slider-label-row">
                      <span className="setting-name">Site Overheads &amp; Preliminaries</span>
                      <span className="setting-pct num">{pct(markups.overheads, 1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.20"
                      step="0.005"
                      value={markups.overheads}
                      onChange={(e) => setMarkup("overheads", parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <div className="slider-range-limits">
                      <span>0%</span>
                      <span>Tender: 8.0%</span>
                      <span>20%</span>
                    </div>
                  </div>

                  {/* Profit */}
                  <div className="setting-slider-item">
                    <div className="slider-label-row">
                      <span className="setting-name">Contractor Profit Margin</span>
                      <span className="setting-pct num">{pct(markups.profit, 1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.15"
                      step="0.005"
                      value={markups.profit}
                      onChange={(e) => setMarkup("profit", parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <div className="slider-range-limits">
                      <span>0%</span>
                      <span>Standard: 6.0%</span>
                      <span>15%</span>
                    </div>
                  </div>

                  {/* Contingency */}
                  <div className="setting-slider-item">
                    <div className="slider-label-row">
                      <span className="setting-name">Unforeseen Contingency Reserve</span>
                      <span className="setting-pct num">{pct(markups.contingency, 1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.15"
                      step="0.005"
                      value={markups.contingency}
                      onChange={(e) => setMarkup("contingency", parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <div className="slider-range-limits">
                      <span>0%</span>
                      <span>Statutory: 5.0%</span>
                      <span>15%</span>
                    </div>
                  </div>

                  {/* VAT */}
                  <div className="setting-slider-item">
                    <div className="slider-label-row">
                      <span className="setting-name">Statutory State Value Added Tax (VAT)</span>
                      <span className="setting-pct num">{pct(markups.vat, 1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.25"
                      step="0.01"
                      value={markups.vat}
                      onChange={(e) => setMarkup("vat", parseFloat(e.target.value))}
                      className="setting-range"
                    />
                    <div className="slider-range-limits">
                      <span>0%</span>
                      <span>Azerbaijan Standard: 18.0%</span>
                      <span>25%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Nomenclature & Localization */}
              <div className="settings-section">
                <div className="section-head">
                  <Globe size={15} className="section-icon" />
                  <h3 className="section-title">{t("languageNorms", lang)}</h3>
                </div>

                <div className="settings-lang-row">
                  <div className="lang-option-card">
                    <label className="lang-label">
                      <input
                        type="radio"
                        name="lang-choice"
                        checked={lang === "en"}
                        onChange={() => setLang("en")}
                      />
                      <div className="lang-info">
                        <strong>English Engineering Norms</strong>
                        <span>Standard international quantity surveying terminology (Default)</span>
                      </div>
                    </label>
                  </div>

                  <div className="lang-option-card">
                    <label className="lang-label">
                      <input
                        type="radio"
                        name="lang-choice"
                        checked={lang === "az"}
                        onChange={() => setLang("az")}
                      />
                      <div className="lang-info">
                        <strong>Azərbaycan Dövlət Şəhərsalma Normaları</strong>
                        <span>Orijinal işçi layihə və smeta nomenklaturası</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 3: Surveyor & Project Specs */}
              <div className="settings-section">
                <div className="section-head">
                  <ShieldCheck size={15} className="section-icon" />
                  <h3 className="section-title">{t("surveyorProfile", lang)}</h3>
                </div>

                <div className="settings-profile-grid">
                  <div className="profile-spec-item">
                    <span className="spec-label">Lead Quantity Surveyor:</span>
                    <strong className="spec-val">{user?.name || "Elmir Məmmədov"}</strong>
                  </div>
                  <div className="profile-spec-item">
                    <span className="spec-label">Design Organization:</span>
                    <strong className="spec-val">"Storm Building" MMC</strong>
                  </div>
                  <div className="profile-spec-item">
                    <span className="spec-label">Chief Project Engineer:</span>
                    <strong className="spec-val">G. Musayeva</strong>
                  </div>
                  <div className="profile-spec-item">
                    <span className="spec-label">Project Stage:</span>
                    <strong className="spec-val">İşçi Layihə (Working Design 2026)</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <span className="modal-footer-hint">Press Esc or click Done to save adjustments</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowSettings(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* =========================================================================
          2. Keyboard Shortcuts & Help Cheatsheet Modal (Opened by Question Mark)
          ========================================================================= */}
      {showShortcuts ? (
        <div className="modal-backdrop" onClick={() => setShowShortcuts(false)}>
          <div className="modal-dialog shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge badge-obsidian">
                  <Keyboard size={18} />
                </div>
                <div>
                  <h2 className="modal-title">{t("shortcutsTitle", lang)}</h2>
                  <span className="modal-sub">{t("shortcutsSub", lang)}</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowShortcuts(false)}
                title="Close guide (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scroll">
              {/* Search shortcut highlight */}
              <div className="shortcuts-hero-box">
                <div className="hero-box-left">
                  <Command size={18} className="hero-cmd-icon" />
                  <div>
                    <strong>{t("globalSearch", lang)}</strong>
                    <span>Instantly jump to any bill line, drawing sheet, or specification</span>
                  </div>
                </div>
                <div className="hero-kbd-wrap">
                  <kbd className="kbd-key">⌘</kbd>
                  <kbd className="kbd-key">K</kbd>
                </div>
              </div>

              {/* Shortcuts Groups Grid */}
              <div className="shortcuts-grid">
                {/* 1. Navigation */}
                <div className="shortcut-category-card">
                  <h3 className="category-title">{t("quickNav", lang)}</h3>
                  <div className="shortcut-rows-list">
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Project Overview Dashboard</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">1</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Bill of Quantities (WBS Tree)</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">2</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Drawing Register (205 Sheets)</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">3</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Discipline Audits &amp; Conflicts</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">4</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Commercial Rates &amp; Markups</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">5</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Printable PDF &amp; Excel Reports</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">6</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Surveyor Actions */}
                <div className="shortcut-category-card">
                  <h3 className="category-title">Surveyor Takeoff Actions</h3>
                  <div className="shortcut-rows-list">
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Approve / Sign Off Quantity</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">A</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Apply Schedule Math Correction</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">F</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Cycle Next Bill Line in Inspector</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">→</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Cycle Previous Bill Line</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">←</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Open Keyboard Cheatsheet</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">?</kbd>
                      </div>
                    </div>
                    <div className="shortcut-item">
                      <span className="shortcut-desc">Close Modal / Inspector Drawer</span>
                      <div className="kbd-combo">
                        <kbd className="kbd-key">Esc</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Evidence Methodology Guide */}
              <div className="guide-legend-section">
                <h3 className="legend-section-title">Verification Evidence Methodology</h3>
                <div className="legend-cards-grid">
                  <div className="legend-card">
                    <div className="legend-badge badge-schedule">Schedule Extraction</div>
                    <p className="legend-desc">
                      Values extracted directly from vector CAD schedules and tables (A500C rebar, MEP schedules).
                    </p>
                  </div>
                  <div className="legend-card">
                    <div className="legend-badge badge-derived">Parametric Takeoff</div>
                    <p className="legend-desc">
                      Quantities calculated using explicit engineering formulas combining dimensions and member counts.
                    </p>
                  </div>
                  <div className="legend-card">
                    <div className="legend-badge badge-image">Plan Takeoff</div>
                    <p className="legend-desc">
                      Measured from architectural floor plans and cross-referenced with room finish schedules.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Discipline Audits Severity Guide */}
              <div className="guide-legend-section">
                <h3 className="legend-section-title">Discipline Audits &amp; Discrepancy Severity</h3>
                <div className="audit-legend-list">
                  <div className="audit-legend-item">
                    <span className="audit-tag tag-error">Discrepancy</span>
                    <span className="audit-text">
                      Arithmetic math errors or overstatements printed inside the drawings (e.g. Bracing Şr-2 -400kg).
                    </span>
                  </div>
                  <div className="audit-legend-item">
                    <span className="audit-tag tag-warn">Variance</span>
                    <span className="audit-text">
                      Discrepancies between structural, architectural, and MEP plans (e.g. 100mm vs 150mm slab thickness).
                    </span>
                  </div>
                  <div className="audit-legend-item">
                    <span className="audit-tag tag-info">Note</span>
                    <span className="audit-text">
                      Engineering annotations or items requiring surveyor clarification.
                    </span>
                  </div>
                  <div className="audit-legend-item">
                    <span className="audit-tag tag-ok">Verified</span>
                    <span className="audit-text">
                      100% agreement confirmed between independent drawing sets and schedules.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <span className="modal-footer-hint">Shortcuts are active across all drawing and takeoff views</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowShortcuts(false)}
              >
                {t("gotIt", lang)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  HelpCircle,
  Layers,
  Search,
  Settings,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney, pct } from "../lib/format";
import { useApp } from "../lib/store";
import { Logo } from "../components/ui";

export function OverviewPage() {
  const boq = useBoq();
  const navigate = useNavigate();
  const fixes = useApp((s) => s.fixes);
  const setFix = useApp((s) => s.setFix);
  const approved = useApp((s) => s.approved);
  const toggleApprove = useApp((s) => s.toggleApprove);
  const user = useApp((s) => s.user);

  const [taskTab, setTaskTab] = useState<"pending" | "approved">("pending");
  const [search, setSearch] = useState("");
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [curveTooltip, setCurveTooltip] = useState<{
    stage: string;
    direct: number;
    gross: number;
    x: number;
    y: number;
  } | null>(null);

  const works = boq.works || 1;

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
        name: "Warehouse Hall (48×24m)",
        color: "#B45309", // Architectural Bronze
        total: whTotal,
        share: whTotal / works,
      },
      {
        id: "AD",
        name: "Admin Office (2-Storey)",
        color: "#18181B", // Obsidian
        total: adTotal,
        share: adTotal / works,
      },
      {
        id: "SITE",
        name: "Site Works & Landscaping",
        color: "#D97706", // Amber Bronze
        total: siteTotal,
        share: siteTotal / works,
      },
      {
        id: "PS_TK",
        name: "Pump Station & Reservoirs",
        color: "#71717A", // Warm Slate
        total: pstkTotal,
        share: pstkTotal / works,
      },
    ];
  }, [boq.buildings, works]);

  // Dual curve milestones for Commercial Valuation Progression
  const milestones = [
    { stage: "Substructure", direct: 184000, gross: 274160 },
    { stage: "Frame & Trusses", direct: 452000, gross: 673480 },
    { stage: "Roofing", direct: 598000, gross: 891020 },
    { stage: "Envelope", direct: 742000, gross: 1105580 },
    { stage: "Finishes", direct: 886000, gross: 1320140 },
    { stage: "MEP & Utility", direct: 994000, gross: 1481060 },
  ];

  const width = 340;
  const height = 110;
  const padX = 20;
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
        {/* Top App Bar (Clean, no clutter) */}
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
              className="dash-action-icon-btn"
              onClick={() => navigate("/rates")}
              title="Pricing & mark-up configurations"
            >
              <Settings size={16} />
            </button>

            <button
              type="button"
              className="dash-action-icon-btn"
              onClick={() => navigate("/checks")}
              title="Documentation & Audit rules"
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
                <span className="dash-user-role truncate">{user?.role || "Lead QS"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Title & Quick Search Bar */}
        <div className="dash-banner">
          <div className="dash-title-group">
            <span className="dash-kicker">
              {data.project.nameEn} • {data.project.placeEn}
            </span>
            <h1 className="dash-title">Project Dashboard</h1>
          </div>

          <div className="dash-search-container">
            <Search size={14} className="dash-search-icon" />
            <input
              type="text"
              className="dash-search-input"
              placeholder="Search bill lines, drawing sheets, specifications..."
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
                  <h2 className="dash-card-title">Action Queue</h2>
                  <span className="dash-pill-counter">4 Items</span>
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

              {/* Sub-Filter Tabs */}
              <div className="dash-tab-row">
                <button
                  type="button"
                  className={`dash-pill-tab${taskTab === "pending" ? " active" : ""}`}
                  onClick={() => setTaskTab("pending")}
                >
                  Pending ({isBracingFixed && isFootingSigned ? "2" : isBracingFixed || isFootingSigned ? "3" : "4"})
                </button>
                <button
                  type="button"
                  className={`dash-pill-tab${taskTab === "approved" ? " active" : ""}`}
                  onClick={() => setTaskTab("approved")}
                >
                  Approved ({isBracingFixed && isFootingSigned ? "18" : "16"})
                </button>
              </div>

              <div className="dash-status-subhead">
                <span>
                  {taskTab === "pending" ? "4 Required Reconciliations" : "18 Verified Approvals"}
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
                  <h2 className="dash-card-title">Projects Overview</h2>
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
                    <h2 className="dash-card-title">Income VS Expense</h2>
                    <div className="dash-curve-legend-inline">
                      <span className="curve-dot dot-bronze" />
                      <span className="curve-legend-label">Direct</span>
                      <span className="curve-dot dot-obsidian" />
                      <span className="curve-legend-label">Gross</span>
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
                      <span key={m.stage} className="dash-stage-label">
                        {m.stage.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Card: Invoice Overview (Statutory Markups Meter Bars) */}
            <div className="dash-card dash-card-markups">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">Invoice Overview</h2>
                  <span className="dash-subtext-muted">Statutory Markups Sequence</span>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => navigate("/rates")}
                  title="Configure markup percentages"
                >
                  <SlidersHorizontal size={13} />
                </button>
              </div>

              {/* Horizontal Progress Meter Bars (Clean & Compact) */}
              <div className="dash-meter-bars">
                {/* 1. Direct Works Scope */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">Direct Works Scope</span>
                  <div className="dash-meter-bar-track">
                    <div className="dash-meter-bar-fill bar-bronze" style={{ width: "100%" }} />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(boq.works)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 2. Overheads */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">Overheads (8%)</span>
                  <div className="dash-meter-bar-track">
                    <div
                      className="dash-meter-bar-fill bar-obsidian"
                      style={{ width: `${(79520 / boq.total) * 100 * 3.5}%` }}
                    />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(79520)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 3. Contractor Profit */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">Profit (6%)</span>
                  <div className="dash-meter-bar-track">
                    <div
                      className="dash-meter-bar-fill bar-amber"
                      style={{ width: `${(59640 / boq.total) * 100 * 3.5}%` }}
                    />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(59640)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 4. Contingency */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">Contingency (5%)</span>
                  <div className="dash-meter-bar-track">
                    <div
                      className="dash-meter-bar-fill bar-slate"
                      style={{ width: `${(49700 / boq.total) * 100 * 3.5}%` }}
                    />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(49700)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 5. Statutory VAT */}
                <div className="dash-meter-item">
                  <span className="dash-meter-name">VAT (18%)</span>
                  <div className="dash-meter-bar-track">
                    <div
                      className="dash-meter-bar-fill bar-emerald"
                      style={{ width: `${(298200 / boq.total) * 100}%` }}
                    />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(298200)} <span className="currency">AZN</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Package Registry & Discipline Audits (Right Column) */}
          <div className="dash-col dash-col-right">
            {/* Top Card: My Meetings (Drawing Packages Registry) */}
            <div className="dash-card dash-card-packages">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">My Meetings</h2>
                  <span className="dash-pill-counter">4 Packages</span>
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
                    <h3 className="dash-pkg-title truncate">Qobu Baş plan</h3>
                    <span className="dash-pkg-meta">8 Sheets • 0.9998 ha Site</span>
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
                    <h3 className="dash-pkg-title truncate">Memarlıq hissəsi</h3>
                    <span className="dash-pkg-meta">36 Sheets • Architecture</span>
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
                    <h3 className="dash-pkg-title truncate">Konstruksiya hissəsi</h3>
                    <span className="dash-pkg-meta">61 Sheets • Structure</span>
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
                    <h3 className="dash-pkg-title truncate">Mühəndis sistemləri</h3>
                    <span className="dash-pkg-meta">100 Sheets • Utilities</span>
                  </div>
                  <ArrowUpRight size={13} className="dash-pkg-arrow" />
                </div>
              </div>

              <div className="dash-packages-footer">
                <Link to="/drawings" className="dash-see-all-link">
                  See All 205 Sheets &gt;
                </Link>
              </div>
            </div>

            {/* Bottom Card: Open Tickets (Discipline Audits) */}
            <div className="dash-card dash-card-audits">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">Open Tickets</h2>
                  <span className="dash-pill-counter">{openAuditCount} Active</span>
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
                    Check &gt;
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
                    Check &gt;
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
                    Check &gt;
                  </button>
                </div>
              </div>

              <div className="dash-audits-footer">
                <span className="dash-audits-foot-text">
                  4 more notes, and 7 cross-checks verified.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Layers,
  Search,
  Settings,
  SlidersHorizontal,
  Wrench,
  X,
} from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney, pct } from "../lib/format";
import { useApp } from "../lib/store";
import { Logo } from "../components/ui";
import { Building3D } from "../components/brand/Building3D";

type ScopeFilter = "ALL" | "WH" | "AD" | "PS_TK" | "SITE";

export function OverviewPage() {
  const boq = useBoq();
  const navigate = useNavigate();
  const fixes = useApp((s) => s.fixes);
  const setFix = useApp((s) => s.setFix);
  const approved = useApp((s) => s.approved);
  const toggleApprove = useApp((s) => s.toggleApprove);
  const user = useApp((s) => s.user);

  const [scope, setScope] = useState<ScopeFilter>("ALL");
  const [taskTab, setTaskTab] = useState<"pending" | "approved">("pending");
  const [search, setSearch] = useState("");
  const [show3DModal, setShow3DModal] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [curveTooltip, setCurveTooltip] = useState<{
    stage: string;
    direct: number;
    gross: number;
    x: number;
    y: number;
  } | null>(null);

  const works = boq.works || 1;

  // Filtered scope calculations
  const scopeBuildings = useMemo(() => {
    if (scope === "ALL") return boq.buildings;
    if (scope === "WH") return boq.buildings.filter((b) => b.id === "WH");
    if (scope === "AD") return boq.buildings.filter((b) => b.id === "AD");
    if (scope === "PS_TK") return boq.buildings.filter((b) => b.id === "PS" || b.id === "TK");
    if (scope === "SITE") return boq.buildings.filter((b) => b.id === "SITE");
    return boq.buildings;
  }, [boq.buildings, scope]);

  const scopeWorksTotal = useMemo(
    () => scopeBuildings.reduce((sum, b) => sum + b.total, 0),
    [scopeBuildings]
  );

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

  // Dual curve points for Commercial Valuation Progression
  const milestones = [
    { stage: "Substructure", direct: 184000, gross: 274160 },
    { stage: "Frame & Trusses", direct: 452000, gross: 673480 },
    { stage: "Roofing", direct: 598000, gross: 891020 },
    { stage: "Envelope", direct: 742000, gross: 1105580 },
    { stage: "Finishes", direct: 886000, gross: 1320140 },
    { stage: "MEP & Utility", direct: 994000, gross: 1481060 },
  ];

  // SVG coordinate calculations for dual curve
  const width = 380;
  const height = 140;
  const padX = 24;
  const padY = 20;
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

  // Action Queue Tasks
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
        {/* Top App Window Bar */}
        <header className="dash-topbar">
          {/* Brand Identity */}
          <div className="dash-topbar-brand" onClick={() => navigate("/overview")} role="button" tabIndex={0}>
            <Logo size={32} />
            <div className="dash-brand-meta">
              <span className="dash-brand-title">Storm</span>
              <span className="dash-brand-tag">Takeoff Platform</span>
            </div>
          </div>

          {/* Scope Filter Segmented Pills */}
          <div className="dash-scope-pills" role="tablist" aria-label="Project Scope Filter">
            <button
              type="button"
              role="tab"
              aria-selected={scope === "ALL"}
              className={`dash-scope-pill${scope === "ALL" ? " active" : ""}`}
              onClick={() => setScope("ALL")}
            >
              All Assets
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "WH"}
              className={`dash-scope-pill${scope === "WH" ? " active" : ""}`}
              onClick={() => setScope("WH")}
            >
              Warehouse (48×24m)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "AD"}
              className={`dash-scope-pill${scope === "AD" ? " active" : ""}`}
              onClick={() => setScope("AD")}
            >
              Admin (2-Story)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "PS_TK"}
              className={`dash-scope-pill${scope === "PS_TK" ? " active" : ""}`}
              onClick={() => setScope("PS_TK")}
            >
              Pump &amp; Tanks
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "SITE"}
              className={`dash-scope-pill${scope === "SITE" ? " active" : ""}`}
              onClick={() => setScope("SITE")}
            >
              Site Works
            </button>
          </div>

          {/* Right Action Icons & Surveyor Chip */}
          <div className="dash-topbar-actions">
            <button
              type="button"
              className="dash-action-icon-btn"
              onClick={() => setShow3DModal(true)}
              title="Inspect 3D Digital Twin model"
            >
              <Box size={17} />
              <span className="dash-action-label">3D Twin</span>
            </button>

            <button
              type="button"
              className="dash-action-icon-btn badge-wrap"
              onClick={() => navigate("/checks")}
              title={`${openAuditCount} active discipline audits`}
            >
              <Bell size={17} />
              {openAuditCount > 0 ? (
                <span className="dash-badge-pulse" />
              ) : null}
            </button>

            <button
              type="button"
              className="dash-action-icon-btn"
              onClick={() => navigate("/rates")}
              title="Pricing & mark-up configurations"
            >
              <Settings size={17} />
            </button>

            <button
              type="button"
              className="dash-action-icon-btn"
              onClick={() => navigate("/checks")}
              title="Documentation & Audit rules"
            >
              <HelpCircle size={17} />
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
            <Search size={15} className="dash-search-icon" />
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

        {/* 3-Column Executive Card Grid (Molded from uploaded design) */}
        <div className="dash-grid">
          {/* Column 1: Surveyor Action Queue (Molded from 'My Tasks') */}
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
                  <ArrowUpRight size={14} />
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
                <ChevronDown size={14} />
              </div>

              {/* Task Cards List */}
              <div className="dash-tasks-list">
                {/* Task 1: Bracing Şr-2 profile total */}
                <div className={`dash-task-item${isBracingFixed ? " done" : ""}`}>
                  <div className="dash-task-lead">
                    <span className="dash-task-discipline-tag tag-structural">Structural Steel</span>
                    <span className="dash-task-sheet-ref">KS-33</span>
                  </div>
                  <h3 className="dash-task-heading">Bracing Şr-2 math overstatement</h3>
                  <p className="dash-task-desc">
                    Row schedule prints 808.80 kg; calculated 4 × 51.10 kg &amp; 8 × 25.55 kg sum to 408.80 kg.
                  </p>
                  <div className="dash-task-action-row">
                    {isBracingFixed ? (
                      <button
                        type="button"
                        className="dash-action-btn btn-done"
                        onClick={() => setFix("C-01", false)}
                      >
                        <Check size={13} strokeWidth={2.5} />
                        <span>Corrected (-400 kg)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="dash-action-btn btn-apply"
                        onClick={() => setFix("C-01", true)}
                      >
                        <Wrench size={13} />
                        <span>Apply Fix (-400 kg)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="dash-inspect-link"
                      onClick={() => navigate("/checks/C-01")}
                      title="Inspect calculation evidence"
                    >
                      Inspect <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Task 2: Warehouse slab area */}
                <div className="dash-task-item">
                  <div className="dash-task-lead">
                    <span className="dash-task-discipline-tag tag-variance">Cross-Discipline</span>
                    <span className="dash-task-sheet-ref">KS-03 / AR-02</span>
                  </div>
                  <h3 className="dash-task-heading">Warehouse slab area variance</h3>
                  <p className="dash-task-desc">
                    Structural drawing indicates 1,122.0 m²; architectural finish schedule sums to 1,130.4 m².
                  </p>
                  <div className="dash-task-action-row">
                    <button
                      type="button"
                      className="dash-action-btn btn-outline"
                      onClick={() => navigate("/checks/C-02")}
                    >
                      Reconcile Variance
                    </button>
                    <span className="dash-task-metric">Δ +8.4 m²</span>
                  </div>
                </div>

                {/* Task 3: Admin ground slab thickness */}
                <div className="dash-task-item">
                  <div className="dash-task-lead">
                    <span className="dash-task-discipline-tag tag-spec">Specification</span>
                    <span className="dash-task-sheet-ref">KS-42 / AR-14</span>
                  </div>
                  <h3 className="dash-task-heading">Admin ground slab thickness</h3>
                  <p className="dash-task-desc">
                    Structure specifies 100 mm slab; architecture notes 150 mm monolithic cast.
                  </p>
                  <div className="dash-task-action-row">
                    <button
                      type="button"
                      className="dash-action-btn btn-outline"
                      onClick={() => navigate("/checks/C-03")}
                    >
                      Compare Notes
                    </button>
                    <span className="dash-task-metric">100 vs 150mm</span>
                  </div>
                </div>

                {/* Task 4: Pad Footing F-1 Rebar */}
                <div className={`dash-task-item${isFootingSigned ? " done" : ""}`}>
                  <div className="dash-task-lead">
                    <span className="dash-task-discipline-tag tag-reinforce">Reinforcement</span>
                    <span className="dash-task-sheet-ref">KS-04</span>
                  </div>
                  <h3 className="dash-task-heading">Pad Footing F-1 rebar sign-off</h3>
                  <p className="dash-task-desc">
                    31 pad foundations: 32.4 tonnes of A500C rebar cross-verified with column starters.
                  </p>
                  <div className="dash-task-action-row">
                    <button
                      type="button"
                      className={`dash-action-btn${isFootingSigned ? " btn-done" : " btn-apply"}`}
                      onClick={() => toggleApprove("WH-F1-REBAR")}
                    >
                      {isFootingSigned ? (
                        <>
                          <Check size={13} strokeWidth={2.5} />
                          <span>Signed Off ✓</span>
                        </>
                      ) : (
                        <span>Sign Off Approval</span>
                      )}
                    </button>
                    <span className="dash-task-metric">32.4 t</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Analytical Core (Center Column) */}
          <div className="dash-col dash-col-center">
            {/* Top Sub-Grid: 2 cards side by side */}
            <div className="dash-center-top-row">
              {/* Card A: Asset Valuation Share (Donut Chart) */}
              <div className="dash-card dash-card-donut">
                <div className="dash-card-header">
                  <h2 className="dash-card-title">Asset Valuation Share</h2>
                  <button
                    type="button"
                    className="dash-mini-btn"
                    onClick={() => navigate("/bill")}
                    title="View Bill of Quantities"
                  >
                    <ArrowUpRight size={14} />
                  </button>
                </div>

                <div className="dash-donut-wrap">
                  {/* Interactive SVG Donut */}
                  <svg className="dash-donut-svg" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="54" fill="none" stroke="#F1F1EE" strokeWidth="18" />
                    {(() => {
                      const radius = 54;
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
                            cx="80"
                            cy="80"
                            r={radius}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth={isHovered ? 21 : 18}
                            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                            strokeDashoffset={dashOffset}
                            className="dash-donut-slice"
                            onMouseEnter={() => setHoveredSlice(slice.id)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            style={{
                              transformOrigin: "center",
                              transform: "rotate(-90deg)",
                              transition: "stroke-width 200ms ease, opacity 200ms ease",
                              opacity: hoveredSlice && !isHovered ? 0.6 : 1,
                              cursor: "pointer",
                            }}
                          />
                        );
                      });
                    })()}

                    {/* Donut Hole Value */}
                    <g className="dash-donut-hole-text">
                      <text x="80" y="74" textAnchor="middle" className="donut-hole-label">
                        DIRECT WORKS
                      </text>
                      <text x="80" y="93" textAnchor="middle" className="donut-hole-val num">
                        {Math.round(scopeWorksTotal / 1000)}k
                      </text>
                      <text x="80" y="106" textAnchor="middle" className="donut-hole-unit">
                        AZN
                      </text>
                    </g>
                  </svg>
                </div>

                {/* Donut Legend */}
                <div className="dash-donut-legend">
                  {assetSlices.map((s) => (
                    <div
                      key={s.id}
                      className={`dash-legend-item${hoveredSlice === s.id ? " active" : ""}`}
                      onMouseEnter={() => setHoveredSlice(s.id)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      onClick={() => navigate(`/bill?b=${s.id === "PS_TK" ? "PS" : s.id}`)}
                    >
                      <span className="legend-dot" style={{ backgroundColor: s.color }} />
                      <span className="legend-name truncate">{s.name}</span>
                      <span className="legend-pct num">{pct(s.share)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card B: Commercial Progression (Dual Curve Chart) */}
              <div className="dash-card dash-card-curve">
                <div className="dash-card-header">
                  <div className="dash-header-title-wrap">
                    <h2 className="dash-card-title">Commercial Progression</h2>
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
                    <ArrowUpRight size={14} />
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
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <path
                      d={dPathDirect}
                      fill="none"
                      stroke="#B45309"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />

                    {/* Data Points */}
                    {pointsGross.map((p) => (
                      <circle
                        key={`g-${p.stage}`}
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="#FFFFFF"
                        stroke="#18181B"
                        strokeWidth="2"
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
                        r={4}
                        fill="#FFFFFF"
                        stroke="#B45309"
                        strokeWidth="2"
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
                        {m.stage.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Card: Statutory Markups Sequence (Molded from 'Invoice Overview') */}
            <div className="dash-card dash-card-markups">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">Statutory Markups &amp; Valuation Chain</h2>
                  <span className="dash-subtext-muted">4 Statutory Commercial Tiers + VAT</span>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => navigate("/rates")}
                  title="Configure markup percentages"
                >
                  <SlidersHorizontal size={14} />
                </button>
              </div>

              {/* Sleek Horizontal Progress Meter Bars */}
              <div className="dash-meter-bars">
                {/* 1. Direct Works Scope */}
                <div className="dash-meter-item">
                  <div className="dash-meter-info">
                    <span className="dash-meter-name">Direct Works Scope</span>
                    <span className="dash-meter-tag">100.0% Baseline</span>
                  </div>
                  <div className="dash-meter-bar-track">
                    <div className="dash-meter-bar-fill bar-bronze" style={{ width: "100%" }} />
                  </div>
                  <div className="dash-meter-value num">
                    {fmtMoney(boq.works)} <span className="currency">AZN</span>
                  </div>
                </div>

                {/* 2. Overheads */}
                <div className="dash-meter-item">
                  <div className="dash-meter-info">
                    <span className="dash-meter-name">Site Overheads &amp; Preliminaries</span>
                    <span className="dash-meter-tag">+8.00%</span>
                  </div>
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
                  <div className="dash-meter-info">
                    <span className="dash-meter-name">Contractor Profit Margin</span>
                    <span className="dash-meter-tag">+6.00%</span>
                  </div>
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
                  <div className="dash-meter-info">
                    <span className="dash-meter-name">Unforeseen Contingency Reserve</span>
                    <span className="dash-meter-tag">+5.00%</span>
                  </div>
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
                  <div className="dash-meter-info">
                    <span className="dash-meter-name">Statutory State VAT</span>
                    <span className="dash-meter-tag">+18.00%</span>
                  </div>
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

              {/* Total Callout Footer */}
              <div className="dash-markups-foot">
                <div className="dash-foot-lead">
                  <CheckCircle2 size={15} className="dash-ok-icon" />
                  <span>Statutory 5-tier valuation sequence active</span>
                </div>
                <div className="dash-foot-total">
                  <span className="dash-foot-label">Total Contract Valuation:</span>
                  <strong className="dash-foot-amount num">{fmtMoney(boq.total)} AZN</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Package Registry & Discipline Audits (Right Column) */}
          <div className="dash-col dash-col-right">
            {/* Top Card: Drawing Packages Registry (Molded from 'My Meetings') */}
            <div className="dash-card dash-card-packages">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">Drawing Packages</h2>
                  <span className="dash-pill-counter">205 Sheets</span>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => navigate("/drawings")}
                  title="Open drawing register"
                >
                  <Layers size={14} />
                </button>
              </div>

              <div className="dash-packages-list">
                {/* 1. Master Plan */}
                <div
                  className="dash-pkg-item"
                  onClick={() => navigate("/drawings?doc=BP")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-pkg-code-badge badge-bp">BP</div>
                  <div className="dash-pkg-content truncate">
                    <h3 className="dash-pkg-title truncate">Qobu Baş plan</h3>
                    <span className="dash-pkg-meta">8 Sheets • 0.9998 ha Site Layout</span>
                  </div>
                  <ArrowUpRight size={14} className="dash-pkg-arrow" />
                </div>

                {/* 2. Architecture */}
                <div
                  className="dash-pkg-item"
                  onClick={() => navigate("/drawings?doc=AR")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-pkg-code-badge badge-ar">AR</div>
                  <div className="dash-pkg-content truncate">
                    <h3 className="dash-pkg-title truncate">Memarlıq hissəsi</h3>
                    <span className="dash-pkg-meta">36 Sheets • ±0.000 Plans &amp; Finishes</span>
                  </div>
                  <ArrowUpRight size={14} className="dash-pkg-arrow" />
                </div>

                {/* 3. Structure */}
                <div
                  className="dash-pkg-item"
                  onClick={() => navigate("/drawings?doc=KS")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-pkg-code-badge badge-ks">KS</div>
                  <div className="dash-pkg-content truncate">
                    <h3 className="dash-pkg-title truncate">Konstruksiya hissəsi</h3>
                    <span className="dash-pkg-meta">61 Sheets • Pad Footings &amp; Trusses</span>
                  </div>
                  <ArrowUpRight size={14} className="dash-pkg-arrow" />
                </div>

                {/* 4. MEP */}
                <div
                  className="dash-pkg-item"
                  onClick={() => navigate("/drawings?doc=MEP")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="dash-pkg-code-badge badge-mep">MEP</div>
                  <div className="dash-pkg-content truncate">
                    <h3 className="dash-pkg-title truncate">Mühəndis sistemləri</h3>
                    <span className="dash-pkg-meta">100 Sheets • HVAC, Water, Fire &amp; Power</span>
                  </div>
                  <ArrowUpRight size={14} className="dash-pkg-arrow" />
                </div>
              </div>

              <div className="dash-packages-footer">
                <Link to="/drawings" className="dash-see-all-link">
                  Browse All 205 Drawing Sheets →
                </Link>
              </div>
            </div>

            {/* Bottom Card: Discipline Audits (Molded from 'Open Tickets') */}
            <div className="dash-card dash-card-audits">
              <div className="dash-card-header">
                <div className="dash-header-title-wrap">
                  <h2 className="dash-card-title">Discipline Audits</h2>
                  <span className="dash-pill-counter">{openAuditCount} Active</span>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => navigate("/checks")}
                  title="Inspect all checks"
                >
                  <ArrowUpRight size={14} />
                </button>
              </div>

              {/* Tickets List */}
              <div className="dash-audits-list">
                {/* Finding 1 */}
                <div className="dash-audit-ticket">
                  <div className="dash-ticket-top">
                    <div className="dash-reviewer-chip">
                      <div className="dash-reviewer-avatar">KS</div>
                      <span className="dash-reviewer-name">Structural QS Lead</span>
                    </div>
                    <span className="dash-severity-chip chip-error">Discrepancy</span>
                  </div>
                  <p className="dash-ticket-desc">
                    Bracing Şr-2 profile total is overstated by 400 kg on sheet KS-33.
                  </p>
                  <div className="dash-ticket-foot">
                    <span className="dash-ticket-bldg">Warehouse</span>
                    <button
                      type="button"
                      className="dash-ticket-btn"
                      onClick={() => navigate("/checks/C-01")}
                    >
                      Review &gt;
                    </button>
                  </div>
                </div>

                {/* Finding 2 */}
                <div className="dash-audit-ticket">
                  <div className="dash-ticket-top">
                    <div className="dash-reviewer-chip">
                      <div className="dash-reviewer-avatar">AR</div>
                      <span className="dash-reviewer-name">Arch / Struct Audit</span>
                    </div>
                    <span className="dash-severity-chip chip-warn">Variance</span>
                  </div>
                  <p className="dash-ticket-desc">
                    Admin ground slab is 100 mm on structure and 150 mm on architecture.
                  </p>
                  <div className="dash-ticket-foot">
                    <span className="dash-ticket-bldg">Admin</span>
                    <button
                      type="button"
                      className="dash-ticket-btn"
                      onClick={() => navigate("/checks/C-03")}
                    >
                      Review &gt;
                    </button>
                  </div>
                </div>

                {/* Finding 3 */}
                <div className="dash-audit-ticket">
                  <div className="dash-ticket-top">
                    <div className="dash-reviewer-chip">
                      <div className="dash-reviewer-avatar">MEP</div>
                      <span className="dash-reviewer-name">MEP Engineer</span>
                    </div>
                    <span className="dash-severity-chip chip-info">Note</span>
                  </div>
                  <p className="dash-ticket-desc">
                    Booster water pump station schedules omit explicit unit rating.
                  </p>
                  <div className="dash-ticket-foot">
                    <span className="dash-ticket-bldg">Pump House</span>
                    <button
                      type="button"
                      className="dash-ticket-btn"
                      onClick={() => navigate("/checks/C-05")}
                    >
                      Review &gt;
                    </button>
                  </div>
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

      {/* Interactive 3D Digital Twin Modal */}
      {show3DModal ? (
        <div className="dash-modal-overlay" onClick={() => setShow3DModal(false)}>
          <div className="dash-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dash-modal-header">
              <div className="dash-modal-title-wrap">
                <Box size={18} className="dash-modal-icon" />
                <div>
                  <h2 className="dash-modal-title">Interactive 3D Digital Twin</h2>
                  <span className="dash-modal-sub">
                    Qobu Logistics Hub • Structural &amp; Member Geometry Takeoff
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="dash-modal-close-btn"
                onClick={() => setShow3DModal(false)}
                title="Close 3D viewer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="dash-modal-body">
              <Building3D showCaption />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

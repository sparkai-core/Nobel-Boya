import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Layers,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney, pct } from "../lib/format";
import { useApp } from "../lib/store";
import { t } from "../lib/i18n";

export function OverviewPage() {
  const boq = useBoq();
  const navigate = useNavigate();
  const fixes = useApp((s) => s.fixes);
  const setFix = useApp((s) => s.setFix);
  const approved = useApp((s) => s.approved);
  const toggleApprove = useApp((s) => s.toggleApprove);
  const markups = useApp((s) => s.markups);
  const lang = useApp((s) => s.lang);
  const setShowSettings = useApp((s) => s.setShowSettings);

  const [taskTab, setTaskTab] = useState<"pending" | "approved">("pending");
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [curveTooltip, setCurveTooltip] = useState<{
    stage: string;
    direct: number;
    gross: number;
    x: number;
    y: number;
  } | null>(null);

  const works = boq.works || 841932.64;

  // 2026 Contrast Palette for Asset Share Donut Chart
  const assetSlices = useMemo(() => {
    const whTotal = boq.buildings.find((b) => b.id === "WH")?.total || 437360;
    const adTotal = boq.buildings.find((b) => b.id === "AD")?.total || 144820;
    const pstkTotal =
      (boq.buildings.find((b) => b.id === "PS")?.total || 0) +
      (boq.buildings.find((b) => b.id === "TK")?.total || 26522);
    const siteTotal = boq.buildings.find((b) => b.id === "SITE")?.total || 253230;

    return [
      {
        id: "WH",
        name: lang === "az" ? "Anbar (48×24m)" : "Warehouse (48×24m)",
        color: "#2563EB", // Royal Cobalt Blue
        total: whTotal,
        share: whTotal / works,
      },
      {
        id: "SITE",
        name: lang === "az" ? "Sahə İşi və İnfra" : "Site Works & Civil",
        color: "#F97316", // Vibrant Coral Orange
        total: siteTotal,
        share: siteTotal / works,
      },
      {
        id: "AD",
        name: lang === "az" ? "İnzibati Ofis (2M)" : "Admin Office (2-St)",
        color: "#0F172A", // Deep Obsidian Slate
        total: adTotal,
        share: adTotal / works,
      },
      {
        id: "PS_TK",
        name: lang === "az" ? "Nasosxana və Çənlər" : "Pump & Reservoirs",
        color: "#94A3B8", // Cool Slate Grey
        total: pstkTotal,
        share: pstkTotal / works,
      },
    ];
  }, [boq.buildings, works, lang]);

  // Dual curve milestones for Commercial Progression Chart
  const STAGE_LABELS: Record<string, { en: string; az: string }> = {
    Substructure: { en: "Substructure", az: "Bünövrə" },
    Frame: { en: "Frame", az: "Karkas" },
    Roofing: { en: "Roofing", az: "Dam" },
    Envelope: { en: "Envelope", az: "Fasad" },
    Finishes: { en: "Finishes", az: "Tərtibat" },
    MEP: { en: "MEP", az: "Mühəndis" },
  };

  const milestones = [
    { stage: "Substructure", direct: 184000, gross: 261280 },
    { stage: "Frame", direct: 452000, gross: 641840 },
    { stage: "Roofing", direct: 598000, gross: 849160 },
    { stage: "Envelope", direct: 742000, gross: 1053640 },
    { stage: "Finishes", direct: 886000, gross: 1258120 },
    { stage: "MEP", direct: 994000, gross: 1411480 },
  ];

  const width = 360;
  const height = 110;
  const padX = 20;
  const padY = 14;
  const maxVal = 1550000;

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
    <div className="dash-view">
      {/* Dashboard Sub-Header / Title Row */}
      <div className="dash-banner">
        <div className="dash-title-group">
          <span className="dash-kicker">
            {lang === "az"
              ? "Qobu Qəsəbəsi, Abşeron Rayonu, Bakı • 0.9998 ha Baş Plan Sahəsi"
              : "Qobu Settlement, Absheron District, Baku • 0.9998 ha Site Layout"}
          </span>
          <h1 className="dash-title">{t("projectDashboard", lang)}</h1>
        </div>

        <div className="dash-header-kpis">
          <div className="header-kpi-chip">
            <span className="kpi-label">{lang === "az" ? "Birbaşa İşlər" : "Direct Works"}</span>
            <strong className="kpi-val num">{fmtMoney(boq.works)} ₼</strong>
          </div>
          <div className="header-kpi-chip">
            <span className="kpi-label">{lang === "az" ? "Müqavilə Cəmi" : "Contract Total"}</span>
            <strong className="kpi-val num text-cobalt">{fmtMoney(boq.total)} ₼</strong>
          </div>
          <div className="header-kpi-chip">
            <span className="kpi-label">{lang === "az" ? "Audit Yoxlamaları" : "Discipline Audits"}</span>
            <strong className="kpi-val num text-emerald">16 {lang === "az" ? "Aktiv" : "Active"}</strong>
          </div>
        </div>
      </div>

      {/* 3-Column Executive Grid (Panze Studio Architecture) */}
      <div className="dash-grid">
        {/* Column 1: Surveyor Action Queue (Panze "My Tasks" style) */}
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

            {/* Sub-Filter Tabs (Solid Black Active Pill) */}
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

            {/* Task Cards List (Clean ~52px each with subtle icon backgrounds) */}
            <div className="dash-tasks-list">
              {/* Task 1: Bracing Şr-2 profile total */}
              <div className={`dash-task-item${isBracingFixed ? " done" : ""}`}>
                <div className="dash-task-icon-box box-warning">
                  <AlertTriangle size={15} />
                </div>
                <div className="dash-task-text truncate">
                  <h3 className="dash-task-heading truncate">
                    {lang === "az" ? "Şr-2 bağlarında 400 kq artıq hesablama" : "Bracing Şr-2 math overstatement"}
                  </h3>
                  <span className="dash-task-sub truncate">
                    {lang === "az" ? "KS-33 • cəmdə 400 kq xəta" : "KS-33 • -400 kg error in sum"}
                  </span>
                </div>
                <div className="dash-task-action-wrap">
                  {isBracingFixed ? (
                    <button
                      type="button"
                      className="task-pill-action done"
                      onClick={() => setFix("C-01", false)}
                      title="Correction active (-400 kg)"
                    >
                      <Check size={12} strokeWidth={2.5} />
                      <span>{lang === "az" ? "Düzəldildi" : "Fixed"}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="task-pill-action fix"
                      onClick={() => setFix("C-01", true)}
                      title="Apply 400 kg correction"
                    >
                      <Wrench size={11} />
                      <span>{lang === "az" ? "-400kq Düzəlt" : "Fix -400kg"}</span>
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
                  <Layers size={15} />
                </div>
                <div className="dash-task-text truncate">
                  <h3 className="dash-task-heading truncate">
                    {lang === "az" ? "Anbar döşəmə sahəsi fərqi" : "Warehouse slab area variance"}
                  </h3>
                  <span className="dash-task-sub truncate">
                    {lang === "az" ? "KS-03 və AR-02 • Δ +8.4 m²" : "KS-03 vs AR-02 • Δ +8.4 m²"}
                  </span>
                </div>
                <div className="dash-task-action-wrap">
                  <span className="task-pill-action neutral">
                    <span>{lang === "az" ? "Baxış" : "Inspect"}</span>
                    <ArrowUpRight size={11} />
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
                  <SlidersHorizontal size={15} />
                </div>
                <div className="dash-task-text truncate">
                  <h3 className="dash-task-heading truncate">
                    {lang === "az" ? "İnzibati bina döşəmə qalınlığı" : "Admin ground slab thickness"}
                  </h3>
                  <span className="dash-task-sub truncate">
                    {lang === "az" ? "KS-42 və AR-14 • 100 və 150mm" : "KS-42 vs AR-14 • 100 vs 150mm"}
                  </span>
                </div>
                <div className="dash-task-action-wrap">
                  <span className="task-pill-action neutral">
                    <span>{lang === "az" ? "Baxış" : "Inspect"}</span>
                    <ArrowUpRight size={11} />
                  </span>
                </div>
              </div>

              {/* Task 4: Pad Footing F-1 Rebar */}
              <div className={`dash-task-item${isFootingSigned ? " done" : ""}`}>
                <div className="dash-task-icon-box box-rebar">
                  <Check size={15} />
                </div>
                <div className="dash-task-text truncate">
                  <h3 className="dash-task-heading truncate">
                    {lang === "az" ? "MB-1 bünövrə armatur təsdiqi" : "Pad Footing F-1 rebar sign-off"}
                  </h3>
                  <span className="dash-task-sub truncate">
                    {lang === "az" ? "KS-04 • 32.4 t A500C təsdiqləndi" : "KS-04 • 32.4 t A500C verified"}
                  </span>
                </div>
                <div className="dash-task-action-wrap">
                  <button
                    type="button"
                    className={`task-pill-action${isFootingSigned ? " done" : " action"}`}
                    onClick={() => toggleApprove("WH-F1-REBAR")}
                    title={isFootingSigned ? "Signed Off" : "Sign off rebar"}
                  >
                    <Check size={12} strokeWidth={2.5} />
                    <span>
                      {isFootingSigned
                        ? (lang === "az" ? "Təsdiqləndi" : "Signed")
                        : (lang === "az" ? "Təsdiqlə" : "Sign Off")}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Analytical Core (Center Column) */}
        <div className="dash-col dash-col-center">
          {/* Top Sub-Row: 2 cards side by side */}
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
                {/* Thick Multi-Color SVG Donut */}
                <svg className="dash-donut-svg" viewBox="0 0 130 130">
                  <circle cx="65" cy="65" r="44" fill="none" stroke="#F1F3F7" strokeWidth="15" />
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
                          strokeWidth={isHovered ? 18 : 15}
                          strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                          strokeDashoffset={dashOffset}
                          className="dash-donut-slice"
                          onMouseEnter={() => setHoveredSlice(slice.id)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          style={{
                            transformOrigin: "center",
                            transform: "rotate(-90deg)",
                            transition: "stroke-width 180ms ease, opacity 180ms ease",
                            opacity: hoveredSlice && !isHovered ? 0.45 : 1,
                            cursor: "pointer",
                          }}
                        />
                      );
                    });
                  })()}

                  {/* Donut Hole Value */}
                  <g className="dash-donut-hole-text">
                    <text x="65" y="64" textAnchor="middle" className="donut-hole-val num">
                      {Math.round(works / 1000)}k <tspan className="donut-hole-unit">AZN</tspan>
                    </text>
                    <text x="65" y="77" textAnchor="middle" className="donut-hole-label">
                      {t("directWorks", lang)}
                    </text>
                  </g>
                </svg>
              </div>

              {/* Donut Legend (Clean 2x2 grid matching Panze) */}
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
                    <span className="curve-dot dot-cobalt" />
                    <span className="curve-legend-label">{t("directBaseline", lang)}</span>
                    <span className="curve-dot dot-obsidian" />
                    <span className="curve-legend-label">{t("grossTotal", lang)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="dash-mini-btn"
                  onClick={() => navigate("/export")}
                  title="Export commercial report"
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
                    <linearGradient id="cobaltGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="obsidianGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0F172A" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#0F172A" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Reference Grid Guides */}
                  <line x1={padX} y1={padY} x2={width - padX} y2={padY} stroke="rgba(15, 23, 42, 0.05)" strokeDasharray="3 3" />
                  <line x1={padX} y1={(padY + height - padY) / 2} x2={width - padX} y2={(padY + height - padY) / 2} stroke="rgba(15, 23, 42, 0.05)" strokeDasharray="3 3" />
                  <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="rgba(15, 23, 42, 0.08)" />

                  {/* Area fills */}
                  <path d={areaGross} fill="url(#obsidianGradient)" />
                  <path d={areaDirect} fill="url(#cobaltGradient)" />

                  {/* Spline Lines */}
                  <path
                    d={dPathGross}
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d={dPathDirect}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.2"
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
                      stroke="#0F172A"
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
                      stroke="#2563EB"
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
                    <strong className="tooltip-stage">
                      {STAGE_LABELS[curveTooltip.stage]?.[lang] ?? curveTooltip.stage}
                    </strong>
                    <div className="tooltip-row">
                      <span className="tooltip-tag cobalt">{t("directBaseline", lang)}:</span>
                      <span className="num">{fmtMoney(curveTooltip.direct)} ₼</span>
                    </div>
                    <div className="tooltip-row">
                      <span className="tooltip-tag obsidian">{t("grossTotal", lang)}:</span>
                      <span className="num">{fmtMoney(curveTooltip.gross)} ₼</span>
                    </div>
                  </div>
                ) : null}

                {/* X Axis Stages */}
                <div className="dash-curve-stages">
                  {milestones.map((m) => {
                    const label = STAGE_LABELS[m.stage]?.[lang] ?? m.stage;
                    return (
                      <span key={m.stage} className="dash-stage-label" title={label}>
                        {label.length > 7 ? label.slice(0, 6) + "…" : label}
                      </span>
                    );
                  })}
                </div>

                {/* Bottom Progression KPI Strip (Eliminates empty white space) */}
                <div className="dash-curve-kpi-row">
                  <div className="curve-kpi-item">
                    <span className="curve-kpi-label">
                      <span className="curve-dot dot-cobalt" />
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

          {/* Bottom Card: Invoice Overview (Panze Studio Style Progress Meter Bars) */}
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

            {/* Panze-Style Thick Rounded Meter Bars */}
            <div className="dash-meter-bars">
              {/* 1. Direct Works Scope - Vibrant Cobalt */}
              <div className="dash-meter-item">
                <span className="dash-meter-name">{t("directWorksScope", lang)}</span>
                <div className="dash-meter-bar-track">
                  <div className="dash-meter-bar-fill bar-cobalt" style={{ width: "100%" }} />
                </div>
                <div className="dash-meter-value num">
                  {fmtMoney(boq.works)} <span className="currency">AZN</span>
                </div>
              </div>

              {/* 2. Overheads - Vibrant Violet */}
              <div className="dash-meter-item">
                <span className="dash-meter-name">{t("overheadsName", lang)} ({pct(markups.overheads, 0)})</span>
                <div className="dash-meter-bar-track">
                  <div
                    className="dash-meter-bar-fill bar-violet"
                    style={{ width: `${(boq.chain[1]?.amount ?? 79520) / boq.total * 100 * 3.5}%` }}
                  />
                </div>
                <div className="dash-meter-value num">
                  {fmtMoney(boq.chain[1]?.amount ?? 79520)} <span className="currency">AZN</span>
                </div>
              </div>

              {/* 3. Contractor Profit - Vibrant Coral */}
              <div className="dash-meter-item">
                <span className="dash-meter-name">{t("profitName", lang)} ({pct(markups.profit, 0)})</span>
                <div className="dash-meter-bar-track">
                  <div
                    className="dash-meter-bar-fill bar-coral"
                    style={{ width: `${(boq.chain[2]?.amount ?? 59640) / boq.total * 100 * 3.5}%` }}
                  />
                </div>
                <div className="dash-meter-value num">
                  {fmtMoney(boq.chain[2]?.amount ?? 59640)} <span className="currency">AZN</span>
                </div>
              </div>

              {/* 4. Contingency - Cool Slate */}
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

              {/* 5. Statutory VAT - Emerald Green */}
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
          {/* Top Card: Drawing Packages (Panze "My Meetings" style) */}
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
                  <span className="dash-pkg-meta">8 {t("sheetsCount", lang)} • Site Layout</span>
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
                  <span className="dash-pkg-meta">36 {t("sheetsCount", lang)} • Room Finishes</span>
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
                  <span className="dash-pkg-meta">61 {t("sheetsCount", lang)} • Trusses &amp; Rebar</span>
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
                  <span className="dash-pkg-meta">100 {t("sheetsCount", lang)} • HVAC &amp; Power</span>
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

          {/* Bottom Card: Open Tickets / Discipline Audits (Panze "Open Tickets" style) */}
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
                <div className="dash-reviewer-avatar avatar-ks">KS</div>
                <div className="dash-ticket-content truncate">
                  <h3 className="dash-ticket-title truncate">
                    {lang === "az" ? "Şr-2 bağlarında 400 kq artıq hesablama" : "Bracing Şr-2 math overstatement"}
                  </h3>
                  <span className="dash-ticket-sub truncate">
                    {lang === "az" ? "Vərəq KS-33 • 400 kq xəta" : "Sheet KS-33 • -400 kg error"}
                  </span>
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
                <div className="dash-reviewer-avatar avatar-ar">AR</div>
                <div className="dash-ticket-content truncate">
                  <h3 className="dash-ticket-title truncate">
                    {lang === "az" ? "İnzibati bina döşəmə qalınlığı" : "Admin ground slab thickness"}
                  </h3>
                  <span className="dash-ticket-sub truncate">
                    {lang === "az" ? "KS 100mm və AR 150mm" : "KS 100mm vs AR 150mm"}
                  </span>
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
                <div className="dash-reviewer-avatar avatar-mep">MEP</div>
                <div className="dash-ticket-content truncate">
                  <h3 className="dash-ticket-title truncate">
                    {lang === "az" ? "Nasos gücü üzrə qeyd" : "Booster pump rating note"}
                  </h3>
                  <span className="dash-ticket-sub truncate">
                    {lang === "az" ? "Mühəndis spesifikasiyası" : "Utilities schedule"}
                  </span>
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
  );
}

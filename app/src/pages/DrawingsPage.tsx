import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Folder,
  Layers,
  MapPin,
  Search,
  Table2,
} from "lucide-react";
import { buildingById, data, DISCIPLINES, docByCode, evidenceBySheet, itemById, sheetById, sheetImage } from "../data";
import type { Box } from "../data/types";
import { useBoq } from "../lib/boq";
import { fmtMoney, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { t } from "../lib/i18n";
import { SheetViewer, type ViewerHandle, type ViewerMark } from "../components/SheetViewer";
import { LineInspector } from "../components/LineInspector";
import { Drawer } from "../components/ui";

export function DrawingsPage() {
  const { sheetId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const approvedMap = useApp((s) => s.approved);

  // If no sheetId is specified in URL, show the Project Folders View
  const isFoldersView = !sheetId;

  const [query, setQuery] = useState("");
  const [onlyEvidence, setOnlyEvidence] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const viewer = useRef<ViewerHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // If viewing a sheet, resolve sheet; default to KS-9 if opened directly
  const sheet = sheetById.get(sheetId ?? "") ?? sheetById.get("KS-9")!;
  const activeItem = params.get("item");
  const activeSrc = Number(params.get("src") ?? 0);
  const activeCheck = params.get("check");

  const evidence = evidenceBySheet.get(sheet.id) ?? [];

  // Compute rich marks with tags, values, and verification states for SheetViewer
  const marks: ViewerMark[] = useMemo(() => {
    const list: ViewerMark[] = evidence.map(({ itemId, srcIndex }) => {
      const it = itemById.get(itemId)!;
      const src = it.src[srcIndex]!;
      const isApproved = Boolean(approvedMap[itemId]);
      const isActive = itemId === activeItem && srcIndex === activeSrc;

      const checkOnItem = data.checks.find((c) =>
        c.sources.some((s) => s.sheet === sheet.id && Math.abs(s.box[0] - src.box[0]) < 2)
      );
      const hasVariance = checkOnItem && checkOnItem.severity !== "ok";

      let tone: "red" | "blue" | "green" | "amber" = "blue";
      if (isActive) tone = "red";
      else if (isApproved) tone = "green";
      else if (hasVariance) tone = "amber";

      const line = boq.lineByItem.get(itemId);
      const tag = line?.code || it.section || it.id;
      const label = `${src.value ?? it.qty} ${it.unit}`;

      return {
        key: `i:${itemId}:${srcIndex}`,
        box: src.box,
        tone,
        active: isActive,
        tag,
        label,
        approved: isApproved,
      };
    });

    if (activeCheck) {
      const c = data.checks.find((x) => x.id === activeCheck);
      c?.sources.forEach((s, i) => {
        if (s.sheet === sheet.id) {
          list.push({
            key: `c:${c.id}:${i}`,
            box: s.box,
            tone: "red",
            active: i === activeSrc,
            tag: "Audit",
            label: c.title,
          });
        }
      });
    }

    return list;
  }, [evidence, activeItem, activeSrc, activeCheck, sheet.id, approvedMap, boq.lineByItem]);

  const focus: Box | null = useMemo(() => marks.find((m) => m.active)?.box ?? null, [marks]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.documents.map((d) => ({
      doc: d,
      sheets: data.sheets.filter(
        (s) =>
          s.doc === d.code &&
          (!onlyEvidence || evidenceBySheet.has(s.id)) &&
          (!q || `${s.id} ${s.title} ${s.titleEn} ${buildingById.get(s.building)?.short}`.toLowerCase().includes(q)),
      ),
    }));
  }, [query, onlyEvidence]);

  const flat = groups.flatMap((g) => g.sheets);
  const idx = flat.findIndex((s) => s.id === sheet.id);

  useEffect(() => {
    if (!isFoldersView) {
      listRef.current?.querySelector(`[data-sheet="${sheet.id}"]`)?.scrollIntoView({ block: "nearest" });
    }
  }, [sheet.id, isFoldersView]);

  const openSheet = (id: string) => navigate(`/drawings/${id}`);

  const focusItem = (itemId: string, srcIndex: number) => {
    const next = new URLSearchParams();
    next.set("item", itemId);
    next.set("src", String(srcIndex));
    setParams(next, { replace: true });
    setInspectorOpen(true);
  };

  const doc = docByCode.get(sheet.doc)!;
  const activeLine = activeItem ? boq.lineByItem.get(activeItem) : null;

  // Folder summaries data
  const folderData = [
    {
      code: "BP",
      nameEn: "Master Plan",
      nameAz: "Baş Plan",
      file: "Qobu Bas plan28.09.2026.pdf",
      sheetCount: 8,
      leadSheet: "BP-1",
      scopeEn: "Civil Setting-Out Plans, Topography, Earthworks & Site Zoning (0.9998 ha)",
      scopeAz: "Baş plan, relyef qazma işləri, abadlıq və sahə zonalaşdırılması (0.9998 ha)",
      sampleSheets: ["BP-1", "BP-2", "BP-3", "BP-4"],
      badgeClass: "badge-bp",
    },
    {
      code: "AR",
      nameEn: "Architecture",
      nameAz: "Memarlıq Hissəsi",
      file: "Qobu inzibati bina ve anbar 28.09.2026.pdf",
      sheetCount: 36,
      leadSheet: "AR-1",
      scopeEn: "Warehouse Hall & 2-Storey Office Plans, Elevations, Sections & Finishes",
      scopeAz: "Anbar və 2-mərtəbəli inzibati ofis planları, fasadlar, kəsiklər və otaq tərtibatı",
      sampleSheets: ["AR-1", "AR-2", "AR-3", "AR-14"],
      badgeClass: "badge-ar",
    },
    {
      code: "KS",
      nameEn: "Structure",
      nameAz: "Konstruksiya Hissəsi",
      file: "Qobu konstruksiya.pdf",
      sheetCount: 61,
      leadSheet: "KS-9",
      scopeEn: "Monolithic Foundations, Columns, Steel Trusses, Rebar & Material Schedules",
      scopeAz: "Monolit bünövrələr, dəmir-beton karkas, polad fermalar və armatur spesifikasiyası",
      sampleSheets: ["KS-1", "KS-3", "KS-9", "KS-33"],
      badgeClass: "badge-ks",
    },
    {
      code: "MEP",
      nameEn: "Building Services (MEP)",
      nameAz: "Mühəndis Sistemləri (MEP)",
      file: "Qobu kommunikasiya ümumi.pdf",
      sheetCount: 100,
      leadSheet: "MEP-1",
      scopeEn: "Water Supply, Sewage Drainage, HVAC Ventilation, Power & Fire Alarms",
      scopeAz: "Su təchizatı, kanalizasiya, havalandırma, elektrik paylanması və yanğın siqnalizasiyası",
      sampleSheets: ["MEP-1", "MEP-10", "MEP-25", "MEP-50"],
      badgeClass: "badge-mep",
    },
  ];

  // -------------------------------------------------------------
  // VIEW A: Project Folders Hub (When user clicks Drawing Register)
  // -------------------------------------------------------------
  if (isFoldersView) {
    return (
      <div className="page project-folders-page">
        {/* Page Header */}
        <header className="folders-header">
          <div className="folders-header-left">
            <span className="folders-kicker">
              {lang === "az" ? "Layihə Çertyoj Qovluqları" : "Tender Drawing Register & Project Directory"}
            </span>
            <h1 className="folders-page-title">
              {lang === "az" ? t("projectFoldersTitle", "az") : t("projectFoldersTitle", "en")}
            </h1>
            <p className="folders-page-sub">
              {lang === "az" ? t("projectFoldersSub", "az") : t("projectFoldersSub", "en")}
            </p>
          </div>

          <div className="folders-header-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate("/drawings/KS-9")}
              title="Open full interactive drawing sheet viewer"
            >
              <Layers size={14} />
              <span>{t("openViewerBtn", lang)}</span>
            </button>
          </div>
        </header>

        {/* Master Project Card ("the sheets we are working with are just of one project") */}
        <section className="project-hub-hero">
          <div className="hub-hero-top">
            <div className="hub-hero-badge-row">
              <span className="hub-status-pill">
                <span className="dot pulse" />
                {lang === "az" ? "Aktiv Layihə • İşçi Layihə (2026)" : "Active Project • Working Design (2026)"}
              </span>
              <span className="hub-code-pill font-mono">PRJ-AZ-2026-QOBU</span>
            </div>
            <h2 className="hub-project-title">
              {lang === "az" ? data.project.name : data.project.nameEn}
            </h2>
            <div className="hub-project-location">
              <MapPin size={14} className="text-amber" />
              <span>{lang === "az" ? data.project.place : data.project.placeEn}</span>
            </div>
          </div>

          {/* Project Details Grid */}
          <div className="hub-meta-grid">
            <div className="hub-meta-item">
              <span className="hub-meta-label">{t("client", lang)}</span>
              <strong className="hub-meta-val">{data.project.client}</strong>
            </div>
            <div className="hub-meta-item">
              <span className="hub-meta-label">{t("designer", lang)}</span>
              <strong className="hub-meta-val">{data.project.designer}</strong>
            </div>
            <div className="hub-meta-item">
              <span className="hub-meta-label">{lang === "az" ? "Çertyoj Həcmi" : "Drawing Package"}</span>
              <strong className="hub-meta-val num">4 {lang === "az" ? "Qovluq" : "Folders"} • 205 {t("sheetsCount", lang)}</strong>
            </div>
            <div className="hub-meta-item">
              <span className="hub-meta-label">{t("contractValuation", lang)}</span>
              <strong className="hub-meta-val num text-emerald">{fmtMoney(boq.total)} AZN</strong>
            </div>
          </div>

          {/* Core Action Launchers ("when opening a project it should then open the boq decipline audit") */}
          <div className="hub-actions-bar">
            <div className="hub-actions-desc">
              <strong>{lang === "az" ? "Layihə İdarəetmə Keçidləri:" : "Project Takeoff Actions:"}</strong>
              <span>
                {lang === "az"
                  ? "Smeta cədvəlinə, çarpaz audit yoxlamalarına və ya çertyoj vərəqlərinə birbaşa keçid edin."
                  : "Launch directly into the verified Bill of Quantities or inspect cross-discipline drawing checks."}
              </span>
            </div>

            <div className="hub-action-buttons">
              <button
                type="button"
                className="btn btn-primary hub-btn-boq"
                onClick={() => navigate("/bill")}
              >
                <Table2 size={16} />
                <span>{t("openBoqBtn", lang)}</span>
                <span className="hub-btn-tag font-mono">117 {t("linesCount", lang)}</span>
              </button>

              <button
                type="button"
                className="btn btn-outline hub-btn-audit"
                onClick={() => navigate("/checks")}
              >
                <ClipboardCheck size={16} />
                <span>{t("openAuditsBtn", lang)}</span>
                <span className="hub-btn-tag hub-tag-alert">4 {t("activeFindings", lang)}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 4 Project Drawing Folders / Volumes Grid */}
        <section className="folders-grid-section">
          <div className="section-head-row">
            <div>
              <h3 className="section-heading">
                {lang === "az" ? "Layihə Çertyoj Qovluqları (4 Cild)" : "Tender Drawing Folders (4 Volumes)"}
              </h3>
              <span className="section-subheading">
                {lang === "az"
                  ? "Qovluq üzrə bütün vərəqləri açmaq və aşkarlanan smeta işarələrini təhlil etmək üçün qovluğu seçin."
                  : "Select any volume to open its drawing sheets and review vector takeoff coordinates."}
              </span>
            </div>
            <span className="muted small num-inline">205 {t("sheetsCount", lang)}</span>
          </div>

          <div className="folders-grid">
            {folderData.map((folder) => (
              <div
                key={folder.code}
                className="folder-card"
                onClick={() => navigate(`/drawings/${folder.leadSheet}`)}
                role="button"
                tabIndex={0}
              >
                <div className="folder-card-top">
                  <div className={`folder-code-badge ${folder.badgeClass}`}>
                    <Folder size={16} />
                    <span>{folder.code}</span>
                  </div>
                  <span className="folder-sheet-badge num-inline">
                    {folder.sheetCount} {t("sheetsCount", lang)}
                  </span>
                </div>

                <div className="folder-card-body">
                  <h4 className="folder-title">
                    {lang === "az" ? folder.nameAz : folder.nameEn}
                  </h4>
                  <span className="folder-filename font-mono truncate" title={folder.file}>
                    {folder.file}
                  </span>
                  <p className="folder-scope">
                    {lang === "az" ? folder.scopeAz : folder.scopeEn}
                  </p>
                </div>

                {/* Sample Sheet Pills */}
                <div className="folder-samples-row">
                  <span className="folder-samples-label">{lang === "az" ? "Vərəqlər:" : "Key Sheets:"}</span>
                  <div className="folder-pills">
                    {folder.sampleSheets.map((sh) => (
                      <span
                        key={sh}
                        className="sample-sheet-pill"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/drawings/${sh}`);
                        }}
                      >
                        {sh}
                      </span>
                    ))}
                    <span className="sample-more-pill">+{folder.sheetCount - folder.sampleSheets.length}</span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="folder-card-footer">
                  <span className="folder-open-action">
                    <span>{t("exploreFolder", lang)} ({folder.sheetCount})</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: Interactive Drawing Sheet Viewer (When viewing a sheet)
  // -------------------------------------------------------------
  return (
    <div className="drawings modern-drawings">
      {/* Left Sheet Register Sidebar */}
      <aside className="register">
        <div className="register-head">
          {/* Breadcrumb Back to Project Folders */}
          <button
            type="button"
            className="back-to-folders-btn"
            onClick={() => navigate("/drawings")}
            title="Return to Project Folders Directory"
          >
            <ChevronLeft size={14} />
            <span>{t("backToFolders", lang)}</span>
          </button>

          <div className="register-title-row">
            <h1>{t("drawingSheets", lang)}</h1>
            <span className="register-badge">{flat.length} / 205</span>
          </div>

          <div className="search">
            <Search size={14} aria-hidden="true" />
            <input
              className="input"
              placeholder={t("searchSheetsPlaceholder", lang)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search sheets"
            />
          </div>

          <label className="check-toggle">
            <input type="checkbox" checked={onlyEvidence} onChange={(e) => setOnlyEvidence(e.target.checked)} />
            <span>{t("onlyWithTakeoff", lang)}</span>
          </label>
        </div>

        <div className="register-list scroll" ref={listRef}>
          {groups.map(({ doc: d, sheets }) =>
            sheets.length ? (
              <section key={d.code} className="reg-group">
                <h2 className="reg-doc">
                  <span>{lang === "az" ? d.az : d.en}</span>
                  <span className="muted num-inline">{sheets.length}</span>
                </h2>
                <ul>
                  {sheets.map((s) => {
                    const n = evidenceBySheet.get(s.id)?.length ?? 0;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          data-sheet={s.id}
                          className={`reg-sheet${s.id === sheet.id ? " active" : ""}`}
                          onClick={() => openSheet(s.id)}
                        >
                          <img src={sheetImage(s.id, true)} alt="" loading="lazy" />
                          <span className="reg-text">
                            <span className="reg-title">{lang === "az" ? s.title : s.titleEn}</span>
                            <span className="reg-meta">
                              {s.id} • {buildingById.get(s.building)?.short}
                            </span>
                          </span>
                          {n ? <span className="reg-count num-inline">{n}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      </aside>

      {/* Main Blueprint Canvas Center */}
      <section className="sheet-pane">
        <header className="sheet-bar">
          <div className="sheet-titles">
            <div className="sheet-id-line">
              <strong>{sheet.id}</strong>
              <span className="sheet-sep">•</span>
              <span className="sheet-file-meta">
                {doc.file}, {lang === "az" ? `Vərəq ${sheet.page}` : `Sheet ${sheet.page}`} / {data.sheets.filter((s) => s.doc === doc.code).length}
              </span>
              <span className="discipline-tag">{DISCIPLINES[sheet.discipline]}</span>
            </div>
            <div className="sheet-name" lang="az">
              {sheet.title}
            </div>
            <div className="sheet-sub muted">
              {sheet.titleEn} • {lang === "az" ? buildingById.get(sheet.building)?.short : buildingById.get(sheet.building)?.en}
            </div>
          </div>

          <div className="sheet-nav-controls">
            {/* Quick Link to Folders */}
            <button
              type="button"
              className="btn btn-outline btn-xs mr-2"
              onClick={() => navigate("/drawings")}
              title="Return to Project Folders Directory"
            >
              <Folder size={13} />
              <span>{t("viewFolders", lang)}</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              disabled={idx <= 0}
              onClick={() => idx > 0 && openSheet(flat[idx - 1]!.id)}
              aria-label="Previous sheet"
              title="Previous sheet"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="sheet-counter num-inline">
              {idx + 1} <span className="muted">/</span> {flat.length}
            </span>
            <button
              type="button"
              className="icon-btn"
              disabled={idx >= flat.length - 1}
              onClick={() => idx < flat.length - 1 && openSheet(flat[idx + 1]!.id)}
              aria-label="Next sheet"
              title="Next sheet"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {/* Persistent Detected Quantities Toolbar for Immediate Verification */}
        {evidence.length > 0 ? (
          <div className="sheet-detected-bar">
            <div className="detected-label-group">
              <span className="detected-bar-title">
                {lang === "az" ? "Aşkarlanan Smeta Həcmləri:" : "Detected Schedule Values:"}
              </span>
              <span className="detected-count-badge font-mono">{evidence.length}</span>
            </div>
            <div className="detected-chips-scroll">
              {evidence.map(({ itemId, srcIndex }) => {
                const it = itemById.get(itemId)!;
                const src = it.src[srcIndex]!;
                const line = boq.lineByItem.get(itemId);
                const tag = line?.code || it.section || it.id;
                const val = `${src.value ?? it.qty} ${unitLabel(it.unit, lang)}`;
                const isApproved = Boolean(approvedMap[itemId]);
                const isActive = itemId === activeItem && srcIndex === activeSrc;

                return (
                  <button
                    key={`${itemId}-${srcIndex}`}
                    type="button"
                    className={`detected-val-chip${isActive ? " active" : ""}${isApproved ? " approved" : ""}`}
                    onClick={() => focusItem(itemId, srcIndex)}
                    title={`Locate on blueprint & inspect: ${line?.en || it.en}`}
                  >
                    <span className="chip-tag font-mono">{tag}</span>
                    <span className="chip-val num">{val}</span>
                    {isApproved ? (
                      <span className="chip-status-dot approved" title="Approved" />
                    ) : (
                      <span className="chip-status-dot pending" title="Pending verification" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <SheetViewer
          ref={viewer}
          sheet={sheet}
          marks={marks}
          focus={focus}
          onMark={(key) => {
            const [kind, id, i] = key.split(":");
            if (kind === "i") focusItem(id!, Number(i));
          }}
        />
      </section>

      {/* Slide-out Inspector Drawer */}
      <Drawer
        open={inspectorOpen}
        onClose={() => {
          setInspectorOpen(false);
          const next = new URLSearchParams(params);
          next.delete("item");
          next.delete("src");
          setParams(next, { replace: true });
        }}
        title={activeLine ? `${activeLine.code} • ${activeLine.en}` : "Element Details"}
      >
        {activeLine ? (
          <LineInspector
            line={activeLine}
            onFocusSheet={(sh, box) => {
              if (sh !== sheet.id) {
                openSheet(sh);
              } else {
                viewer.current?.flyTo(box);
              }
            }}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

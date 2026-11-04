import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Ruler,
  Search,
} from "lucide-react";
import { buildingById, data, DISCIPLINES, docByCode, evidenceBySheet, itemById, sheetById, sheetImage } from "../data";
import type { Box } from "../data/types";
import { useBoq } from "../lib/boq";
import { fmtQty, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { SheetViewer, type ViewerHandle, type ViewerMark } from "../components/SheetViewer";
import { LineInspector } from "../components/LineInspector";
import { Drawer, MethodTag, SeverityTag } from "../components/ui";

export function DrawingsPage() {
  const { sheetId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const approvedMap = useApp((s) => s.approved);
  const toggleApprove = useApp((s) => s.toggleApprove);

  const [query, setQuery] = useState("");
  const [onlyEvidence, setOnlyEvidence] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const viewer = useRef<ViewerHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sheet = sheetById.get(sheetId ?? "") ?? sheetById.get("KS-9")!;
  const activeItem = params.get("item");
  const activeSrc = Number(params.get("src") ?? 0);
  const activeCheck = params.get("check");

  const evidence = evidenceBySheet.get(sheet.id) ?? [];
  const checkHere = data.checks.filter((c) => c.sources.some((s) => s.sheet === sheet.id));

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
    listRef.current?.querySelector(`[data-sheet="${sheet.id}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sheet.id]);

  const open = (id: string) => navigate(`/drawings/${id}`);

  const focusItem = (itemId: string, srcIndex: number) => {
    const next = new URLSearchParams();
    next.set("item", itemId);
    next.set("src", String(srcIndex));
    setParams(next, { replace: true });
    viewer.current?.flyTo(itemById.get(itemId)!.src[srcIndex]!.box);
    setInspectorOpen(true);
  };

  const doc = docByCode.get(sheet.doc)!;
  const activeLine = activeItem ? boq.lineByItem.get(activeItem) : null;

  return (
    <div className="drawings modern-drawings">
      {/* Left Sheet Register Sidebar */}
      <aside className="register">
        <div className="register-head">
          <div className="register-title-row">
            <h1>Drawing Sheets</h1>
            <span className="register-badge">{flat.length} / 205</span>
          </div>

          <div className="search">
            <Search size={14} aria-hidden="true" />
            <input
              className="input"
              placeholder="Search by code, title, building..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search sheets"
            />
          </div>

          <label className="check-toggle">
            <input type="checkbox" checked={onlyEvidence} onChange={(e) => setOnlyEvidence(e.target.checked)} />
            <span>Only sheets with takeoff quantities</span>
          </label>
        </div>

        <div className="register-list scroll" ref={listRef}>
          {groups.map(({ doc: d, sheets }) =>
            sheets.length ? (
              <section key={d.code} className="reg-group">
                <h2 className="reg-doc">
                  <span>{d.en}</span>
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
                          onClick={() => open(s.id)}
                        >
                          <img src={sheetImage(s.id, true)} alt="" loading="lazy" />
                          <span className="reg-text">
                            <span className="reg-title">{s.titleEn}</span>
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
                {doc.file}, Sheet {sheet.page} of {data.sheets.filter((s) => s.doc === doc.code).length}
              </span>
              <span className="discipline-tag">{DISCIPLINES[sheet.discipline]}</span>
            </div>
            <div className="sheet-name" lang="az">
              {sheet.title}
            </div>
            <div className="sheet-sub muted">
              {sheet.titleEn} • {buildingById.get(sheet.building)?.en}
            </div>
          </div>

          <div className="sheet-nav-controls">
            <button
              type="button"
              className="icon-btn"
              disabled={idx <= 0}
              onClick={() => idx > 0 && open(flat[idx - 1]!.id)}
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
              onClick={() => idx < flat.length - 1 && open(flat[idx + 1]!.id)}
              aria-label="Next sheet"
              title="Next sheet"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

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

      {/* Right Schedule Takeoff Sidebar */}
      <aside className="read-pane scroll">
        <div className="read-pane-head">
          <div>
            <h2>Verified Takeoff Items</h2>
            <span className="text-muted small">
              {evidence.length} {evidence.length === 1 ? "quantity" : "quantities"} on this sheet
            </span>
          </div>
        </div>

        {!evidence.length ? (
          <div className="read-empty-card">
            <Layers size={24} className="text-muted" />
            <p className="empty-title">General Reference Sheet</p>
            <p className="text-muted small">
              {sheet.discipline === "general"
                ? "This sheet establishes drawing legends, general notes, and setting-out coordinates."
                : "Elements shown on this plan are itemized in the master schedules on adjacent sheets."}
            </p>
          </div>
        ) : (
          <ul className="read-list">
            {evidence.map(({ itemId, srcIndex }) => {
              const it = itemById.get(itemId)!;
              const src = it.src[srcIndex]!;
              const line = boq.lineByItem.get(itemId);
              const active = itemId === activeItem && srcIndex === activeSrc;
              const isApproved = Boolean(approvedMap[itemId]);

              return (
                <li key={`${itemId}-${srcIndex}`}>
                  <div className={`read-item-card${active ? " active" : ""}${isApproved ? " approved" : ""}`}>
                    <div className="read-item-top" onClick={() => focusItem(itemId, srcIndex)}>
                      <div className="read-tags">
                        <MethodTag method={it.method} compact />
                        {line ? <span className="read-code num-inline">{line.code}</span> : null}
                      </div>

                      <div className="read-actions-inline">
                        <button
                          type="button"
                          className={`btn-approve-mini ${isApproved ? "approved" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleApprove(itemId);
                          }}
                          title={isApproved ? "Approved by surveyor" : "Click to approve"}
                        >
                          <Check size={12} />
                          <span>{isApproved ? "Approved" : "Approve"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="read-item-body" onClick={() => focusItem(itemId, srcIndex)}>
                      <h4 className="read-desc">{lang === "az" ? it.az : it.en}</h4>
                      <div className="read-qty-row">
                        <span className="text-muted small">Takeoff Quantity:</span>
                        <strong className="num-inline">
                          {fmtQty(it.qty, it.unit)} {unitLabel(it.unit, lang)}
                        </strong>
                      </div>

                      <blockquote className="read-quote" lang="az">
                        "{src.quote}"
                      </blockquote>
                    </div>

                    <div className="read-item-footer">
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => focusItem(itemId, srcIndex)}
                      >
                        <Ruler size={11} />
                        <span>Inspect & Edit Dimensions</span>
                      </button>

                      {line ? (
                        <Link to={`/bill?line=${encodeURIComponent(line.id)}`} className="text-link small">
                          Line {line.code} in BOQ
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {checkHere.length ? (
          <div className="sheet-audit-card">
            <h3 className="sheet-audit-title">Discipline Checks on this Sheet</h3>
            <ul className="sheet-audit-list">
              {checkHere.map((c) => (
                <li key={c.id}>
                  <Link to={`/checks/${c.id}`} className="sheet-audit-link">
                    <SeverityTag severity={c.severity} kind={c.kind} />
                    <span className="audit-link-title">{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>

      {/* Slide-out Constech-style Inspector Drawer */}
      <Drawer
        open={inspectorOpen && Boolean(activeLine)}
        onClose={() => setInspectorOpen(false)}
        title={activeLine ? `Line ${activeLine.code} • ${activeLine.section}` : "Takeoff Inspector"}
        kicker="Item Dimension & Provenance Inspector"
        width={460}
      >
        {activeLine ? (
          <LineInspector
            line={activeLine}
            onFocusSheet={(sId, box) => {
              if (sId !== sheet.id) open(sId);
              setTimeout(() => viewer.current?.flyTo(box), 120);
            }}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { buildingById, data, DISCIPLINES, docByCode, evidenceBySheet, itemById, sheetById, sheetImage, sheetKind, type SheetKind } from "../data";
import type { Box } from "../data/types";
import { useBoq } from "../lib/boq";
import { fmtQty, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { SheetViewer, type ViewerHandle, type ViewerMark } from "../components/SheetViewer";
import { MethodTag, SeverityTag } from "../components/ui";

export function DrawingsPage() {
  const { sheetId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const [query, setQuery] = useState("");
  const [onlyEvidence, setOnlyEvidence] = useState(false);
  const viewer = useRef<ViewerHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sheet = sheetById.get(sheetId ?? "") ?? sheetById.get("AR-10")!;
  const activeItem = params.get("item");
  const activeSrc = Number(params.get("src") ?? 0);
  const activeCheck = params.get("check");

  const evidence = evidenceBySheet.get(sheet.id) ?? [];
  const checkHere = data.checks.filter((c) => c.sources.some((s) => s.sheet === sheet.id));

  const marks: ViewerMark[] = useMemo(() => {
    const list: ViewerMark[] = evidence.map(({ itemId, srcIndex }) => {
      const it = itemById.get(itemId)!;
      const src = it.src[srcIndex]!;
      return {
        key: `i:${itemId}:${srcIndex}`,
        box: src.box,
        tone: "blue" as const,
        active: itemId === activeItem && srcIndex === activeSrc,
        label: src.role ? `${roleLabel(src.role)} ${src.value ?? ""}`.trim() : `${fmtQty(it.qty, it.unit)} ${unitLabel(it.unit, lang)}`,
      };
    });
    if (activeCheck) {
      const c = data.checks.find((x) => x.id === activeCheck);
      c?.sources.forEach((s, i) => {
        if (s.sheet === sheet.id) list.push({ key: `c:${c.id}:${i}`, box: s.box, tone: "red", active: i === activeSrc });
      });
    }
    return list.map((m) => (m.active ? { ...m, tone: "red" as const } : m));
  }, [evidence, activeItem, activeSrc, activeCheck, sheet.id, lang]);

  const focus: Box | null = useMemo(() => marks.find((m) => m.active)?.box ?? null, [marks]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return KINDS.map((k) => ({
      ...k,
      groups: data.documents
        .map((d) => ({
          doc: d,
          sheets: data.sheets.filter(
            (s) =>
              s.doc === d.code &&
              sheetKind(s) === k.kind &&
              (!onlyEvidence || evidenceBySheet.has(s.id)) &&
              (!q || `${s.id} ${s.title} ${s.titleEn} ${buildingById.get(s.building)?.short}`.toLowerCase().includes(q)),
          ),
        }))
        .filter((g) => g.sheets.length),
    }));
  }, [query, onlyEvidence]);
  const flat = sections.flatMap((s) => s.groups.flatMap((g) => g.sheets));
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
  };

  const doc = docByCode.get(sheet.doc)!;
  const hasText = doc.text === true || (doc.text === "partial" && evidence.some((e) => itemById.get(e.itemId)!.src[e.srcIndex]!.how === "text"));

  return (
    <div className="drawings">
      <aside className="register">
        <div className="register-head">
          <h1>Drawings</h1>
          <div className="reg-project">
            <strong>{data.project.nameEn}</strong>
            <span>4 PDF files, 205 sheets, issue {data.project.issued}</span>
          </div>
          <div className="search">
            <Search size={15} aria-hidden="true" />
            <input className="input" placeholder="Search sheets" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search sheets" />
          </div>
          <label className="check-toggle">
            <input type="checkbox" checked={onlyEvidence} onChange={(e) => setOnlyEvidence(e.target.checked)} />
            Only sheets with quantities
          </label>
        </div>
        <div className="register-list scroll" ref={listRef}>
          {sections.map((sec) =>
            sec.groups.length ? (
              <section key={sec.kind} className="reg-section">
                <h2 className="reg-section-title">
                  <span>{sec.title}</span>
                  <small className="num-inline">{sec.groups.reduce((a, g) => a + g.sheets.length, 0)}</small>
                </h2>
                <ul>
                  {sec.groups.flatMap((g) => g.sheets).map((s) => {
                    const n = evidenceBySheet.get(s.id)?.length ?? 0;
                    return (
                      <li key={s.id}>
                        <button type="button" data-sheet={s.id} className={`reg-sheet${s.id === sheet.id ? " active" : ""}`} onClick={() => open(s.id)}>
                          <img src={sheetImage(s.id, true)} alt="" loading="lazy" />
                          <span className="reg-text">
                            <span className="reg-title">{s.titleEn}</span>
                            <span className="reg-meta">
                              {s.id}, {buildingById.get(s.building)?.short}, {DISCIPLINES[s.discipline]?.toLowerCase()}
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

      <section className="sheet-pane">
        <header className="sheet-bar">
          <div className="sheet-titles">
            <div className="sheet-id">
              <strong>{sheet.id}</strong>
              <span className="muted">
                {doc.file}, page {sheet.page}
              </span>
            </div>
            <div className="sheet-name" lang="az">
              {sheet.title}
            </div>
            <div className="sheet-sub muted">
              {sheet.titleEn}. {buildingById.get(sheet.building)?.en}, {DISCIPLINES[sheet.discipline]?.toLowerCase()}.{" "}
              <span className={`layer ${hasText ? "layer-true" : "layer-false"}`}>{hasText ? "Text layer" : "Image only"}</span>
            </div>
          </div>
          <div className="sheet-nav">
            <button type="button" className="icon-btn" disabled={idx <= 0} onClick={() => idx > 0 && open(flat[idx - 1]!.id)} aria-label="Previous sheet">
              <ChevronLeft size={18} />
            </button>
            <span className="num-inline muted">
              {idx + 1} / {flat.length}
            </span>
            <button type="button" className="icon-btn" disabled={idx >= flat.length - 1} onClick={() => idx < flat.length - 1 && open(flat[idx + 1]!.id)} aria-label="Next sheet">
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

      <aside className="read-pane scroll">
        <h2>Read from this sheet</h2>
        {!evidence.length ? (
          <p className="muted small read-empty">
            No quantities are taken from this sheet. {sheet.discipline === "general" ? "It is a cover, title or general sheet." : "Its content is covered by the schedules on other sheets."}
          </p>
        ) : (
          <ul className="read-list">
            {evidence.map(({ itemId, srcIndex }) => {
              const it = itemById.get(itemId)!;
              const src = it.src[srcIndex]!;
              const line = boq.lineByItem.get(itemId);
              const active = itemId === activeItem && srcIndex === activeSrc;
              return (
                <li key={`${itemId}-${srcIndex}`}>
                  <button type="button" className={`read-item${active ? " active" : ""}`} onClick={() => focusItem(itemId, srcIndex)}>
                    <span className="read-top">
                      <MethodTag method={it.method} compact />
                      <span className="read-code num-inline">{line?.code}</span>
                      <span className="read-qty num-inline">
                        {src.role ? <span className="muted">{roleLabel(src.role)} </span> : null}
                        {src.value ?? ""}
                      </span>
                    </span>
                    <span className="read-desc">{lang === "az" ? it.az : it.en}</span>
                    <span className="read-bill muted small">
                      Bill quantity <span className="num-inline">{fmtQty(it.qty, it.unit)}</span> {unitLabel(it.unit, lang)}
                      {it.method === "derived" ? ", derived" : ""}
                    </span>
                    <span className="read-quote" lang="az">
                      {src.quote}
                    </span>
                  </button>
                  {line ? (
                    <Link to={`/bill?line=${encodeURIComponent(line.id)}`} className="text-link small read-link">
                      Line {line.code} in the bill
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {checkHere.length ? (
          <>
            <h2 className="read-checks-title">Checks on this sheet</h2>
            <ul className="read-checks">
              {checkHere.map((c) => (
                <li key={c.id}>
                  <Link to={`/checks/${c.id}`}>
                    <SeverityTag severity={c.severity} kind={c.kind} />
                    <span>{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </aside>
    </div>
  );
}

const KINDS: { kind: SheetKind; title: string }[] = [
  { kind: "drawing", title: "Floor plans and drawings" },
  { kind: "schedule", title: "Schedules" },
  { kind: "source", title: "Source files and notes" },
];

function roleLabel(role: string) {
  return ({ length: "Length", count: "Count", area: "Area", thickness: "Thickness", profiles: "Profiles", plates: "Plates", schedule: "Also in", spec: "Spec" } as Record<string, string>)[role] ?? role;
}

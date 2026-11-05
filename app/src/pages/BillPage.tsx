import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Edit3,
  ExternalLink,
  Layers,
  Search,
} from "lucide-react";
import { data } from "../data";
import type { Method } from "../data/types";
import { useBoq, type Line } from "../lib/boq";
import { fmtMoney, fmtNum, fmtQty, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { useMedia } from "../lib/useMedia";
import { PageHead } from "../components/Shell";
import { LineInspector } from "../components/LineInspector";
import { Drawer, Empty, MethodTag, Segmented } from "../components/ui";

type Filter = "all" | Method | "findings" | "adjusted";

export function BillPage() {
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
  const approvedMap = useApp((s) => s.approved);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const building = params.get("b") ?? "all";
  const selectedId = params.get("line");
  const tableRef = useRef<HTMLDivElement>(null);
  const narrow = useMedia("(max-width: 1280px)");

  // Tree Hierarchy Collapse / Expand State
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleNode = (key: string) => {
    setCollapsed((s) => ({ ...s, [key]: !s[key] }));
  };

  const expandAll = () => setCollapsed({});
  const collapseAll = () => {
    const allKeys: Record<string, boolean> = {};
    for (const b of boq.buildings) {
      allKeys[`b:${b.id}`] = true;
      for (const s of b.sections) {
        allKeys[`s:${b.id}:${s.id}`] = true;
      }
    }
    setCollapsed(allKeys);
  };
  const collapseToTrades = () => {
    const tradeKeys: Record<string, boolean> = {};
    for (const b of boq.buildings) {
      for (const s of b.sections) {
        tradeKeys[`s:${b.id}:${s.id}`] = true;
      }
    }
    setCollapsed(tradeKeys);
  };

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const matches = (l: Line) => {
    if (building !== "all" && l.building !== building) return false;
    if (filter === "findings" && !l.checks.some((c) => c.severity !== "ok")) return false;
    if (filter === "adjusted" && !l.adjusted) return false;
    if ((filter === "schedule" || filter === "image" || filter === "derived") && l.method !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${l.code} ${l.az} ${l.en} ${l.items.flatMap((i) => i.src.map((s) => `${s.sheet} ${s.quote}`)).join(" ")}`
      .toLowerCase()
      .includes(q);
  };

  const visible = useMemo(() => boq.lines.filter(matches), [boq.lines, building, filter, query]);
  const visibleIds = useMemo(() => new Set(visible.map((l) => l.id)), [visible]);
  const selected = boq.lines.find((l) => l.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const base = boq.lines.filter((l) => building === "all" || l.building === building);
    return {
      all: base.length,
      schedule: base.filter((l) => l.method === "schedule").length,
      derived: base.filter((l) => l.method === "derived").length,
      image: base.filter((l) => l.method === "image").length,
      findings: base.filter((l) => l.checks.some((c) => c.severity !== "ok")).length,
      adjusted: base.filter((l) => l.adjusted).length,
    };
  }, [boq.lines, building]);

  // Keyboard navigation through visible lines
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches("input, textarea, select")) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const i = visible.findIndex((l) => l.id === selectedId);
      const next = e.key === "ArrowDown" ? visible[Math.min(i + 1, visible.length - 1)] : visible[Math.max(i - 1, 0)];
      if (next) setParam("line", next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!selectedId) return;
    tableRef.current?.querySelector(`[data-line="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const shownTotal = visible.reduce((a, l) => a + l.amount, 0);
  const compact = narrow && Boolean(selected);

  const selectedIndex = selected ? visible.findIndex((l) => l.id === selected.id) : -1;

  const isSearching = query.trim().length > 0;

  return (
    <div className={`page page-bill${selected ? " with-drawer" : ""}`}>
      <PageHead
        title="Bill of Quantities"
        lead={
          <>
            Hierarchical Work Breakdown Structure (WBS) for <strong>{data.project.nameEn}</strong> • Measured works{" "}
            <span className="num-inline font-bold">{fmtMoney(shownTotal)} AZN</span> before mark-ups. Click any line to
            inspect pixel-level drawing coordinates, adjust dimensions, or sign off.
          </>
        }
      />

      {/* Modern Filter Toolbar */}
      <div className="toolbar modern-toolbar">
        <div className="search modern-search">
          <Search size={15} aria-hidden="true" />
          <input
            className="input"
            placeholder="Search item description, element mark, or drawing sheet..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the bill"
          />
        </div>

        <select
          className="input select select-building"
          value={building}
          onChange={(e) => setParam("b", e.target.value === "all" ? null : e.target.value)}
          aria-label="Structure Filter"
        >
          <option value="all">All Structures (Warehouse, Admin, Pump)</option>
          {data.buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.short}
            </option>
          ))}
        </select>

        {/* Tree Control Action Buttons */}
        <div className="tree-quick-controls">
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={expandAll}
            title="Expand all levels of the tree"
          >
            <ChevronsUpDown size={13} />
            <span>Expand All</span>
          </button>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={collapseToTrades}
            title="Collapse down to trade sections"
          >
            <ChevronsDownUp size={13} />
            <span>Collapse Trades</span>
          </button>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={collapseAll}
            title="Collapse all structures"
          >
            <ChevronsDownUp size={13} />
            <span>Collapse All</span>
          </button>
        </div>

        <Segmented<Filter>
          label="Filter by evidence"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All Items", count: counts.all },
            { value: "schedule", label: "Schedules", count: counts.schedule },
            { value: "derived", label: "Parametric", count: counts.derived },
            { value: "image", label: "Plan Takeoff", count: counts.image },
            { value: "findings", label: "Audit Issues", count: counts.findings },
            ...(counts.adjusted ? [{ value: "adjusted" as Filter, label: "Adjusted", count: counts.adjusted }] : []),
          ]}
        />
      </div>

      {/* Tree Hierarchy Data Grid */}
      <div className="bill-table scroll tree-table-wrap" ref={tableRef}>
        {!visible.length ? (
          <Empty title="No takeoff items match your search filters">
            Try adjusting your search query, or select another building asset from the dropdown.
          </Empty>
        ) : (
          <table className={`boq tree-table${compact ? " compact" : ""}`}>
            <thead>
              <tr className="tree-header-row">
                <th style={{ width: "90px" }}>WBS Code</th>
                <th>Work Breakdown / Item Description</th>
                {compact ? null : <th style={{ width: "70px" }}>Unit</th>}
                <th className="num" style={{ width: "110px" }}>
                  Quantity
                </th>
                {compact ? null : (
                  <th className="num" style={{ width: "110px" }}>
                    Rate (AZN)
                  </th>
                )}
                <th className="num" style={{ width: "140px" }}>
                  Amount (AZN)
                </th>
                {compact ? null : <th style={{ width: "170px" }}>Drawing Evidence</th>}
                <th style={{ width: "60px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {boq.buildings.map((b) => {
                const bLines = b.sections.flatMap((s) => s.lines).filter((l) => visibleIds.has(l.id));
                if (!bLines.length) return null;

                const bCollapsed = !isSearching && Boolean(collapsed[`b:${b.id}`]);
                const bTotalAmount = bLines.reduce((acc, l) => acc + l.amount, 0);

                return (
                  <Fragment key={b.id}>
                    {/* LEVEL 1: Building Asset Branch */}
                    <tr
                      className={`tree-row tree-level-1 clickable${bCollapsed ? " is-collapsed" : ""}`}
                      onClick={() => toggleNode(`b:${b.id}`)}
                    >
                      <td className="tree-node-code">
                        <button
                          type="button"
                          className="tree-chevron-btn"
                          aria-label={bCollapsed ? "Expand building" : "Collapse building"}
                        >
                          {bCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                        </button>
                        <span className="num-inline font-bold">{b.code}</span>
                      </td>
                      <td colSpan={compact ? 2 : 4} className="tree-node-title">
                        <div className="tree-asset-title-group">
                          <Building2 size={16} className="text-muted" />
                          <strong className="tree-node-name">{lang === "az" ? b.az : b.en}</strong>
                          <span className="tree-count-badge">{bLines.length} takeoff items</span>
                        </div>
                      </td>
                      <td className="num tree-node-total">
                        <strong>{fmtMoney(bTotalAmount)}</strong>
                      </td>
                      {compact ? null : (
                        <td className="tree-node-meta">
                          <span className="pill-badge-subtle">Asset Level</span>
                        </td>
                      )}
                      <td />
                    </tr>

                    {/* Child Trades under Building */}
                    {!bCollapsed &&
                      b.sections.map((s) => {
                        const sLines = s.lines.filter((l) => visibleIds.has(l.id));
                        if (!sLines.length) return null;

                        const sCollapsed = !isSearching && Boolean(collapsed[`s:${b.id}:${s.id}`]);
                        const sTotalAmount = sLines.reduce((acc, l) => acc + l.amount, 0);

                        return (
                          <Fragment key={s.id}>
                            {/* LEVEL 2: Trade Section Branch */}
                            <tr
                              className={`tree-row tree-level-2 clickable${sCollapsed ? " is-collapsed" : ""}`}
                              onClick={() => toggleNode(`s:${b.id}:${s.id}`)}
                            >
                              <td className="tree-node-code">
                                <span className="tree-guide-connector">├──</span>
                                <button
                                  type="button"
                                  className="tree-chevron-btn"
                                  aria-label={sCollapsed ? "Expand trade" : "Collapse trade"}
                                >
                                  {sCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <span className="num-inline text-muted">{s.code}</span>
                              </td>
                              <td colSpan={compact ? 2 : 4} className="tree-node-title">
                                <div className="tree-trade-title-group">
                                  <Layers size={14} className="text-muted" />
                                  <span className="font-semibold">{lang === "az" ? s.az : s.en}</span>
                                  <span className="tree-count-badge subtle">{sLines.length} lines</span>
                                </div>
                              </td>
                              <td className="num tree-node-subtotal">
                                <span>{fmtMoney(sTotalAmount)}</span>
                              </td>
                              {compact ? null : (
                                <td className="tree-node-meta">
                                  <span className="muted small">Trade Roll-up</span>
                                </td>
                              )}
                              <td />
                            </tr>

                            {/* LEVEL 3: Individual Takeoff Lines */}
                            {!sCollapsed &&
                              sLines.map((l, lIdx) => {
                                const isApproved = l.items[0] ? Boolean(approvedMap[l.items[0].id]) : false;
                                const isLast = lIdx === sLines.length - 1;
                                return (
                                  <TreeLineRow
                                    key={l.id}
                                    line={l}
                                    lang={lang}
                                    compact={compact}
                                    selected={l.id === selectedId}
                                    approved={isApproved}
                                    isLast={isLast}
                                    onSelect={() => setParam("line", l.id === selectedId ? null : l.id)}
                                  />
                                );
                              })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-Over Precision Line Inspector */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setParam("line", null)}
        kicker={
          selected
            ? `Item ${selected.code} • ${data.buildings.find((b) => b.id === selected.building)?.short}`
            : null
        }
        title={selected ? (data.sections.find((s) => s.id === selected.section)?.en ?? "Item Inspector") : ""}
        width={500}
      >
        {selected ? (
          <LineInspector
            key={selected.id}
            line={selected}
            position={{
              current: selectedIndex + 1,
              total: visible.length,
            }}
            onPrev={() => {
              if (selectedIndex > 0) setParam("line", visible[selectedIndex - 1]!.id);
            }}
            onNext={() => {
              if (selectedIndex < visible.length - 1) setParam("line", visible[selectedIndex + 1]!.id);
            }}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function TreeLineRow({
  line,
  lang,
  compact,
  selected,
  approved,
  isLast,
  onSelect,
}: {
  line: Line;
  lang: "az" | "en";
  compact: boolean;
  selected: boolean;
  approved?: boolean;
  isLast?: boolean;
  onSelect: () => void;
}) {
  const sheets = [...new Set(line.items.flatMap((i) => i.src.map((s) => s.sheet)))];
  const finding = line.checks.find((c) => c.severity === "error") ?? line.checks.find((c) => c.severity === "warn");

  return (
    <tr
      data-line={line.id}
      className={`tree-row tree-level-3${selected ? " selected" : ""}${approved ? " approved" : ""}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <td className="tree-node-code">
        <span className="tree-guide-indent">│</span>
        <span className="tree-guide-connector">{isLast ? "└──" : "├──"}</span>
        <span className="num-inline code font-mono">{line.code}</span>
      </td>
      <td className="desc">
        <div className="tree-desc-group">
          <span className="desc-text">{lang === "az" ? line.az : line.en}</span>
          {approved ? (
            <span className="flag flag-approved" title="Surveyor sign-off approved">
              <Check size={11} strokeWidth={2.5} /> Approved
            </span>
          ) : null}
          {finding ? (
            <span className={`flag flag-${finding.severity}`} title={finding.title}>
              {finding.severity === "error" ? "Variance" : "Review"}
            </span>
          ) : null}
          {line.adjusted ? (
            <span className="flag flag-adjusted" title="Dimensions or rate modified by surveyor">
              <Edit3 size={10} /> {line.adjusted === "fix" ? "Audit Resolved" : "Modified"}
            </span>
          ) : null}
        </div>
      </td>
      {compact ? null : <td className="unit">{unitLabel(line.unit, lang)}</td>}
      <td className="num">
        {fmtQty(line.qty, line.unit)}
        {compact ? <span className="unit-inline">{unitLabel(line.unit, lang)}</span> : null}
      </td>
      {compact ? null : (
        <td className={`num${line.rate !== line.sampleRate ? " edited" : ""}`}>{fmtNum(line.rate)}</td>
      )}
      <td className="num amount font-semibold">{fmtMoney(line.amount)}</td>
      {compact ? null : (
        <td className="src">
          <MethodTag method={line.method} compact />
          <span className="src-sheet" title={`Drawing sheet ${sheets[0]}`}>
            {sheets[0]}
          </span>
          {sheets.length > 1 ? (
            <span className="faint" title={sheets.join(", ")}>
              +{sheets.length - 1}
            </span>
          ) : null}
        </td>
      )}
      <td className="tree-row-action">
        <button
          type="button"
          className="icon-btn-ghost inspect-pill-btn"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          title="Inspect redline evidence and formulas"
        >
          <ExternalLink size={13} />
        </button>
      </td>
    </tr>
  );
}

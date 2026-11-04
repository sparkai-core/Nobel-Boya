import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Search } from "lucide-react";
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
    return `${l.code} ${l.az} ${l.en} ${l.items.flatMap((i) => i.src.map((s) => `${s.sheet} ${s.quote}`)).join(" ")}`.toLowerCase().includes(q);
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
  const span = compact ? 2 : 4;

  const selectedIndex = selected ? visible.findIndex((l) => l.id === selected.id) : -1;

  return (
    <div className={`page page-bill${selected ? " with-drawer" : ""}`}>
      <PageHead
        title="Bill of Quantities"
        lead={
          <>
            {visible.length === boq.lines.length ? `${boq.lines.length} lines` : `${visible.length} of ${boq.lines.length} lines`} • Measured works{" "}
            <span className="num-inline">{fmtMoney(shownTotal)} AZN</span> before commercial mark-ups. Select any line to inspect dimensions and redline drawing evidence.
          </>
        }
      />

      <div className="toolbar">
        <div className="search">
          <Search size={15} aria-hidden="true" />
          <input
            className="input"
            placeholder="Search item description, drawing sheet or schedule quote..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the bill"
          />
        </div>
        <select
          className="input select"
          value={building}
          onChange={(e) => setParam("b", e.target.value === "all" ? null : e.target.value)}
          aria-label="Structure"
        >
          <option value="all">All project structures</option>
          {data.buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.short}
            </option>
          ))}
        </select>
        <Segmented<Filter>
          label="Filter lines"
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

      <div className="bill-table scroll" ref={tableRef}>
        {!visible.length ? (
          <Empty title="No items match your criteria">Clear search filters or select another trade section.</Empty>
        ) : (
          <table className={`boq${compact ? " compact" : ""}`}>
            <colgroup>
              <col className="c-code" />
              <col />
              {compact ? null : <col className="c-unit" />}
              <col className="c-qty" />
              {compact ? null : <col className="c-rate" />}
              <col className="c-amount" />
              {compact ? null : <col className="c-src" />}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Description</th>
                {compact ? null : <th scope="col">Unit</th>}
                <th scope="col" className="num">
                  Quantity
                </th>
                {compact ? null : (
                  <th scope="col" className="num">
                    Rate (AZN)
                  </th>
                )}
                <th scope="col" className="num">
                  Amount (AZN)
                </th>
                {compact ? null : <th scope="col">Drawing Provenance</th>}
              </tr>
            </thead>
            <tbody>
              {boq.buildings.map((b) => {
                const bLines = b.sections.flatMap((s) => s.lines).filter((l) => visibleIds.has(l.id));
                if (!bLines.length) return null;
                return (
                  <Fragment key={b.id}>
                    <tr className="row-building">
                      <td className="num">{b.code}</td>
                      <td colSpan={span}>{lang === "az" ? b.az : b.en}</td>
                      <td className="num">{fmtMoney(b.total)}</td>
                      {compact ? null : <td />}
                    </tr>
                    {b.sections.map((s) => {
                      const sLines = s.lines.filter((l) => visibleIds.has(l.id));
                      if (!sLines.length) return null;
                      return (
                        <Fragment key={s.id}>
                          <tr className="row-section">
                            <td className="num">{s.code}</td>
                            <td colSpan={span}>{lang === "az" ? s.az : s.en}</td>
                            <td className="num">{fmtMoney(s.total)}</td>
                            {compact ? null : <td />}
                          </tr>
                          {sLines.map((l) => {
                            const isApproved = l.items[0] ? Boolean(approvedMap[l.items[0].id]) : false;
                            return (
                              <LineRow
                                key={l.id}
                                line={l}
                                lang={lang}
                                compact={compact}
                                selected={l.id === selectedId}
                                approved={isApproved}
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

      <Drawer
        open={Boolean(selected)}
        onClose={() => setParam("line", null)}
        kicker={selected ? `Item ${selected.code} • ${data.buildings.find((b) => b.id === selected.building)?.short}` : null}
        title={selected ? (data.sections.find((s) => s.id === selected.section)?.en ?? "Item Inspector") : ""}
        width={480}
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

function LineRow({
  line,
  lang,
  compact,
  selected,
  approved,
  onSelect,
}: {
  line: Line;
  lang: "az" | "en";
  compact: boolean;
  selected: boolean;
  approved?: boolean;
  onSelect: () => void;
}) {
  const sheets = [...new Set(line.items.flatMap((i) => i.src.map((s) => s.sheet)))];
  const finding = line.checks.find((c) => c.severity === "error") ?? line.checks.find((c) => c.severity === "warn");

  return (
    <tr
      data-line={line.id}
      className={`row-line${selected ? " selected" : ""}${approved ? " approved" : ""}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <td className="num code">{line.code}</td>
      <td className="desc">
        <span className="desc-text">{lang === "az" ? line.az : line.en}</span>
        {approved ? (
          <span className="flag flag-approved" title="Approved by Quantity Surveyor">
            <Check size={11} /> Approved
          </span>
        ) : null}
        {finding ? (
          <span className={`flag flag-${finding.severity}`}>
            {finding.severity === "error" ? "Variance" : "Review"}
          </span>
        ) : null}
        {line.adjusted ? (
          <span className="flag flag-adjusted">
            {line.adjusted === "fix" ? "Audit Resolved" : "Overridden"}
          </span>
        ) : null}
      </td>
      {compact ? null : <td className="unit">{unitLabel(line.unit, lang)}</td>}
      <td className="num">
        {fmtQty(line.qty, line.unit)}
        {compact ? <span className="unit-inline">{unitLabel(line.unit, lang)}</span> : null}
      </td>
      {compact ? null : <td className={`num${line.rate !== line.sampleRate ? " edited" : ""}`}>{fmtNum(line.rate)}</td>}
      <td className="num amount">{fmtMoney(line.amount)}</td>
      {compact ? null : (
        <td className="src">
          <MethodTag method={line.method} compact />
          <span className="src-sheet">{sheets[0]}</span>
          {sheets.length > 1 ? <span className="faint">+{sheets.length - 1}</span> : null}
        </td>
      )}
    </tr>
  );
}

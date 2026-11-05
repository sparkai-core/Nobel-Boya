import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { data } from "../data";
import type { Method } from "../data/types";
import { useBoq, type Line } from "../lib/boq";
import { fmtMoney, fmtNum, fmtQty, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { useMedia } from "../lib/useMedia";
import { buildingName, buildingShort } from "../lib/loc";
import { PageHead } from "../components/Shell";
import { LineInspector } from "../components/LineInspector";
import { Drawer, Empty, MethodTag, Segmented } from "../components/ui";
import { useT } from "../lib/i18n";

type Filter = "all" | Method | "findings" | "adjusted";

export function BillPage() {
  const t = useT();
  const boq = useBoq();
  const lang = useApp((s) => s.lang);
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

  return (
    <div className={`page page-bill${selected ? " with-drawer" : ""}`}>
      <PageHead
        title={t("Bill of quantities")}
        lead={
          <>
            {visible.length === boq.lines.length ? t("{n} lines", { n: boq.lines.length }) : t("{v} of {n} lines", { v: visible.length, n: boq.lines.length })}, {t("measured works")}{" "}
            <span className="num-inline">{fmtMoney(shownTotal)}</span> {t("AZN before mark-ups. Select a line to see the sheet it was read from.")}
          </>
        }
      />

      <div className="toolbar">
        <div className="search">
          <Search size={15} aria-hidden="true" />
          <input
            className="input"
            placeholder={t("Search description, sheet or printed text")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("Search the bill")}
          />
        </div>
        <select className="input select" value={building} onChange={(e) => setParam("b", e.target.value === "all" ? null : e.target.value)} aria-label={t("Structure")}>
          <option value="all">{t("All structures")}</option>
          {data.buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {buildingShort(b.id, lang)}
            </option>
          ))}
        </select>
        <Segmented<Filter>
          label={t("Filter lines")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("All"), count: counts.all },
            { value: "schedule", label: t("Printed"), count: counts.schedule },
            { value: "derived", label: t("Derived"), count: counts.derived },
            { value: "image", label: t("From image"), count: counts.image },
            { value: "findings", label: t("With findings"), count: counts.findings },
            ...(counts.adjusted ? [{ value: "adjusted" as Filter, label: t("Adjusted"), count: counts.adjusted }] : []),
          ]}
        />
      </div>

      <div className="bill-table scroll" ref={tableRef}>
        {!visible.length ? (
          <Empty title={t("No lines match")}>{t("Clear the search or choose another filter.")}</Empty>
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
                <th scope="col">{t("Code")}</th>
                <th scope="col">{t("Description")}</th>
                {compact ? null : <th scope="col">{t("Unit")}</th>}
                <th scope="col" className="num">
                  {t("Quantity")}
                </th>
                {compact ? null : (
                  <th scope="col" className="num">
                    {t("Rate")}
                  </th>
                )}
                <th scope="col" className="num">
                  {t("Amount")}
                </th>
                {compact ? null : <th scope="col">{t("Source")}</th>}
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
                      <td colSpan={span}>{buildingName(b.id, lang)}</td>
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
                          {sLines.map((l) => (
                            <LineRow key={l.id} line={l} lang={lang} compact={compact} selected={l.id === selectedId} onSelect={() => setParam("line", l.id === selectedId ? null : l.id)} />
                          ))}
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
        kicker={selected ? `${selected.code}, ${buildingShort(selected.building, lang)}` : null}
        title={selected ? ((s) => (s ? (lang === "az" ? s.az : s.en) : ""))(data.sections.find((s) => s.id === selected.section)) : ""}
      >
        {selected ? <LineInspector key={selected.id} line={selected} /> : null}
      </Drawer>
    </div>
  );
}

function LineRow({ line, lang, compact, selected, onSelect }: { line: Line; lang: "az" | "en"; compact: boolean; selected: boolean; onSelect: () => void }) {
  const t = useT();
  const sheets = [...new Set(line.items.flatMap((i) => i.src.map((s) => s.sheet)))];
  const finding = line.checks.find((c) => c.severity === "error") ?? line.checks.find((c) => c.severity === "warn");
  return (
    <tr data-line={line.id} className={`row-line${selected ? " selected" : ""}`} onClick={onSelect} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect()}>
      <td className="num code">{line.code}</td>
      <td className="desc">
        <span>{lang === "az" ? line.az : line.en}</span>
        {finding ? <span className={`flag flag-${finding.severity}`}>{finding.severity === "error" ? t("Error") : t("Conflict")}</span> : null}
        {line.adjusted ? <span className="flag flag-adjusted">{line.adjusted === "fix" ? t("Corrected") : t("Overridden")}</span> : null}
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

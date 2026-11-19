import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Columns3, ChartGantt, ListPlus, Plus, Search, Table2, Upload } from "lucide-react";
import { Empty, FilterChips, GanttCore, useL, type GanttLink, type GanttRow } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { addDays, PROJECT_FINISH, PROJECT_START, TODAY } from "../../../ops/dates";
import { cpm, progressWeight, type Cpm } from "../../../ops/select";
import type { Activity } from "../../../ops/types";
import { calendarName, groupActivities, groupSpan, linkLabel, origDur, programmeFinish, remDur, variance, wbsTree, type WbsGroup } from "./model";
import { ActivityPane } from "./ActivityPane";
import { ActivityDialog } from "./ActivityDialog";

type Filter = "critical" | "progress" | "behind" | "notstarted" | "done";
type ColKey = "od" | "rd" | "pct" | "start" | "end" | "tf" | "bs" | "bf" | "var" | "as" | "af" | "cal" | "pred";

const COLS: { key: ColKey; label: string; def: boolean }[] = [
  { key: "od", label: "Orig dur", def: true },
  { key: "rd", label: "Rem dur", def: true },
  { key: "pct", label: "% done", def: true },
  { key: "start", label: "Start", def: true },
  { key: "end", label: "Finish", def: true },
  { key: "tf", label: "Total float", def: true },
  { key: "bs", label: "BL start", def: false },
  { key: "bf", label: "BL finish", def: true },
  { key: "var", label: "Var (days)", def: true },
  { key: "as", label: "Act start", def: false },
  { key: "af", label: "Act finish", def: false },
  { key: "cal", label: "Calendar", def: true },
  { key: "pred", label: "Predecessors", def: true },
];

/** P6-style activity table grouped by WBS, with filters, a column chooser, a Gantt view and a detail pane. */
export function ActivitiesTab({ onImport, onAdd }: { onImport: () => void; onAdd: () => void }) {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const wbs = useOps((s) => s.wbs);
  const workweek = useOps((s) => s.workweek);
  const cp = useMemo(() => cpm(activities, links), [activities, links]);
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const weight = useMemo(() => progressWeight(activities), [activities]);
  const calName = calendarName(workweek);
  const predsOf = useMemo(() => {
    const m = new Map<string, typeof links>();
    for (const l of links) m.set(l.to, [...(m.get(l.to) ?? []), l]);
    return m;
  }, [links]);
  const [editing, setEditing] = useState<Activity | null>(null);

  const [filter, setFilter] = useState<Filter | null>(null);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "gantt">("table");
  const [cols, setCols] = useState<Set<ColKey>>(() => new Set(COLS.filter((c) => c.def).map((c) => c.key)));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(() => activities.find((a) => a.status === "BLOCKED")?.id ?? activities[0]?.id ?? null);
  const [paneH, setPaneH] = useState(320);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const test = (a: Activity, f: Filter | null) => {
    if (!f) return true;
    if (f === "critical") return !!cp.get(a.id)?.critical && a.status !== "COMPLETED";
    if (f === "progress") return a.status === "IN_PROGRESS" || a.status === "BLOCKED";
    if (f === "behind") return a.end > a.bEnd;
    if (f === "notstarted") return a.status === "NOT_STARTED";
    return a.status === "COMPLETED";
  };
  const needle = q.trim().toLowerCase();
  const shown = activities.filter((a) => test(a, filter) && (!needle || a.code.toLowerCase().includes(needle) || a.name.en.toLowerCase().includes(needle) || a.name.az.toLowerCase().includes(needle)));
  const tree = useMemo(() => wbsTree(wbs, shown), [wbs, shown]);
  const count = (f: Filter) => activities.filter((a) => test(a, f)).length;

  const predText = (a: Activity) =>
    (predsOf.get(a.id) ?? [])
      .map((l) => linkLabel(byId.get(l.from)?.code ?? l.from, l))
      .join(", ");

  const cell = (a: Activity, k: ColKey, c: Cpm | undefined): ReactNode => {
    switch (k) {
      case "od":
        return `${origDur(a)}d`;
      case "rd":
        return `${remDur(a)}d`;
      case "pct":
        return (
          <span className="pp-pct">
            <i style={{ width: `${a.pct}%` }} />
            <b>{a.pct}%</b>
          </span>
        );
      case "start":
        return (
          <>
            {d(a.start)}
            {a.aStart ? <sup className="pp-a">A</sup> : null}
          </>
        );
      case "end":
        return (
          <>
            {d(a.end)}
            {a.aEnd ? <sup className="pp-a">A</sup> : null}
          </>
        );
      case "tf":
        return c ? <span className={c.critical ? "k-text-bad" : c.near ? "k-text-warn" : undefined}>{c.tf}d</span> : "—";
      case "bs":
        return d(a.bStart);
      case "bf":
        return d(a.bEnd);
      case "var": {
        const v = variance(a);
        return <span className={v < 0 ? "k-text-bad" : v > 0 ? "k-text-ok" : "muted"}>{v > 0 ? `+${v}` : v}</span>;
      }
      case "as":
        return a.aStart ? d(a.aStart) : "—";
      case "af":
        return a.aEnd ? d(a.aEnd) : "—";
      case "cal":
        return calName;
      case "pred":
        return <span className="k-mono pp-pred">{predText(a) || "—"}</span>;
    }
  };
  const visible = COLS.filter((c) => cols.has(c.key));
  const toggleGroup = (id: string) => setCollapsed((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const renderGroup = (g: WbsGroup): ReactNode => {
    const list = groupActivities(g);
    const sp = groupSpan(list, weight);
    const closed = collapsed.has(g.node.id);
    return (
      <Fragment key={g.node.id}>
        <tr className={`pp-grp lvl-${g.level}`} onClick={() => toggleGroup(g.node.id)}>
          <td colSpan={2 + visible.length}>
            <span className="pp-grp-in" style={{ paddingLeft: g.level * 16 }}>
              {closed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <b className="k-mono">{g.node.code}</b>
              <strong>{x(g.node.name)}</strong>
              <span className="pp-grp-meta">
                {t("{n} activities", { n: list.length })}
                {sp ? ` · ${d(sp.start, false)} → ${d(sp.end)} · ${Math.round(sp.pct * 100)}%` : ""}
              </span>
            </span>
          </td>
        </tr>
        {closed
          ? null
          : (
              <>
                {g.activities.map((a) => {
                  const c = cp.get(a.id);
                  return (
                    <tr key={a.id} className={`pp-act${sel === a.id ? " sel" : ""}${c?.critical && a.status !== "COMPLETED" ? " crit" : ""}`} onClick={() => setSel(a.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(a.id)}>
                      <td className="k-mono pp-id" style={{ paddingLeft: 12 + (g.level + 1) * 16 }}>
                        <i className={`pp-dot s-${a.status.toLowerCase()}`} />
                        {a.code}
                      </td>
                      <td className="pp-name">
                        <span className="truncate">{x(a.name)}</span>
                      </td>
                      {visible.map((col) => (
                        <td key={col.key} className={`pp-c-${col.key} num-inline`}>
                          {cell(a, col.key, c)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {g.children.map(renderGroup)}
              </>
            )}
      </Fragment>
    );
  };

  // Gantt rows from the same grouping.
  const gantt = useMemo(() => {
    const rows: GanttRow[] = [];
    const walk = (g: WbsGroup) => {
      const list = groupActivities(g);
      const sp = groupSpan(list, weight);
      rows.push({ id: `g:${g.node.id}`, label: `${g.node.code} ${x(g.node.name)}`, level: g.level, group: true, bars: sp ? [{ start: sp.start, end: sp.end, kind: "current", tone: "neutral", pct: sp.pct * 100 }] : [] });
      if (collapsed.has(g.node.id)) return;
      for (const a of g.activities) {
        const c = cp.get(a.id);
        const crit = !!c?.critical && a.status !== "COMPLETED";
        rows.push({ id: a.id, label: `${a.code} ${x(a.name)}`, level: g.level + 1, critical: crit, cells: [`${a.pct}%`], bars: [{ start: a.bStart, end: a.bEnd, kind: "baseline", label: t("Baseline") }, { start: a.start, end: a.end, kind: "current", pct: a.pct, tone: a.status === "COMPLETED" ? "ok" : crit ? "bad" : "brand" }] });
      }
      g.children.forEach(walk);
    };
    tree.forEach(walk);
    const ids = new Set(rows.map((r) => r.id));
    const gl: GanttLink[] = links.filter((l) => ids.has(l.from) && ids.has(l.to)).map((l) => ({ from: l.from, to: l.to, critical: !!cp.get(l.from)?.critical && !!cp.get(l.to)?.critical }));
    return { rows, links: gl };
  }, [tree, collapsed, cp, links, weight, x, t]);

  const selected = sel ? byId.get(sel) : undefined;

  const startDrag = (e: RPointerEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = paneH;
    const move = (ev: PointerEvent) => setPaneH(Math.max(180, Math.min(640, h0 - (ev.clientY - y0))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (!activities.length) {
    return (
      <div className="k-panel">
        <Empty icon={<ListPlus size={20} />} title={t("No programme yet")} action={
          <div className="pp-empty-actions">
            <button type="button" className="btn btn-primary" onClick={onImport}>
              <Upload size={15} /> {t("Import a P6 / MS Project file")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onAdd}>
              <Plus size={15} /> {t("Add an activity")}
            </button>
          </div>
        }>
          {t("Import a Primavera P6 (.xer / .xml) or MS Project (.xml) file, or add activities by hand.")}
        </Empty>
      </div>
    );
  }

  return (
    <div className="pp-acts">
      <div className="k-panel pp-acts-panel">
        <div className="pp-acts-bar">
          <label className="search k-search pp-search">
            <Search size={15} />
            <input ref={search} className="input" type="search" value={q} placeholder={t("Search ID or name")} onChange={(e) => setQ(e.target.value)} aria-label={t("Search ID or name")} />
            <kbd className="pp-kbd">/</kbd>
          </label>
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "critical", label: t("Critical"), count: count("critical") },
              { value: "progress", label: t("In progress"), count: count("progress") },
              { value: "behind", label: t("Behind baseline"), count: count("behind") },
              { value: "notstarted", label: t("Not started"), count: count("notstarted") },
              { value: "done", label: t("Done"), count: count("done") },
            ]}
          />
          <div className="pp-acts-end">
            <span className="muted small num-inline">{t("{n} of {m}", { n: shown.length, m: activities.length })}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onAdd}>
              <Plus size={14} /> {t("Add")}
            </button>
            <ColumnChooser cols={cols} onChange={setCols} />
            <Segmented
              label={t("View")}
              value={view}
              onChange={setView}
              options={[
                { value: "table", label: <><Table2 size={14} /> {t("Table")}</> },
                { value: "gantt", label: <><ChartGantt size={14} /> {t("Gantt")}</> },
              ]}
            />
          </div>
        </div>

        {!shown.length ? (
          <Empty title={t("Nothing matches these filters.")}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFilter(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </Empty>
        ) : view === "table" ? (
          <div className="pp-scrollx pp-grid-box">
            <table className="pp-table pp-p6">
              <thead>
                <tr>
                  <th>{t("Activity ID")}</th>
                  <th className="pp-name">{t("Activity name")}</th>
                  {visible.map((c) => (
                    <th key={c.key} className={`pp-c-${c.key}`}>
                      {t(c.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{tree.map(renderGroup)}</tbody>
            </table>
          </div>
        ) : (
          <div className="pp-gantt-box">
            <GanttCore
              rows={gantt.rows}
              links={gantt.links}
              from={addDays(PROJECT_START, -7)}
              to={addDays(programmeFinish(activities) > PROJECT_FINISH ? programmeFinish(activities) : PROJECT_FINISH, 21)}
              today={TODAY}
              zoom="month"
              labelWidth={300}
              rowHeight={30}
              cellHeaders={["%"]}
              selected={sel}
              onRowClick={(id) => (id.startsWith("g:") ? toggleGroup(id.slice(2)) : setSel(id))}
              markers={[{ date: PROJECT_FINISH, label: t("Contract"), tone: "bad" }]}
              height={480}
            />
          </div>
        )}
      </div>

      {selected ? (
        <div className="pp-pane k-panel" style={{ height: paneH }}>
          <button type="button" className="pp-pane-grip" onPointerDown={startDrag} aria-label={t("Drag to resize")} title={t("Drag to resize")}>
            <i />
          </button>
          <ActivityPane key={selected.id} a={selected} cp={cp.get(selected.id)} onPick={setSel} onEdit={() => setEditing(selected)} />
        </div>
      ) : null}
      <ActivityDialog open={!!editing} activity={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ColumnChooser({ cols, onChange }: { cols: Set<ColKey>; onChange: (s: Set<ColKey>) => void }) {
  const { t } = useL();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="k-menu-wrap" ref={ref}>
      <button type="button" className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Columns3 size={14} /> {t("Columns")}
        <span className="k-count">{cols.size}</span>
      </button>
      {open ? (
        <div className="k-menu pp-colmenu" role="menu">
          <div className="pp-colmenu-head">{t("Show columns")}</div>
          {COLS.map((c) => (
            <label key={c.key} className="pp-colmenu-item">
              <input
                type="checkbox"
                checked={cols.has(c.key)}
                onChange={() => {
                  const n = new Set(cols);
                  if (n.has(c.key)) n.delete(c.key);
                  else n.add(c.key);
                  onChange(n);
                }}
              />
              <span>{t(c.label)}</span>
            </label>
          ))}
          <div className="pp-colmenu-foot">
            <button type="button" className="k-link-btn" onClick={() => onChange(new Set(COLS.map((c) => c.key)))}>
              {t("All")}
            </button>
            <button type="button" className="k-link-btn" onClick={() => onChange(new Set(COLS.filter((c) => c.def).map((c) => c.key)))}>
              {t("Default")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

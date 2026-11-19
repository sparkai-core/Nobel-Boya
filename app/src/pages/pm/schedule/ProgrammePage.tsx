import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Crosshair, Flag, ListPlus, Pencil, Plus, Save, Upload } from "lucide-react";
import { Dialog, Empty, FilterChips, GanttCore, PageHero, SearchBox, toast, useL, useSearch, type GanttBar, type GanttLink, type GanttRow, type Zoom } from "../../../components/kit";
import { Drawer, Segmented } from "../../../components/ui";
import { useMedia } from "../../../lib/useMedia";
import { useOps } from "../../../ops/store";
import { addDays, maxDate, PROJECT_START, TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import type { Activity } from "../../../ops/types";
import { dateOf, durOf, lateness, milestoneRows, MS_TONE, ownerShort, rollup, slipDays, useSchedule, wbsChildren } from "./model";
import { ProjectRunStrip } from "./ProjectRunStrip";
import { TaskPanel } from "./TaskPanel";
import { ActivityDialog } from "../planning/ActivityDialog";
import { MilestoneDialog } from "./MilestoneDialog";
import { UNASSIGNED } from "../planning/model";

type Filter = "all" | "progress" | "blocked" | "critical" | "late" | "milestones" | "done" | "notstarted";
type View = { baseline: boolean; actual: boolean; forecast: boolean; critical: boolean; links: boolean };

/**
 * The programme as a Gantt grouped by WBS: summary bars per WBS item, activities with % done,
 * owner and slip, milestones as diamonds, the critical path in red and a task panel for updates.
 */
export function ProgrammePage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const taskId = params.get("task");
  const filter = (params.get("filter") as Filter | null) ?? "all";
  const { activities, links, milestones, wbs, subs, cp, outlook, byId, weight } = useSchedule();
  const setBaseline = useOps((s) => s.setBaseline);
  const wide = useMedia("(min-width: 760px)");
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState<Zoom>("month");
  const [view, setView] = useState<View>({ baseline: true, actual: true, forecast: false, critical: true, links: false });
  const [nonce, setNonce] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [addingMs, setAddingMs] = useState(false);
  const has = activities.length > 0;

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v == null) p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: k !== "task" });
  };

  const isCrit = useCallback((a: Activity) => !!cp.get(a.id)?.critical && a.status !== "COMPLETED", [cp]);
  const searched = useSearch(activities, q, (a) => [a.code, a.name, a.owner, ownerShort(a.owner, subs)]);
  const visible = useMemo(() => {
    const passes = (a: Activity) => {
      switch (filter) {
        case "progress":
          return a.status === "IN_PROGRESS";
        case "blocked":
          return a.status === "BLOCKED";
        case "critical":
          return isCrit(a);
        case "late":
          return !!lateness(a);
        case "done":
          return a.status === "COMPLETED";
        case "notstarted":
          return a.status === "NOT_STARTED";
        case "milestones":
          return false;
        default:
          return true;
      }
    };
    return new Set(searched.filter(passes).map((a) => a.id));
  }, [searched, filter, isCrit]);

  const kids = useMemo(() => wbsChildren(wbs), [wbs]);
  const msRows = useMemo(() => milestoneRows(milestones, activities), [milestones, activities]);

  const rows = useMemo(() => {
    const out: GanttRow[] = [];
    const showCrit = view.critical;
    const actRow = (a: Activity, level: number): GanttRow => {
      const c = cp.get(a.id);
      const crit = showCrit && isCrit(a);
      const bars: GanttBar[] = [];
      if (view.baseline) bars.push({ kind: "baseline", start: a.bStart, end: a.bEnd, label: `${t("Baseline")} ${d(a.bStart)} – ${d(a.bEnd)}` });
      if (view.forecast && a.status !== "COMPLETED") {
        const remaining = Math.round(durOf(a) * (1 - a.pct / 100));
        const fs = a.status === "NOT_STARTED" && c ? maxDate(a.start, dateOf(c.es)) : a.start;
        const fe = a.status === "NOT_STARTED" && c ? maxDate(a.end, dateOf(c.ef)) : maxDate(a.end, addDays(TODAY, remaining));
        bars.push({ kind: "forecast", start: fs, end: fe, tone: fe > a.end ? "bad" : "brand", label: `${t("Forecast")} ${d(fs)} – ${d(fe)}` });
      }
      bars.push({ kind: "current", start: a.start, end: a.end, pct: a.pct, tone: a.status === "BLOCKED" ? "bad" : crit ? "bad" : a.status === "COMPLETED" ? "ok" : "brand", label: `${a.code} · ${d(a.start)} – ${d(a.end)} · ${a.pct}%` });
      if (view.actual && a.aStart) bars.push({ kind: "actual", start: a.aStart, end: a.aEnd ?? TODAY, tone: "ok", label: `${t("Actual")} ${d(a.aStart)} – ${a.aEnd ? d(a.aEnd) : t("today")}` });
      const slip = slipDays(a);
      const late = lateness(a);
      return {
        id: a.id,
        level,
        critical: crit,
        label: (
          <>
            <span className="pms-code">{a.code}</span> {x(a.name)}
            {late ? <i className="pms-late-dot" title={late === "overdue" ? t("Finish date passed") : t("Behind today's plan")} /> : null}
          </>
        ),
        bars,
        cells: wide
          ? [
              <span key="p" className={a.status === "COMPLETED" ? "k-text-ok" : undefined}>{a.pct}%</span>,
              <span key="o" className="pms-owner truncate" title={subs.find((s) => s.id === a.owner)?.name ?? a.owner}>
                {ownerShort(a.owner, subs)}
              </span>,
              <span key="s" className={slip > 0 ? "k-text-bad" : slip < 0 ? "k-text-ok" : "k-text-muted"}>{slip > 0 ? `+${slip}` : slip < 0 ? `−${-slip}` : "0"}</span>,
            ]
          : undefined,
      };
    };
    const nodeIds = new Set(wbs.map((n) => n.id));
    const own = new Map<string, Activity[]>();
    const loose: Activity[] = [];
    for (const a of activities) {
      if (nodeIds.has(a.wbsId)) own.set(a.wbsId, [...(own.get(a.wbsId) ?? []), a]);
      else loose.push(a);
    }
    const subtreeOf = new Map<string, Activity[]>();
    const collect = (id: string, guard = 0): Activity[] => {
      if (subtreeOf.has(id)) return subtreeOf.get(id)!;
      subtreeOf.set(id, []);
      const list = [...(own.get(id) ?? []), ...(guard > 60 ? [] : (kids.get(id) ?? []).flatMap((k) => collect(k.id, guard + 1)))];
      subtreeOf.set(id, list);
      return list;
    };
    const walk = (nodeId: string, level: number) => {
      const node = nodeId === UNASSIGNED.id ? UNASSIGNED : wbs.find((n) => n.id === nodeId);
      if (!node) return;
      const subtree = nodeId === UNASSIGNED.id ? loose : collect(nodeId);
      if (!subtree.some((a) => visible.has(a.id))) return;
      const r = rollup(subtree, cp, weight);
      const open = !collapsed.has(nodeId);
      out.push({
        id: `g:${nodeId}`,
        level,
        group: true,
        label: (
          <>
            {open ? <ChevronDown size={13} className="pms-fold" /> : <ChevronRight size={13} className="pms-fold" />}
            <span className="pms-code">{node.code}</span> {x(node.name)}
          </>
        ),
        bars: [...(view.baseline ? [{ kind: "baseline" as const, start: subtree.reduce((m, a) => (a.bStart < m ? a.bStart : m), r.start), end: r.bEnd }] : []), { kind: "current", start: r.start, end: r.end, tone: "neutral" }],
        cells: wide ? [<b key="p">{Math.round(r.pct)}%</b>, <span key="o" className="k-text-muted">{t("{n} tasks", { n: r.count })}</span>, <span key="s" />] : undefined,
      });
      if (!open) return;
      const mine = nodeId === UNASSIGNED.id ? loose : (own.get(nodeId) ?? []);
      for (const a of mine.filter((z) => visible.has(z.id)).sort((p, q2) => p.start.localeCompare(q2.start))) out.push(actRow(a, level + 1));
      if (nodeId !== UNASSIGNED.id) for (const k of kids.get(nodeId) ?? []) walk(k.id, level + 1);
    };
    if (filter !== "milestones") {
      for (const top of wbs.filter((n) => !n.parentId || !nodeIds.has(n.parentId))) walk(top.id, 0);
      if (loose.length) walk(UNASSIGNED.id, 0);
    }

    const msShown = filter === "all" || filter === "milestones" ? msRows.filter((r) => !q || `${r.m.code} ${r.m.name.en} ${r.m.name.az}`.toLowerCase().includes(q.toLowerCase())) : [];
    if (msShown.length) {
      const open = !collapsed.has("ms");
      out.push({ id: "g:ms", level: 0, group: true, label: <>{open ? <ChevronDown size={13} className="pms-fold" /> : <ChevronRight size={13} className="pms-fold" />}{t("Milestones")}</>, bars: [], cells: wide ? [<span key="a" />, <span key="b" className="k-text-muted">{t("{n} items", { n: msShown.length })}</span>, <span key="c" />] : undefined });
      if (open)
        for (const { m, f } of msShown)
          out.push({
            id: `m:${m.id}`,
            level: 1,
            label: (
              <>
                <Flag size={12} className="pms-flag" /> <span className="pms-code">{m.code}</span> {x(m.name)}
              </>
            ),
            bars: f.slip > 0 ? [{ kind: "ghost", start: m.target, end: f.forecast, label: t("{n} days after target", { n: f.slip }) }] : [],
            milestones: [
              { date: m.target, filled: false, tone: "neutral", title: `${t("Target")} ${d(m.target)}` },
              { date: f.done ? (m.actual ?? f.forecast) : f.forecast, filled: true, tone: MS_TONE[f.state], title: `${f.done ? t("Done") : t("Forecast")} ${d(f.forecast)}` },
            ],
            cells: wide ? [<span key="a">{f.done ? "✓" : ""}</span>, <span key="b" className="k-text-muted">{d(f.forecast, false)}</span>, <span key="c" className={f.slip > 0 ? "k-text-bad" : "k-text-muted"}>{f.slip > 0 ? `+${f.slip}` : "0"}</span>] : undefined,
          });
    }
    return out;
  }, [activities, wbs, kids, visible, collapsed, view, cp, weight, wide, filter, msRows, q, subs, isCrit, t, x, d]);

  const ganttLinks: GanttLink[] = useMemo(() => {
    if (!view.links) return [];
    const shown = new Set(rows.map((r) => r.id));
    return links.filter((l) => shown.has(l.from) && shown.has(l.to)).map((l) => ({ from: l.from, to: l.to, critical: view.critical && !!cp.get(l.from)?.critical && !!cp.get(l.to)?.critical }));
  }, [rows, links, view, cp]);

  const counts: Record<Filter, number> = {
    all: activities.length,
    progress: activities.filter((a) => a.status === "IN_PROGRESS").length,
    blocked: activities.filter((a) => a.status === "BLOCKED").length,
    critical: activities.filter(isCrit).length,
    late: activities.filter((a) => lateness(a)).length,
    milestones: milestones.length,
    done: activities.filter((a) => a.status === "COMPLETED").length,
    notstarted: activities.filter((a) => a.status === "NOT_STARTED").length,
  };
  const chipKeys: Filter[] = ["progress", "blocked", "critical", "late", "milestones"];
  if (filter === "done" || filter === "notstarted") chipKeys.push(filter);
  const LABEL: Record<Filter, string> = { all: "All", progress: "In progress", blocked: "Blocked", critical: "Critical path", late: "Running late", milestones: "Milestones", done: "Done", notstarted: "Not started" };

  const onRow = (id: string) => {
    if (id.startsWith("g:")) {
      const key = id.slice(2);
      setCollapsed((c) => {
        const n = new Set(c);
        if (n.has(key)) n.delete(key);
        else n.add(key);
        return n;
      });
      return;
    }
    if (id.startsWith("m:")) {
      navigate(`${R.milestones}?m=${id.slice(2)}`);
      return;
    }
    setParam("task", id);
  };

  const task = taskId ? byId.get(taskId) : undefined;
  const toggle = (k: keyof View) => setView((v) => ({ ...v, [k]: !v[k] }));
  const from = addDays(PROJECT_START, -7);
  const to = addDays(maxDate(outlook.forecast, outlook.contract), 24);

  return (
    <div className="k-page pms">
      <PageHero
        eyebrow={t("Project management · Programme")}
        title={t("Programme")}
        subtitle={t("Every activity of the project against its baseline, grouped by the work breakdown. Click a bar to update progress.")}
        flow={["Plan", "Baseline", "Track progress", "Forecast the finish"]}
        art="programme"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} />
              {t("Add activity")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAddingMs(true)}>
              <Flag size={15} />
              {t("Add milestone")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)} disabled={!has}>
              <Save size={15} />
              {t("Set baseline")}
            </button>
          </>
        }
      />

      <ProjectRunStrip />

      <section className="pms-gantt-wrap">
        <div className="pms-toolbar">
          <div className="pms-toolbar-row">
            <SearchBox value={q} onChange={setQ} placeholder="Search activities, codes, owners" />
            <FilterChips<Filter>
              value={filter === "all" ? null : filter}
              onChange={(v) => setParam("filter", v)}
              options={chipKeys.map((k) => ({ value: k, label: t(LABEL[k]), count: counts[k] }))}
            />
          </div>
          <div className="pms-toolbar-row">
            <Segmented<Zoom> value={zoom} onChange={setZoom} label={t("Zoom")} options={[{ value: "week", label: t("Week") }, { value: "month", label: t("Month") }, { value: "quarter", label: t("Quarter") }]} />
            <div className="pms-toggles" role="group" aria-label={t("Show on the bars")}>
              {(
                [
                  ["baseline", "Baseline"],
                  ["actual", "Actual"],
                  ["forecast", "Forecast"],
                  ["critical", "Critical path"],
                  ["links", "Links"],
                ] as [keyof View, string][]
              ).map(([k, label]) => (
                <button key={k} type="button" className={`pms-toggle${view[k] ? " on" : ""} t-${k}`} aria-pressed={view[k]} onClick={() => toggle(k)}>
                  <i aria-hidden="true" />
                  {t(label)}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNonce((n) => n + 1)}>
              <Crosshair size={14} />
              {t("Go to today")}
            </button>
          </div>
        </div>

        {!has && !milestones.length ? (
          <Empty
            icon={<ListPlus size={20} />}
            title={t("No programme yet")}
            action={
              <div className="pms-empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => navigate(`${R.planning("activities")}?import=1`)}>
                  <Upload size={15} /> {t("Import a P6 / MS Project file")}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setAdding(true)}>
                  <Plus size={15} /> {t("Add an activity")}
                </button>
              </div>
            }
          >
            {t("Import a Primavera P6 (.xer / .xml) or MS Project (.xml) file, or add activities by hand.")}
          </Empty>
        ) : rows.length ? (
          <div className="pms-gantt">
            <GanttCore
              key={`${zoom}-${nonce}`}
              rows={rows}
              from={from}
              to={to}
              zoom={zoom}
              today={TODAY}
              links={ganttLinks}
              onRowClick={onRow}
              selected={taskId}
              labelWidth={wide ? 470 : 200}
              rowHeight={36}
              height={640}
              cellHeaders={wide ? [t("Done"), t("Owner"), t("Slip")] : []}
              markers={outlook.contractKnown ? [{ date: outlook.contract, label: t("Contract finish"), tone: "bad" }] : []}
            />
          </div>
        ) : (
          <div className="k-register-empty">
            {t("No activities match.")}{" "}
            <button
              type="button"
              className="k-link-btn"
              onClick={() => {
                setQ("");
                setParam("filter", null);
              }}
            >
              {t("Clear filters")}
            </button>
          </div>
        )}

        <div className="pms-legend">
          <span className="lg-cur">{t("Programme")}</span>
          <span className="lg-prog">{t("Done so far")}</span>
          {view.baseline ? <span className="lg-base">{t("Baseline")}</span> : null}
          {view.actual ? <span className="lg-act">{t("Actual")}</span> : null}
          {view.forecast ? <span className="lg-fc">{t("Forecast")}</span> : null}
          {view.critical ? <span className="lg-crit">{t("Critical or blocked")}</span> : null}
          <span className="lg-ms">{t("Milestone target / forecast")}</span>
          <span className="lg-today">{t("Today")}</span>
        </div>
      </section>

      <Drawer open={!!task} onClose={() => setParam("task", null)} title={task ? x(task.name) : ""} kicker={task ? `${task.code} · ${t("Activity")}` : undefined} width={460}>
        {task ? (
          <>
            <div className="pms-task-edit">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(task)}>
                <Pencil size={13} /> {t("Edit or delete")}
              </button>
            </div>
            <TaskPanel key={task.id} task={task} onOpen={(id) => setParam("task", id)} />
          </>
        ) : null}
      </Drawer>

      <ActivityDialog open={adding} onClose={() => setAdding(false)} onSaved={(id) => setParam("task", id)} />
      <ActivityDialog
        open={!!editing}
        activity={editing}
        onClose={() => {
          setEditing(null);
          if (taskId && !useOps.getState().activities.some((a) => a.id === taskId)) setParam("task", null);
        }}
      />
      <MilestoneDialog open={addingMs} onClose={() => setAddingMs(false)} />

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("Set a new baseline?")}
        kicker={t("Programme")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setBaseline();
                setConfirm(false);
                toast(t("Baseline set to the current programme"));
              }}
            >
              {t("Set baseline")}
            </button>
          </>
        }
      >
        <p>{t("The current dates of all {n} activities become the new baseline, and milestone baselines move to their forecasts. Slip is then measured from today's programme.", { n: activities.length })}</p>
        {outlook.contractKnown && outlook.lateDays > 0 ? (
          <div className="k-callout k-tone-warn" style={{ marginTop: 12 }}>
            <span>{t("The programme finishes {n} days after the contract date today. A new baseline hides that slip from the variance columns.", { n: outlook.lateDays })}</span>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

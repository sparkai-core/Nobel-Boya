import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarRange, Check, Grid3x3, Minus, Plus, Users, X } from "lucide-react";
import { CountUp, Empty, PageHero, Panel, Sparkline, StatTiles, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays } from "../../../ops/dates";
import { buildingShort } from "../../../lib/loc";
import type { Activity } from "../../../ops/types";
import { cellOf, issuesOf, KINDS, kindMeta, liveIn, type Issue } from "./lookahead-model";
import { ActivityDrawer, ConstraintDialog } from "./LookaheadParts";
import { weekOf } from "./shared";

const WEEKS = [0, 1, 2].map((i) => ({ i, ...weekOf(i) }));
const HIST_PPC = [71, 78, 64, 69];

/**
 * The three-week make-ready board: what starts or runs in each week, what still stands in its way
 * (logged constraints plus live checks on orders, RFIs, inspections, permits, plant and submittals),
 * and a constraint matrix to clear them.
 */
export function LookaheadPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [drawer, setDrawer] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; activity: string | null }>({ open: false, activity: null });
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  const live = useMemo(() => liveIn(s.activities, WEEKS[0]!.from, WEEKS[2]!.to).sort((a, b) => a.start.localeCompare(b.start)), [s.activities]);
  const issues = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const a of live) m.set(a.id, issuesOf(s, a));
    return m;
  }, [s, live]);
  const openOf = (id: string) => (issues.get(id) ?? []).filter((i) => i.open);
  const ready = live.filter((a) => !openOf(a.id).length);
  const makeReady = live.length ? ready.length / live.length : 1;
  const openCount = live.reduce((n, a) => n + openOf(a.id).length, 0);
  const dueThisWeek = s.constraints.filter((c) => c.status === "OPEN" && c.due <= WEEKS[0]!.to).length;

  // PPC: activities that were live last week and reached the % their current dates call for.
  const ppc = useMemo(() => {
    const lw = weekOf(-1);
    const acts = liveIn(s.activities, lw.from, lw.to).concat(s.activities.filter((a) => a.status === "COMPLETED" && a.aEnd && a.aEnd >= lw.from && a.aEnd <= lw.to));
    if (!acts.length) return 100;
    const met = acts.filter((a) => {
      if (a.status === "COMPLETED") return true;
      if (a.status === "BLOCKED") return false;
      const share = Math.min(1, Math.max(0, diffDays(a.start, lw.to) / Math.max(1, diffDays(a.start, a.end))));
      return a.pct >= Math.round(share * 100) - 2;
    }).length;
    return Math.round((met / acts.length) * 100);
  }, [s.activities]);
  const ppcSeries = [...HIST_PPC, ppc];

  const rows = onlyBlocked ? live.filter((a) => openOf(a.id).length) : live;
  const drawerAct = drawer ? s.activities.find((a) => a.id === drawer) ?? null : null;

  const openCell = (a: Activity, kind: (typeof KINDS)[number]["key"]) => {
    const first = (issues.get(a.id) ?? []).find((i) => i.kind === kind && i.open && i.href);
    if (first?.href) navigate(first.href);
    else setDrawer(a.id);
  };

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · Look-ahead")}
        title={t("Three-week look-ahead")}
        subtitle={t("Make work ready before it starts: every activity in the next three weeks with what still stands in its way.")}
        flow={["Pull the next three weeks", "Find the constraints", "Clear or escalate", "Start ready work"]}
        art="calendar"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ open: true, activity: null })}>
            <Plus size={15} />
            {t("Add constraint")}
          </button>
        }
      />

      <StatTiles
        items={[
          { label: t("Make ready"), value: <CountUp value={makeReady * 100} format={(v) => `${Math.round(v)}%`} />, sub: t("{a} of {b} activities ready", { a: ready.length, b: live.length }), tone: makeReady >= 0.8 ? "ok" : makeReady >= 0.6 ? "warn" : "bad" },
          { label: t("Open constraints"), value: <CountUp value={openCount} />, sub: t("on activities in the window"), tone: openCount ? "bad" : "ok", onClick: () => setOnlyBlocked(true) },
          { label: t("Due this week"), value: <CountUp value={dueThisWeek} />, sub: t("logged constraints to clear by {date}", { date: d(WEEKS[0]!.to, false) }), tone: dueThisWeek ? "warn" : "ok" },
          {
            label: t("PPC last week"),
            value: (
              <span className="pg-ppc">
                <CountUp value={ppc} format={(v) => `${Math.round(v)}%`} />
                <Sparkline values={ppcSeries} width={84} height={28} tone={ppc >= 70 ? "ok" : "warn"} />
              </span>
            ),
            sub: t("percent of planned work completed, last 5 weeks"),
            tone: ppc >= 70 ? "ok" : "warn",
          },
        ]}
      />

      <section className="pg-board" aria-label={t("Three-week look-ahead")}>
        {WEEKS.map((w) => {
          const starting = live.filter((a) => (w.i === 0 ? a.start <= w.to : a.start >= w.from && a.start <= w.to));
          const continuing = live.filter((a) => a.start < w.from && a.end >= w.from && !starting.includes(a));
          return (
            <div key={w.i} className="pg-week">
              <header>
                <b>{w.i === 0 ? t("This week") : w.i === 1 ? t("Next week") : t("In two weeks")}</b>
                <span className="muted small num-inline">
                  {d(w.from, false)} – {d(w.to, false)}
                </span>
                <span className="k-count">{starting.length}</span>
              </header>
              <div className="pg-week-cards">
                {starting.map((a) => {
                  const iss = issues.get(a.id) ?? [];
                  const open = iss.filter((i) => i.open);
                  const kinds = [...new Set(open.map((i) => i.kind))];
                  return (
                    <button key={a.id} type="button" className={`pg-card k-rise${open.length ? " bad" : " ok"}`} onClick={() => setDrawer(a.id)}>
                      <span className="pg-card-top">
                        <span className="k-ref">{a.code}</span>
                        <span className="pg-card-b">{buildingShort(a.building, lang)}</span>
                        <span className={`pg-card-state${open.length ? " bad" : " ok"}`}>{open.length ? t("{n} open", { n: open.length }) : t("Ready")}</span>
                      </span>
                      <strong>{x(a.name)}</strong>
                      <small className="muted">
                        {a.status === "NOT_STARTED" ? t("starts {date}", { date: d(a.start, false) }) : t("running · {p}% done", { p: a.pct })} · <Users size={11} /> {a.crew}
                      </small>
                      {kinds.length ? (
                        <span className="pg-chips">
                          {kinds.map((k) => {
                            const m = kindMeta(k);
                            const Icon = m.icon;
                            return (
                              <span key={k} className="pg-chip">
                                <Icon size={11} />
                                {t(m.label)}
                              </span>
                            );
                          })}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                {!starting.length ? <p className="pg-empty small">{t("Nothing new starts this week.")}</p> : null}
                {continuing.length ? (
                  <div className="pg-cont">
                    <span className="muted small">{t("Still running")}</span>
                    {continuing.map((a) => (
                      <button key={a.id} type="button" className={`pg-cont-row${openOf(a.id).length ? " bad" : ""}`} onClick={() => setDrawer(a.id)}>
                        <span className="k-ref">{a.code}</span>
                        <span className="truncate">{x(a.name)}</span>
                        <i style={{ width: `${a.pct}%` }} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <Panel
        title={t("Constraint matrix")}
        icon={<Grid3x3 size={15} />}
        count={rows.length}
        sub={t("Each activity against the seven things it needs. Click a cross to open the record that holds it.")}
        actions={
          <label className="pg-toggle">
            <input type="checkbox" checked={onlyBlocked} onChange={(e) => setOnlyBlocked(e.target.checked)} />
            {t("Only constrained")}
          </label>
        }
        pad={false}
      >
        {rows.length ? (
          <div className="pg-matrix-wrap">
            <table className="pg-matrix">
              <thead>
                <tr>
                  <th scope="col">{t("Activity")}</th>
                  {KINDS.map((k) => {
                    const Icon = k.icon;
                    return (
                      <th key={k.key} scope="col" title={t(k.label)}>
                        <Icon size={14} />
                        <span>{t(k.label)}</span>
                      </th>
                    );
                  })}
                  <th scope="col">{t("State")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const iss = issues.get(a.id) ?? [];
                  const open = iss.filter((i) => i.open).length;
                  return (
                    <tr key={a.id}>
                      <th scope="row">
                        <button type="button" className="pg-matrix-act" onClick={() => setDrawer(a.id)}>
                          <span className="k-ref">{a.code}</span>
                          <span className="truncate">{x(a.name)}</span>
                        </button>
                      </th>
                      {KINDS.map((k) => {
                        const c = cellOf(iss, k.key);
                        const tip = iss.filter((i) => i.kind === k.key).map((i) => x(i.text)).join(" · ");
                        return (
                          <td key={k.key}>
                            {c === "bad" ? (
                              <button type="button" className="pg-cell bad" title={tip} aria-label={`${t(k.label)}: ${tip}`} onClick={() => openCell(a, k.key)}>
                                <X size={13} strokeWidth={3} />
                              </button>
                            ) : c === "ok" ? (
                              <span className="pg-cell ok" title={tip}>
                                <Check size={13} strokeWidth={3} />
                              </span>
                            ) : (
                              <span className="pg-cell na" aria-label={t("Not needed")}>
                                <Minus size={12} />
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <span className={`k-badge k-tone-${open ? "bad" : "ok"}`}>
                          <i aria-hidden="true" />
                          {open ? open : t("Ready")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<CalendarRange size={20} />} title={onlyBlocked ? t("Every activity in the window is ready") : t("Nothing runs in the next three weeks")} />
        )}
      </Panel>

      <ActivityDrawer activity={drawerAct} issues={drawer ? (issues.get(drawer) ?? []) : []} onClose={() => setDrawer(null)} onAdd={(id) => setDialog({ open: true, activity: id })} />
      <ConstraintDialog open={dialog.open} initialActivity={dialog.activity} activities={live} onClose={() => setDialog({ open: false, activity: null })} />
    </div>
  );
}

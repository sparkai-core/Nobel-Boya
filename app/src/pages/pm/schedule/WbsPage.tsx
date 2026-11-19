import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ChevronRight, ListTree, Minimize2, Maximize2, Network, Pencil, Plus } from "lucide-react";
import { Badge, Empty, KeyVals, Meter, Money, PageHero, StatusBadge, useL } from "../../../components/kit";
import { Drawer, Segmented } from "../../../components/ui";
import { fmtMoneyShort } from "../../../lib/format";
import { buildingShort } from "../../../lib/loc";
import { useOps } from "../../../ops/store";
import { diffDays } from "../../../ops/dates";
import { R } from "../../../ops/select";
import { DERIVED_WBS } from "../../../ops/seed";
import type { Activity, WbsNode } from "../../../ops/types";
import { rollup, subtreeIds, useSchedule, wbsChildren, type Rollup } from "./model";
import { WbsDialog } from "./WbsDialog";

/**
 * The work breakdown as a top-down org chart: project → top-level packages → sub-packages, each with
 * a roll-up of tasks, budget and budget-weighted progress. Clicking a node opens its detail.
 */
export function WbsPage() {
  const { t, x } = useL();
  const { activities, wbs, cp, weight } = useSchedule();
  const zones = useOps((s) => s.zones);
  const kids = useMemo(() => wbsChildren(wbs), [wbs]);
  const roots = useMemo(() => {
    const ids = new Set(wbs.map((w) => w.id));
    return wbs.filter((n) => !n.parentId || !ids.has(n.parentId));
  }, [wbs]);
  const root = roots[0];
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<"packages" | "activities">("packages");
  const [dialog, setDialog] = useState<{ node?: WbsNode | null; parentId?: string | null } | null>(null);

  const rolls = useMemo(() => {
    const m = new Map<string, Rollup>();
    const byWbs = new Map<string, typeof activities>();
    for (const a of activities) byWbs.set(a.wbsId, [...(byWbs.get(a.wbsId) ?? []), a]);
    for (const n of wbs) {
      const ids = subtreeIds(n.id, kids);
      m.set(n.id, rollup([...ids].flatMap((id) => byWbs.get(id) ?? []), cp, weight));
    }
    return m;
  }, [wbs, kids, activities, cp, weight]);
  const loose = useMemo(() => {
    const ids = new Set(wbs.map((w) => w.id));
    return activities.filter((a) => !ids.has(a.wbsId)).length;
  }, [wbs, activities]);
  const derived = wbs.some((w) => w.id.startsWith(DERIVED_WBS));
  const dialogEl = <WbsDialog open={!!dialog} node={dialog?.node ?? null} parentId={dialog?.parentId ?? null} onClose={() => setDialog(null)} onSaved={(id) => dialog?.node && setSel(id)} />;

  if (!root)
    return (
      <div className="k-page pms">
        <PageHero eyebrow={t("Project management · WBS")} title={t("Work breakdown")} subtitle={t("How the project is divided into packages, with tasks, budget and progress rolled up at every level.")} art="wbs" />
        <div className="k-panel">
          <Empty
            icon={<Network size={20} />}
            title={t("No work breakdown yet")}
            action={
              <div className="pms-empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => setDialog({ parentId: null })}>
                  <Plus size={15} /> {t("Add the top item")}
                </button>
                <Link to={`${R.planning("activities")}?import=1`} className="btn btn-ghost">
                  {t("Import a P6 / MS Project file")}
                </Link>
              </div>
            }
          >
            {t("Importing a programme brings its WBS. Or start with the top item (the project) and add packages under it.")}
          </Empty>
        </div>
        {dialogEl}
      </div>
    );
  const tops = [...(kids.get(root.id) ?? []), ...roots.slice(1)];
  const fold = (id: string) =>
    setFolded((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const parents = wbs.filter((n) => (kids.get(n.id) ?? []).length > 0 && n.id !== root.id).map((n) => n.id);
  const allFolded = parents.every((p) => folded.has(p));

  const node = (n: WbsNode, level: number) => {
    const r = rolls.get(n.id)!;
    const children = kids.get(n.id) ?? [];
    const own = activities.filter((a) => a.wbsId === n.id).sort((a, b) => a.start.localeCompare(b.start));
    const isFolded = folded.has(n.id);
    return (
      <div className={`pms-node lv-${level}${sel === n.id ? " sel" : ""}`}>
        <button type="button" className="pms-node-main" onClick={() => setSel(n.id)} aria-pressed={sel === n.id}>
          <span className="pms-node-top">
            <span className="pms-code">{n.code}</span>
            {r.blocked ? <i className="pms-node-flag bad" title={t("{n} blocked", { n: r.blocked })} /> : r.critical ? <i className="pms-node-flag crit" title={t("On the critical path")} /> : null}
          </span>
          <strong>{x(n.name)}</strong>
          <span className="pms-node-figs">
            <span>{t("{n} tasks", { n: r.count })}</span>
            {r.budget > 0 ? <span className="num-inline">{fmtMoneyShort(r.budget)}</span> : null}
            {r.count ? <b className="num-inline">{Math.round(r.pct)}%</b> : null}
          </span>
          <Meter value={r.pct / 100} marker={r.planned / 100} tone={r.blocked ? "bad" : r.pct + 2 < r.planned ? "warn" : "brand"} label={t("Progress")} />
        </button>
        {children.length ? (
          <button type="button" className="pms-node-fold" onClick={() => fold(n.id)} aria-label={isFolded ? t("Show sub-items") : t("Hide sub-items")} aria-expanded={!isFolded}>
            {isFolded ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            <span>{children.length}</span>
          </button>
        ) : null}
        {mode === "activities" && own.length && !isFolded ? <ActivityPills acts={own} /> : null}
      </div>
    );
  };

  const branch = (n: WbsNode, level: number) => {
    const children = kids.get(n.id) ?? [];
    return (
      <div key={n.id} className="pms-branch">
        {node(n, level)}
        {children.length && !folded.has(n.id) ? <div className="pms-kids">{children.map((c) => branch(c, level + 1))}</div> : null}
      </div>
    );
  };

  const selected = sel ? wbs.find((n) => n.id === sel) : undefined;
  const rr = rolls.get(root.id)!;

  return (
    <div className="k-page pms">
      <PageHero
        eyebrow={t("Project management · WBS")}
        title={t("Work breakdown")}
        subtitle={t("How the project is divided into packages, with tasks, budget and progress rolled up at every level.")}
        flow={["Project", "Package", "Sub-package", "Activity"]}
        art="wbs"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ parentId: sel ?? root.id })}>
              <Plus size={15} />
              {t("Add WBS item")}
            </button>
            <Link to={R.programme()} className="btn btn-ghost">
              <ListTree size={15} />
              {t("Open the programme")}
            </Link>
          </>
        }
      />

      <section className="pms-org-wrap">
        <div className="pms-org-bar">
          <p>
            <b>{t("{n} packages", { n: wbs.length - 1 })}</b> · {t("{n} tasks", { n: rr.count })}
            {rr.budget > 0 ? (
              <>
                {" · "}
                <Money value={rr.budget} short />
              </>
            ) : null}
            {rr.count ? ` · ${t("{n}% done, plan says {m}%", { n: Math.round(rr.pct), m: Math.round(rr.planned) })}` : ""}
            {loose ? ` · ${t("{n} activities have no WBS item", { n: loose })}` : ""}
            {derived ? <span className="muted small"> · {t("Built from the BOQ buildings and sections until you import a programme or change it.")}</span> : null}
          </p>
          <div className="k-row" style={{ gap: 8 }}>
            <Segmented value={mode} onChange={setMode} label={t("Detail")} options={[{ value: "packages", label: t("Packages") }, { value: "activities", label: t("With activities") }]} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFolded(allFolded ? new Set() : new Set(parents))}>
              {allFolded ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              {allFolded ? t("Expand all") : t("Collapse all")}
            </button>
          </div>
        </div>
        <div className="pms-org-scroll">
          <div className="pms-org">
            <div className="pms-org-root">{node(root, 0)}</div>
            <div className="pms-org-cols">
              {tops.map((n) => (
                <div key={n.id} className="pms-org-col">
                  {branch(n, 1)}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="pms-legend">
          <span className="lg-prog">{t("Done, budget-weighted")}</span>
          <span className="lg-planmark">{t("Where the plan says it should be")}</span>
          <span className="lg-dot-crit">{t("Holds critical work")}</span>
          <span className="lg-dot-bad">{t("Holds blocked work")}</span>
        </div>
      </section>

      <Drawer open={!!selected} onClose={() => setSel(null)} title={selected ? x(selected.name) : ""} kicker={selected ? `${selected.code} · ${t("WBS item")}` : undefined} width={460}>
        {selected ? (
          <>
            <div className="pms-task-edit">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ parentId: selected.id })}>
                <Plus size={13} /> {t("Add a sub-item")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ node: selected })}>
                <Pencil size={13} /> {t("Edit or delete")}
              </button>
            </div>
            <NodeDetail n={selected} r={rolls.get(selected.id) ?? rollup([], cp)} wbs={wbs} activities={activities} zones={zones} onPick={setSel} />
          </>
        ) : null}
      </Drawer>
      {dialogEl}
    </div>
  );
}

function ActivityPills({ acts }: { acts: Activity[] }) {
  const { x } = useL();
  return (
    <ul className="pms-pills">
      {acts.map((a) => (
        <li key={a.id}>
          <Link to={R.programme(a.id)} title={x(a.name)} className={`st-${a.status.toLowerCase()}`}>
            <span className="pms-code">{a.code}</span>
            <i style={{ ["--p" as string]: `${a.pct}%` }} />
            <b className="num-inline">{a.pct}%</b>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NodeDetail({ n, r, wbs, activities, zones, onPick }: { n: WbsNode; r: Rollup; wbs: WbsNode[]; activities: Activity[]; zones: ReturnType<typeof useOps.getState>["zones"]; onPick: (id: string) => void }) {
  const { t, x, d, lang } = useL();
  const path: WbsNode[] = [];
  for (let cur: WbsNode | undefined = n; cur; cur = cur.parentId ? wbs.find((w) => w.id === cur!.parentId) : undefined) path.unshift(cur);
  const ids = new Set(r.ids);
  const tasks = activities.filter((a) => ids.has(a.id)).sort((a, b) => a.start.localeCompare(b.start));
  const myZones = zones.filter((z) => ids.has(z.activityId));
  const byBuilding = new Map<string, typeof myZones>();
  for (const z of myZones) byBuilding.set(z.building, [...(byBuilding.get(z.building) ?? []), z]);
  const max = Math.max(1, r.budget);
  const slip = diffDays(r.bEnd, r.end);

  return (
    <div className="pms-node-detail">
      <nav className="pms-path" aria-label={t("Where this sits")}>
        {path.map((p, i) => (
          <span key={p.id}>
            {i ? <ChevronRight size={12} /> : null}
            {p.id === n.id ? <b>{p.code}</b> : <button type="button" onClick={() => onPick(p.id)}>{p.code}</button>}
          </span>
        ))}
      </nav>
      <KeyVals
        items={[
          { k: t("Tasks"), v: r.count },
          { k: t("Done"), v: r.count ? `${Math.round(r.pct)}%` : "—" },
          { k: t("Dates"), v: r.count ? `${d(r.start, false)} – ${d(r.end)}` : "—" },
          { k: t("Slip"), v: !r.count ? "—" : <span className={slip > 0 ? "k-text-bad" : undefined}>{slip > 0 ? t("{n} days late", { n: slip }) : t("On baseline")}</span> },
        ]}
      />

      {r.budget > 0 ? (
      <section>
        <h3>{t("Budget against earned")}</h3>
        <div className="pms-be">
          <div>
            <span>{t("Budget")}</span>
            <i style={{ width: "100%" }} />
            <Money value={r.budget} short />
          </div>
          <div>
            <span>{t("Planned by today")}</span>
            <i className="plan" style={{ width: `${((r.planned / 100) * r.budget * 100) / max}%` }} />
            <Money value={(r.planned / 100) * r.budget} short />
          </div>
          <div>
            <span>{t("Earned")}</span>
            <i className="earned" style={{ width: `${(r.earned / max) * 100}%` }} />
            <Money value={r.earned} short />
          </div>
        </div>
      </section>
      ) : null}

      {byBuilding.size ? (
      <section>
        <h3>{t("Progress by building")}</h3>
        {byBuilding.size ? (
          <ul className="pms-zones">
            {[...byBuilding.entries()].map(([b, zs]) => {
              const exp = zs.reduce((a, z) => a + z.expectedPct, 0) / zs.length;
              const act = zs.reduce((a, z) => a + z.actualPct, 0) / zs.length;
              return (
                <li key={b}>
                  <div className="pms-zone-head">
                    <strong>{buildingShort(b, lang)}</strong>
                    <span className="num-inline">
                      {Math.round(act)}% <small>/ {Math.round(exp)}%</small>
                    </span>
                  </div>
                  <Meter value={act / 100} marker={exp / 100} tone={act + 3 < exp ? "warn" : "ok"} label={buildingShort(b, lang)} />
                  <small className="muted">{zs.map((z) => x(z.name)).join(" · ")}</small>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
      ) : null}

      <section>
        <h3>
          {t("Tasks")} <span className="k-count">{tasks.length}</span>
        </h3>
        <ul className="pms-node-tasks">
          {tasks.map((a) => (
            <li key={a.id}>
              <Link to={R.programme(a.id)}>
                <span className="pms-code">{a.code}</span>
                <span className="truncate">{x(a.name)}</span>
                {a.status === "BLOCKED" ? <StatusBadge kind="activity" status={a.status} /> : <Badge tone={a.status === "COMPLETED" ? "ok" : "neutral"} dot={false}>{a.pct}%</Badge>}
                <ArrowRight size={13} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

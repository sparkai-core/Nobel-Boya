import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CircleDot, GitMerge, ListChecks, Network, Route, Shuffle, TimerOff } from "lucide-react";
import { Badge, Dialog, Field, PageHero, Panel, toast, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { cpm, R, type Cpm, type Tone } from "../../../ops/select";
import type { Activity, Dependency, LinkType } from "../../../ops/types";
import { dateOf, dayOf, linkLabel, useSchedule } from "./model";

type Fix = { from: string; to: string; type: LinkType; lag: number };
type IssueKind = "open-start" | "open-end" | "ss-lag" | "out-of-seq" | "neg-float";
type Issue = { id: string; kind: IssueKind; ids: string[]; title: string; detail: string; tone: Tone; fix?: Fix; to?: string };

const BW = 172;
const BH = 50;
const GX = 70;
const GY = 16;
const PAD = 26;

/**
 * Logic network: activity boxes in columns by logic depth, arrows for every link (critical in red,
 * SS/FF and lags labelled), open ends tagged, a worklist of logic issues and a recalculation preview
 * before a fix is applied.
 */
export function DependenciesPage() {
  const { t, x, d } = useL();
  const { activities, links, cp, byId, outlook } = useSchedule();
  const addLink = useOps((s) => s.addLink);
  const shiftActivity = useOps((s) => s.shiftActivity);
  const updateActivity = useOps((s) => s.updateActivity);
  const [scope, setScope] = useState<"issues" | "all">("issues");
  const [sel, setSel] = useState<string | null>(null);
  const [preview, setPreview] = useState<Fix | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // ------------------------------------------------------------ issues
  const issues = useMemo(() => {
    const out: Issue[] = [];
    const hasPred = new Set(links.map((l) => l.to));
    const hasSucc = new Set(links.map((l) => l.from));
    const first = [...activities].sort((a, b) => a.start.localeCompare(b.start))[0];
    const last = [...activities].sort((a, b) => b.end.localeCompare(a.end))[0];
    if (!first || !last) return out;
    for (const a of activities) {
      if (a.id !== first.id && !hasPred.has(a.id))
        out.push({ id: `os-${a.id}`, kind: "open-start", ids: [a.id], tone: "warn", title: t("{code} has no predecessor", { code: a.code }), detail: t("{name} can start any time as far as the logic knows. Tie it to the work it really waits for.", { name: x(a.name) }), fix: { from: first.id, to: a.id, type: "FS", lag: 0 } });
      if (a.id !== last.id && !hasSucc.has(a.id)) {
        const next = activities.filter((z) => z.id !== a.id && z.building === a.building && z.start >= a.end && z.status !== "COMPLETED").sort((p, q) => p.start.localeCompare(q.start))[0];
        out.push({ id: `oe-${a.id}`, kind: "open-end", ids: [a.id], tone: "warn", title: t("{code} has no successor", { code: a.code }), detail: t("If {name} slips, nothing in the programme moves. Its float is not real.", { name: x(a.name) }), fix: { from: a.id, to: (next ?? last).id, type: "FS", lag: 0 } });
      }
    }
    for (const l of links.filter((z) => z.type === "SS" && z.lag >= 14)) {
      const p = byId.get(l.from);
      const s = byId.get(l.to);
      if (!p || !s) continue;
      out.push({ id: `ss-${l.id}`, kind: "ss-lag", ids: [l.from, l.to], tone: "info", title: t("{a} → {b} is start-to-start with a {n}-day lag", { a: p.code, b: s.code, n: l.lag }), detail: t("A long SS lag hides how much of {a} must be done first. Add a finish-to-finish link so {b} cannot finish before it.", { a: p.code, b: s.code }), fix: { from: l.from, to: l.to, type: "FF", lag: 7 } });
    }
    for (const l of links) {
      const p = byId.get(l.from);
      const s = byId.get(l.to);
      if (!p || !s || !s.aStart) continue;
      const need = l.type === "FS" ? dateOf(dayOf(p.aEnd ?? p.end) + l.lag) : l.type === "SS" ? dateOf(dayOf(p.aStart ?? p.start) + l.lag) : null;
      const predOpen = l.type === "FS" ? p.status !== "COMPLETED" || (p.aEnd ?? p.end) > s.aStart : !p.aStart;
      if (need && predOpen && s.aStart < need) out.push({ id: `oq-${l.id}`, kind: "out-of-seq", ids: [l.from, l.to], tone: "bad", title: t("{b} started before {a} allowed it", { a: p.code, b: s.code }), detail: t("{b} started {date} but the {type} link says it should wait for {a}. Check the logic or the progress.", { a: p.code, b: s.code, date: d(s.aStart), type: linkLabel(l) }), to: R.programme(s.id) });
    }
    const behind = Math.max(0, dayOf(outlook.calculated) - dayOf(outlook.contract));
    const neg = activities.filter((a) => a.status !== "COMPLETED" && (cp.get(a.id)?.tf ?? 0) - behind < 0);
    if (neg.length) {
      const worst = Math.min(...neg.map((a) => (cp.get(a.id)?.tf ?? 0) - behind));
      out.push({ id: "neg", kind: "neg-float", ids: neg.map((a) => a.id), tone: "bad", title: t("{n} activities have negative float", { n: neg.length }), detail: t("Measured against the contract date the chain is short by {n} days. Only recovery or a time extension clears this.", { n: -worst }), to: R.recovery });
    }
    const order: Record<IssueKind, number> = { "neg-float": 0, "out-of-seq": 1, "open-start": 2, "open-end": 3, "ss-lag": 4 };
    return out.sort((a, b) => order[a.kind] - order[b.kind]);
  }, [activities, links, byId, cp, outlook, t, x, d]);

  const openIds = useMemo(() => {
    const m = new Map<string, "start" | "end" | "both">();
    for (const i of issues) {
      if (i.kind === "open-start") m.set(i.ids[0]!, m.get(i.ids[0]!) === "end" ? "both" : "start");
      if (i.kind === "open-end") m.set(i.ids[0]!, m.get(i.ids[0]!) === "start" ? "both" : "end");
    }
    return m;
  }, [issues]);

  // ------------------------------------------------------------ layout
  const layout = useMemo(() => {
    const depth = new Map<string, number>();
    const preds = new Map<string, Dependency[]>();
    for (const l of links) preds.set(l.to, [...(preds.get(l.to) ?? []), l]);
    const visit = (id: string, stack: Set<string>): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (stack.has(id)) return 0;
      stack.add(id);
      let dpt = 0;
      for (const l of preds.get(id) ?? []) if (byId.has(l.from)) dpt = Math.max(dpt, visit(l.from, stack) + 1);
      stack.delete(id);
      depth.set(id, dpt);
      return dpt;
    };
    for (const a of activities) visit(a.id, new Set());

    let shown: Activity[] = activities;
    if (scope === "issues") {
      const keep = new Set<string>();
      for (const i of issues.filter((z) => z.kind !== "neg-float")) for (const id of i.ids) keep.add(id);
      for (const l of links) if (keep.has(l.from) || keep.has(l.to)) {
        keep.add(l.from);
        keep.add(l.to);
      }
      shown = activities.filter((a) => keep.has(a.id));
    }
    const cols = [...new Set(shown.map((a) => depth.get(a.id) ?? 0))].sort((a, b) => a - b);
    const colOf = new Map(cols.map((c, i) => [c, i]));
    const byCol = new Map<number, Activity[]>();
    for (const a of shown) {
      const c = colOf.get(depth.get(a.id) ?? 0)!;
      byCol.set(c, [...(byCol.get(c) ?? []), a]);
    }
    const pos = new Map<string, { x: number; y: number }>();
    let maxRows = 0;
    for (const [c, list] of byCol) {
      list.sort((a, b) => a.building.localeCompare(b.building) || a.start.localeCompare(b.start));
      list.forEach((a, i) => pos.set(a.id, { x: PAD + c * (BW + GX), y: PAD + 18 + i * (BH + GY) }));
      maxRows = Math.max(maxRows, list.length);
    }
    const width = PAD * 2 + cols.length * (BW + GX) - GX;
    const height = PAD * 2 + 18 + maxRows * (BH + GY);
    const edges = links.filter((l) => pos.has(l.from) && pos.has(l.to));
    return { pos, width, height, edges, cols: cols.length, shown };
  }, [activities, links, byId, scope, issues]);

  const isCrit = (id: string) => !!cp.get(id)?.critical && byId.get(id)?.status !== "COMPLETED";
  const related = sel ? new Set([sel, ...links.filter((l) => l.from === sel || l.to === sel).flatMap((l) => [l.from, l.to])]) : null;
  const selAct = sel ? byId.get(sel) : undefined;

  const focus = (id: string) => {
    setSel(id);
    const p = layout.pos.get(id);
    const el = scroller.current;
    if (p && el) el.scrollTo({ left: Math.max(0, p.x - el.clientWidth / 2 + BW / 2), top: Math.max(0, p.y - 120), behavior: "smooth" });
  };

  const KIND_ICON: Record<IssueKind, typeof AlertTriangle> = { "open-start": CircleDot, "open-end": CircleDot, "ss-lag": GitMerge, "out-of-seq": Shuffle, "neg-float": TimerOff };

  return (
    <div className="k-page pms">
      <PageHero
        eyebrow={t("Project management · Dependencies")}
        title={t("Dependencies")}
        subtitle={t("The logic that ties the programme together. Fix open ends and weak links so the critical path can be trusted.")}
        flow={["Links", "Open ends", "Recalculate", "Apply"]}
        art="network"
      />

      <div className="k-grid-main">
        <section className="pms-net-panel">
          <header className="pms-net-head">
            <div>
              <h2>{t("Logic network")}</h2>
              <p className="muted small">{t("{n} activities and {m} links, in columns by logic depth. Scroll to pan.", { n: layout.shown.length, m: layout.edges.length })}</p>
            </div>
            <Segmented value={scope} onChange={(v) => setScope(v)} label={t("Show")} options={[{ value: "issues", label: t("Around issues") }, { value: "all", label: t("All") }]} />
          </header>
          <div className="pms-net-scroll" ref={scroller}>
            <svg className="pms-net" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={t("Logic network")}>
              <defs>
                <marker id="pms-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0 L8 4 L0 8z" fill="var(--faint)" />
                </marker>
                <marker id="pms-arr-crit" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0 L8 4 L0 8z" fill="var(--redline)" />
                </marker>
              </defs>
              {layout.edges.map((l) => {
                const a = layout.pos.get(l.from)!;
                const b = layout.pos.get(l.to)!;
                const x1 = a.x + BW;
                const y1 = a.y + BH / 2;
                const x2 = b.x - 2;
                const y2 = b.y + BH / 2;
                const k = Math.max(30, (x2 - x1) / 2);
                const crit = isCrit(l.from) && isCrit(l.to);
                const dim = related && !(related.has(l.from) && related.has(l.to) && (l.from === sel || l.to === sel));
                const label = l.type !== "FS" || l.lag !== 0;
                return (
                  <g key={l.id} className={`pms-edge${crit ? " crit" : ""}${dim ? " dim" : ""}`}>
                    <path d={`M${x1} ${y1} C${x1 + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}`} markerEnd={crit ? "url(#pms-arr-crit)" : "url(#pms-arr)"} />
                    {label ? (
                      <g transform={`translate(${(x1 + x2) / 2} ${(y1 + y2) / 2})`}>
                        <rect x={-22} y={-9} width={44} height={18} rx={9} />
                        <text textAnchor="middle" dy="4">
                          {linkLabel(l)}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
              {layout.shown.map((a) => {
                const p = layout.pos.get(a.id)!;
                const crit = isCrit(a.id);
                const open = openIds.get(a.id);
                const name = x(a.name);
                return (
                  <g
                    key={a.id}
                    transform={`translate(${p.x} ${p.y})`}
                    className={`pms-box st-${a.status.toLowerCase()}${crit ? " crit" : ""}${sel === a.id ? " sel" : ""}${related && !related.has(a.id) ? " dim" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSel(sel === a.id ? null : a.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSel(sel === a.id ? null : a.id)}
                  >
                    <title>{`${a.code} ${name} · ${d(a.start)} – ${d(a.end)}`}</title>
                    <rect className="pms-box-bg" width={BW} height={BH} rx={9} />
                    <rect className="pms-box-stripe" width={4} height={BH - 12} x={6} y={6} rx={2} />
                    <text x={16} y={19} className="pms-box-code">
                      {a.code}
                    </text>
                    <text x={BW - 10} y={19} textAnchor="end" className="pms-box-pct">
                      {a.pct}%
                    </text>
                    <text x={16} y={36} className="pms-box-name">
                      {name.length > 24 ? `${name.slice(0, 23)}…` : name}
                    </text>
                    {open ? (
                      <g transform={`translate(${open === "end" ? BW - 70 : 8} -9)`} className="pms-box-tag">
                        <rect width={open === "both" ? 92 : 62} height={16} rx={8} />
                        <text x={(open === "both" ? 92 : 62) / 2} y={11.5} textAnchor="middle">
                          {open === "start" ? t("Open start") : open === "end" ? t("Open end") : t("Open both ends")}
                        </text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
          <footer className="pms-net-foot">
            {selAct ? (
              <>
                <span className="pms-code">{selAct.code}</span>
                <strong className="truncate">{x(selAct.name)}</strong>
                <span className="muted small">
                  {t("{a} in · {b} out", { a: links.filter((l) => l.to === selAct.id).length, b: links.filter((l) => l.from === selAct.id).length })} · {t("{n} days float", { n: cp.get(selAct.id)?.tf ?? 0 })}
                </span>
                <Link to={R.programme(selAct.id)} className="k-link-btn">
                  {t("Open in the programme")} <ArrowRight size={13} />
                </Link>
              </>
            ) : (
              <span className="muted small">{t("Select a box to trace its links.")}</span>
            )}
            <span className="pms-net-key">
              <i className="crit" /> {t("Critical link")}
              <i className="tag" /> {t("Open end")}
            </span>
          </footer>
        </section>

        <Panel title={t("Issues to fix")} icon={<ListChecks size={15} />} count={issues.length} sub={t("Found in the logic as it stands. Preview a fix to see which dates move.")} pad={false}>
          {issues.length ? (
            <ul className="pms-issues">
              {issues.map((i) => {
                const Icon = KIND_ICON[i.kind];
                return (
                  <li key={i.id} className={i.ids.includes(sel ?? "") ? "on" : undefined}>
                    <button type="button" className="pms-issue-main" onClick={() => focus(i.ids[i.kind === "ss-lag" ? 1 : 0]!)}>
                      <span className={`pms-issue-icon k-tone-${i.tone}`}>
                        <Icon size={14} />
                      </span>
                      <span>
                        <strong>{i.title}</strong>
                        <small>{i.detail}</small>
                      </span>
                    </button>
                    <div className="pms-issue-actions">
                      {i.fix ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview(i.fix!)}>
                          <Network size={13} />
                          {t("Preview fix")}
                        </button>
                      ) : null}
                      {i.to ? (
                        <Link to={i.to} className="btn btn-ghost btn-sm">
                          {i.kind === "neg-float" ? <Route size={13} /> : <ArrowRight size={13} />}
                          {i.kind === "neg-float" ? t("Recovery options") : t("Open in the programme")}
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="k-panel-body muted">{t("The logic is clean: every activity has a start and an end link.")}</p>
          )}
        </Panel>
      </div>

      {preview ? (
        <Recalc
          fix={preview}
          onChange={setPreview}
          onClose={() => setPreview(null)}
          activities={activities}
          links={links}
          before={cp}
          onApply={(fix, moved) => {
            addLink(fix.from, fix.to, fix.type, fix.lag);
            for (const m of moved) {
              const a = byId.get(m.id);
              if (!a) continue;
              if (a.status === "NOT_STARTED" && m.startDelta > 0) shiftActivity(a.id, m.startDelta);
              else if (a.status !== "COMPLETED" && m.endDelta > 0) updateActivity(a.id, { end: dateOf(dayOf(a.end) + m.endDelta) });
            }
            setPreview(null);
            toast(t("Link added: {a} → {b}. {n} activities moved.", { a: byId.get(fix.from)?.code ?? "", b: byId.get(fix.to)?.code ?? "", n: moved.filter((m) => m.startDelta > 0 || m.endDelta > 0).length }));
          }}
        />
      ) : null}
    </div>
  );
}

type Moved = { id: string; startDelta: number; endDelta: number };

function Recalc({ fix, onChange, onClose, onApply, activities, links, before }: { fix: Fix; onChange: (f: Fix) => void; onClose: () => void; onApply: (f: Fix, moved: Moved[]) => void; activities: Activity[]; links: Dependency[]; before: Map<string, Cpm> }) {
  const { t, x, d } = useL();
  const after = useMemo(() => cpm(activities, [...links, { id: "preview", ...fix }]), [activities, links, fix]);
  const exists = links.some((l) => l.from === fix.from && l.to === fix.to && l.type === fix.type);
  // A link to an activity that already leads back to the source would close a loop.
  const loop = useMemo(() => {
    const seen = new Set<string>();
    const stack = [fix.to];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === fix.from) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const l of links) if (l.from === cur) stack.push(l.to);
    }
    return false;
  }, [links, fix]);
  const rows = activities
    .map((a) => ({ a, b: before.get(a.id)!, c: after.get(a.id)! }))
    .filter((r) => r.b && r.c && (r.b.es !== r.c.es || r.b.ef !== r.c.ef || r.b.tf !== r.c.tf))
    .sort((p, q) => q.c.es - p.c.es);
  const moved: Moved[] = rows.map((r) => ({ id: r.a.id, startDelta: Math.max(0, r.c.es - dayOf(r.a.start)), endDelta: Math.max(0, r.c.ef - dayOf(r.a.end)) }));
  const finishBefore = Math.max(...[...before.values()].map((c) => c.ef));
  const finishAfter = Math.max(...[...after.values()].map((c) => c.ef));
  const opts = [...activities].sort((a, b) => a.code.localeCompare(b.code));
  const bad = fix.from === fix.to || loop || exists;

  return (
    <Dialog
      open
      onClose={onClose}
      width={720}
      kicker={t("Preview recalculation")}
      title={t("Add a link and recalculate")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" disabled={bad} onClick={() => onApply(fix, moved)}>
            {t("Apply")}
          </button>
        </>
      }
    >
      <div className="pms-recalc-form">
        <Field label={t("From")}>
          <select className="input select" value={fix.from} onChange={(e) => onChange({ ...fix, from: e.target.value })}>
            {opts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {x(a.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("To")}>
          <select className="input select" value={fix.to} onChange={(e) => onChange({ ...fix, to: e.target.value })}>
            {opts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {x(a.name)}
              </option>
            ))}
          </select>
        </Field>
        <div className="k-field">
          <span className="k-field-label">{t("Type")}</span>
          <Segmented<LinkType> value={fix.type} onChange={(v) => onChange({ ...fix, type: v })} label={t("Link type")} options={(["FS", "SS", "FF", "SF"] as LinkType[]).map((v) => ({ value: v, label: v }))} />
        </div>
        <Field label={t("Lag, days")}>
          <input className="input" type="number" value={fix.lag} min={-30} max={90} onChange={(e) => onChange({ ...fix, lag: Math.round(Number(e.target.value) || 0) })} />
        </Field>
      </div>
      {bad ? (
        <div className="k-callout k-tone-bad">
          <AlertTriangle size={16} />
          <span>{fix.from === fix.to ? t("An activity cannot be linked to itself.") : loop ? t("This link would close a loop in the logic.") : t("This link already exists.")}</span>
        </div>
      ) : (
        <>
          <p className="pms-recalc-sum">
            {t("Project finish")}: <b>{d(dateOf(finishBefore))}</b> → <b className={finishAfter > finishBefore ? "k-text-bad" : undefined}>{d(dateOf(finishAfter))}</b>
            {finishAfter > finishBefore ? <Badge tone="bad">{t("+{n} days", { n: finishAfter - finishBefore })}</Badge> : <Badge tone="ok">{t("Finish unchanged")}</Badge>}
          </p>
          {rows.length ? (
            <div className="pms-recalc-table">
              <table className="k-table">
                <thead>
                  <tr>
                    <th>{t("Activity")}</th>
                    <th>{t("Dates now")}</th>
                    <th>{t("Dates after")}</th>
                    <th style={{ textAlign: "right" }}>{t("Float")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 12).map(({ a, b, c }) => (
                    <tr key={a.id}>
                      <td>
                        <span className="pms-code">{a.code}</span> <span className="truncate">{x(a.name)}</span>
                      </td>
                      <td className="num-inline">
                        {d(dateOf(b.es), false)} – {d(dateOf(b.ef), false)}
                      </td>
                      <td className={`num-inline${c.ef > b.ef ? " k-text-bad" : ""}`}>
                        {d(dateOf(c.es), false)} – {d(dateOf(c.ef), false)}
                      </td>
                      <td className="num-inline" style={{ textAlign: "right" }}>
                        {b.tf} → <b className={c.tf <= 0 ? "k-text-bad" : undefined}>{c.tf}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 12 ? <p className="muted small">{t("…and {n} more", { n: rows.length - 12 })}</p> : null}
            </div>
          ) : (
            <p className="muted">{t("No dates or float change. The link only documents the logic.")}</p>
          )}
        </>
      )}
    </Dialog>
  );
}

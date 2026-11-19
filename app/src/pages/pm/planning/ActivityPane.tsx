import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, PackagePlus, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Badge, KeyVals, StatusBadge, TabBar, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { R, type Cpm } from "../../../ops/select";
import type { Activity, LinkType } from "../../../ops/types";
import { constraintKey, usePlanExtras, type ConstraintKind } from "../../../ops/ext/planning-p2";
import { fmtQty, unitLabel } from "../../../lib/format";
import { calendarName, LINK_WORDS, origDur, remDur, RISK_SPREAD, riskDays, supplyFor, variance, type SupplyState } from "./model";

type PaneTab = "general" | "status" | "rel" | "res" | "risk";

const CONSTRAINTS: { value: ConstraintKind; label: string }[] = [
  { value: "NONE", label: "No constraint" },
  { value: "SNET", label: "Start on or after" },
  { value: "FNLT", label: "Finish on or before" },
  { value: "MFO", label: "Must finish on" },
  { value: "ALAP", label: "As late as possible" },
];

const SUPPLY: Record<SupplyState, { label: string; tone: "ok" | "brand" | "bad" | "muted" }> = {
  ONSITE: { label: "On site", tone: "ok" },
  ONORDER: { label: "On order", tone: "brand" },
  SHORT: { label: "Short", tone: "bad" },
  NOTREQ: { label: "Not requested", tone: "muted" },
};

/** Bottom detail pane of the Activities tab (P6 "Activity Details"). */
export function ActivityPane({ a, cp, onPick, onEdit }: { a: Activity; cp: Cpm | undefined; onPick: (id: string) => void; onEdit: () => void }) {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const wbsNode = s.wbs.find((w) => w.id === a.wbsId);
  const [tab, setTab] = useState<PaneTab>("general");
  const preds = s.links.filter((l) => l.to === a.id);
  const succs = s.links.filter((l) => l.from === a.id);
  const supply = useMemo(() => supplyFor(s, a.id), [s, a.id]);
  const resources = s.resources.filter((r) => r.activityIds.includes(a.id));
  const v = variance(a);

  return (
    <div className="pp-pane-in">
      <header className="pp-pane-head">
        <div className="pp-pane-title">
          <span className="k-ref">{a.code}</span>
          <strong className="truncate">{x(a.name)}</strong>
          <StatusBadge kind="activity" status={a.status} />
          {cp?.critical && a.status !== "COMPLETED" ? <Badge tone="bad">{t("Critical")}</Badge> : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
            <Pencil size={13} /> {t("Edit")}
          </button>
        </div>
        <TabBar
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "general", label: t("General") },
            { value: "status", label: t("Status") },
            { value: "rel", label: t("Relationships"), count: preds.length + succs.length },
            { value: "res", label: t("Resources"), count: resources.length + supply.length },
            { value: "risk", label: t("Risk") },
          ]}
        />
      </header>
      <div className="pp-pane-body">
        {tab === "general" ? (
          <div className="pp-gen">
            <KeyVals
              cols={3}
              items={[
                { k: t("Activity ID"), v: <span className="k-mono">{a.code}</span> },
                { k: t("Type"), v: a.isMilestone ? t("Milestone") : t("Task dependent") },
                { k: t("Original duration"), v: t("{n} days", { n: origDur(a) }) },
                { k: t("Calendar"), v: calendarName(s.workweek) },
                { k: t("WBS"), v: wbsNode ? `${wbsNode.code} · ${x(wbsNode.name)}` : "—" },
                { k: t("Owner"), v: s.subs.find((z) => z.id === a.owner)?.name ?? (a.owner || "—") },
              ]}
            />
            <div className="pp-gen-facts">
              <Fig label={t("Start")} value={d(a.start)} sub={a.aStart ? t("Actual") : t("Planned")} />
              <Fig label={t("Finish")} value={d(a.end)} sub={a.aEnd ? t("Actual") : t("Forecast")} />
              <Fig label={t("Total float")} value={cp ? t("{n} days", { n: cp.tf }) : "—"} tone={cp?.critical ? "bad" : cp?.near ? "warn" : undefined} />
              <Fig label={t("Baseline finish")} value={d(a.bEnd)} />
              <Fig label={t("Against baseline")} value={v < 0 ? t("{n}d late", { n: -v }) : v > 0 ? t("{n}d early", { n: v }) : t("On baseline")} tone={v < 0 ? "bad" : "ok"} />
            </div>
            {a.blockedReason ? <p className="k-callout k-tone-bad small">{x(a.blockedReason)}</p> : null}
          </div>
        ) : null}

        {tab === "status" ? <StatusTab a={a} /> : null}

        {tab === "rel" ? (
          <div className="pp-rel">
            <RelTable title={t("Predecessors")} rows={preds.map((l) => ({ l, other: s.activities.find((z) => z.id === l.from) }))} onPick={onPick} />
            <RelTable title={t("Successors")} rows={succs.map((l) => ({ l, other: s.activities.find((z) => z.id === l.to) }))} onPick={onPick} />
            <AddPred a={a} />
          </div>
        ) : null}

        {tab === "res" ? (
          <div className="pp-res">
            <div className="pp-supply-head">
              <strong>{t("Material supply")}</strong>
              <div className="pp-supply-strip">
                {(Object.keys(SUPPLY) as SupplyState[]).map((k) => {
                  const n = supply.filter((r) => r.state === k).length;
                  return (
                    <span key={k} className={`pp-supply-seg k-tone-${SUPPLY[k].tone}${n ? "" : " zero"}`}>
                      <b className="num-inline">{n}</b> {t(SUPPLY[k].label)}
                    </span>
                  );
                })}
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`${R.newRequest}?activity=${a.id}`)}>
                <PackagePlus size={14} /> {t("Order material")}
              </button>
            </div>
            {supply.length ? (
              <ul className="pp-supply-list">
                {supply.map((r) => {
                  const share = r.need > 0 ? Math.min(1, r.onSite / r.need) : 0;
                  const ord = r.need > 0 ? Math.min(1 - share, r.onOrder / r.need) : 0;
                  return (
                    <li key={r.key}>
                      <span className="truncate">{r.name ? x(r.name) : r.key}</span>
                      <span className="pp-supply-bar" aria-hidden="true">
                        <i className="on" style={{ width: `${share * 100}%` }} />
                        <i className="ord" style={{ left: `${share * 100}%`, width: `${ord * 100}%` }} />
                      </span>
                      <span className="num-inline muted small">
                        {fmtQty(r.onSite, r.unit)} / {fmtQty(r.need, r.unit)} {unitLabel(r.unit, lang)}
                      </span>
                      <Badge tone={SUPPLY[r.state].tone}>{t(SUPPLY[r.state].label)}</Badge>
                      <span className="k-mono small muted">{r.mrRef ?? "—"}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="k-note">{t("No materials are linked to this activity yet.")}</p>
            )}
            <strong className="pp-sub-h">{t("Resources on this activity")}</strong>
            {resources.length ? (
              <table className="pp-table pp-mini">
                <thead>
                  <tr>
                    <th>{t("ID")}</th>
                    <th>{t("Resource")}</th>
                    <th>{t("Type")}</th>
                    <th className="r">{t("Share of budget")}</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id}>
                      <td className="k-mono">{r.code}</td>
                      <td>{x(r.name)}</td>
                      <td>{t(r.type === "LABOUR" ? "Labour" : r.type === "PLANT" ? "Plant" : "Material")}</td>
                      <td className="r num-inline">
                        {fmtQty(r.budget / Math.max(1, r.activityIds.length), r.unit)} {unitLabel(r.unit, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="k-note">{t("No resources assigned.")}</p>
            )}
          </div>
        ) : null}

        {tab === "risk" ? <RiskTab a={a} /> : null}
      </div>
    </div>
  );
}

function Fig({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="pp-fig">
      <span>{label}</span>
      <strong className={tone ? `k-text-${tone}` : undefined}>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function StatusTab({ a }: { a: Activity }) {
  const { t, d } = useL();
  const logProgress = useOps((s) => s.logProgress);
  const constraint = usePlanExtras((s) => s.constraints[constraintKey(a.id)]) ?? { kind: "NONE" as ConstraintKind, date: null };
  const setConstraint = usePlanExtras((s) => s.setConstraint);
  const [pct, setPct] = useState(a.pct);
  const [note, setNote] = useState("");
  const dirty = pct !== a.pct;
  const save = () => {
    logProgress(a.id, pct, note.trim());
    toast(t("{code} set to {p}%", { code: a.code, p: pct }));
    setNote("");
  };
  return (
    <div className="pp-status">
      <div className="pp-slider">
        <div className="pp-slider-top">
          <span className="k-field-label">{t("% complete")}</span>
          <strong className="num-inline">{pct}%</strong>
        </div>
        <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ ["--v" as string]: `${pct}%` }} aria-label={t("% complete")} disabled={a.status === "COMPLETED"} />
        <div className="pp-slider-row">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Note for the daily report (optional)")} />
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!dirty}>
            <Save size={14} /> {t("Save progress")}
          </button>
        </div>
      </div>
      <KeyVals
        cols={3}
        items={[
          { k: t("Actual start"), v: a.aStart ? d(a.aStart) : t("Not started") },
          { k: t("Actual finish"), v: a.aEnd ? d(a.aEnd) : "—" },
          { k: t("Remaining duration"), v: t("{n} days", { n: remDur(a) }) },
        ]}
      />
      <div className="pp-constraint">
        <label className="k-field">
          <span className="k-field-label">{t("Constraint")}</span>
          <select
            className="input select"
            value={constraint.kind}
            onChange={(e) => {
              const kind = e.target.value as ConstraintKind;
              setConstraint(a.id, { kind, date: kind === "NONE" || kind === "ALAP" ? null : (constraint.date ?? (kind === "SNET" ? a.start : a.end)) });
              toast(t("Constraint saved on {code}", { code: a.code }));
            }}
          >
            {CONSTRAINTS.map((c) => (
              <option key={c.value} value={c.value}>
                {t(c.label)}
              </option>
            ))}
          </select>
        </label>
        {constraint.kind !== "NONE" && constraint.kind !== "ALAP" ? (
          <label className="k-field">
            <span className="k-field-label">{t("Constraint date")}</span>
            <input className="input" type="date" value={constraint.date ?? ""} onChange={(e) => setConstraint(a.id, { ...constraint, date: e.target.value || null })} />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function RelTable({ title, rows, onPick }: { title: string; rows: { l: { id: string; type: LinkType; lag: number }; other: Activity | undefined }[]; onPick: (id: string) => void }) {
  const { t, x, d } = useL();
  const removeLink = useOps((s) => s.removeLink);
  return (
    <div>
      <strong className="pp-sub-h">
        {title} <span className="k-count">{rows.length}</span>
      </strong>
      {rows.length ? (
        <table className="pp-table pp-mini">
          <thead>
            <tr>
              <th>{t("ID")}</th>
              <th>{t("Activity")}</th>
              <th>{t("Link")}</th>
              <th className="r">{t("Lag")}</th>
              <th>{t("Finish")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ l, other }) => (
              <tr key={l.id}>
                <td className="k-mono">
                  {other ? (
                    <button type="button" className="k-link-btn" onClick={() => onPick(other.id)}>
                      {other.code}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="truncate">{other ? x(other.name) : "—"}</td>
                <td>
                  <span className="k-mono pp-ltype">{l.type}</span> {t(LINK_WORDS[l.type])}
                </td>
                <td className="r num-inline">{l.lag ? t("{n}d", { n: l.lag }) : "0"}</td>
                <td className="num-inline">{other ? d(other.end) : "—"}</td>
                <td className="r">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("Remove link")}
                    onClick={() => {
                      removeLink(l.id);
                      toast(t("Link removed"), "muted");
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="k-note">{t("None.")}</p>
      )}
    </div>
  );
}

function AddPred({ a }: { a: Activity }) {
  const { t, x } = useL();
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const addLink = useOps((s) => s.addLink);
  const [from, setFrom] = useState("");
  const [type, setType] = useState<LinkType>("FS");
  const [lag, setLag] = useState(0);
  const options = activities.filter((z) => z.id !== a.id && !links.some((l) => l.from === z.id && l.to === a.id));
  return (
    <div className="pp-addpred">
      <strong className="pp-sub-h">
        <Link2 size={14} /> {t("Add a predecessor")}
      </strong>
      <div className="pp-addpred-row">
        <select className="input select" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("Predecessor")}>
          <option value="">{t("Choose an activity")}</option>
          {options.map((z) => (
            <option key={z.id} value={z.id}>
              {z.code} · {x(z.name)}
            </option>
          ))}
        </select>
        <select className="input select" value={type} onChange={(e) => setType(e.target.value as LinkType)} aria-label={t("Link")}>
          {(Object.keys(LINK_WORDS) as LinkType[]).map((k) => (
            <option key={k} value={k}>
              {k} · {t(LINK_WORDS[k])}
            </option>
          ))}
        </select>
        <input className="input pp-lag" type="number" value={lag} onChange={(e) => setLag(Number(e.target.value) || 0)} aria-label={t("Lag")} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!from}
          onClick={() => {
            addLink(from, a.id, type, lag);
            toast(t("{a} now comes before {b}", { a: activities.find((z) => z.id === from)?.code ?? from, b: a.code }));
            setFrom("");
            setLag(0);
          }}
        >
          <Plus size={14} /> {t("Add")}
        </button>
      </div>
    </div>
  );
}

function RiskTab({ a }: { a: Activity }) {
  const { t, d } = useL();
  const r = riskDays(a);
  const base = a.status === "COMPLETED" ? a.end : a.start > TODAY ? a.start : TODAY;
  const lo = r.best;
  const hi = r.worst;
  const mode = r.likely;
  // Triangular P80.
  const p80 = Math.round(hi - Math.sqrt(0.2 * (hi - lo) * (hi - mode)));
  const X = (v: number) => ((v - lo) / Math.max(1, hi - lo)) * 100;
  const slack = diffDays(addDays(base, p80), a.bEnd);
  return (
    <div className="pp-risk">
      <div className="pp-risk-figs">
        <Fig label={t("Best")} value={t("{n} days", { n: r.best })} sub={d(addDays(base, r.best))} tone="ok" />
        <Fig label={t("Most likely")} value={t("{n} days", { n: r.likely })} sub={d(addDays(base, r.likely))} />
        <Fig label={t("Worst")} value={t("{n} days", { n: r.worst })} sub={d(addDays(base, r.worst))} tone="bad" />
        <Fig label={t("80% sure by")} value={d(addDays(base, p80))} sub={slack < 0 ? t("{n}d after baseline", { n: -slack }) : t("Inside baseline")} tone={slack < 0 ? "warn" : "ok"} />
      </div>
      <svg className="pp-tri" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={`0,32 ${X(mode)},3 100,32`} className="pp-tri-area" />
        <line x1={X(p80)} x2={X(p80)} y1={2} y2={32} className="pp-tri-p80" />
        <line x1={0} x2={100} y1={32} y2={32} className="pp-tri-base" />
      </svg>
      <p className="muted small">{t("Remaining work from {d}. An assumed spread, not read from the file: {a}% best case, +{b}% worst case (+{c}% while blocked).", { d: d(base), a: -Math.round(RISK_SPREAD.best * 100), b: Math.round(RISK_SPREAD.worst * 100), c: Math.round(RISK_SPREAD.blocked * 100) })}</p>
    </div>
  );
}

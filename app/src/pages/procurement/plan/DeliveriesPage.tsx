import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarDays, Clock3, MessageSquarePlus, PhoneCall, Timer, Truck } from "lucide-react";
import { Badge, BarList, Dialog, Empty, Field, FilterChips, FlowRail, PageHero, Panel, Register, SearchBox, StatTiles, Toolbar, toast, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, dowShort, toDate, TODAY } from "../../../ops/dates";
import { cpm, R, type Tone } from "../../../ops/select";
import type { PurchaseOrder } from "../../../ops/types";
import { fmtQty, unitLabel } from "../../../lib/format";
import { dueLines, expectedOf, vendorOnTime, type DueLine } from "./shared";

type Filter = "risk" | "overdue" | "week";

/** Expediting: every open order line against the day the programme needs it, with chasing and vendor on-time records. */
export function DeliveriesPage() {
  const { t, x, d, rel, lang, stamp } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const lines = useMemo(() => dueLines(s), [s]);
  const cp = useMemo(() => cpm(s.activities, s.links), [s.activities, s.links]);
  const vname = (id: string) => s.vendors.find((v) => v.id === id)?.name ?? id;

  const [filter, setFilter] = useState<Filter | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [chase, setChase] = useState<PurchaseOrder | null>(null);
  const [note, setNote] = useState("");
  const [newDate, setNewDate] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // One row per open order for the dumbbell and risk views.
  const perPo = useMemo(() => {
    const map = new Map<string, DueLine[]>();
    for (const l of lines) map.set(l.po.id, [...(map.get(l.po.id) ?? []), l]);
    return [...map.values()].map((ls) => ({ po: ls[0]!.po, lines: ls, expected: ls[0]!.expected, need: ls[0]!.need, act: ls[0]!.act, gap: ls[0]!.gap }));
  }, [lines]);
  const atRisk = perPo.filter((p) => p.gap != null && p.gap > 0).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
  const overdue = lines.filter((l) => l.expected < TODAY);
  const weekEnd = addDays(TODAY, 7);

  const filtered = useMemo(
    () =>
      lines.filter((l) => {
        if (day && l.expected !== day) return false;
        if (filter === "risk") return l.gap != null && l.gap > 0;
        if (filter === "overdue") return l.expected < TODAY;
        if (filter === "week") return l.expected >= TODAY && l.expected <= weekEnd;
        return true;
      }),
    [lines, day, filter, weekEnd],
  );
  const rows = useSearch(filtered, q, (l) => [l.po.ref, vname(l.po.vendorId), l.line.description, l.act?.code, l.act?.name]);

  const openChase = (po: PurchaseOrder) => {
    setChase(po);
    setNote("");
    setNewDate("");
    setErr(null);
  };
  const submitChase = () => {
    if (!chase) return;
    if (!note.trim()) {
      setErr(t("Write what the vendor said."));
      return;
    }
    s.chasePo(chase.id, note.trim(), newDate || null);
    toast(newDate ? t("{po} chased: now due {d}.", { po: chase.ref, d: d(newDate) }) : t("{po} chased. Note added to the log.", { po: chase.ref }), "ok");
    setChase(null);
  };

  const gapBadge = (gap: number | null) => {
    if (gap == null) return <span className="muted">—</span>;
    if (gap > 0) return <Badge tone="bad">{t("{n} d late", { n: gap })}</Badge>;
    if (gap === 0) return <Badge tone="warn">{t("Just in time")}</Badge>;
    return <Badge tone="ok">{t("{n} d early", { n: -gap })}</Badge>;
  };

  const columns: Column<DueLine>[] = [
    {
      key: "po",
      header: t("Order"),
      sort: (l) => l.po.ref,
      render: (l) => (
        <span className="k-cell-title">
          <span className="k-ref">{l.po.ref}</span>
          <small className="truncate">{vname(l.po.vendorId)}</small>
        </span>
      ),
    },
    {
      key: "mat",
      header: t("Material outstanding"),
      sort: (l) => x(l.line.description),
      render: (l) => (
        <span className="k-cell-title">
          <strong className="truncate">{x(l.line.description)}</strong>
          <small className="num-inline">
            {t("{a} {u} of {b}", { a: fmtQty(l.outstanding, l.line.unit), u: unitLabel(l.line.unit, lang), b: fmtQty(l.line.qty, l.line.unit) })}
          </small>
        </span>
      ),
    },
    {
      key: "exp",
      header: t("Expected"),
      sort: (l) => l.expected,
      render: (l) => (
        <span className="k-cell-title">
          <b className={`num-inline${l.expected < TODAY ? " k-text-bad" : ""}`}>{d(l.expected)}</b>
          <small>{rel(l.expected)}</small>
        </span>
      ),
    },
    {
      key: "need",
      header: t("Programme need"),
      sort: (l) => l.need ?? "9",
      render: (l) =>
        l.act && l.need ? (
          <span className="k-cell-title">
            <b className="num-inline">{l.need === TODAY && l.act.start <= TODAY ? t("Now") : d(l.need)}</b>
            <small>
              <button
                type="button"
                className="k-link-btn k-mono"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(R.programme(l.act!.id));
                }}
              >
                {l.act.code}
              </button>
              {l.act.start <= TODAY ? ` · ${t("running")}` : ""}
            </small>
          </span>
        ) : (
          <span className="muted">{t("No link")}</span>
        ),
    },
    { key: "gap", header: t("Gap"), sort: (l) => l.gap ?? -999, align: "right", render: (l) => gapBadge(l.gap) },
    {
      key: "act",
      header: "",
      align: "right",
      render: (l) => (
        <button
          type="button"
          className={`btn btn-sm ${l.gap != null && l.gap > 0 ? "btn-primary" : "btn-ghost"}`}
          onClick={(e) => {
            e.stopPropagation();
            openChase(l.po);
          }}
        >
          <PhoneCall size={13} />
          {t("Chase")}
        </button>
      ),
    },
  ];

  const ontime = useMemo(() => {
    const m = vendorOnTime(s);
    return [...m.entries()]
      .map(([id, r]) => ({ id, ...r, share: r.total ? r.onTime / r.total : 0 }))
      .sort((a, b) => a.share - b.share || b.total - a.total);
  }, [s]);
  const log = s.expedites.slice(0, 8);
  const chaseLog = chase ? s.expedites.filter((e) => e.poId === chase.id) : [];

  return (
    <div className="k-page ppl-page">
      <PageHero
        eyebrow={t("Procurement · Expediting")}
        title={t("Expediting")}
        subtitle={t("Every open order line against the day the programme needs it. Chase the ones that land late before they move the finish date.")}
        flow={["Order", "Expected", "Programme need", "Chase", "Receive"]}
        art="receipt"
        actions={
          <>
            {atRisk[0] ? (
              <button type="button" className="btn btn-primary" onClick={() => openChase(atRisk[0]!.po)}>
                <PhoneCall size={15} />
                {t("Chase {po}", { po: atRisk[0].po.ref })}
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => navigate(R.receipts)}>
              <Truck size={15} />
              {t("Goods receipt")}
            </button>
          </>
        }
      />
      <FlowRail current="receive" />

      <StatTiles
        items={[
          { label: t("Open lines due"), value: lines.length, sub: t("on {n} orders", { n: perPo.length }), tone: "brand", icon: <Truck size={14} />, onClick: () => { setFilter(null); setDay(null); } },
          { label: t("At risk to programme"), value: atRisk.length, sub: t("arrive after the site needs them"), tone: atRisk.length ? "bad" : "ok", icon: <AlertTriangle size={14} />, onClick: () => setFilter(filter === "risk" ? null : "risk") },
          { label: t("Past the PO date"), value: overdue.length, sub: t("lines overdue from the vendor"), tone: overdue.length ? "warn" : "ok", icon: <Clock3 size={14} />, onClick: () => setFilter(filter === "overdue" ? null : "overdue") },
          { label: t("Arriving this week"), value: lines.filter((l) => l.expected >= TODAY && l.expected <= weekEnd).length, sub: t("by {d}", { d: d(weekEnd, false) }), tone: "neutral", icon: <Timer size={14} />, onClick: () => setFilter(filter === "week" ? null : "week") },
        ]}
      />

      <div className="k-grid-2">
        <Panel title={t("Deliveries, next 6 weeks")} icon={<CalendarDays size={16} />} sub={t("Darker days have more orders landing. A red ring means a delivery that day is late for the programme. Click a day to filter.")}>
          <HeatCalendar lines={lines} picked={day} onPick={(v) => setDay(v === day ? null : v)} overdue={overdue.length} onOverdue={() => setFilter(filter === "overdue" ? null : "overdue")} />
        </Panel>
        <Panel title={t("Need vs arrive")} icon={<Timer size={16} />} sub={t("Hollow dot: when the programme needs it. Filled dot: when the vendor will deliver. Red when it arrives after the need.")}>
          {perPo.length ? <Dumbbell rows={perPo.filter((p) => p.need)} vname={vname} onPick={(po) => navigate(R.order(po.id))} /> : <Empty title={t("No open deliveries.")} />}
        </Panel>
      </div>

      <div className="k-grid-2">
        <Panel title={t("At risk to programme")} icon={<AlertTriangle size={16} />} count={atRisk.length}>
          {atRisk.length ? (
            <ul className="ppl-risk">
              {atRisk.map((r) => {
                const c = r.act ? cp.get(r.act.id) : undefined;
                const tf = c ? Math.max(0, c.tf) : 0;
                const hits = (r.gap ?? 0) - tf;
                return (
                  <li key={r.po.id} className="k-rise">
                    <div className="ppl-risk-head">
                      <span className="k-ref">{r.po.ref}</span>
                      <strong className="truncate">{vname(r.po.vendorId)}</strong>
                      <Badge tone="bad">{t("{n} d late", { n: r.gap ?? 0 })}</Badge>
                    </div>
                    <p className="ppl-risk-text">
                      {r.act ? (
                        <>
                          <span className="k-mono">{r.act.code}</span> {x(r.act.name)} · {t("float {n} d", { n: tf })}
                          {c?.critical ? <Badge tone="bad">{t("Critical path")}</Badge> : null}
                        </>
                      ) : null}
                    </p>
                    <div className="ppl-risk-foot">
                      <span className={hits > 0 ? "k-text-bad" : "k-text-warn"}>{hits > 0 ? t("Moves the activity by {n} days", { n: hits }) : t("Absorbed by float for now")}</span>
                      <span className="k-row" style={{ gap: 6 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openChase(r.po)}>
                          <PhoneCall size={13} />
                          {t("Chase vendor")}
                        </button>
                        {r.act ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.programme(r.act!.id))}>
                            {t("Open activity")}
                          </button>
                        ) : null}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            lines.length ? <Empty title={t("Nothing lands late.")}>{t("Every open line arrives before the programme needs it.")}</Empty> : <Empty title={t("No open order lines")}>{t("Lines appear here once a purchase order is issued.")}</Empty>
          )}
        </Panel>
        <Panel title={t("Vendor on-time record")} icon={<Clock3 size={16} />} sub={t("Receipts posted by the PO date, plus balances already past due. 'In full' excludes short or damaged drops.")}>
          {ontime.length ? (
            <BarList
              max={1}
              format={(v) => `${Math.round(v * 100)}%`}
              items={ontime.map((v) => ({
                key: v.id,
                label: vname(v.id),
                sub: t("{a} of {b} on time · {c} in full", { a: v.onTime, b: v.total, c: v.inFull }),
                value: v.share,
                tone: (v.share >= 0.9 ? "ok" : v.share >= 0.6 ? "warn" : "bad") as Tone,
                onClick: () => navigate(R.vendor(v.id)),
              }))}
            />
          ) : (
            <Empty title={t("No deliveries yet.")} />
          )}
        </Panel>
      </div>

      <Register
        rows={rows}
        columns={columns}
        rowKey={(l) => l.key}
        onRowClick={(l) => navigate(R.order(l.po.id))}
        rowClass={(l) => (l.gap != null && l.gap > 0 ? "ppl-row-late" : undefined)}
        initialSort={{ key: "gap", dir: "desc" }}
        toolbar={
          <Toolbar end={<SearchBox value={q} onChange={setQ} placeholder="Search orders, vendors, materials" />}>
            <FilterChips<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "risk", label: t("At risk"), count: lines.filter((l) => l.gap != null && l.gap > 0).length },
                { value: "overdue", label: t("Past the PO date"), count: overdue.length },
                { value: "week", label: t("This week"), count: lines.filter((l) => l.expected >= TODAY && l.expected <= weekEnd).length },
              ]}
            />
            {day ? (
              <button type="button" className="k-chip on" onClick={() => setDay(null)}>
                {d(day)} ×
              </button>
            ) : null}
          </Toolbar>
        }
        empty={t("No open lines match.")}
      />

      <Panel title={t("Chase log")} icon={<MessageSquarePlus size={16} />} count={s.expedites.length}>
        {log.length ? (
          <ol className="ppl-log">
            {log.map((e) => (
              <li key={e.id}>
                <span className="ppl-log-dot" aria-hidden="true" />
                <div>
                  <p>
                    <button type="button" className="k-ref ppl-ref-btn" onClick={() => navigate(R.order(e.poId))}>
                      {e.poId}
                    </button>{" "}
                    {x(e.note)}
                  </p>
                  <small>
                    {e.by} · {stamp(e.at)}
                    {e.newDate ? ` · ${t("new date {d}", { d: d(e.newDate) })}` : ""}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title={t("No chases yet.")} />
        )}
      </Panel>

      <Dialog
        open={!!chase}
        onClose={() => setChase(null)}
        kicker={chase ? `${chase.ref} · ${vname(chase.vendorId)}` : undefined}
        title={t("Chase vendor")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setChase(null)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={submitChase}>
              <PhoneCall size={14} />
              {t("Log the chase")}
            </button>
          </>
        }
      >
        {chase ? (
          <div className="ppl-chase">
            <p className="k-note">
              {t("Now expected {d}.", { d: d(expectedOf(s, chase)) })}{" "}
              {(() => {
                const r = perPo.find((p) => p.po.id === chase.id);
                return r?.act && r.need ? t("{code} needs it {when}.", { code: r.act.code, when: r.need <= TODAY ? t("now") : d(r.need) }) : "";
              })()}
            </p>
            <Field label={t("What did the vendor say?")} wide error={err}>
              <textarea className="input" rows={3} value={note} onChange={(e) => { setNote(e.target.value); setErr(null); }} placeholder={t("e.g. Truck leaves the plant Thursday morning")} />
            </Field>
            <Field label={t("New promised date (optional)")} hint={t("Moves the PO's expected date.")}>
              <input className="input" type="date" min={TODAY} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </Field>
            {chaseLog.length ? (
              <div className="ppl-chase-log">
                <span className="muted small">{t("Earlier chases")}</span>
                {chaseLog.map((e) => (
                  <p key={e.id}>
                    <b>{stamp(e.at)}</b> {x(e.note)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

/** Six-week calendar of deliveries per day, starting on the Monday of this week. */
function HeatCalendar({ lines, picked, onPick, overdue, onOverdue }: { lines: DueLine[]; picked: string | null; onPick: (d: string) => void; overdue: number; onOverdue: () => void }) {
  const { t, d, lang } = useL();
  const start = addDays(TODAY, -((toDate(TODAY).getUTCDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDay = new Map<string, { pos: Set<string>; late: boolean }>();
  const needs = new Set(lines.map((l) => l.need).filter((v): v is string => !!v && v > TODAY));
  for (const l of lines) {
    const r = byDay.get(l.expected) ?? { pos: new Set<string>(), late: false };
    r.pos.add(l.po.id);
    if (l.gap != null && l.gap > 0) r.late = true;
    byDay.set(l.expected, r);
  }
  // At least three per day for the darkest shade, so a single truck reads as light.
  const max = Math.max(3, ...[...byDay.values()].map((v) => v.pos.size));
  return (
    <div className="ppl-heat">
      <div className="ppl-heat-grid">
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <span key={w} className="ppl-heat-dow">
            {dowShort(w, lang)}
          </span>
        ))}
        {days.map((day, i) => {
          const r = byDay.get(day);
          const n = r?.pos.size ?? 0;
          const past = day < TODAY;
          const lvl = n ? Math.ceil((n / max) * 3) : 0;
          return (
            <button
              key={day}
              type="button"
              className={`ppl-heat-cell lvl-${lvl}${past ? " past" : ""}${day === TODAY ? " today" : ""}${r?.late ? " late" : ""}${picked === day ? " on" : ""}`}
              disabled={past || !n}
              onClick={() => onPick(day)}
              title={n ? t("{d}: {n} deliveries", { d: d(day), n }) : d(day)}
              style={{ animationDelay: `${i * 8}ms` }}
            >
              <span>{toDate(day).getUTCDate()}</span>
              {n ? <b className="num-inline">{n}</b> : null}
              {needs.has(day) ? <i className="ppl-heat-need" title={t("A programme activity needs material")} /> : null}
            </button>
          );
        })}
      </div>
      <div className="ppl-heat-foot">
        <span className="ppl-heat-scale">
          {t("Fewer")}
          <i className="lvl-1" />
          <i className="lvl-2" />
          <i className="lvl-3" />
          {t("Many")}
        </span>
        <span className="ppl-heat-key">
          <i className="ppl-heat-need" /> {t("Need date")}
        </span>
        {overdue ? (
          <button type="button" className="k-chip ppl-overdue-chip" onClick={onOverdue}>
            {t("Overdue")} <b className="num-inline">{overdue}</b>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Need vs arrive per order: a dumbbell on a shared date axis. */
function Dumbbell({ rows, vname, onPick }: { rows: { po: PurchaseOrder; expected: string; need: string | null; gap: number | null }[]; vname: (id: string) => string; onPick: (po: PurchaseOrder) => void }) {
  const { t, d } = useL();
  const dates = rows.flatMap((r) => [r.expected, r.need ?? r.expected, TODAY]);
  // Window of at most two weeks back and eight weeks ahead; dates outside it pin to the edge.
  const lo = addDays(dates.reduce((a, b) => (a < b ? a : b), TODAY), -3);
  const hi = addDays(dates.reduce((a, b) => (a > b ? a : b), TODAY), 3);
  const from = lo < addDays(TODAY, -14) ? addDays(TODAY, -14) : lo;
  const to = hi > addDays(TODAY, 56) ? addDays(TODAY, 56) : hi;
  const span = Math.max(1, diffDays(from, to));
  const X = (date: string) => Math.max(0, Math.min(100, (diffDays(from, date) / span) * 100));
  const clip = (date: string) => date < from || date > to;
  const ticks: string[] = [];
  const stepDays = 7 * Math.max(1, Math.ceil(span / 7 / 5));
  for (let w = from; w <= to; w = addDays(w, stepDays)) ticks.push(w);
  const sorted = [...rows].sort((a, b) => (a.need ?? "").localeCompare(b.need ?? ""));
  return (
    <div className="ppl-db">
      <div className="ppl-db-axis">
        <span />
        <span className="ppl-db-track">
          {ticks.map((w) => (
            <small key={w} style={{ left: `${X(w)}%` }}>
              {d(w, false)}
            </small>
          ))}
        </span>
      </div>
      {sorted.map((r, i) => {
        const late = r.gap != null && r.gap > 0;
        const a = X(r.need ?? r.expected);
        const b = X(r.expected);
        return (
          <button key={r.po.id} type="button" className={`ppl-db-row${late ? " late" : ""}`} onClick={() => onPick(r.po)} title={`${r.po.ref} · ${vname(r.po.vendorId)}`} style={{ animationDelay: `${i * 40}ms` }}>
            <span className="ppl-db-label">
              <b className="k-mono">{r.po.ref}</b>
              <small className="truncate">{vname(r.po.vendorId)}</small>
            </span>
            <span className="ppl-db-track">
              <i className="ppl-db-today" style={{ left: `${X(TODAY)}%` }} />
              <i className="ppl-db-bar" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }} />
              <i className={`ppl-db-need${r.need && clip(r.need) ? " clip" : ""}`} style={{ left: `${a}%` }} title={t("Needed {d}", { d: d(r.need) })} />
              <i className={`ppl-db-arrive${clip(r.expected) ? " clip" : ""}`} style={{ left: `${b}%` }} title={t("Arrives {d}", { d: d(r.expected) })} />
            </span>
          </button>
        );
      })}
      <div className="k-legend">
        <span className="ppl-lg ppl-lg-need">{t("Needed")}</span>
        <span className="ppl-lg ppl-lg-arrive">{t("Arrives")}</span>
        <span className="ppl-lg ppl-lg-arrive-late">{t("Arrives late")}</span>
        <span className="lg-today">{t("Today")}</span>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Database, ListChecks, Save, Send, Workflow } from "lucide-react";
import { Field, LineItemsEditor, newDraftLine, PageHero, Panel, toast, useL, type DraftLine } from "../../../components/kit";
import { ME, useOps } from "../../../ops/store";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { budgetOf, R, statusMeta, TRADES, tradeName } from "../../../ops/select";
import { buildingShort } from "../../../lib/loc";
import { fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import { data } from "../../../data";
import type { Activity, Material, MaterialRequest, Priority, Trade } from "../../../ops/types";
import { BUILDINGS, tradeLeadDays } from "./shared";

const PRIORITIES: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

/** BOQ quantities of one building, grouped by rate key, optionally limited to a trade or a BOQ section. */
function boqLines(materials: Material[], building: string, filter: { trade?: Trade; section?: string }, limit = 8): DraftLine[] {
  const byRate = new Map<string, number>();
  for (const it of data.items) {
    if (it.building !== building) continue;
    if (filter.section && it.section !== filter.section) continue;
    const rate = data.rates[it.rate];
    if (!rate) continue;
    if (filter.trade && rate.group !== filter.trade) continue;
    byRate.set(it.rate, (byRate.get(it.rate) ?? 0) + it.qty);
  }
  return [...byRate.entries()]
    .map(([key, qty]) => ({ m: materials.find((x) => x.key === key), qty }))
    .filter((r): r is { m: Material; qty: number } => !!r.m && r.qty > 0)
    .sort((a, b) => b.qty * b.m.rate - a.qty * a.m.rate)
    .slice(0, limit)
    .map(({ m, qty }) => ({ ...newDraftLine(m), qty: Math.round(qty * 100) / 100 }));
}

/** Most valuable trade among a set of lines. */
function mainTrade(materials: Material[], lines: DraftLine[]): Trade | null {
  const sum = new Map<Trade, number>();
  for (const l of lines) {
    const m = materials.find((x) => x.key === l.material);
    if (m) sum.set(m.trade, (sum.get(m.trade) ?? 0) + m.rate * l.qty);
  }
  return [...sum.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function RequestNewPage() {
  const { t, x, d, rel, lang } = useL();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const materials = useOps((s) => s.materials);
  const activities = useOps((s) => s.activities);
  const vendors = useOps((s) => s.vendors);
  const seq = useOps((s) => s.seq);
  const createMr = useOps((s) => s.createMr);

  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [neededBy, setNeededBy] = useState(addDays(TODAY, 14));
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [building, setBuilding] = useState("WH");
  const [trade, setTrade] = useState<Trade>("Concrete");
  const [activityId, setActivityId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<MaterialRequest["source"]>("MANUAL");
  const [boqBuilding, setBoqBuilding] = useState("WH");
  const [boqTrade, setBoqTrade] = useState<Trade>("Steel");
  const [progAct, setProgAct] = useState("");
  const [filled, setFilled] = useState<string | null>(null);

  const upcoming = useMemo(
    () => activities.filter((a) => a.status !== "COMPLETED" && a.end >= TODAY && !a.isMilestone).sort((a, b) => a.start.localeCompare(b.start)),
    [activities],
  );

  const fromActivity = (a: Activity) => {
    const ls = a.section ? boqLines(materials, a.building, { section: a.section }, 6) : [];
    const tr = mainTrade(materials, ls);
    setActivityId(a.id);
    setBuilding(a.building);
    if (tr) setTrade(tr);
    setLines(ls);
    setTitle(`${x(a.name)} (${a.code})`);
    const need = addDays(a.start, -7);
    setNeededBy(need > addDays(TODAY, 3) ? need : addDays(TODAY, 7));
    setPriority(a.priority === "CRITICAL" ? "URGENT" : a.priority === "HIGH" ? "HIGH" : "MEDIUM");
    setSource("PROGRAMME");
    setProgAct(a.id);
    setFilled(ls.length ? t("Filled {n} lines from {code}.", { n: ls.length, code: a.code }) : t("{code} has no BOQ materials; add lines by hand.", { code: a.code }));
  };

  // ?activity=<id> prefills from the programme.
  useEffect(() => {
    const id = params.get("activity");
    const a = id ? activities.find((x2) => x2.id === id || x2.code === id) : undefined;
    if (a) fromActivity(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fromBoq = () => {
    const ls = boqLines(materials, boqBuilding, { trade: boqTrade });
    setLines(ls);
    setBuilding(boqBuilding);
    setTrade(boqTrade);
    setSource("BOQ");
    if (!title.trim()) setTitle(`${tradeName(boqTrade, lang)} · ${buildingShort(boqBuilding, lang)}`);
    setFilled(ls.length ? t("Filled {n} lines from the BOQ.", { n: ls.length }) : t("The BOQ has no {trade} items for this building.", { trade: tradeName(boqTrade, lang) }));
  };

  const lead = tradeLeadDays(vendors, trade);
  const safeDate = lead != null ? addDays(TODAY, lead + 7) : null;
  const tight = safeDate != null && neededBy < safeDate;
  const value = budgetOf({ materials }, lines);
  const act = activityId ? activities.find((a) => a.id === activityId) : undefined;
  const nextRef = `MR-${String((seq.MR ?? 0) + 1).padStart(4, "0")}`;

  const missing: string[] = [];
  if (!title.trim()) missing.push(t("A title"));
  if (!lines.length) missing.push(t("At least one line"));
  else if (lines.some((l) => !(l.qty > 0))) missing.push(t("A quantity on every line"));
  else if (lines.some((l) => !l.material && !l.description.en.trim())) missing.push(t("A description on every line"));
  if (!neededBy) missing.push(t("A needed-by date"));
  else if (neededBy < TODAY) missing.push(t("A needed-by date in the future"));

  const save = (submit: boolean) => {
    if (submit && missing.length) {
      toast(t("Still missing: {list}", { list: missing.join(", ").toLowerCase() }), "warn");
      return;
    }
    if (!title.trim()) {
      toast(t("Give the request a title first."), "warn");
      return;
    }
    const id = createMr(
      {
        title: title.trim(),
        priority,
        trade,
        building,
        activityId,
        neededBy,
        notes: notes.trim(),
        source,
        lines: lines.map(({ id: _id, ...l }) => ({ ...l, description: l.description.en.trim() || l.description.az.trim() ? l.description : { en: "—", az: "—" } })),
      },
      submit,
    );
    toast(submit ? t("{ref} submitted to procurement", { ref: id }) : t("{ref} saved as draft", { ref: id }));
    navigate(R.request(id));
  };

  const quick = [
    { label: "1 week", days: 7 },
    { label: "2 weeks", days: 14 },
    { label: "1 month", days: 30 },
  ];
  const pMeta = statusMeta("priority", priority);

  return (
    <div className="k-page ps-page">
      <PageHero
        eyebrow={t("Procurement · New request")}
        title={t("New material request")}
        subtitle={t("Say what the site needs and by when. Start from the BOQ or the programme so quantities match the bill.")}
        flow={["Describe", "Check against the BOQ", "Submit", "Procurement sends the RFQ"]}
        art="request"
        back={{ to: R.requests, label: "Material requests" }}
      />

      <div className="k-grid-main ps-new">
        <div className="k-stack">
          <Panel title={t("Start from")} icon={<Workflow size={15} />} sub={t("Fill the lines from the bill of quantities or from an upcoming programme activity. You can edit everything after.")}>
            <div className="ps-starts">
              <div className="ps-start">
                <span className="ps-start-icon">
                  <Database size={16} />
                </span>
                <strong>{t("Start from the BOQ")}</strong>
                <div className="ps-start-row">
                  <select className="input select" value={boqBuilding} onChange={(e) => setBoqBuilding(e.target.value)} aria-label={t("Building")}>
                    {BUILDINGS.map((b) => (
                      <option key={b} value={b}>
                        {buildingShort(b, lang)}
                      </option>
                    ))}
                  </select>
                  <select className="input select" value={boqTrade} onChange={(e) => setBoqTrade(e.target.value as Trade)} aria-label={t("Trade")}>
                    {TRADES.map((tr) => (
                      <option key={tr} value={tr}>
                        {tradeName(tr, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={fromBoq}>
                  {t("Fill from the BOQ")}
                </button>
              </div>
              <div className="ps-start">
                <span className="ps-start-icon">
                  <CalendarClock size={16} />
                </span>
                <strong>{t("Start from the programme")}</strong>
                <select
                  className="input select"
                  value={progAct}
                  aria-label={t("Upcoming activity")}
                  onChange={(e) => {
                    const a = activities.find((x2) => x2.id === e.target.value);
                    if (a) fromActivity(a);
                    else setProgAct("");
                  }}
                >
                  <option value="">{t("Pick an upcoming activity…")}</option>
                  {upcoming.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {x(a.name)} · {d(a.start, false)}
                    </option>
                  ))}
                </select>
                <small className="muted">{t("Suggests the BOQ materials of the activity's section.")}</small>
              </div>
            </div>
            {filled ? (
              <p className="ps-filled k-rise">
                <CheckCircle2 size={14} />
                {filled}
              </p>
            ) : null}
          </Panel>

          <Panel title={t("What is needed")} icon={<ClipboardList size={15} />} count={lines.length || undefined}>
            <div className="k-stack" style={{ gap: 14 }}>
              <Field label={t("Title")}>
                <input className="input" value={title} placeholder={t("e.g. Rebar for admin first-floor slab")} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <div className="ps-lines-scroll">
                <LineItemsEditor lines={lines} onChange={setLines} trade={trade} />
              </div>
            </div>
          </Panel>

          <Panel title={t("When and where")} icon={<CalendarClock size={15} />}>
            <div className="k-form">
              <Field label={t("Needed on site by")} hint={neededBy ? rel(neededBy) : undefined}>
                <input className="input" type="date" value={neededBy} min={TODAY} onChange={(e) => setNeededBy(e.target.value)} />
                <div className="k-quick">
                  {quick.map((q) => {
                    const v = addDays(TODAY, q.days);
                    return (
                      <button key={q.days} type="button" className={neededBy === v ? "on" : undefined} onClick={() => setNeededBy(v)}>
                        {t(q.label)}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label={t("Priority")}>
                <div className="ps-seg" role="group" aria-label={t("Priority")}>
                  {PRIORITIES.map((p) => (
                    <button key={p} type="button" className={`ps-seg-btn p-${p}${priority === p ? " on" : ""}`} aria-pressed={priority === p} onClick={() => setPriority(p)}>
                      {x(statusMeta("priority", p).label)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t("Building")}>
                <select className="input select" value={building} onChange={(e) => setBuilding(e.target.value)}>
                  {BUILDINGS.map((b) => (
                    <option key={b} value={b}>
                      {buildingShort(b, lang)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Trade")}>
                <select className="input select" value={trade} onChange={(e) => setTrade(e.target.value as Trade)}>
                  {TRADES.map((tr) => (
                    <option key={tr} value={tr}>
                      {tradeName(tr, lang)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("For programme activity")} wide>
                <select className="input select" value={activityId ?? ""} onChange={(e) => setActivityId(e.target.value || null)}>
                  <option value="">{t("Not linked")}</option>
                  {upcoming.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {x(a.name)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Note for procurement")} wide>
                <textarea className="input" value={notes} placeholder={t("Access, delivery windows, grades, anything the buyer should know")} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
            {lead != null ? (
              <div className={`k-callout ${tight ? "k-tone-warn" : "k-tone-brand"}`} style={{ marginTop: 14 }}>
                {tight ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                <span>
                  {t("{trade} vendors deliver in about {n} days on average, plus about a week for quotes.", { trade: tradeName(trade, lang), n: lead })}{" "}
                  {tight ? <b>{t("The earliest safe date is {date}.", { date: d(safeDate!) })}</b> : t("This date leaves enough time.")}
                </span>
              </div>
            ) : null}
          </Panel>

          <div className="ps-actions">
            <button type="button" className="btn btn-ghost" onClick={() => save(false)}>
              <Save size={15} />
              {t("Save as draft")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => save(true)}>
              <Send size={15} />
              {t("Submit to procurement")}
            </button>
          </div>
        </div>

        <aside className="ps-ticket-wrap">
          <div className="ps-ticket" aria-label={t("Request ticket preview")}>
            <header className="ps-ticket-head">
              <span className="ps-ticket-kicker">{t("Material request")}</span>
              <span className="k-ref">{nextRef}</span>
              <span className={`ps-ticket-prio k-tone-${pMeta.tone}`}>{x(pMeta.label)}</span>
            </header>
            <h3 className={title.trim() ? undefined : "ps-ph"}>{title.trim() || t("Untitled request")}</h3>
            <dl className="ps-ticket-kv">
              <div>
                <dt>{t("Building")}</dt>
                <dd>{buildingShort(building, lang)}</dd>
              </div>
              <div>
                <dt>{t("Trade")}</dt>
                <dd>{tradeName(trade, lang)}</dd>
              </div>
              <div>
                <dt>{t("Needed by")}</dt>
                <dd className={neededBy && neededBy < TODAY ? "k-text-bad" : undefined}>
                  {neededBy ? d(neededBy) : "—"}
                  {neededBy ? <small>{t("{n} days from today", { n: diffDays(TODAY, neededBy) })}</small> : null}
                </dd>
              </div>
              <div>
                <dt>{t("Activity")}</dt>
                <dd>{act ? act.code : "—"}</dd>
              </div>
            </dl>
            <ol className="ps-ticket-lines">
              {lines.length ? (
                lines.map((l) => (
                  <li key={l.id}>
                    <span className="truncate">{x(l.description) || t("Unnamed line")}</span>
                    <b className={`num-inline${l.qty > 0 ? "" : " k-text-bad"}`}>
                      {l.qty > 0 ? fmtQty(l.qty, l.unit) : "?"} {unitLabel(l.unit, lang)}
                    </b>
                  </li>
                ))
              ) : (
                <li className="ps-ph">{t("No lines yet")}</li>
              )}
            </ol>
            <div className="ps-ticket-total">
              <span>{t("BOQ value")}</span>
              <b className="num-inline">≈ {fmtMoneyShort(value)} AZN</b>
            </div>
            <div className="ps-perf" aria-hidden="true" />
            <div className="ps-ticket-foot">
              {missing.length ? (
                <>
                  <span className="ps-ticket-miss">
                    <ListChecks size={14} />
                    {t("Still missing")}
                  </span>
                  <ul>
                    {missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <span className="ps-ticket-ready">
                  <CheckCircle2 size={15} />
                  {t("Ready to submit")}
                </span>
              )}
              <small>
                {t("Requested by {name}", { name: ME })} · {d(TODAY)}
              </small>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

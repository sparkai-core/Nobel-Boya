import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, ChevronRight, Cloud, CloudRain, FilePlus2, HardHat, Image as ImageIcon, Package, Plus, Printer, Send, Sun, Thermometer, Truck, Wind, X as XIcon } from "lucide-react";
import { Badge, Empty, Field, PageHero, Panel, StatusSteps, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { dowShort, monthLong, same, toDate, TODAY } from "../../../ops/dates";
import { PATHS, R, statusMeta } from "../../../ops/select";
import { sheetImage } from "../../../data";
import { rateName } from "../../../ops/seed/util";
import { fmtQty, unitLabel } from "../../../lib/format";
import type { DailyReport, PlantStatus, Weather } from "../../../ops/types";
import { DelayDialog, type DelayDraft } from "./DelayDialog";
import { plannedPctAt } from "./shared";

const WEATHER_ICON: Record<Weather, typeof Sun> = { SUNNY: Sun, CLOUDY: Cloud, RAIN: CloudRain, WIND: Wind };
const WEATHER_LABEL: Record<Weather, string> = { SUNNY: "Sunny", CLOUDY: "Cloudy", RAIN: "Rain", WIND: "Wind" };
const PLANT: PlantStatus[] = ["WORKING", "IDLE", "STANDBY", "BROKEN_DOWN"];
const PLANT_LABEL: Record<PlantStatus, string> = { WORKING: "Working", IDLE: "Idle", STANDBY: "Standby", BROKEN_DOWN: "Broken down" };
const PLANT_TONE: Record<PlantStatus, "ok" | "muted" | "warn" | "bad"> = { WORKING: "ok", IDLE: "muted", STANDBY: "warn", BROKEN_DOWN: "bad" };
const SEVERITIES: DailyReport["blockers"][number]["severity"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const MONTHS = ["2026-10", "2026-11"];

export function DailyReportsPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const reports = useOps((s) => s.reports);
  const calendar = useOps((s) => s.calendar);
  const saveReport = useOps((s) => s.saveReport);

  const byDate = useMemo(() => new Map(reports.map((r) => [r.date, r])), [reports]);
  const report = reports.find((r) => r.id === id) ?? (id ? undefined : (byDate.get(TODAY) ?? reports[reports.length - 1]));
  const pickedDate = report?.date ?? (id?.startsWith("DR-") ? id.slice(3) : TODAY);

  const startToday = () => {
    const last = reports[reports.length - 1];
    saveReport({
      id: `DR-${TODAY}`,
      date: TODAY,
      status: "DRAFT",
      author: last?.author ?? "",
      weather: "CLOUDY",
      tempC: last?.tempC ?? 12,
      conditions: last?.conditions ?? same(""),
      entries: [],
      labour: last?.labour ?? [],
      plant: last?.plant ?? [],
      materials: [],
      blockers: (last?.blockers ?? []).filter((b) => b.status === "OPEN"),
      photos: [],
      notes: null,
    });
    navigate(R.report(`DR-${TODAY}`));
    toast(t("Today's report started"));
  };

  const counts = useMemo(() => reports.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}), [reports]);

  return (
    <div className="k-page pmc">
      <PageHero
        eyebrow={t("Project management · Daily reports")}
        title={t("Daily reports")}
        subtitle={t("What happened on site each day: work done, people and plant, deliveries, blockers and photos, signed off by the project manager.")}
        flow={["Draft on site", "Send for approval", "Approved"]}
        art="report"
        actions={
          byDate.get(TODAY) ? (
            <button type="button" className="btn btn-primary" onClick={() => navigate(R.report(`DR-${TODAY}`))}>
              {t("Open today's report")}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={startToday}>
              <FilePlus2 size={15} />
              {t("Start today's report")}
            </button>
          )
        }
      />

      <div className="pmc-dr">
        <aside className="pmc-cal-col">
          {MONTHS.map((m) => (
            <MonthGrid key={m} month={m} picked={pickedDate} byDate={byDate} holidays={calendar} onPick={(r) => navigate(R.report(r.id))} />
          ))}
          <ul className="pmc-cal-key">
            {(["APPROVED", "SUBMITTED", "DRAFT", "REJECTED"] as const).map((st) => (
              <li key={st}>
                <i className={`pmc-dot s-${st.toLowerCase()}`} />
                {x(statusMeta("report", st).label)}
                <b className="num-inline">{counts[st] ?? 0}</b>
              </li>
            ))}
          </ul>
        </aside>

        <div className="pmc-dr-main">
          {report ? (
            <ReportDoc key={report.id} report={report} />
          ) : (
            <Panel>
              <Empty icon={<FilePlus2 size={20} />} title={t("No report for {date}", { date: d(pickedDate) })} action={pickedDate === TODAY ? <button type="button" className="btn btn-primary" onClick={startToday}>{t("Start today's report")}</button> : undefined}>
                {toDate(pickedDate).getUTCDay() === 0 ? t("Sundays are not working days.") : t("The site did not file a report that day.")}
              </Empty>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ month, picked, byDate, holidays, onPick }: { month: string; picked: string; byDate: Map<string, DailyReport>; holidays: { date: string; name: { en: string; az: string } }[]; onPick: (r: DailyReport) => void }) {
  const { lang, x } = useL();
  const first = toDate(`${month}-01`);
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <section className="pmc-cal">
      <h3>
        {monthLong(m, lang)} {y}
      </h3>
      <div className="pmc-cal-grid">
        {[1, 2, 3, 4, 5, 6, 0].map((dw) => (
          <span key={dw} className="pmc-cal-dow">{dowShort(dw, lang)}</span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`e${i}`} />;
          const r = byDate.get(c);
          const hol = holidays.find((h) => h.date === c);
          const future = c > TODAY;
          return (
            <button
              key={c}
              type="button"
              className={`pmc-cal-day${c === picked ? " on" : ""}${c === TODAY ? " today" : ""}${r ? "" : " none"}${future ? " future" : ""}`}
              disabled={!r}
              title={hol ? x(hol.name) : r ? x(statusMeta("report", r.status).label) : undefined}
              onClick={() => r && onPick(r)}
            >
              <span className="num-inline">{Number(c.slice(8))}</span>
              {r ? <i className={`pmc-dot s-${r.status.toLowerCase()}`} /> : hol ? <i className="pmc-dot hol" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReportDoc({ report }: { report: DailyReport }) {
  const { t, x, d, lang } = useL();
  const activities = useOps((s) => s.activities);
  const materials = useOps((s) => s.materials);
  const rfis = useOps((s) => s.rfis);
  const saveReport = useOps((s) => s.saveReport);
  const setReportStatus = useOps((s) => s.setReportStatus);
  const logProgress = useOps((s) => s.logProgress);
  const editable = report.date === TODAY && report.status === "DRAFT";
  const act = (id: string) => activities.find((a) => a.id === id);
  const W = WEATHER_ICON[report.weather];

  const [delayFor, setDelayFor] = useState<DelayDraft | null>(null);
  const live = activities.filter((a) => a.status === "IN_PROGRESS" || a.status === "BLOCKED").sort((a, b) => a.code.localeCompare(b.code));
  const [entryAct, setEntryAct] = useState(live[0]?.id ?? "");
  const entryA = act(entryAct);
  const [entryPct, setEntryPct] = useState(entryA ? Math.min(100, entryA.pct + 3) : 0);
  const [entryQty, setEntryQty] = useState(0);
  const [entryUnit, setEntryUnit] = useState("m³");
  const [entryNote, setEntryNote] = useState("");
  const [labTrade, setLabTrade] = useState("");
  const [labCount, setLabCount] = useState(4);
  const [blkText, setBlkText] = useState("");
  const [blkSev, setBlkSev] = useState<DailyReport["blockers"][number]["severity"]>("MEDIUM");
  const [blkOwner, setBlkOwner] = useState("");
  const [blkDue, setBlkDue] = useState(TODAY);
  const [notes, setNotes] = useState(report.notes ? x(report.notes) : "");

  const fresh = () => useOps.getState().reports.find((r) => r.id === report.id) ?? report;

  const addEntry = () => {
    const a = act(entryAct);
    if (!a) return;
    logProgress(a.id, entryPct, entryNote.trim());
    const r = fresh();
    const over = entryPct > plannedPctAt(a, TODAY);
    saveReport({ ...r, entries: r.entries.map((e) => (e.activityId === a.id ? { ...e, qty: entryQty, unit: entryQty > 0 ? entryUnit : "%", over, zone: e.zone } : e)) });
    toast(t("{code} logged at {n}%. Programme, S-curve and health updated.", { code: a.code, n: entryPct }));
    setEntryNote("");
    setEntryQty(0);
  };
  const addLabour = () => {
    if (!labTrade.trim() || labCount <= 0) return;
    const r = fresh();
    const found = r.labour.find((l) => x(l.trade).toLowerCase() === labTrade.trim().toLowerCase());
    saveReport({ ...r, labour: found ? r.labour.map((l) => (l === found ? { ...l, count: l.count + labCount } : l)) : [...r.labour, { trade: same(labTrade.trim()), count: labCount }] });
    toast(t("{n} people added", { n: labCount }));
    setLabTrade("");
  };
  const addBlocker = () => {
    if (!blkText.trim()) return;
    const r = fresh();
    saveReport({ ...r, blockers: [...r.blockers, { text: same(blkText.trim()), severity: blkSev, owner: blkOwner.trim() || "—", due: blkDue, status: "OPEN" }] });
    toast(t("Blocker added"), "warn");
    setBlkText("");
    setBlkOwner("");
  };
  const saveNotes = () => {
    saveReport({ ...fresh(), notes: notes.trim() ? same(notes.trim()) : null });
    toast(t("Notes saved"));
  };
  const cyclePlant = (i: number) => {
    if (!editable) return;
    const r = fresh();
    saveReport({ ...r, plant: r.plant.map((p, j) => (j === i ? { ...p, status: PLANT[(PLANT.indexOf(p.status) + 1) % PLANT.length]! } : p)) });
  };
  const clearBlocker = (i: number) => {
    const r = fresh();
    saveReport({ ...r, blockers: r.blockers.map((b, j) => (j === i ? { ...b, status: "RESOLVED" } : b)) });
    toast(t("Blocker cleared"));
  };
  const status = (st: DailyReport["status"], msg: string) => {
    setReportStatus(report.id, st);
    toast(msg, st === "REJECTED" ? "bad" : "ok");
  };

  const raise = (b: DailyReport["blockers"][number]) => {
    const text = x(b.text);
    const code = text.match(/\b[A-Z]{1,3}-\d{3}\b/)?.[0];
    const rfi = text.match(/RFI-\d{4}/)?.[0];
    const aid = (code && activities.find((a) => a.code === code)?.id) || (rfi && rfis.find((r) => r.id === rfi)?.activityId) || report.entries[0]?.activityId;
    setDelayFor({ title: text, activityId: aid ?? undefined, cause: rfi ? "RFI" : "SITE_CONDITION", startedAt: report.date, notes: t("Raised from the daily report of {date}.", { date: d(report.date) }), party: b.owner });
  };

  const people = report.labour.reduce((a, l) => a + l.count, 0);
  const matName = (key: string) => {
    const m = materials.find((v) => v.key === key);
    return m ? x(m.name) : x(rateName(key));
  };

  return (
    <article className="pmc-doc k-rise">
      <header className="pmc-doc-head">
        <div>
          <span className="k-eyebrow">{t("Daily site report")}</span>
          <h2>{d(report.date)}</h2>
          <p className="muted small">
            {t("Filed by {name}", { name: report.author })} · {report.id}
          </p>
        </div>
        <div className="pmc-doc-actions">
          {report.status === "DRAFT" ? (
            <button type="button" className="btn btn-primary" onClick={() => status("SUBMITTED", t("Report sent for approval"))}>
              <Send size={15} />
              {t("Submit for approval")}
            </button>
          ) : report.status === "SUBMITTED" ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => status("APPROVED", t("Report approved"))}>
                <Check size={15} />
                {t("Approve")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => status("REJECTED", t("Report sent back"))}>
                <XIcon size={15} />
                {t("Reject")}
              </button>
            </>
          ) : report.status === "REJECTED" ? (
            <button type="button" className="btn btn-ghost" onClick={() => status("DRAFT", t("Report back in draft"))}>
              {t("Back to draft")}
            </button>
          ) : (
            <span className="k-stamp-mark pmc-stamp">{t("Approved")}</span>
          )}
          <button type="button" className="icon-btn" onClick={() => window.print()} aria-label={t("Print")} title={t("Print")}>
            <Printer size={17} />
          </button>
        </div>
      </header>
      <StatusSteps kind="report" path={PATHS.report} status={report.status === "REJECTED" ? "SUBMITTED" : report.status} rejected={report.status === "REJECTED"} />

      <section className="pmc-doc-wx">
        <span className="pmc-wx">
          <W size={26} />
          <span>
            <strong>{t(WEATHER_LABEL[report.weather])}</strong>
            <small>
              <Thermometer size={12} /> {report.tempC}°C
            </small>
          </span>
        </span>
        <span className="pmc-doc-cond">
          <small>{t("Site conditions")}</small>
          <span>{x(report.conditions) || "—"}</span>
        </span>
        <span className="pmc-doc-cond">
          <small>{t("On site")}</small>
          <span className="num-inline">{t("{n} people", { n: people })}</span>
        </span>
      </section>

      <section className="pmc-doc-sec">
        <h3>{t("Work done today")}</h3>
        {report.entries.length ? (
          <table className="pmc-doc-table">
            <thead>
              <tr>
                <th>{t("Activity")}</th>
                <th className="hide-700">{t("Zone")}</th>
                <th>{t("Work")}</th>
                <th className="r">{t("Qty")}</th>
                <th>{t("Progress")}</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((e, i) => {
                const a = act(e.activityId);
                return (
                  <tr key={i}>
                    <td>
                      {a ? (
                        <Link to={R.programme(a.id)} className="pmc-code">{a.code}</Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hide-700 muted">{e.zone}</td>
                    <td>
                      {x(e.text)} {e.over ? <Badge tone="brand">{t("Over plan")}</Badge> : null}
                    </td>
                    <td className="r num-inline">{e.qty > 0 ? `${fmtQty(e.qty, e.unit)} ${unitLabel(e.unit, lang)}` : "—"}</td>
                    <td>
                      <span className="pmc-doc-pct">
                        <span><i style={{ width: `${e.pct}%` }} /></span>
                        <b className="num-inline">{e.pct}%</b>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted small">{t("No work logged yet.")}</p>
        )}
        {editable ? (
          <div className="pmc-doc-add">
            <Field label={t("Activity in progress")}>
              <select
                className="input select"
                value={entryAct}
                onChange={(e) => {
                  setEntryAct(e.target.value);
                  const a = act(e.target.value);
                  if (a) setEntryPct(Math.min(100, a.pct + 3));
                }}
              >
                {live.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {x(a.name)} ({a.pct}%)
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Reached %")}>
              <input className="input num-inline" type="number" min={entryA?.pct ?? 0} max={100} value={entryPct} onChange={(e) => setEntryPct(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
            </Field>
            <Field label={t("Qty")}>
              <span className="k-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                <input className="input num-inline" type="number" min={0} value={entryQty} onChange={(e) => setEntryQty(Math.max(0, Number(e.target.value) || 0))} />
                <select className="input select" value={entryUnit} onChange={(e) => setEntryUnit(e.target.value)} aria-label={t("Unit")}>
                  {["m³", "m²", "m", "kg", "ədəd"].map((u) => (
                    <option key={u} value={u}>{unitLabel(u, lang)}</option>
                  ))}
                </select>
              </span>
            </Field>
            <Field label={t("Note")}>
              <input className="input" value={entryNote} onChange={(e) => setEntryNote(e.target.value)} placeholder={t("What was done")} />
            </Field>
            <button type="button" className="btn btn-primary" onClick={addEntry} disabled={!entryA}>
              <Plus size={15} />
              {t("Add entry")}
            </button>
          </div>
        ) : null}
      </section>

      <div className="pmc-doc-cols">
        <section className="pmc-doc-sec">
          <h3>
            <HardHat size={14} /> {t("People")}
          </h3>
          <ul className="pmc-doc-list">
            {report.labour.map((l, i) => (
              <li key={i}>
                <span>{x(l.trade)}</span>
                <b className="num-inline">{l.count}</b>
              </li>
            ))}
            <li className="total">
              <span>{t("Total")}</span>
              <b className="num-inline">{people}</b>
            </li>
          </ul>
          {editable ? (
            <div className="pmc-inline-add">
              <input className="input" value={labTrade} onChange={(e) => setLabTrade(e.target.value)} placeholder={t("Trade")} aria-label={t("Trade")} />
              <input className="input num-inline" type="number" min={1} value={labCount} onChange={(e) => setLabCount(Math.max(0, Math.round(Number(e.target.value) || 0)))} aria-label={t("People")} />
              <button type="button" className="icon-btn" onClick={addLabour} aria-label={t("Add labour")}>
                <Plus size={16} />
              </button>
            </div>
          ) : null}
        </section>
        <section className="pmc-doc-sec">
          <h3>
            <Truck size={14} /> {t("Plant")}
          </h3>
          <ul className="pmc-doc-list">
            {report.plant.map((p, i) => (
              <li key={i}>
                <span>{x(p.name)}</span>
                <button type="button" className={`pmc-plant k-tone-${PLANT_TONE[p.status]}`} onClick={() => cyclePlant(i)} disabled={!editable} title={editable ? t("Click to change") : undefined}>
                  {t(PLANT_LABEL[p.status])}
                </button>
                <small className="num-inline">{p.hours} {t("h")}</small>
              </li>
            ))}
          </ul>
        </section>
        <section className="pmc-doc-sec">
          <h3>
            <Package size={14} /> {t("Materials")}
          </h3>
          <ul className="pmc-doc-list">
            {report.materials.map((m, i) => (
              <li key={i}>
                <span className="truncate">{matName(m.key)}</span>
                <b className="num-inline">
                  {fmtQty(m.qty, m.unit)} <small>{unitLabel(m.unit, lang)}</small>
                </b>
              </li>
            ))}
            {!report.materials.length ? <li className="muted">{t("None used")}</li> : null}
          </ul>
        </section>
      </div>

      <section className="pmc-doc-sec">
        <h3>
          <AlertTriangle size={14} /> {t("Blockers")}
        </h3>
        {report.blockers.length ? (
          <ul className="pmc-blockers">
            {report.blockers.map((b, i) => (
              <li key={i} className={b.status === "RESOLVED" ? "done" : undefined}>
                <Badge tone={statusMeta("priority", b.severity).tone}>{x(statusMeta("priority", b.severity).label)}</Badge>
                <span className="pmc-blocker-text">
                  <strong>{x(b.text)}</strong>
                  <small>
                    {b.owner} · {t("clear by {date}", { date: d(b.due, false) })}
                    {b.status === "RESOLVED" ? ` · ${t("Cleared")}` : ""}
                  </small>
                </span>
                {b.status === "OPEN" ? (
                  <span className="pmc-blocker-act">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => raise(b)}>
                      {t("Raise as delay")} <ChevronRight size={13} />
                    </button>
                    {editable ? (
                      <button type="button" className="icon-btn" onClick={() => clearBlocker(i)} aria-label={t("Clear")} title={t("Clear")}>
                        <Check size={15} />
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{t("Nothing blocked the work.")}</p>
        )}
        {editable ? (
          <div className="pmc-doc-add">
            <Field label={t("What is blocked")}>
              <input className="input" value={blkText} onChange={(e) => setBlkText(e.target.value)} />
            </Field>
            <Field label={t("Severity")}>
              <select className="input select" value={blkSev} onChange={(e) => setBlkSev(e.target.value as typeof blkSev)}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{x(statusMeta("priority", s).label)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("Owner")}>
              <input className="input" value={blkOwner} onChange={(e) => setBlkOwner(e.target.value)} />
            </Field>
            <Field label={t("Clear by")}>
              <input className="input" type="date" value={blkDue} onChange={(e) => setBlkDue(e.target.value || TODAY)} />
            </Field>
            <button type="button" className="btn btn-ghost" onClick={addBlocker} disabled={!blkText.trim()}>
              <Plus size={15} />
              {t("Add blocker")}
            </button>
          </div>
        ) : null}
      </section>

      <section className="pmc-doc-sec">
        <h3>{t("Notes")}</h3>
        {editable ? (
          <div className="k-stack" style={{ gap: 8 }}>
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Anything the project manager should know")} />
            <span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={saveNotes}>
                {t("Save notes")}
              </button>
            </span>
          </div>
        ) : (
          <p>{report.notes ? x(report.notes) : <span className="muted">—</span>}</p>
        )}
      </section>

      <section className="pmc-doc-sec">
        <h3>
          <ImageIcon size={14} /> {t("Photos")}
        </h3>
        {report.photos.length ? (
          <div className="pmc-doc-photos">
            {report.photos.map((p, i) => (
              <a key={`${p}-${i}`} href={sheetImage(p)} target="_blank" rel="noopener">
                <img src={sheetImage(p, true)} alt={p} loading="lazy" />
                <small>{p}</small>
              </a>
            ))}
          </div>
        ) : (
          <p className="muted small">{t("No photos attached.")}</p>
        )}
      </section>

      <DelayDialog open={!!delayFor} onClose={() => setDelayFor(null)} initial={delayFor ?? undefined} />
    </article>
  );
}

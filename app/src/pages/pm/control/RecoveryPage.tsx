import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BadgeCheck, CalendarRange, Check, Coins, Gauge, PlayCircle, Plus, RotateCcw, Send, ShieldCheck, Sparkles, Trash2, TrendingDown, X as XIcon } from "lucide-react";
import { Badge, Dialog, Empty, Kebab, Money, PageHero, Panel, StatusBadge, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, PROJECT_FINISH, TODAY } from "../../../ops/dates";
import { programmeStats, R, type Tone } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { RecoveryScenario, Txt } from "../../../ops/types";
import { finishAfterRecovery, isOpenDelay, signed, useCpm } from "./shared";
import { ScenarioDialog, type ScenarioDraft } from "./ScenarioDialog";

const RISK_ORDER = { low: 0, medium: 1, high: 2 } as const;
const RISK_TONE: Record<RecoveryScenario["risk"], Tone> = { low: "ok", medium: "warn", high: "bad" };
const RISK_LABEL: Record<RecoveryScenario["risk"], string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };
const T = (en: string, az: string): Txt => ({ en, az });
const live = (r: RecoveryScenario) => r.status !== "REJECTED" && r.status !== "APPLIED";
const perDay = (r: RecoveryScenario) => r.cost / Math.max(1, r.daysRecovered);

/** A way to win days back, read from the programme and the open delays. The cost is left to the user. */
type Suggestion = Omit<RecoveryScenario, "id" | "status" | "cost"> & { key: string; why: Txt };

export function RecoveryPage() {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const delays = useOps((s) => s.delays);
  const subs = useOps((s) => s.subs);
  const recovery = useOps((s) => s.recovery);
  const setScenarioStatus = useOps((s) => s.setScenarioStatus);
  const applyScenario = useOps((s) => s.applyScenario);
  const removeItem = useOps((s) => s.removeItem);
  const hasActs = activities.length > 0;
  const contractSet = useOps((s) => !!s.setup.contractFinish);
  const [draft, setDraft] = useState<ScenarioDraft | null>(null);
  const crit = useCpm();

  const stats = programmeStats(activities);
  const gap = Math.max(0, stats.varianceDays);

  // Default plan: cheapest days first until the gap is closed.
  const defaultPlan = useMemo(() => {
    const out = new Set<string>();
    let sum = 0;
    for (const r of recovery.filter(live).sort((a, b) => perDay(a) - perDay(b))) {
      if (sum >= gap) break;
      out.add(r.id);
      sum += r.daysRecovered;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [plan, setPlan] = useState<Set<string>>(defaultPlan);
  const [applyId, setApplyId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const steps = recovery.filter((r) => live(r) && plan.has(r.id));
  const won = steps.reduce((a, r) => a + r.daysRecovered, 0);
  const landing = gap - won;
  const closes = gap > 0 ? Math.min(1, won / gap) : 1;

  // ---------------------------------------------------------------- suggestions from the data
  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const critical = activities.filter((a) => a.status !== "COMPLETED" && crit.get(a.id)?.critical).sort((a, b) => a.start.localeCompare(b.start));
    const owner = (id: string) => subs.find((s) => s.id === id)?.name ?? id;
    const dur = (id: string) => crit.get(id)?.dur ?? 0;

    const rfiDelay = delays.filter((dl) => isOpenDelay(dl) && dl.cause === "RFI" && dl.daysLost > dl.floatAbsorbed)[0];
    if (rfiDelay) {
      const ref = rfiDelay.links.find((l) => l.kind === "RFI")?.id ?? rfiDelay.ref;
      const days = Math.min(4, rfiDelay.daysLost - rfiDelay.floatAbsorbed);
      out.push({
        key: "rfi",
        name: T(`Close ${ref} in a design workshop`, `${ref}-ü layihə görüşündə bağlamaq`),
        daysRecovered: days,
        risk: "medium",
        summary: T(`Sit the designer and the fabricator together this week so ${ref} is answered in days, not weeks.`, `Layihəçi ilə istehsalçını bu həftə bir araya gətirmək ki, ${ref} həftələrlə yox, günlərlə cavablansın.`),
        assumptions: [T("The designer agrees to a workshop within 3 days", "Layihəçi 3 gün ərzində görüşə razıdır"), T("The fabricator can start the day the detail is issued", "İstehsalçı detal verildiyi gün başlaya bilir")],
        actions: [{ title: T(`Book the ${ref} workshop`, `${ref} görüşünü təyin etmək`), owner: "", due: addDays(TODAY, 3), days }],
        why: T(`${rfiDelay.ref} still pushes the programme by ${rfiDelay.daysLost - rfiDelay.floatAbsorbed} days.`, `${rfiDelay.ref} qrafiki hələ ${rfiDelay.daysLost - rfiDelay.floatAbsorbed} gün itələyir.`),
      });
    }

    const crewTarget = critical.find((a) => a.status !== "BLOCKED" && dur(a.id) >= 20 && dur(a.id) <= 60);
    if (crewTarget) {
      const days = Math.min(10, Math.round(dur(crewTarget.id) * 0.2));
      out.push({
        key: "crew",
        name: T(`Second crew on ${crewTarget.code}`, `${crewTarget.code} üzrə ikinci briqada`),
        daysRecovered: days,
        risk: "medium",
        summary: T(`Split ${crewTarget.name.en.toLowerCase()} into two work fronts with a second ${crewTarget.crew}-person crew.`, `${crewTarget.name.az} işini ikinci ${crewTarget.crew} nəfərlik briqada ilə iki iş cəbhəsinə bölmək.`),
        assumptions: [T(`${owner(crewTarget.owner)} can field a second crew`, `${owner(crewTarget.owner)} ikinci briqada çıxara bilir`), T("Crane and access allow two fronts", "Kran və giriş iki cəbhəyə imkan verir")],
        actions: [{ title: T(`Agree the second crew with ${owner(crewTarget.owner)}`, `${owner(crewTarget.owner)} ilə ikinci briqadanı razılaşdırmaq`), owner: "", due: addDays(TODAY, 5), days }],
        why: T(`${crewTarget.code} is on the critical path and runs ${dur(crewTarget.id)} days.`, `${crewTarget.code} kritik yoldadır və ${dur(crewTarget.id)} gün davam edir.`),
      });
    }

    const longest = [...critical].sort((a, b) => dur(b.id) - dur(a.id))[0];
    if (longest) {
      const days = Math.floor(Math.min(dur(longest.id), 70) / 7);
      out.push({
        key: "sunday",
        name: T(`Sunday working on ${longest.code}`, `${longest.code} üzrə bazar günləri iş`),
        daysRecovered: days,
        risk: "low",
        summary: T(`Work Sundays for ten weeks on the longest critical activity, ${longest.name.en.toLowerCase()}.`, `Ən uzun kritik iş olan ${longest.name.az} üzrə on həftə bazar günləri işləmək.`),
        assumptions: [T("Overtime paid at 1.5 times the day rate", "Əlavə iş gündəlik tarifin 1,5 misli ödənilir"), T("Client allows Sunday working on site", "Sifarişçi bazar günləri işə icazə verir")],
        actions: [{ title: T("Add Sundays to the working calendar", "Bazar günlərini iş təqviminə əlavə etmək"), owner: "", due: addDays(TODAY, 7), days }],
        why: T(`${longest.code} is the longest critical activity (${dur(longest.id)} days).`, `${longest.code} ən uzun kritik işdir (${dur(longest.id)} gün).`),
      });
    }

    const byId = new Map(activities.map((a) => [a.id, a]));
    const overlap = links.find((l) => l.type === "FS" && crit.get(l.from)?.critical && crit.get(l.to)?.critical && byId.get(l.to)?.status === "NOT_STARTED" && byId.get(l.from)?.status === "NOT_STARTED" && dur(l.from) >= 14);
    if (overlap) {
      const a = byId.get(overlap.from)!;
      const b = byId.get(overlap.to)!;
      const days = Math.min(7, Math.round(dur(a.id) * 0.3));
      out.push({
        key: "overlap",
        name: T(`Overlap ${a.code} and ${b.code}`, `${a.code} və ${b.code} işlərini üst-üstə salmaq`),
        daysRecovered: days,
        risk: "high",
        summary: T(`Start ${b.code} on the finished bays while ${a.code} completes the rest.`, `${a.code} qalan hissəni bitirərkən ${b.code}-ni hazır aşırımlarda başlamaq.`),
        assumptions: [T("The work can be split into bays", "İşi aşırımlara bölmək mümkündür"), T("Both crews can share the access safely", "Hər iki briqada girişdən təhlükəsiz istifadə edə bilir")],
        actions: [{ title: T(`Change ${a.code} → ${b.code} to start-to-start`, `${a.code} → ${b.code} əlaqəsini başlanğıc–başlanğıca dəyişmək`), owner: "", due: addDays(TODAY, 4), days }],
        why: T(`${a.code} → ${b.code} is a finish-to-start link on the critical path.`, `${a.code} → ${b.code} kritik yolda bitmə–başlanğıc əlaqəsidir.`),
      });
    }
    return out;
  }, [activities, links, delays, subs, crit]);

  const created = (sg: Suggestion) => recovery.some((r) => r.name.en === sg.name.en);
  const pickSuggestion = (sg: Suggestion) => {
    const a = sg.actions[0];
    setDraft({ name: sg.name, daysRecovered: sg.daysRecovered, risk: sg.risk, summary: sg.summary, assumptions: sg.assumptions, action: a?.title, due: a?.due });
  };
  const remove = (r: RecoveryScenario) => {
    removeItem("recovery", r.id);
    setPlan((p) => {
      const n = new Set(p);
      n.delete(r.id);
      return n;
    });
    toast(t("{id} deleted", { id: r.id }), "muted");
  };

  // ---------------------------------------------------------------- comparison badges
  const cands = recovery.filter(live);
  const best = (score: (r: RecoveryScenario) => number) => (cands.length ? cands.reduce((a, b) => (score(b) < score(a) ? b : a)).id : null);
  const tags: Record<string, string[]> = {};
  const tag = (id: string | null, label: string) => id && (tags[id] = [...(tags[id] ?? []), label]);
  tag(best((r) => -r.daysRecovered), "Most days won back");
  tag(best((r) => r.cost), "Lowest cost");
  tag(best(perDay), "Cheapest per day");
  tag(best((r) => RISK_ORDER[r.risk] * 1e7 + r.cost), "Lowest risk");

  const toggle = (id: string) =>
    setPlan((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setStatus = (r: RecoveryScenario, st: RecoveryScenario["status"], msg: string) => {
    setScenarioStatus(r.id, st);
    toast(msg, st === "REJECTED" ? "muted" : "ok");
  };

  const applying = recovery.find((r) => r.id === applyId);
  const doApply = () => {
    if (!applying) return;
    const before = stats.forecastFinish;
    applyScenario(applying.id);
    const after = programmeStats(useOps.getState().activities).forecastFinish;
    setPlan((p) => {
      const n = new Set(p);
      n.delete(applying.id);
      return n;
    });
    toast(t("{name} applied. Forecast finish {a} → {b}.", { name: x(applying.name), a: d(before), b: d(after) }));
    setApplyId(null);
  };

  // ---------------------------------------------------------------- ladder geometry
  const cols = [
    { key: "start", label: t("Forecast finish"), sub: d(stats.forecastFinish, false), from: 0, to: gap, kind: "start" as const },
    ...steps.reduce<{ key: string; label: string; sub: string; from: number; to: number; kind: "step" }[]>((acc, r) => {
      const top = acc.length ? acc[acc.length - 1]!.to : gap;
      acc.push({ key: r.id, label: x(r.name), sub: t("−{n} d", { n: r.daysRecovered }), from: top, to: top - r.daysRecovered, kind: "step" });
      return acc;
    }, []),
    { key: "land", label: t("Lands at"), sub: d(addDays(stats.forecastFinish, -won), false), from: 0, to: landing, kind: "land" as const },
  ];
  const vMax = Math.max(gap, 2) + 2;
  const vMin = Math.min(0, landing) - 2;
  const W = Math.max(600, cols.length * 150);
  const H = 250;
  const pad = { l: 40, r: 12, t: 22, b: 54 };
  const colW = (W - pad.l - pad.r) / cols.length;
  const Y = (v: number) => pad.t + ((vMax - v) / (vMax - vMin)) * (H - pad.t - pad.b);

  return (
    <div className="k-page pmc">
      <PageHero
        eyebrow={t("Project management · Recovery")}
        title={t("Recovery")}
        subtitle={t("How to win back the days the programme has lost: what each option costs, what it risks and how far it closes the gap to the contract date.")}
        flow={["Find options", "Calculate", "Send for approval", "Approve", "Apply to the programme"]}
        art="recovery"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setDraft({})}>
            <Plus size={15} />
            {t("New scenario")}
          </button>
        }
      />

      {!hasActs ? (
        <Panel>
          <Empty
            icon={<CalendarRange size={20} />}
            title={t("No programme yet")}
            action={
              <Link to={R.programme()} className="btn btn-primary">
                {t("Open the programme")}
              </Link>
            }
          >
            {t("Recovery works on the programme: the gap to the contract date and the critical path. Add activities or import a P6 / MS Project file first.")}
          </Empty>
        </Panel>
      ) : null}

      {hasActs ? (
      <Panel
        title={t("Recovery ladder")}
        icon={<TrendingDown size={15} />}
        sub={t("Starts at the forecast finish and steps back by the days each option in the plan wins, landing against the contract finish. Tick options in the comparison to build the plan.")}
        actions={
          <span className="pmc-ladder-head">
            <span className="muted small">{t("Gap to close")}</span>
            <b className={`num-inline ${gap ? "k-text-bad" : "k-text-ok"}`}>{t("{n} d", { n: gap })}</b>
          </span>
        }
      >
        {!contractSet ? (
          <p className="k-note">{t("No contract finish date is set for this project, so the gap is measured to the latest activity finish.")}</p>
        ) : null}
        {gap === 0 && !steps.length ? (
          <div className="k-callout k-tone-ok">
            <BadgeCheck size={18} />
            <span>{t("The programme finishes on or before the contract date. Nothing to recover.")}</span>
          </div>
        ) : null}
        <div className="pmc-ladder-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="pmc-ladder" role="img" aria-label={t("Recovery ladder")}>
            {Array.from({ length: Math.floor(vMax) - Math.ceil(vMin) + 1 }, (_, i) => Math.ceil(vMin) + i)
              .filter((v) => v % (vMax - vMin > 20 ? 4 : 2) === 0)
              .map((v) => (
                <g key={v}>
                  <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} className={v === 0 ? "pmc-ladder-zero" : "k-grid"} />
                  <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" className="k-axis">
                    {signed(v)}
                  </text>
                </g>
              ))}
            <text x={pad.l + 4} y={Y(0) + 14} className="pmc-ladder-contract">
              {t("Contract finish {date}", { date: d(PROJECT_FINISH, false) })}
            </text>
            {cols.map((c, i) => {
              const x0 = pad.l + i * colW + colW * 0.18;
              const w = colW * 0.64;
              const top = Y(Math.max(c.from, c.to));
              const h = Math.max(2, Math.abs(Y(c.from) - Y(c.to)));
              const cls = c.kind === "start" ? "start" : c.kind === "land" ? (landing > 0 ? "land-late" : "land-ok") : `step${hover === c.key ? " hot" : ""}`;
              const next = cols[i + 1];
              return (
                <g key={c.key} className={`pmc-ladder-col ${cls}`} style={{ animationDelay: `${i * 90}ms` }}>
                  <rect x={x0} y={top} width={w} height={h} rx={4} />
                  <text x={x0 + w / 2} y={top - 6} textAnchor="middle" className="pmc-ladder-val">
                    {c.kind === "step" ? c.sub : t("{n} d", { n: signed(c.to) })}
                  </text>
                  {next && c.kind !== "land" ? <line x1={x0 + w} x2={pad.l + (i + 1) * colW + colW * 0.18} y1={Y(c.to)} y2={Y(c.to)} className="pmc-ladder-link" /> : null}
                  <foreignObject x={pad.l + i * colW + 2} y={H - pad.b + 6} width={colW - 4} height={pad.b - 6}>
                    <div className="pmc-ladder-label">
                      <span>{c.label}</span>
                      {c.kind !== "step" ? <small>{c.sub}</small> : null}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="pmc-closes">
          <span>
            <small>{t("Days won back")}</small>
            <b className="num-inline">{won}</b>
          </span>
          <span className="pmc-closes-meter">
            <small>{t("How far the plan closes the gap")}</small>
            <span className="pmc-closes-track">
              <i style={{ width: `${closes * 100}%` }} className={closes >= 1 ? "ok" : ""} />
            </span>
          </span>
          <b className={`pmc-closes-pct num-inline ${closes >= 1 ? "k-text-ok" : "k-text-warn"}`}>{Math.round(closes * 100)}%</b>
          <span className="muted small">{landing > 0 ? t("Still {n} days late after the plan.", { n: landing }) : landing < 0 ? t("{n} days spare against the contract.", { n: -landing }) : t("Lands exactly on the contract date.")}</span>
        </div>
      </Panel>
      ) : null}

      {hasActs ? (
      <Panel title={t("Ways to win days back")} icon={<Sparkles size={15} />} sub={t("Suggested from the critical path and the open delays. Check the days, enter the cost, then create the scenario.")}>
        {suggestions.length ? (
          <div className="pmc-sugs">
            {suggestions.map((sg, i) => {
              const done = created(sg);
              return (
                <article key={sg.key} className="k-ai pmc-sug k-rise" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="k-ai-tag">
                    <Sparkles size={12} /> {t("Suggestion")}
                  </span>
                  <h3>{x(sg.name)}</h3>
                  <p className="pmc-sug-why">{x(sg.why)}</p>
                  <div className="pmc-sug-figs">
                    <span>
                      <small>{t("Days back")}</small>
                      <b className="num-inline">{sg.daysRecovered}</b>
                    </span>
                    <span>
                      <small>{t("Cost")}</small>
                      <b className="num-inline muted">{t("you enter it")}</b>
                    </span>
                    <span>
                      <small>{t("Risk")}</small>
                      <Badge tone={RISK_TONE[sg.risk]}>{t(RISK_LABEL[sg.risk])}</Badge>
                    </span>
                  </div>
                  <p className="small">{x(sg.summary)}</p>
                  <ul className="pmc-sug-assume">
                    {sg.assumptions.map((a, j) => (
                      <li key={j}>{x(a)}</li>
                    ))}
                  </ul>
                  <button type="button" className={done ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"} disabled={done} onClick={() => pickSuggestion(sg)}>
                    {done ? <Check size={14} /> : <PlayCircle size={14} />}
                    {done ? t("Created") : t("Use this")}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty title={t("No suggestions right now")}>{t("Nothing on the critical path is open to recovery.")}</Empty>
        )}
      </Panel>
      ) : null}

      <Panel title={t("What-if scenarios side by side")} icon={<Gauge size={15} />} count={recovery.length} pad={false}>
        {recovery.length ? (
          <div className="pmc-cmp-wrap">
            <table className="pmc-cmp">
              <thead>
                <tr>
                  <th />
                  {recovery.map((r) => (
                    <th key={r.id} className={`${r.status === "REJECTED" ? "dim" : ""}${plan.has(r.id) && live(r) ? " inplan" : ""}`} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
                      <div className="pmc-cmp-tags">
                        {(tags[r.id] ?? []).map((tg) => (
                          <span key={tg} className="pmc-cmp-tag">
                            <Award size={11} /> {t(tg)}
                          </span>
                        ))}
                      </div>
                      <span className="k-row" style={{ gap: 6, justifyContent: "space-between" }}>
                        <span className="k-ref">{r.id}</span>
                        {r.status !== "APPLIED" ? <Kebab items={[{ label: t("Delete"), icon: <Trash2 size={14} />, danger: true, onClick: () => remove(r) }]} /> : null}
                      </span>
                      <strong>{x(r.name)}</strong>
                      <span className="k-row" style={{ gap: 6 }}>
                        <StatusBadge kind="scenario" status={r.status} />
                        {live(r) ? (
                          <label className="pmc-check small">
                            <input type="checkbox" checked={plan.has(r.id)} onChange={() => toggle(r.id)} />
                            {t("In the plan")}
                          </label>
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>{t("New finish date")}</th>
                  {recovery.map((r) => (
                    <td key={r.id} className="num-inline">
                      {r.status === "APPLIED" ? <span className="k-text-brand">{t("In the programme")}</span> : <b>{d(finishAfterRecovery(activities, r.daysRecovered))}</b>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>{t("Days back")}</th>
                  {recovery.map((r) => (
                    <td key={r.id}>
                      <span className="pmc-cmp-days">
                        <i style={{ width: `${(r.daysRecovered / Math.max(1, ...recovery.map((v) => v.daysRecovered))) * 100}%` }} />
                        <b className="num-inline">{r.daysRecovered}</b>
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>{t("Against contract")}</th>
                  {recovery.map((r) => {
                    const v = r.status === "APPLIED" ? stats.varianceDays : diffDays(PROJECT_FINISH, finishAfterRecovery(activities, r.daysRecovered));
                    return (
                      <td key={r.id} className={v > 0 ? "k-text-bad" : "k-text-ok"}>
                        {v > 0 ? t("{n} d late", { n: v }) : v < 0 ? t("{n} d spare", { n: -v }) : t("on the date")}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <th>{t("Risk")}</th>
                  {recovery.map((r) => (
                    <td key={r.id}>
                      <Badge tone={RISK_TONE[r.risk]}>{t(RISK_LABEL[r.risk])}</Badge>
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>{t("Cost")}</th>
                  {recovery.map((r) => (
                    <td key={r.id}>
                      <Money value={r.cost} short />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>{t("Cost per day")}</th>
                  {recovery.map((r) => (
                    <td key={r.id}>
                      <Money value={perDay(r)} short />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>{t("Actions")}</th>
                  {recovery.map((r) => (
                    <td key={r.id}>
                      <ul className="pmc-cmp-actions">
                        {r.actions.map((a, i) => (
                          <li key={i}>
                            <span>{x(a.title)}</span>
                            <small>
                              {a.owner || "—"} · {d(a.due, false)}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
                <tr className="pmc-cmp-foot">
                  <th />
                  {recovery.map((r) => (
                    <td key={r.id}>
                      {r.status === "DRAFT" || r.status === "CALCULATED" ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(r, "UNDER_REVIEW", t("{id} sent for approval", { id: r.id }))}>
                          <Send size={13} />
                          {t("Send for approval")}
                        </button>
                      ) : r.status === "UNDER_REVIEW" ? (
                        <span className="k-row" style={{ gap: 6 }}>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(r, "APPROVED", t("{id} approved", { id: r.id }))}>
                            <ShieldCheck size={13} />
                            {t("Approve")}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(r, "REJECTED", t("{id} rejected", { id: r.id }))}>
                            <XIcon size={13} />
                            {t("Reject")}
                          </button>
                        </span>
                      ) : r.status === "APPROVED" ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setApplyId(r.id)}>
                          <PlayCircle size={13} />
                          {t("Apply to the programme")}
                        </button>
                      ) : r.status === "REJECTED" ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(r, "CALCULATED", t("{id} reopened", { id: r.id }))}>
                          <RotateCcw size={13} />
                          {t("Reopen")}
                        </button>
                      ) : (
                        <Badge tone="brand">{t("Applied")}</Badge>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="k-panel-body">
            <Empty
              title={t("No scenarios yet")}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft({})}>
                  <Plus size={14} />
                  {t("New scenario")}
                </button>
              }
            >
              {t("Create one by hand, or from a suggestion above.")}
            </Empty>
          </div>
        )}
      </Panel>

      <ScenarioDialog open={!!draft} onClose={() => setDraft(null)} initial={draft ?? undefined} onSaved={(id) => setPlan((p) => new Set(p).add(id))} />

      <Dialog
        open={!!applying}
        onClose={() => setApplyId(null)}
        kicker={t("Recovery")}
        title={t("Apply {name}?", { name: applying ? x(applying.name) : "" })}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setApplyId(null)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={doApply}>
              <Check size={15} />
              {t("Yes, apply it")}
            </button>
          </>
        }
      >
        {applying ? (
          <div className="k-stack" style={{ gap: 12 }}>
            <p>{t("Every unfinished activity that has slipped is pulled back by up to {n} days. The Gantt, milestones and finish date update at once.", { n: applying.daysRecovered })}</p>
            <div className="pmc-preview-flow">
              <span>
                <small>{t("Forecast finish")}</small>
                <b className="num-inline">{d(stats.forecastFinish)}</b>
              </span>
              <TrendingDown size={14} />
              <span className="ok">
                <small>{t("After recovery")}</small>
                <b className="num-inline">{d(finishAfterRecovery(activities, applying.daysRecovered))}</b>
              </span>
              <Coins size={14} />
              <span>
                <small>{t("Cost")}</small>
                <b className="num-inline">{fmtMoneyShort(applying.cost)} AZN</b>
              </span>
            </div>
            <a className="k-link-btn" href={`#${R.programme()}`}>
              {t("See it on the programme afterwards")}
            </a>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

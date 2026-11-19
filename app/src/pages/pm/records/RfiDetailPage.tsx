import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CalendarClock, Check, Clock, Coins, FileDiff, GitBranch, Maximize2, MessageSquareReply, Send, TriangleAlert } from "lucide-react";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  DetailHeader,
  Kebab,
  KeyFigure,
  LifecycleStrip,
  Meter,
  NextBar,
  Panel,
  StatusBadge,
  Timeline,
  toast,
  useL,
  type LifeStep,
} from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { cpm, R, statusMeta } from "../../../ops/select";
import { rateFor } from "../../../ops/seed/util";
import { data, sheetById, sheetImage } from "../../../data";
import { disciplineName, sheetTitle } from "../../../lib/loc";
import { fmtMoneyShort } from "../../../lib/format";
import type { ChangeOrder, HistoryEvent, Rfi } from "../../../ops/types";
import { changeCost, NotFound, rfiOverdue, rfiShownStatus, SheetLightbox, signed } from "./shared";

const QUICK = ["Proceed as drawn.", "Use the dimension given in the schedule.", "Hold this element until the revised detail is issued."];

/** One RFI: the question as a document beside its drawing, the designer's answer, and what it affects. */
export function RfiDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const rfi = useOps((s) => s.rfis.find((r) => r.id === id));
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const delays = useOps((s) => s.delays);
  const changes = useOps((s) => s.changes);
  const parties = useOps((s) => s.parties);
  const answerRfi = useOps((s) => s.answerRfi);
  const closeRfi = useOps((s) => s.closeRfi);
  const raiseChange = useOps((s) => s.raiseChange);
  const [answer, setAnswer] = useState("");
  const [answeredBy, setAnsweredBy] = useState<string | null>(null);
  const patchItem = useOps((s) => s.patchItem);
  const [sheet, setSheet] = useState<string | null>(null);
  const crit = useMemo(() => cpm(activities, links), [activities, links]);

  if (!rfi) return <NotFound what={t("RFI")} back={R.rfis} backLabel="Back to RFIs" />;

  const late = rfiOverdue(rfi);
  const left = diffDays(TODAY, rfi.dueAt);
  const act = rfi.activityId ? activities.find((a) => a.id === rfi.activityId) : undefined;
  const actCpm = act ? crit.get(act.id) : undefined;
  const linkedDelays = delays.filter((dl) => dl.links.some((l) => l.kind === "RFI" && l.id === rfi.id));
  const linkedChanges = changes.filter((c) => c.rfiId === rfi.id);
  const designer = parties.find((p) => p.role === "CONSULTANT")?.name ?? data.project.designer;
  const contractor = parties.find((p) => p.role === "CONTRACTOR")?.name ?? "";
  const sh = rfi.sheetId ? sheetById.get(rfi.sheetId) : undefined;
  const pm = statusMeta("priority", rfi.priority);
  const answeredOnTime = !!rfi.answeredAt && rfi.answeredAt <= rfi.dueAt;
  const life: LifeStep[] = [
    { label: t("Raised"), date: d(rfi.raisedAt, false), note: rfi.raisedBy, state: "done" },
    {
      label: t("Due"),
      date: d(rfi.dueAt, false),
      state: rfi.answeredAt ? (answeredOnTime ? "done" : "late") : late ? "late" : "current",
      note: rfi.answeredAt ? (answeredOnTime ? t("on time") : t("after the due date")) : late ? t("overdue {n} days", { n: -left }) : left === 0 ? t("due today") : t("{n} days left", { n: left }),
    },
    { label: t("Answered"), date: rfi.answeredAt ? d(rfi.answeredAt, false) : undefined, note: rfi.answeredBy ?? undefined, state: rfi.answeredAt ? "done" : "todo" },
    { label: t("Closed"), state: rfi.status === "CLOSED" ? "done" : rfi.status === "ANSWERED" ? "current" : "todo" },
    ...linkedChanges.map((c): LifeStep => ({ label: t("Change {ref}", { ref: c.ref }), date: d(c.raisedAt, false), href: R.change(c.id), note: x(statusMeta("change", c.status).label), state: c.status === "APPROVED" ? "done" : c.status === "REJECTED" ? "skipped" : "current" })),
  ];

  const sendAnswer = () => {
    if (!answer.trim()) return;
    answerRfi(rfi.id, answer.trim());
    const by = (answeredBy ?? designer).trim();
    if (by) patchItem("rfis", rfi.id, { answeredBy: by });
    setAnswer("");
    toast(t("{id} answered", { id: rfi.ref }));
  };

  const raiseFromAnswer = () => {
    const lines: ChangeOrder["lines"] = [];
    if (act?.section) {
      const top = data.items
        .filter((it) => it.building === act.building && it.section === act.section)
        .map((it) => ({ it, v: rateFor(it.rate) * it.qty }))
        .sort((a, b) => b.v - a.v)[0];
      // The BOQ line the change most likely touches, at its bill rate. The quantity is left at 0 to be measured.
      if (top) lines.push({ itemId: top.it.id, description: { en: top.it.en, az: top.it.az }, unit: top.it.unit, qtyDelta: 0, rate: rateFor(top.it.rate) });
    }
    const ans = rfi.answer ?? { en: "", az: "" };
    const vo = raiseChange({
      title: { en: `Change from ${rfi.ref}: ${rfi.subject.en}`, az: `${rfi.ref} üzrə dəyişiklik: ${rfi.subject.az}` },
      reason: "RFI",
      description: {
        en: `Raised from the designer's answer to ${rfi.ref}: "${ans.en}" Enter the quantities once measured.`,
        az: `${rfi.ref}-ə layihəçinin cavabı əsasında açılıb: "${ans.az}" Miqdarları ölçüldükdən sonra daxil edin.`,
      },
      daysDelta: 0,
      rfiId: rfi.id,
      lines,
    });
    toast(t("{vo} raised from {rfi}", { vo, rfi: rfi.ref }));
    navigate(R.change(vo));
  };

  const events: HistoryEvent[] = [
    { at: rfi.raisedAt, actor: "USER" as const, text: { en: `Raised by ${rfi.raisedBy}`, az: `${rfi.raisedBy} tərəfindən açılıb` } },
    ...(late ? [{ at: rfi.dueAt, actor: "SYSTEM" as const, text: { en: "Due date passed without an answer", az: "Cavab verilmədən müddət keçdi" } }] : []),
    ...linkedDelays.map((dl) => ({ at: dl.startedAt, actor: "SYSTEM" as const, text: { en: `${dl.ref} logged: ${dl.daysLost} days lost`, az: `${dl.ref} qeydə alındı: ${dl.daysLost} gün itki` } })),
    ...linkedChanges.map((c) => ({ at: c.raisedAt, actor: "SYSTEM" as const, text: { en: `${c.ref} raised from this RFI`, az: `${c.ref} bu RFI üzrə açıldı` } })),
    ...(rfi.answeredAt ? [{ at: rfi.answeredAt, actor: "USER" as const, text: { en: `Answered by ${rfi.answeredBy ?? ""}`, az: `${rfi.answeredBy ?? ""} cavablandırdı` } }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));
  if (rfi.status === "CLOSED") events.push({ at: "", actor: "USER", text: { en: "Closed", az: "Bağlandı" } });

  return (
    <div className="k-page">
      <Breadcrumbs items={[{ label: t("Project management"), to: R.pm }, { label: t("RFIs"), to: R.rfis }, { label: rfi.ref }]} />

      <DetailHeader
        refCode={rfi.ref}
        badges={
          <>
            <Badge tone={pm.tone}>{x(pm.label)}</Badge>
            <StatusBadge kind="rfi" status={rfiShownStatus(rfi)} />
          </>
        }
        title={x(rfi.subject)}
        meta={
          <>
            <span className="pmr-person">
              <Avatar name={rfi.raisedBy} size={20} />
              {rfi.raisedBy}
            </span>
            <span>{t("raised {date}", { date: d(rfi.raisedAt) })}</span>
            <span>{disciplineName(rfi.discipline, lang)}</span>
            {act ? <Link to={R.programme(act.id)}>{act.code}</Link> : null}
          </>
        }
        aside={
          rfi.status === "OPEN" ? (
            <KeyFigure label={t("Due")} value={d(rfi.dueAt)} sub={late ? t("overdue {n} days", { n: -left }) : left === 0 ? t("due today") : t("{n} days left", { n: left })} tone={late ? "bad" : left <= 3 ? "warn" : undefined} />
          ) : (
            <KeyFigure label={t("Answered in")} value={t("{n} days", { n: diffDays(rfi.raisedAt, rfi.answeredAt ?? rfi.raisedAt) })} sub={rfi.answeredAt && rfi.answeredAt <= rfi.dueAt ? t("on time") : t("after the due date")} tone={rfi.answeredAt && rfi.answeredAt <= rfi.dueAt ? "ok" : "warn"} />
          )
        }
      >
        <LifecycleStrip steps={life} />
      </DetailHeader>

      {rfi.status === "OPEN" ? (
        <NextBar tone={late ? "bad" : "warn"} text={late ? t("The designer is {n} days late. Chase the answer, then record it below when it arrives.", { n: -left }) : t("Waiting on the designer. Record the answer below when it arrives.")}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const el = document.getElementById("pmr-answer-text");
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              el?.focus({ preventScroll: true });
            }}
          >
            <MessageSquareReply size={15} />
            {t("Record answer")}
          </button>
        </NextBar>
      ) : rfi.status === "ANSWERED" ? (
        <NextBar text={t("Answered. Close it, or raise a change if the answer alters cost or time.")}>
          <button type="button" className="btn btn-primary" onClick={() => { closeRfi(rfi.id); toast(t("{id} closed", { id: rfi.ref })); }}>
            <Check size={15} />
            {t("Close RFI")}
          </button>
          <Kebab items={[{ label: t("Raise a change from this answer"), icon: <FileDiff size={14} />, onClick: raiseFromAnswer }]} />
        </NextBar>
      ) : (
        <NextBar tone="ok" text={t("Closed. The answer is part of the project record.")} />
      )}

      <div className="k-grid-main">
        <div className="k-stack">
          <section className="pmr-docwrap" aria-label={t("Question and drawing")}>
            <article className="pmr-doc">
              <header>
                <span className="pmr-doc-kind">{t("Request for information")}</span>
                <span className="k-ref">{rfi.ref}</span>
              </header>
              <dl className="pmr-doc-meta">
                <div>
                  <dt>{t("To")}</dt>
                  <dd>{designer}</dd>
                </div>
                <div>
                  <dt>{t("From")}</dt>
                  <dd>{contractor}</dd>
                </div>
                <div>
                  <dt>{t("Date")}</dt>
                  <dd>{d(rfi.raisedAt)}</dd>
                </div>
                <div>
                  <dt>{t("Reply by")}</dt>
                  <dd className={late ? "k-text-bad" : undefined}>{d(rfi.dueAt)}</dd>
                </div>
                <div>
                  <dt>{t("Discipline")}</dt>
                  <dd>{disciplineName(rfi.discipline, lang)}</dd>
                </div>
                <div>
                  <dt>{t("Sheet")}</dt>
                  <dd>{rfi.sheetId ?? "—"}</dd>
                </div>
              </dl>
              <h3>{x(rfi.subject)}</h3>
              <p className="pmr-doc-body">{x(rfi.question)}</p>
              <div className="pmr-doc-flags">
                <span className={rfi.costImpact ? "on" : undefined}>
                  <Coins size={13} />
                  {rfi.costImpact ? t("May change cost") : t("No cost effect expected")}
                </span>
                <span className={rfi.timeImpact ? "on" : undefined}>
                  <Clock size={13} />
                  {rfi.timeImpact ? t("May change time") : t("No time effect expected")}
                </span>
              </div>
              <footer>
                <span>{rfi.raisedBy}</span>
                <small>{contractor}</small>
              </footer>
            </article>

            <figure className="pmr-docsheet">
              {sh ? (
                <>
                  <button type="button" className="pmr-docsheet-img" onClick={() => setSheet(sh.id)} aria-label={t("Open sheet {id}", { id: sh.id })}>
                    <img src={sheetImage(sh.id)} alt={sheetTitle(sh, lang)} loading="lazy" />
                    <span className="pmr-docsheet-zoom">
                      <Maximize2 size={14} />
                      {t("Open larger")}
                    </span>
                  </button>
                  <figcaption>
                    <b>{sh.id}</b>
                    <span>{sheetTitle(sh, lang)}</span>
                  </figcaption>
                </>
              ) : (
                <div className="pmr-docsheet-none">{t("No drawing sheet referenced.")}</div>
              )}
            </figure>
          </section>

          <Panel title={t("Answer")} icon={<MessageSquareReply size={15} />} className="pmr-answer-panel">
            {rfi.status === "OPEN" ? (
              <div className="k-stack">
                <label className="k-field">
                  <span className="k-field-label">{t("The designer's answer")}</span>
                  <textarea id="pmr-answer-text" className="input" rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t("Type the designer's answer…")} />
                </label>
                <label className="k-field">
                  <span className="k-field-label">{t("Answered by")}</span>
                  <input className="input" value={answeredBy ?? designer} onChange={(e) => setAnsweredBy(e.target.value)} />
                </label>
                <div className="k-quick">
                  {QUICK.map((qk) => (
                    <button key={qk} type="button" onClick={() => setAnswer((a) => (a ? `${a} ${t(qk)}` : t(qk)))}>
                      {t(qk)}
                    </button>
                  ))}
                </div>
                <div className="k-row">
                  <span className="k-spacer" />
                  <button type="button" className="btn btn-primary" disabled={!answer.trim()} onClick={sendAnswer}>
                    <Send size={14} />
                    {t("Record answer")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="k-stack">
                <blockquote className="pmr-answer">
                  <p>{x(rfi.answer)}</p>
                  <footer>
                    <Avatar name={rfi.answeredBy ?? "?"} size={22} />
                    <span>
                      <b>{rfi.answeredBy}</b>{rfi.answeredBy !== designer && designer ? ` · ${designer}` : ""} · {d(rfi.answeredAt)}
                    </span>
                  </footer>
                </blockquote>
                <div className="k-row">
                  {rfi.status === "ANSWERED" ? (
                    <button type="button" className="btn btn-ghost" onClick={() => { closeRfi(rfi.id); toast(t("{id} closed", { id: rfi.ref })); }}>
                      <Check size={14} />
                      {t("Close RFI")}
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-primary" onClick={raiseFromAnswer}>
                    <FileDiff size={14} />
                    {t("Raise a change from this answer")}
                  </button>
                </div>
              </div>
            )}
          </Panel>

          <Panel title={t("History")} icon={<CalendarClock size={15} />}>
            <Timeline events={events} />
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Impact")} icon={<TriangleAlert size={15} />} sub={t("The work this question holds up and what has come from it.")}>
            <div className="k-stack pmr-impact-list">
              <div>
                <h4 className="pmr-mini-h">{t("Activity")}</h4>
                {act ? (
                  <Link to={R.programme(act.id)} className="pmr-linkcard">
                    <span className="pmr-linkcard-top">
                      <span className="k-ref">{act.code}</span>
                      <StatusBadge kind="activity" status={act.status} />
                    </span>
                    <strong>{x(act.name)}</strong>
                    <Meter value={act.pct / 100} tone={act.status === "BLOCKED" ? "bad" : "brand"} />
                    <small>
                      {t("{p}% done", { p: act.pct })} · {d(act.start, false)} – {d(act.end, false)}
                    </small>
                    {actCpm ? (
                      <span className={`pmr-float${actCpm.critical ? " crit" : ""}`}>
                        <GitBranch size={12} />
                        {actCpm.critical ? t("On the critical path: no float") : t("{n} days of float", { n: actCpm.tf })}
                      </span>
                    ) : null}
                  </Link>
                ) : (
                  <p className="muted small">{t("No activity linked.")}</p>
                )}
              </div>
              <div>
                <h4 className="pmr-mini-h">{t("Delays")}</h4>
                {linkedDelays.length ? (
                  linkedDelays.map((dl) => (
                    <Link key={dl.id} to={R.delays} className="pmr-linkcard bad">
                      <span className="pmr-linkcard-top">
                        <span className="k-ref">{dl.ref}</span>
                        <StatusBadge kind="delay" status={dl.status} />
                      </span>
                      <strong>{x(dl.title)}</strong>
                      <small>
                        {t("{n} days lost", { n: dl.daysLost })}
                        {dl.criticalPathChanged ? ` · ${t("moves the finish")}` : ""}
                      </small>
                    </Link>
                  ))
                ) : (
                  <p className="muted small">{t("No delay logged against it.")}</p>
                )}
              </div>
              <div>
                <h4 className="pmr-mini-h">{t("Change orders")}</h4>
                {linkedChanges.length ? (
                  linkedChanges.map((c) => <ChangeLink key={c.id} c={c} />)
                ) : (
                  <p className="muted small">{t("No change raised from it yet.")}</p>
                )}
              </div>
            </div>
          </Panel>
          <RelatedRfis rfi={rfi} />
        </div>
      </div>

      <SheetLightbox sheetId={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

function ChangeLink({ c }: { c: ChangeOrder }) {
  const { x, t } = useL();
  const cost = changeCost(c);
  return (
    <Link to={R.change(c.id)} className="pmr-linkcard">
      <span className="pmr-linkcard-top">
        <span className="k-ref">{c.ref}</span>
        <StatusBadge kind="change" status={c.status} />
      </span>
      <strong>{x(c.title)}</strong>
      <small>
        <span className={cost > 0 ? "k-text-bad" : "k-text-ok"}>{signed(cost, fmtMoneyShort)} AZN</span> · {t("{n} days", { n: signed(c.daysDelta, String) })}
      </small>
    </Link>
  );
}

/** Other questions on the same sheet. */
function RelatedRfis({ rfi }: { rfi: Rfi }) {
  const { t, x } = useL();
  const rfis = useOps((s) => s.rfis);
  const same = rfis.filter((r) => r.id !== rfi.id && r.sheetId && r.sheetId === rfi.sheetId);
  if (!same.length) return null;
  return (
    <Panel title={t("Also on {sheet}", { sheet: rfi.sheetId ?? "" })} pad={false}>
      <ul className="pmr-related">
        {same.map((r) => (
          <li key={r.id}>
            <Link to={R.rfi(r.id)}>
              <span className="k-ref">{r.ref}</span>
              <span className="truncate">{x(r.subject)}</span>
              <StatusBadge kind="rfi" status={rfiShownStatus(r)} />
              <ArrowRight size={13} />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

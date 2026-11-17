import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Camera, Check, ClipboardCheck, Link2, Minus, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Avatar, Breadcrumbs, DetailHeader, KeyFigure, LifecycleStrip, Meter, NextBar, Panel, StatusBadge, Timeline, toast, useL, type LifeStep } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { poTotal, R, statusMeta } from "../../../ops/select";
import { sheetById, sheetImage } from "../../../data";
import { sheetTitle } from "../../../lib/loc";
import { fmtMoneyShort } from "../../../lib/format";
import type { HistoryEvent, Inspection, InspectionStatus } from "../../../ops/types";
import { NotFound, SheetLightbox } from "./shared";
import { InspectionDialog, KIND_LABEL, type InspectionDraft } from "./InspectionDialog";

type Result = Inspection["checklist"][number]["result"];
const RESULTS: { value: Result; label: string; icon: typeof Check }[] = [
  { value: "OK", label: "OK", icon: Check },
  { value: "NOK", label: "NOK", icon: X },
  { value: "NA", label: "N/A", icon: Minus },
];
const OUTCOMES: { value: InspectionStatus; label: string; hint: string }[] = [
  { value: "PASSED", label: "Passed", hint: "Work can proceed." },
  { value: "PASSED_WITH_COMMENTS", label: "Passed with comments", hint: "Proceed once the comments are dealt with." },
  { value: "FAILED", label: "Failed", hint: "Stop. Raise an NCR so the fix is tracked." },
];

/** One inspection or NCR: the checklist with large OK / NOK / N/A toggles, the result, and the follow-up. */
export function InspectionDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const insp = useOps((s) => s.inspections.find((i) => i.id === id));
  const inspections = useOps((s) => s.inspections);
  const activities = useOps((s) => s.activities);
  const pos = useOps((s) => s.pos);
  const vendors = useOps((s) => s.vendors);
  const recordInspection = useOps((s) => s.recordInspection);
  const [list, setList] = useState<Inspection["checklist"]>(insp?.checklist ?? []);
  const [outcome, setOutcome] = useState<InspectionStatus | null>(null);
  const [notes, setNotes] = useState("");
  const [sheet, setSheet] = useState<string | null>(null);
  const [ncr, setNcr] = useState<InspectionDraft | null>(null);

  useEffect(() => {
    setList(insp?.checklist ?? []);
    setNotes(insp?.notes ? (lang === "az" ? insp.notes.az : insp.notes.en) : "");
    setOutcome(null);
  }, [insp?.id, insp?.checklist, insp?.notes, lang]);

  if (!insp) return <NotFound what={t("Inspection")} back={R.inspections} backLabel="Back to inspections" />;

  const isNcr = insp.kind === "NCR";
  const editable = insp.status === "REQUESTED" || (isNcr && insp.status === "OPEN");
  const nok = list.filter((c) => c.result === "NOK").length;
  const ok = list.filter((c) => c.result === "OK").length;
  const pending = list.filter((c) => c.result === "NA").length;
  const suggested: InspectionStatus = nok ? (nok >= 2 || list.length <= 2 ? "FAILED" : "PASSED_WITH_COMMENTS") : "PASSED";
  const chosen = outcome ?? suggested;
  const act = insp.activityId ? activities.find((a) => a.id === insp.activityId) : undefined;
  const po = insp.poId ? pos.find((p) => p.id === insp.poId) : undefined;
  const related = inspections.filter((i) => i.id !== insp.id && i.activityId && i.activityId === insp.activityId);
  const setResult = (i: number, r: Result) => setList((l) => l.map((c, j) => (j === i ? { ...c, result: r } : c)));
  const daysOpen = diffDays(insp.requestedAt, TODAY);

  const record = () => {
    recordInspection(insp.id, chosen, list, notes.trim());
    toast(t("{id} recorded: {result}", { id: insp.ref, result: t(OUTCOMES.find((o) => o.value === chosen)!.label) }), chosen === "FAILED" ? "bad" : "ok");
  };
  const closeNcr = () => {
    recordInspection(insp.id, "CLOSED", list, notes.trim());
    toast(t("{id} closed", { id: insp.ref }));
  };
  const raiseNcr = () =>
    setNcr({
      kind: "NCR",
      title: { en: `Non-conformance: ${insp.title.en}`, az: `Uyğunsuzluq: ${insp.title.az}` },
      activityId: insp.activityId,
      poId: insp.poId,
      location: insp.location,
      checklist: list.filter((c) => c.result === "NOK").length ? list.filter((c) => c.result === "NOK") : list,
      notes: { en: `Raised from ${insp.ref}. Corrective action: `, az: `${insp.ref} üzrə açılıb. Düzəldici tədbir: ` },
      photos: insp.photos,
      inspector: insp.inspector,
    });

  const events: HistoryEvent[] = [
    { at: insp.requestedAt, actor: "USER" as const, text: isNcr ? { en: `Raised by ${insp.inspector}`, az: `${insp.inspector} tərəfindən açılıb` } : { en: `Inspection requested from ${insp.inspector}`, az: `${insp.inspector}-dən yoxlama istənilib` } },
    ...(insp.inspectedAt && !isNcr ? [{ at: insp.inspectedAt, actor: "USER" as const, text: { en: `Inspected: ${insp.status.toLowerCase().replace(/_/g, " ")}`, az: `Yoxlanıldı: ${tAz(insp.status)}` } }] : []),
    ...related.filter((r) => r.kind === "NCR" && r.requestedAt >= insp.requestedAt).map((r) => ({ at: r.requestedAt, actor: "SYSTEM" as const, text: { en: `${r.ref} raised on the same activity`, az: `Eyni iş üzrə ${r.ref} açılıb` } })),
    ...(isNcr && insp.status === "CLOSED" ? [{ at: insp.inspectedAt ?? "", actor: "USER" as const, text: { en: "Closed after the corrective action", az: "Düzəldici tədbirdən sonra bağlanıb" } }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const stLabel = (s: InspectionStatus) => x(statusMeta("inspection", s).label);
  let life: LifeStep[];
  if (isNcr) {
    const source = inspections
      .filter((i) => i.kind !== "NCR" && i.status === "FAILED" && i.activityId && i.activityId === insp.activityId && (i.inspectedAt ?? i.requestedAt) <= insp.requestedAt)
      .sort((a, b) => (b.inspectedAt ?? b.requestedAt).localeCompare(a.inspectedAt ?? a.requestedAt))[0];
    life = [
      ...(source ? [{ label: t("{ref} failed", { ref: source.ref }), date: d(source.inspectedAt ?? source.requestedAt, false), href: R.inspection(source.id), state: "late" as const }] : []),
      { label: t("NCR raised"), date: d(insp.requestedAt, false), note: insp.inspector, state: "done" },
      { label: t("Corrective action"), note: insp.status === "OPEN" ? t("open {n} days", { n: daysOpen }) : undefined, state: insp.status === "OPEN" ? (daysOpen > 7 ? "late" : "current") : "done" },
      { label: t("Closed"), date: insp.status === "CLOSED" && insp.inspectedAt ? d(insp.inspectedAt, false) : undefined, state: insp.status === "CLOSED" ? "done" : "todo" },
    ];
  } else {
    const ncr = insp.status === "FAILED" ? inspections.find((i) => i.kind === "NCR" && i.activityId && i.activityId === insp.activityId && i.requestedAt >= (insp.inspectedAt ?? insp.requestedAt)) : undefined;
    const passed = insp.status === "PASSED" || insp.status === "PASSED_WITH_COMMENTS";
    life = [
      { label: t("Requested"), date: d(insp.requestedAt, false), note: insp.inspector, state: "done" },
      { label: t("Inspected"), date: insp.inspectedAt ? d(insp.inspectedAt, false) : t("booked {date}", { date: d(insp.requestedAt, false) }), state: insp.inspectedAt ? "done" : insp.requestedAt <= TODAY ? "current" : "todo" },
      { label: insp.status === "REQUESTED" ? t("Result") : stLabel(insp.status), note: nok ? t("{n} not OK", { n: nok }) : undefined, state: insp.status === "REQUESTED" ? "todo" : insp.status === "FAILED" ? "late" : "done" },
      insp.status === "FAILED"
        ? ncr
          ? { label: t("NCR {ref}", { ref: ncr.ref }), date: d(ncr.requestedAt, false), href: R.inspection(ncr.id), note: stLabel(ncr.status), state: ncr.status === "CLOSED" ? "done" : "current" }
          : { label: t("NCR"), note: t("to raise"), state: "late" }
        : { label: t("Closed"), date: passed && insp.inspectedAt ? d(insp.inspectedAt, false) : undefined, state: passed ? "done" : "todo" },
    ];
  }

  return (
    <div className="k-page">
      <Breadcrumbs items={[{ label: t("Project management"), to: R.pm }, { label: t("Inspections"), to: R.inspections }, { label: insp.ref }]} />

      <DetailHeader
        refCode={insp.ref}
        badges={
          <>
            <span className={`pmr-kind pmr-kind-${insp.kind}`}>{t(KIND_LABEL[insp.kind])}</span>
            <StatusBadge kind="inspection" status={insp.status} />
          </>
        }
        title={x(insp.title)}
        meta={
          <>
            <span>{x(insp.location)}</span>
            <span className="pmr-person">
              <Avatar name={insp.inspector} size={20} />
              {insp.inspector}
            </span>
            <span>{insp.inspectedAt ? t("inspected {date}", { date: d(insp.inspectedAt) }) : t("booked for {date}", { date: d(insp.requestedAt) })}</span>
          </>
        }
        aside={
          isNcr ? (
            <KeyFigure label={insp.status === "OPEN" ? t("Open for") : t("Status")} value={insp.status === "OPEN" ? t("{n} days", { n: daysOpen }) : t("Closed")} tone={insp.status === "OPEN" ? (daysOpen > 7 ? "bad" : "warn") : "ok"} sub={insp.status === "OPEN" ? t("raised {date}", { date: d(insp.requestedAt) }) : undefined} />
          ) : (
            <KeyFigure label={t("Checklist")} value={t("{a} of {b} OK", { a: ok, b: list.length })} tone={nok ? "bad" : pending ? undefined : "ok"} sub={nok ? t("{n} not OK", { n: nok }) : pending ? t("{n} still to check", { n: pending }) : t("all checks done")} />
          )
        }
      >
        <LifecycleStrip steps={life} />
      </DetailHeader>

      {insp.status === "REQUESTED" ? (
        <NextBar text={insp.requestedAt > TODAY ? t("Booked for {date}. Walk the checklist on site, then record the result.", { date: d(insp.requestedAt) }) : t("Walk the checklist on site, then record the result.")} />
      ) : insp.status === "FAILED" ? (
        <NextBar tone="bad" text={t("Failed. Raise a non-conformance so the fix is tracked and re-inspected.")}>
          <button type="button" className="btn btn-primary" onClick={raiseNcr}>
            <ShieldAlert size={14} />
            {t("Raise NCR")}
          </button>
        </NextBar>
      ) : isNcr && insp.status === "OPEN" ? (
        <NextBar tone="bad" text={t("Put it right, set every check to OK, then close the NCR.")}>
          <button type="button" className="btn btn-primary" disabled={nok > 0} onClick={closeNcr} title={nok ? t("Every check must be OK or N/A first.") : undefined}>
            <ShieldCheck size={14} />
            {t("Close NCR")}
          </button>
        </NextBar>
      ) : (
        <NextBar tone="ok" text={isNcr ? t("Closed. The fix was accepted.") : insp.status === "PASSED_WITH_COMMENTS" ? t("Passed with comments. Work can proceed once they are dealt with.") : t("Passed. Work can proceed.")} />
      )}

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Checklist")} icon={<ClipboardCheck size={15} />} count={list.length} sub={editable ? t("Tap a result for each check.") : undefined}>
            <ol className="pmr-checks">
              {list.map((c, i) => (
                <li key={`${c.item.en}-${i}`} className={`r-${c.result}`}>
                  <span className="pmr-check-n">{i + 1}</span>
                  <span className="pmr-check-text">{x(c.item)}</span>
                  <span className="pmr-check-toggles" role="radiogroup" aria-label={x(c.item)}>
                    {RESULTS.map((r) => {
                      const Icon = r.icon;
                      const on = c.result === r.value;
                      return (
                        <button key={r.value} type="button" role="radio" aria-checked={on} disabled={!editable} className={`pmr-check-btn v-${r.value}${on ? " on" : ""}`} onClick={() => setResult(i, r.value)}>
                          <Icon size={15} strokeWidth={2.5} />
                          <span>{t(r.label)}</span>
                        </button>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ol>
            <div className="pmr-check-sum">
              <Meter value={list.length ? ok / list.length : 0} tone={nok ? "bad" : "ok"} />
              <span className="muted small">{t("{ok} OK · {nok} not OK · {na} N/A", { ok, nok, na: pending })}</span>
            </div>
          </Panel>

          {insp.status === "REQUESTED" && !isNcr ? (
            <Panel title={t("Record result")} icon={<ShieldCheck size={15} />}>
              <div className="pmr-outcomes" role="radiogroup" aria-label={t("Result")}>
                {OUTCOMES.map((o) => (
                  <button key={o.value} type="button" role="radio" aria-checked={chosen === o.value} className={`pmr-outcome o-${o.value}${chosen === o.value ? " on" : ""}`} onClick={() => setOutcome(o.value)}>
                    <b>{t(o.label)}</b>
                    <small>{t(o.hint)}</small>
                    {o.value === suggested && outcome == null ? <em>{t("suggested by the checklist")}</em> : null}
                  </button>
                ))}
              </div>
              <label className="k-field">
                <span className="k-field-label">{t("Notes")}</span>
                <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Comments for the site team.")} />
              </label>
              <div className="k-row" style={{ marginTop: 12 }}>
                <span className="k-spacer" />
                <button type="button" className="btn btn-primary" onClick={record}>
                  {t("Record result")}
                </button>
              </div>
            </Panel>
          ) : null}

          {isNcr ? (
            <Panel title={t("Corrective action")} icon={<ShieldAlert size={15} />}>
              {insp.status === "OPEN" ? (
                <>
                  <textarea className="input pmr-full" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("What was done to put it right.")} />
                  <div className="k-row" style={{ marginTop: 12 }}>
                    {nok ? <span className="muted small">{t("Every check must be OK or N/A first.")}</span> : null}
                    <span className="k-spacer" />
                    <button type="button" className="btn btn-primary" disabled={nok > 0} onClick={closeNcr}>
                      <ShieldCheck size={14} />
                      {t("Close NCR")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="pmr-prose">{x(insp.notes) || t("No note recorded.")}</p>
              )}
            </Panel>
          ) : insp.status !== "REQUESTED" ? (
            <Panel title={t("Notes")}>
              <p className="pmr-prose">{x(insp.notes) || t("No comments.")}</p>
              {insp.status === "FAILED" ? (
                <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={raiseNcr}>
                  <ShieldAlert size={14} />
                  {t("Raise NCR")}
                </button>
              ) : null}
            </Panel>
          ) : null}

          <Panel title={t("History")}>
            <Timeline events={events} />
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Photos")} icon={<Camera size={15} />} count={insp.photos.length}>
            {insp.photos.length ? (
              <div className="pmr-photos">
                {insp.photos.map((p) => {
                  const sh = sheetById.get(p);
                  return (
                    <button key={p} type="button" className="pmr-photo" onClick={() => setSheet(p)} aria-label={t("Open sheet {id}", { id: p })}>
                      <img src={sheetImage(p, true)} alt="" loading="lazy" />
                      <span>
                        <b>{p}</b>
                        {sh ? <small className="truncate">{sheetTitle(sh, lang)}</small> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="muted small">{t("No photos attached.")}</p>
            )}
          </Panel>

          <Panel title={t("Linked work")} icon={<Link2 size={15} />}>
            <div className="k-stack">
              {act ? (
                <Link to={R.programme(act.id)} className="pmr-linkcard">
                  <span className="pmr-linkcard-top">
                    <span className="k-ref">{act.code}</span>
                    <StatusBadge kind="activity" status={act.status} />
                  </span>
                  <strong>{x(act.name)}</strong>
                  <Meter value={act.pct / 100} tone={act.status === "BLOCKED" ? "bad" : "brand"} />
                  <small>{t("{p}% done", { p: act.pct })}</small>
                </Link>
              ) : null}
              {po ? (
                <Link to={R.order(po.id)} className="pmr-linkcard">
                  <span className="pmr-linkcard-top">
                    <span className="k-ref">{po.ref}</span>
                    <StatusBadge kind="po" status={po.status} />
                  </span>
                  <strong>{vendors.find((v) => v.id === po.vendorId)?.name}</strong>
                  <small>
                    {fmtMoneyShort(poTotal(po))} AZN · {t("expected {date}", { date: d(po.expectedAt) })}
                  </small>
                </Link>
              ) : null}
              {!act && !po ? <p className="muted small">{t("Not linked to an activity or order.")}</p> : null}
            </div>
          </Panel>

          {related.length ? (
            <Panel title={t("Other records on this activity")} pad={false}>
              <ul className="pmr-related">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={R.inspection(r.id)}>
                      <span className="k-ref">{r.ref}</span>
                      <span className="truncate">{x(r.title)}</span>
                      <StatusBadge kind="inspection" status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>

      <SheetLightbox sheetId={sheet} onClose={() => setSheet(null)} />
      <InspectionDialog
        open={!!ncr}
        initial={ncr ?? undefined}
        onClose={() => setNcr(null)}
        onCreated={(nid) => {
          setNcr(null);
          navigate(R.inspection(nid));
        }}
      />
    </div>
  );
}

function tAz(s: InspectionStatus) {
  return { REQUESTED: "tələb edilib", PASSED: "keçib", PASSED_WITH_COMMENTS: "qeydlərlə keçib", FAILED: "keçməyib", OPEN: "açıq", CLOSED: "bağlanıb" }[s];
}

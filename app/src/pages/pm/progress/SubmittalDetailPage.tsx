import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, CheckCheck, FileImage, FileSearch, Link2, Maximize2, MessageSquare, Package, Plane, RotateCcw, Send, ShoppingCart, Trash2, Undo2, X } from "lucide-react";
import { Avatar, Breadcrumbs, DetailHeader, Empty, Kebab, KeyFigure, LifecycleStrip, Meter, NextBar, Panel, StatusBadge, toast, useL, type LifeStep } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { same, TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import { sheetById, sheetImage } from "../../../data";
import { sheetTitle } from "../../../lib/loc";
import { fmtNum, unitLabel } from "../../../lib/format";
import type { SubmittalStatus } from "../../../ops/types";
import { SheetLightbox } from "../records/shared";
import { Runway } from "./Runway";
import { mrForSubmittal, RP, SUB_META, SubBadge, subApproved, subDates } from "./shared";

const DECISIONS: { status: SubmittalStatus; label: string; icon: typeof Check; tone: string }[] = [
  { status: "APPROVED", label: "Approve", icon: CheckCheck, tone: "ok" },
  { status: "APPROVED_AS_NOTED", label: "Approve as noted", icon: Check, tone: "ok" },
  { status: "REVISE", label: "Revise and resubmit", icon: Undo2, tone: "warn" },
  { status: "REJECTED", label: "Reject", icon: X, tone: "bad" },
];

/** One submittal: its runway, the drawing it covers, the review decision and the hand-off to procurement. */
export function SubmittalDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const sub = useOps((s) => s.submittals.find((y) => y.id === id));
  const activities = useOps((s) => s.activities);
  const materials = useOps((s) => s.materials);
  const mrs = useOps((s) => s.mrs);
  const rfqs = useOps((s) => s.rfqs);
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const removeItem = useOps((s) => s.removeItem);
  const [comment, setComment] = useState("");
  const [sheet, setSheet] = useState<string | null>(null);

  // Once a request exists for the activity after approval, keep it on the submittal.
  const linkable = sub && subApproved(sub) && !sub.mrId ? mrForSubmittal(sub, mrs) : undefined;
  useEffect(() => {
    if (!sub || !linkable) return;
    patchItem("submittals", sub.id, { mrId: linkable.id });
    toast(t("{mr} linked to {id}", { mr: linkable.ref, id: sub.ref }));
  }, [sub, linkable, patchItem, t]);

  if (!sub)
    return (
      <div className="k-page">
        <Breadcrumbs items={[{ label: t("Project management"), to: R.pm }, { label: t("Submittals"), to: RP.submittals }, { label: id }]} />
        <Empty icon={<FileSearch size={20} />} title={t("Submittal not found")} action={<Link to={RP.submittals} className="btn btn-ghost">{t("Back to submittals")}</Link>}>
          {t("It may have been removed, or the link is wrong.")}
        </Empty>
      </div>
    );

  const { act, required, finalDue, late, daysToDue } = subDates(sub, activities);
  const approved = subApproved(sub);
  const decided = approved || sub.status === "REVISE" || sub.status === "REJECTED";
  const inReview = sub.status === "SUBMITTED" || sub.status === "UNDER_REVIEW";
  const mat = sub.material ? materials.find((m) => m.key === sub.material) : undefined;
  const mr = sub.mrId ? mrs.find((m) => m.id === sub.mrId) : undefined;
  const rfq = mr ? rfqs.find((r) => r.mrId === mr.id) : undefined;
  const sh = sub.sheetId ? sheetById.get(sub.sheetId) : undefined;

  const setStatus = (status: SubmittalStatus, patch: Partial<typeof sub> = {}, text?: string) => {
    const note = comment.trim();
    patchItem("submittals", sub.id, { status, ...(note ? { comments: same(note) } : {}), ...patch });
    pushFeed("PM", { en: `${sub.ref} ${SUB_META[status].label.toLowerCase()}${note ? `: ${note}` : ""}`, az: `${sub.ref}: ${SUB_META[status].az}${note ? ` — ${note}` : ""}` }, `pm/submittals/${sub.id}`);
    setComment("");
    toast(text ?? t("{id}: {status}", { id: sub.ref, status: t(SUB_META[status].label) }), status === "REJECTED" ? "bad" : status === "REVISE" ? "warn" : "ok");
  };
  const raiseMr = () => navigate(sub.activityId ? `${R.newRequest}?activity=${sub.activityId}` : R.newRequest);

  const steps: LifeStep[] = [
    { label: t("Prepared"), note: t("Rev {n}", { n: sub.rev }), state: sub.status === "DRAFT" ? "current" : "done" },
    { label: t("Submitted"), date: t("by {date}", { date: d(sub.submitBy, false) }), state: sub.status === "DRAFT" ? (sub.submitBy < TODAY ? "late" : "todo") : "done" },
    { label: t("Review"), note: sub.reviewer, state: inReview ? "current" : decided ? "done" : "todo" },
    {
      label: decided ? t(SUB_META[sub.status].label) : t("Decision"),
      date: t("by {date}", { date: d(finalDue, false) }),
      state: approved ? "done" : decided ? "late" : late ? "late" : "todo",
      note: late && !decided ? t("{n} days late", { n: -daysToDue }) : undefined,
    },
    { label: t("Request raised"), note: mr ? mr.ref : undefined, href: mr ? R.request(mr.id) : undefined, state: mr ? "done" : approved ? "current" : "todo" },
    { label: t("On site"), date: d(required, false), state: act?.aStart ? "done" : "todo", href: act ? R.programme(act.id) : undefined, note: act?.code },
  ];

  return (
    <div className="k-page">
      <Breadcrumbs items={[{ label: t("Project management"), to: R.pm }, { label: t("Submittals"), to: RP.submittals }, { label: sub.ref }]} />

      <DetailHeader
        refCode={sub.ref}
        badges={
          <>
            <SubBadge status={sub.status} />
            <span className="k-badge k-tone-neutral">{t("Rev {n}", { n: sub.rev })}</span>
          </>
        }
        title={x(sub.title)}
        meta={
          <>
            <span className="k-mono">{sub.spec}</span>
            <span>{sub.manufacturer}</span>
            <span className="pg-person">
              <Avatar name={sub.reviewer} size={20} />
              {sub.reviewer}
            </span>
            {act ? <Link to={R.programme(act.id)}>{act.code}</Link> : null}
          </>
        }
        aside={
          <KeyFigure
            label={t("Final due")}
            value={d(finalDue)}
            tone={approved ? "ok" : late ? "bad" : daysToDue <= 14 ? "warn" : undefined}
            sub={approved ? t("approved in time to order") : late ? t("{n} days late: the material will arrive late", { n: -daysToDue }) : t("{n} days left to approve", { n: daysToDue })}
          />
        }
      >
        <LifecycleStrip steps={steps} />
      </DetailHeader>

      {sub.status === "DRAFT" ? (
        <NextBar tone={sub.submitBy < TODAY ? "bad" : "brand"} text={t("Draft. Send it to {who} by {date}.", { who: sub.reviewer, date: d(sub.submitBy) })}>
          <button type="button" className="btn btn-primary" onClick={() => setStatus("SUBMITTED", {}, t("{id} submitted to {who}", { id: sub.ref, who: sub.reviewer }))}>
            <Send size={14} />
            {t("Submit for review")}
          </button>
          {sub.rev === 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                removeItem("submittals", sub.id);
                toast(t("{id} deleted", { id: sub.ref }), "muted");
                navigate(RP.submittals);
              }}
            >
              <Trash2 size={14} />
              {t("Delete draft")}
            </button>
          ) : null}
        </NextBar>
      ) : sub.status === "SUBMITTED" ? (
        <NextBar text={t("With {who}. Start the review, or record the decision below.", { who: sub.reviewer })}>
          <button type="button" className="btn btn-primary" onClick={() => setStatus("UNDER_REVIEW")}>
            <FileSearch size={14} />
            {t("Start review")}
          </button>
        </NextBar>
      ) : sub.status === "UNDER_REVIEW" ? (
        <NextBar tone="warn" text={late ? t("Under review and past the final due date. Decide now, or the material arrives late.") : t("Under review. Record the decision below.")}>
          <button type="button" className="btn btn-primary" onClick={() => setStatus("APPROVED")}>
            <CheckCheck size={14} />
            {t("Approve")}
          </button>
          <Kebab items={DECISIONS.slice(1).map((dc) => ({ label: t(dc.label), icon: <dc.icon size={14} />, danger: dc.status === "REJECTED", onClick: () => setStatus(dc.status) }))} />
        </NextBar>
      ) : sub.status === "REVISE" ? (
        <NextBar tone="bad" text={t("Returned for revision. Fix the comments and resubmit as rev {n}.", { n: sub.rev + 1 })}>
          <button type="button" className="btn btn-primary" onClick={() => setStatus("SUBMITTED", { rev: sub.rev + 1, submitBy: TODAY }, t("{id} resubmitted as rev {n}", { id: sub.ref, n: sub.rev + 1 }))}>
            <RotateCcw size={14} />
            {t("Resubmit rev {n}", { n: sub.rev + 1 })}
          </button>
        </NextBar>
      ) : sub.status === "REJECTED" ? (
        <NextBar tone="bad" text={t("Rejected. Start a new revision with another product or maker.")}>
          <button type="button" className="btn btn-primary" onClick={() => setStatus("DRAFT", { rev: sub.rev + 1 }, t("{id} reopened as rev {n}", { id: sub.ref, n: sub.rev + 1 }))}>
            <RotateCcw size={14} />
            {t("Start rev {n}", { n: sub.rev + 1 })}
          </button>
        </NextBar>
      ) : (
        <NextBar tone="ok" text={mr ? t("Approved — ready for procurement. {mr} is raised; send it out for quotes.", { mr: mr.ref }) : act ? t("Approved — ready for procurement. Raise the material request for {code}.", { code: act.code }) : t("Approved — ready for procurement. Raise the material request.")}>
          {mr ? (
            <>
              {rfq ? (
                <Link to={R.rfq(rfq.id)} className="btn btn-primary">
                  {t("Open {ref}", { ref: rfq.ref })}
                </Link>
              ) : (
                <Link to={R.newRfq(mr.id)} className="btn btn-primary">
                  <Send size={14} />
                  {t("Create RFQ")}
                </Link>
              )}
              <Link to={R.request(mr.id)} className="btn btn-ghost">
                {mr.ref}
              </Link>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={raiseMr}>
              <ShoppingCart size={14} />
              {t("Create MR")}
            </button>
          )}
        </NextBar>
      )}

      <div className="k-grid-main">
        <div className="k-stack">
          {inReview ? (
            <Panel title={t("Review")} icon={<MessageSquare size={15} />} sub={t("Record the reviewer's decision. The comment is kept on the submittal.")}>
              <textarea className="input pg-full" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("Reviewer's comments (optional)")} aria-label={t("Reviewer's comments (optional)")} />
              <div className="pg-decisions">
                {DECISIONS.map((dc) => (
                  <button key={dc.status} type="button" className={`pg-decision k-tone-${dc.tone}`} onClick={() => setStatus(dc.status)}>
                    <dc.icon size={15} />
                    {t(dc.label)}
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title={t("Comments")} icon={<MessageSquare size={15} />}>
            {sub.comments ? (
              <blockquote className="pg-quote">
                <p>{x(sub.comments)}</p>
                <footer>
                  <Avatar name={sub.reviewer} size={20} />
                  <span>
                    <b>{sub.reviewer}</b> · {t("Rev {n}", { n: sub.rev })}
                  </span>
                </footer>
              </blockquote>
            ) : (
              <p className="muted small">{sub.status === "DRAFT" || inReview ? t("Comments appear here once it is reviewed.") : t("No comments from the reviewer.")}</p>
            )}
          </Panel>

          <Panel title={t("Runway")} icon={<Plane size={15} />} sub={t("Submit by, final due and required on site, against today.")} pad={false}>
            <Runway items={[sub]} activities={activities} focus={sub.id} />
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Drawing")} icon={<FileImage size={15} />}>
            {sh ? (
              <figure className="pg-sheet">
                <button type="button" onClick={() => setSheet(sh.id)} aria-label={t("Open sheet {id}", { id: sh.id })}>
                  <img src={sheetImage(sh.id, true)} alt={sheetTitle(sh, lang)} loading="lazy" />
                  <span>
                    <Maximize2 size={13} />
                    {t("Open larger")}
                  </span>
                </button>
                <figcaption>
                  <b>{sh.id}</b>
                  <span className="truncate">{sheetTitle(sh, lang)}</span>
                </figcaption>
              </figure>
            ) : (
              <p className="muted small">{t("No drawing sheet referenced.")}</p>
            )}
          </Panel>

          <Panel title={t("Linked work")} icon={<Link2 size={15} />}>
            <div className="k-stack">
              {act ? (
                <Link to={R.programme(act.id)} className="pg-linkcard">
                  <span className="pg-linkcard-top">
                    <span className="k-ref">{act.code}</span>
                    <StatusBadge kind="activity" status={act.status} />
                  </span>
                  <strong>{x(act.name)}</strong>
                  <Meter value={act.pct / 100} tone={act.status === "BLOCKED" ? "bad" : "brand"} />
                  <small>{act.aStart ? t("started {date}", { date: d(act.aStart) }) : t("starts {date}", { date: d(act.start) })}</small>
                </Link>
              ) : null}
              {mat ? (
                <Link to={RP.material(mat.key)} className="pg-linkcard">
                  <span className="pg-linkcard-top">
                    <span className="k-ref">
                      <Package size={12} /> {t("Material")}
                    </span>
                  </span>
                  <strong>{x(mat.name)}</strong>
                  <small>{t("BOQ quantity {q} {u}", { q: fmtNum(mat.budgetQty, 0), u: unitLabel(mat.unit, lang) })}</small>
                </Link>
              ) : null}
              {mr ? (
                <Link to={R.request(mr.id)} className="pg-linkcard">
                  <span className="pg-linkcard-top">
                    <span className="k-ref">{mr.ref}</span>
                    <StatusBadge kind="mr" status={mr.status} />
                  </span>
                  <strong>{x(mr.title)}</strong>
                  <small>{t("needed by {date}", { date: d(mr.neededBy) })}</small>
                </Link>
              ) : approved ? (
                <button type="button" className="pg-linkcard pg-linkcard-add" onClick={raiseMr}>
                  <ShoppingCart size={15} />
                  <strong>{t("Create MR")}</strong>
                  <small>{t("The request is linked here once it exists.")}</small>
                </button>
              ) : null}
              {!act && !mat && !mr ? <p className="muted small">{t("Not linked to an activity or material.")}</p> : null}
            </div>
          </Panel>
        </div>
      </div>

      <SheetLightbox sheetId={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}

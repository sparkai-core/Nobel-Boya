import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarRange, Check, FileQuestion, Landmark, ListOrdered, RotateCcw, Save, Send, X } from "lucide-react";
import { Badge, Breadcrumbs, DetailHeader, Kebab, KeyFigure, LifecycleStrip, NextBar, Panel, StatusBadge, toast, useL, type LifeStep } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays } from "../../../ops/dates";
import { cpm, R } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort } from "../../../lib/format";
import { updateChange } from "../../../ops/ext/records";
import type { ChangeStatus } from "../../../ops/types";
import { changeCost, NotFound, rfiShownStatus, signed, worksValue } from "./shared";
import { ChangeLines, type ChangeLine } from "./ChangeLines";
import { reasonLabel } from "./ChangeDialog";

/** One change order: priced lines, its effect on the contract value and on the programme. */
export function ChangeDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d } = useL();
  const change = useOps((s) => s.changes.find((c) => c.id === id));
  const changes = useOps((s) => s.changes);
  const rfis = useOps((s) => s.rfis);
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const setChangeStatus = useOps((s) => s.setChangeStatus);
  const [lines, setLines] = useState<ChangeLine[]>(change?.lines ?? []);
  const crit = useMemo(() => cpm(activities, links), [activities, links]);

  useEffect(() => {
    setLines(change?.lines ?? []);
    // Reload the editable copy when another change is opened or the stored lines change.
  }, [change?.id, change?.lines]);

  if (!change) return <NotFound what={t("Change")} back={R.changes} backLabel="Back to changes" />;

  const draft = change.status === "DRAFT";
  const shownLines = draft ? lines : change.lines;
  const cost = changeCost({ lines: shownLines });
  const dirty = draft && JSON.stringify(lines) !== JSON.stringify(change.lines);
  const rfi = change.rfiId ? rfis.find((r) => r.id === change.rfiId) : undefined;
  const act = rfi?.activityId ? activities.find((a) => a.id === rfi.activityId) : undefined;
  const actCpm = act ? crit.get(act.id) : undefined;

  const approvedOthers = changes.filter((c) => c.status === "APPROVED" && c.id !== change.id).reduce((a, c) => a + changeCost(c), 0);
  const before = worksValue() + approvedOthers;
  const after = before + cost;
  const rejected = change.status === "REJECTED";
  const base = Math.max(before, after, Math.abs(cost));
  const deltaW = base > 0 ? Math.min(40, Math.max(1.2, (Math.abs(cost) / base) * 100 * 25)) : 1.2;
  const wv = worksValue();
  const order = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"];
  const at = rejected ? 3 : order.indexOf(change.status);
  const life: LifeStep[] = [
    { label: t("Raised"), date: d(change.raisedAt, false), note: rfi ? rfi.ref : undefined, href: rfi ? R.rfi(rfi.id) : undefined, state: "done" },
    { label: t("Submitted"), note: at === 0 ? t("still a draft") : undefined, state: at === 0 ? "current" : "done" },
    { label: t("Review"), note: t("client's engineer"), state: at === 3 ? "done" : at >= 1 ? "current" : "todo" },
    {
      label: rejected ? t("Rejected") : change.status === "APPROVED" ? t("Approved") : t("Decided"),
      date: change.decidedAt ? d(change.decidedAt, false) : undefined,
      note: change.decidedAt ? t("{n} days after raising", { n: diffDays(change.raisedAt, change.decidedAt) }) : undefined,
      state: rejected ? "late" : change.status === "APPROVED" ? "done" : "todo",
    },
  ];

  const move = (status: ChangeStatus, msg: string) => {
    if (dirty) updateChange(change.id, { lines });
    setChangeStatus(change.id, status);
    toast(t(msg, { id: change.ref }), status === "REJECTED" ? "bad" : "ok");
  };

  const save = () => {
    updateChange(change.id, { lines });
    toast(t("Lines saved on {id}", { id: change.ref }));
  };

  const verdict =
    change.daysDelta <= 0
      ? { tone: "ok", text: change.daysDelta < 0 ? t("Saves {n} days of work.", { n: -change.daysDelta }) : t("No extra time claimed.") }
      : actCpm && actCpm.tf >= change.daysDelta
        ? { tone: "warn", text: t("Absorbed by the float of {code} ({n} days).", { code: act!.code, n: actCpm.tf }) }
        : { tone: "bad", text: act ? t("{code} has {f} days of float, so the finish moves by about {n} days.", { code: act.code, f: Math.max(0, actCpm?.tf ?? 0), n: change.daysDelta - Math.max(0, actCpm?.tf ?? 0) }) : t("Moves the finish by up to {n} days if the work is on the critical path.", { n: change.daysDelta }) };

  return (
    <div className="k-page">
      <Breadcrumbs items={[{ label: t("Project management"), to: R.pm }, { label: t("Changes"), to: R.changes }, { label: change.ref }]} />

      <DetailHeader
        refCode={change.ref}
        badges={
          <>
            <Badge tone={change.reason === "CLIENT" ? "brand" : change.reason === "RFI" ? "info" : change.reason === "SITE" ? "warn" : "neutral"}>{t(reasonLabel(change.reason))}</Badge>
            <StatusBadge kind="change" status={change.status} />
          </>
        }
        title={x(change.title)}
        meta={
          <>
            <span>{t("raised {date}", { date: d(change.raisedAt) })}</span>
            {change.decidedAt ? <span>{t("decided {date}", { date: d(change.decidedAt) })}</span> : null}
            {rfi ? <Link to={R.rfi(rfi.id)}>{rfi.ref}</Link> : null}
          </>
        }
        aside={
          <div className="pmr-keyfigs">
            <KeyFigure label={t("Cost change")} value={<span className="pmr-big">{signed(cost, fmtMoney)} <small className="k-cur">AZN</small></span>} tone={cost > 0 ? "bad" : cost < 0 ? "ok" : undefined} sub={wv > 0 ? t("{p} of the works value", { p: `${((cost / wv) * 100).toFixed(2)}%` }) : undefined} />
            <KeyFigure label={t("Programme")} value={t("{n} days", { n: signed(change.daysDelta, String) })} tone={change.daysDelta > 0 ? "warn" : change.daysDelta < 0 ? "ok" : undefined} />
          </div>
        }
      >
        <LifecycleStrip steps={life} />
      </DetailHeader>

      {change.status === "DRAFT" ? (
        <NextBar text={t("Draft. Check the lines and the days, then submit it to the client's engineer.")}>
          <button type="button" className="btn btn-primary" disabled={!shownLines.length} onClick={() => move("SUBMITTED", "{id} submitted")}>
            <Send size={14} />
            {t("Submit")}
          </button>
          <Kebab items={[{ label: t("Withdraw (reject)"), icon: <X size={14} />, danger: true, onClick: () => move("REJECTED", "{id} withdrawn") }]} />
        </NextBar>
      ) : change.status === "SUBMITTED" ? (
        <NextBar text={t("With the engineer. Start the review to price and check it.")}>
          <button type="button" className="btn btn-primary" onClick={() => move("UNDER_REVIEW", "{id} under review")}>
            {t("Start review")}
          </button>
          <Kebab items={[{ label: t("Return to draft"), icon: <RotateCcw size={14} />, onClick: () => move("DRAFT", "{id} returned to draft") }]} />
        </NextBar>
      ) : change.status === "UNDER_REVIEW" ? (
        <NextBar tone="warn" text={t("Under review. Approving adds {v} AZN to the contract value.", { v: signed(cost, fmtMoney) })}>
          <button type="button" className="btn btn-primary" onClick={() => move("APPROVED", "{id} approved")}>
            <Check size={14} />
            {t("Approve")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => move("REJECTED", "{id} rejected")}>
            <X size={14} />
            {t("Reject")}
          </button>
        </NextBar>
      ) : change.status === "APPROVED" ? (
        <NextBar tone="ok" text={t("Approved on {date}. The contract value now includes it.", { date: d(change.decidedAt) })} />
      ) : (
        <NextBar tone="bad" text={t("Rejected on {date}. It is not part of the contract value.", { date: d(change.decidedAt) })}>
          <button type="button" className="btn btn-ghost" onClick={() => move("DRAFT", "{id} reopened as a draft")}>
            <RotateCcw size={14} />
            {t("Reopen as draft")}
          </button>
        </NextBar>
      )}

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel
            title={t("Priced lines")}
            icon={<ListOrdered size={15} />}
            count={shownLines.length}
            sub={draft ? t("Editable while the change is a draft. Rates default from the BOQ.") : t("Quantity change × rate = amount.")}
            actions={
              dirty ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={save}>
                  <Save size={13} />
                  {t("Save lines")}
                </button>
              ) : null
            }
          >
            <ChangeLines lines={shownLines} onChange={setLines} editable={draft} />
          </Panel>

          <div className="k-grid-2">
            <Panel title={t("Effect on the contract")} icon={<Landmark size={15} />}>
              <div className="pmr-effect">
                <div>
                  <small>{t("Before")}</small>
                  <b className="num-inline">{fmtMoneyShort(before)}</b>
                </div>
                <ArrowRight size={16} className="muted" />
                <div>
                  <small>{t("After")}</small>
                  <b className="num-inline">{fmtMoneyShort(after)}</b>
                </div>
              </div>
              <div className="pmr-effect-bar" aria-hidden="true">
                <i style={{ width: `${100 - deltaW}%` }} />
                <i className={cost >= 0 ? "add" : "cut"} style={{ width: `${deltaW}%` }} />
              </div>
              <p className="muted small">
                {t("Works value {w} AZN, plus {n} other approved changes.", { w: fmtMoneyShort(worksValue()), n: changes.filter((c) => c.status === "APPROVED" && c.id !== change.id).length })} {t("The change is drawn 25× larger so it can be seen.")}
              </p>
            </Panel>

            <Panel title={t("Effect on the programme")} icon={<CalendarRange size={15} />}>
              <div className="pmr-effect">
                <div>
                  <small>{t("Days claimed")}</small>
                  <b className={`num-inline ${change.daysDelta > 0 ? "k-text-warn" : change.daysDelta < 0 ? "k-text-ok" : ""}`}>{signed(change.daysDelta, String)}</b>
                </div>
                {act ? (
                  <Link to={R.programme(act.id)} className="pmr-effect-act">
                    <span className="k-ref">{act.code}</span>
                    <span className="truncate">{x(act.name)}</span>
                  </Link>
                ) : null}
              </div>
              <div className={`k-callout k-tone-${verdict.tone}`}>{verdict.text}</div>
              {!act ? <p className="muted small">{t("No activity is linked. Link an RFI to tie the change to the programme.")}</p> : null}
            </Panel>
          </div>
        </div>

        <div className="k-stack">
          <Panel title={t("Description")}>
            <p className="pmr-prose">{x(change.description)}</p>
          </Panel>
          <Panel title={t("Linked RFI")} icon={<FileQuestion size={15} />}>
            {rfi ? (
              <Link to={R.rfi(rfi.id)} className="pmr-linkcard">
                <span className="pmr-linkcard-top">
                  <span className="k-ref">{rfi.ref}</span>
                  <StatusBadge kind="rfi" status={rfiShownStatus(rfi)} />
                </span>
                <strong>{x(rfi.subject)}</strong>
                {rfi.answer ? <small className="pmr-clamp">“{x(rfi.answer)}”</small> : <small>{t("Not answered yet.")}</small>}
              </Link>
            ) : (
              <p className="muted small">{t("This change did not come from an RFI.")}</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

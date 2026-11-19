import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, Check, Eye, MessageSquareText, PenLine, X } from "lucide-react";
import { Badge, Empty, PageHero, StatusBadge, toast, useL } from "../../components/kit";
import { Segmented } from "../../components/ui";
import { useOps } from "../../ops/store";
import { addDays, diffDays, maxDate, minDate, TODAY } from "../../ops/dates";
import { tradeName } from "../../ops/select";
import { fmtQty, unitLabel } from "../../lib/format";
import { BUCKET_LABEL, BUCKET_TONE, buyerName, useVendor, VP, type Bucket, type InviteRow } from "./model";
import { Countdown, DeclineDialog, OutcomeBadge, useEyebrow } from "./parts";

type Filter = Bucket | "all";

/** RFQ inbox: a due-date timeline of every invitation, then one card per RFQ with its countdown and lines. */
export function VpRfqInbox() {
  const { t } = useL();
  const eyebrow = useEyebrow();
  const navigate = useNavigate();
  const { view } = useVendor();
  const [filter, setFilter] = useState<Filter>("answer");
  const [declining, setDeclining] = useState<InviteRow | null>(null);

  const invites = view?.invites ?? [];
  const counts = useMemo(() => invites.reduce<Record<string, number>>((a, i) => ((a[i.bucket] = (a[i.bucket] ?? 0) + 1), a), {}), [invites]);
  const effective: Filter = filter !== "all" && !counts[filter] && invites.length ? (filter === "answer" && counts.sent ? "sent" : "all") : filter;
  const rows = invites.filter((i) => effective === "all" || i.bucket === effective);

  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;

  return (
    <div className="k-page vp-page">
      <PageHero
        eyebrow={eyebrow("RFQ inbox")}
        title={t("Requests for quotation")}
        subtitle={t("What {buyer} has asked you to price, and when each answer is due.", { buyer: buyerName() })}
        flow={["Invited", "Acknowledge", "Prepare quote", "Sent to the buyer"]}
        art="rfq"
      />

      <DueTimeline rows={invites} onPick={(r) => navigate(VP.rfq(r.rfq.id))} />

      <div className="vp-filterbar">
        <Segmented<Filter>
          label={t("Filter requests")}
          value={effective}
          onChange={setFilter}
          options={[
            { value: "answer", label: t("To answer"), count: counts.answer ?? 0 },
            { value: "sent", label: t("Quote sent"), count: counts.sent ?? 0 },
            { value: "closed", label: t("Closed"), count: counts.closed ?? 0 },
            { value: "all", label: t("All"), count: invites.length },
          ]}
        />
        {effective !== filter ? <span className="muted small">{t("Nothing to answer right now, showing the rest.")}</span> : null}
      </div>

      {rows.length ? (
        <div className="vp-rfqs">
          {rows.map((r, i) => (
            <RfqCard key={r.rfq.id} row={r} vendorId={view.vendor.id} index={i} onDecline={() => setDeclining(r)} />
          ))}
        </div>
      ) : (
        <Empty icon={<CalendarClock size={20} />} title={t("No requests here")}>
          {t("When {buyer} invites you to quote, the request appears in this inbox.", { buyer: buyerName() })}
        </Empty>
      )}

      {declining ? <DeclineDialog open onClose={() => setDeclining(null)} rfqId={declining.rfq.id} rfqRef={declining.rfq.ref} vendorId={view.vendor.id} /> : null}
    </div>
  );
}

function RfqCard({ row, vendorId, index, onDecline }: { row: InviteRow; vendorId: string; index: number; onDecline: () => void }) {
  const { t, x, d, rel, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const vendorRespond = useOps((st) => st.vendorRespond);
  const { rfq, inv, bucket, quote } = row;
  const shown = rfq.lines.slice(0, 4);
  const open = bucket === "answer";
  const ack = () => {
    vendorRespond(rfq.id, vendorId, "ACKNOWLEDGED");
    toast(t("{ref} acknowledged. The buyer can see you are pricing it.", { ref: rfq.ref }));
  };
  return (
    <article className={`vp-rfq b-${bucket}`} style={{ animationDelay: `${index * 50}ms` }}>
      <div className="vp-rfq-side">
        <Countdown due={rfq.dueDate} closed={rfq.status !== "OPEN"} size={68} />
        {rfq.status === "OPEN" ? <small>{d(rfq.dueDate, false)}</small> : null}
      </div>
      <div className="vp-rfq-body">
        <header className="vp-rfq-head">
          <span className="k-ref">{rfq.ref}</span>
          <Badge tone={BUCKET_TONE[bucket]}>{t(BUCKET_LABEL[bucket])}</Badge>
          {inv.status === "INVITED" && open ? <Badge tone="info" dot={false}>{t("New")}</Badge> : inv.status !== "SUBMITTED" ? <StatusBadge kind="invite" status={inv.status} /> : null}
          {rfq.status !== "OPEN" ? <StatusBadge kind="rfq" status={rfq.status} /> : null}
          {quote ? <OutcomeBadge s={s} q={quote} /> : null}
        </header>
        <Link to={VP.rfq(rfq.id)} className="vp-rfq-title">
          {x(rfq.title)}
        </Link>
        <p className="vp-rfq-meta">
          {tradeName(rfq.trade, lang)} · {t("{n} lines", { n: rfq.lines.length })} · {t("sent {date}", { date: d(rfq.createdAt) })} ·{" "}
          <b className={open && row.daysLeft <= 3 ? "k-text-bad" : undefined}>
            {rfq.status === "OPEN" ? t("closes {when}", { when: rel(rfq.dueDate) }) : t("closed {date}", { date: d(rfq.dueDate) })}
          </b>
        </p>
        <table className="vp-items">
          <thead>
            <tr>
              <th>{t("Item")}</th>
              <th className="r">{t("Qty")}</th>
              <th className="hide-820">{t("Spec")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.key}>
                <td>{x(l.description)}</td>
                <td className="r num-inline">
                  {fmtQty(l.qty, l.unit)} <small>{unitLabel(l.unit, lang)}</small>
                </td>
                <td className="hide-820 muted">{l.spec ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rfq.lines.length > shown.length ? <p className="muted small">{t("and {n} more lines", { n: rfq.lines.length - shown.length })}</p> : null}
        {rfq.note ? (
          <div className="vp-buyer-note">
            <MessageSquareText size={14} />
            <span>
              <b>{t("Note from the buyer")}</b> {x(rfq.note)}
            </span>
          </div>
        ) : null}
        {inv.status === "DECLINED" && inv.reason ? (
          <p className="vp-declined">
            <X size={13} /> {t("You declined: {reason}", { reason: inv.reason })}
          </p>
        ) : null}
        <footer className="vp-rfq-actions">
          {open ? (
            <>
              {inv.status === "INVITED" ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={ack}>
                  <Check size={14} />
                  {t("Acknowledge")}
                </button>
              ) : (
                <span className="vp-acked">
                  <Check size={13} /> {t("Acknowledged {when}", { when: rel(inv.at.slice(0, 10)) })}
                </span>
              )}
              <button type="button" className="btn btn-ghost btn-sm vp-danger" onClick={onDecline}>
                <X size={14} />
                {t("Decline")}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(VP.rfq(rfq.id))}>
                <PenLine size={14} />
                {t("Prepare quote")}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(VP.rfq(rfq.id))}>
              <Eye size={14} />
              {quote ? t("View your quote") : t("View request")}
              <ArrowRight size={13} />
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}

/** One flag per invitation on a date axis. Past-due ones sit in a red box left of today. */
function DueTimeline({ rows, onPick }: { rows: InviteRow[]; onPick: (r: InviteRow) => void }) {
  const { t, d } = useL();
  if (!rows.length) return null;
  const from = addDays(minDate(TODAY, ...rows.map((r) => r.rfq.createdAt.slice(0, 10))), -3);
  const to = addDays(maxDate(addDays(TODAY, 14), ...rows.map((r) => r.rfq.dueDate)), 4);
  const span = Math.max(1, diffDays(from, to));
  const X = (date: string) => (diffDays(from, date) / span) * 100;
  const sorted = [...rows].sort((a, b) => a.rfq.dueDate.localeCompare(b.rfq.dueDate));
  const lanes: number[] = [];
  const placed = sorted.map((r) => {
    const x = X(r.rfq.dueDate);
    let lane = lanes.findIndex((end) => end < x - 1);
    if (lane < 0) {
      lane = lanes.length < 3 ? lanes.length : 0;
    }
    lanes[lane] = x + 16;
    return { r, x, lane };
  });
  const pastDue = rows.filter((r) => r.bucket === "answer" && r.rfq.dueDate < TODAY);
  const ticks: string[] = [];
  for (let i = 0; i <= span; i += Math.max(7, Math.round(span / 6 / 7) * 7)) ticks.push(addDays(from, i));
  const nextDue = rows.filter((r) => r.bucket === "answer").sort((a, b) => a.rfq.dueDate.localeCompare(b.rfq.dueDate))[0];

  return (
    <section className="vp-due" aria-label={t("When your quotes are due")}>
      <header className="vp-due-head">
        <h2>{t("When your quotes are due")}</h2>
        <p>
          {pastDue.length ? <b className="k-text-bad">{t("{n} past due", { n: pastDue.length })} · </b> : null}
          {nextDue ? t("Next answer due {date}", { date: d(nextDue.rfq.dueDate) }) : t("No answers due")}
        </p>
      </header>
      <div className="vp-due-scroll">
        <div className="vp-due-chart">
          <div className={`vp-due-past${pastDue.length ? " has" : ""}`} style={{ width: `${X(TODAY)}%` }}>
            <span>{pastDue.length ? t("Past due") : t("Past")}</span>
          </div>
          {placed.map(({ r, x, lane }) => {
            const late = r.bucket === "answer" && r.rfq.dueDate < TODAY;
            const soon = r.bucket === "answer" && !late && r.daysLeft <= 3;
            return (
              <button
                key={r.rfq.id}
                type="button"
                className={`vp-flag b-${r.bucket}${late ? " late" : ""}${soon ? " soon" : ""}${x > 82 ? " flip" : ""}`}
                style={{ left: `${x}%`, ["--lane" as string]: lane }}
                onClick={() => onPick(r)}
                title={`${r.rfq.ref} · ${d(r.rfq.dueDate)}`}
              >
                <span className="vp-flag-label">
                  <b>{r.rfq.ref}</b>
                  <small>{d(r.rfq.dueDate, false)}</small>
                </span>
              </button>
            );
          })}
          <div className="vp-due-today" style={{ left: `${X(TODAY)}%` }}>
            <span>{t("Today")}</span>
          </div>
          <div className="vp-due-axis">
            {ticks.map((tk) => (
              <span key={tk} style={{ left: `${X(tk)}%` }}>
                {d(tk, false)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="vp-due-key">
        <span className="b-answer">{t("To answer")}</span>
        <span className="b-soon">{t("Closing in 3 days")}</span>
        <span className="b-sent">{t("Quote sent")}</span>
        <span className="b-closed">{t("Closed")}</span>
      </div>
    </section>
  );
}

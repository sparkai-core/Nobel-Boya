import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BellRing, Check, Copy, Eye, FileUp, Lock, Send, StickyNote, Table2, UserPlus, Users, XCircle } from "lucide-react";
import {
  Avatar,
  Badge,
  DetailHeader,
  Dialog,
  Empty,
  Kebab,
  KeyFigure,
  Money,
  NextBar,
  Panel,
  StatusBadge,
  StatusSteps,
  toast,
  Trail,
  useL,
  Breadcrumbs,
} from "../../../components/kit";
import { ChainLife } from "../purchasing/parts";
import { useOps } from "../../../ops/store";
import { budgetOf, PATHS, quoteTotal, R, statusMeta, trailOf, tradeName } from "../../../ops/select";
import { fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import type { Rfq } from "../../../ops/types";
import { AiPick } from "./AiPick";
import { approvalFor, closing, liveQuotes, vendorsFor } from "./shared";

const ANSWERED: Record<string, string> = { INVITED: "Invited {when}", ACKNOWLEDGED: "Opened {when}", SUBMITTED: "Quoted {when}", DECLINED: "Declined {when}" };

export function RfqDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, stamp, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const rfq = s.rfqs.find((r) => r.id === id);
  const [inviteOpen, setInviteOpen] = useState(false);
  const lq = useMemo(() => liveQuotes(s.quotes, id), [s.quotes, id]);

  if (!rfq) {
    return (
      <div className="k-page">
        <Empty title={t("RFQ not found")} action={<Link className="btn btn-ghost" to={R.rfqs}>{t("Back to RFQs")}</Link>}>
          {t("{id} is not in this project.", { id })}
        </Empty>
      </div>
    );
  }

  const mr = rfq.mrId ? s.mrs.find((m) => m.id === rfq.mrId) : undefined;
  const open = rfq.status === "OPEN";
  const cl = closing(t, rfq.dueDate, open);
  const pending = rfq.invitations.filter((i) => i.status === "INVITED" || i.status === "ACKNOWLEDGED");
  const appr = approvalFor(s.approvals, s.quotes.filter((q) => q.rfqId === rfq.id).map((q) => q.id));
  const po = appr?.poId ? s.pos.find((p) => p.id === appr.poId) : undefined;
  const budget = budgetOf(s, rfq.lines);
  const vname = (vid: string) => s.vendors.find((v) => v.id === vid)?.name ?? vid;

  const remindAll = () => {
    for (const p of pending) s.remindVendor(rfq.id, p.vendorId);
    toast(pending.length === 1 ? t("Reminder sent to {vendor}", { vendor: vname(pending[0]!.vendorId) }) : t("Reminder sent to {n} vendors on {ref}", { n: pending.length, ref: rfq.ref }));
  };

  // ---- next step
  let text = "";
  let tone: "brand" | "ok" | "warn" | "bad" | "muted" = "brand";
  let primary: ReactNode = null;
  if (rfq.status === "CANCELLED") {
    text = t("This RFQ was cancelled.");
    tone = "muted";
  } else if (rfq.status === "AWARDED") {
    text = t("Awarded to {vendor}.", { vendor: vname(s.quotes.find((q) => q.id === rfq.awardedQuoteId)?.vendorId ?? "") });
    tone = "ok";
    primary = po ? <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.order(po.id))}>{t("Open the order")}</button> : null;
  } else if (appr?.status === "PENDING") {
    text = t("{ref} is waiting for approval: {vendor}, {amount} AZN.", { ref: appr.ref, vendor: vname(appr.vendorId), amount: fmtMoneyShort(appr.amount) });
    tone = "warn";
    primary = <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.approval(appr.id))}>{t("Open the approval")}</button>;
  } else if (lq.length >= 2) {
    text = t("{n} quotes are in. Compare them and send the best for approval.", { n: lq.length });
    primary = <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.compare(rfq.id))}>{t("Compare quotes")}</button>;
  } else if (open && pending.length) {
    text = pending.length === 1 ? t("Waiting on {vendor}. The RFQ {when}.", { vendor: vname(pending[0]!.vendorId), when: cl.text }) : t("Waiting on {n} vendors. The RFQ {when}.", { n: pending.length, when: cl.text });
    primary = (
      <button type="button" className="btn btn-primary btn-sm" onClick={remindAll}>
        <BellRing size={13} />
        {t("Remind them")}
      </button>
    );
  } else if (lq.length === 1) {
    text = t("Only one quote is in. Invite more vendors or take it to approval from the quote.");
    tone = "warn";
    primary = <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.quote(lq[0]!.id))}>{t("Open the quote")}</button>;
  } else {
    text = t("No quotes yet and nobody left to answer. Invite more vendors.");
    tone = "bad";
    primary = (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
        <UserPlus size={13} />
        {t("Invite more vendors")}
      </button>
    );
  }

  return (
    <div className="k-page ps-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("RFQ marketplace"), to: R.rfqs }, { label: rfq.ref }]} />
      <DetailHeader
        refCode={rfq.ref}
        badges={
          <>
            <StatusBadge kind="rfq" status={rfq.status} />
            <Badge tone="muted" dot={false}>
              {tradeName(rfq.trade, lang)}
            </Badge>
          </>
        }
        title={x(rfq.title)}
        meta={
          <>
            {mr ? (
              <Link to={R.request(mr.id)} className="k-link-btn">
                {t("From {ref}", { ref: mr.ref })}
              </Link>
            ) : (
              <span>{t("Direct RFQ, no request")}</span>
            )}
            <span>{t("Sent {when}", { when: stamp(rfq.createdAt) })}</span>
            <span>{t("{n} vendors invited", { n: rfq.invitations.length })}</span>
            <span>
              {t("BOQ value")} ≈ {fmtMoneyShort(budget)} AZN
            </span>
          </>
        }
        aside={<KeyFigure label={t("Quotes due")} value={d(rfq.dueDate)} sub={cl.text} tone={cl.tone === "bad" ? "bad" : cl.tone === "warn" ? "warn" : undefined} />}
      >
        <StatusSteps kind="rfq" path={PATHS.rfq} status={rfq.status} rejected={rfq.status === "CANCELLED"} />
      </DetailHeader>

      <NextBar text={text} tone={tone}>
        {primary}
        <Kebab
          items={[
            { label: t("Invite more vendors"), icon: <UserPlus size={14} />, disabled: !open, onClick: () => setInviteOpen(true) },
            { label: t("Enter a quote"), icon: <FileUp size={14} />, disabled: rfq.status === "CANCELLED" || rfq.status === "AWARDED", onClick: () => navigate(R.uploadQuote(rfq.id)) },
            {
              label: t("Close to new quotes"),
              icon: <Lock size={14} />,
              disabled: !open,
              onClick: () => {
                s.closeRfq(rfq.id);
                toast(t("{ref} closed to new quotes", { ref: rfq.ref }));
              },
            },
            {
              label: t("Cancel RFQ"),
              icon: <XCircle size={14} />,
              danger: true,
              disabled: rfq.status === "CANCELLED" || rfq.status === "AWARDED",
              onClick: () => {
                s.cancelRfq(rfq.id);
                toast(t("{ref} cancelled", { ref: rfq.ref }), "muted");
              },
            },
          ]}
        />
      </NextBar>

      <Trail steps={trailOf(s, "RFQ", rfq.id)} current={rfq.id} />
      <ChainLife kind="RFQ" id={rfq.id} />

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel
            title={t("Vendors invited")}
            icon={<Users size={15} />}
            count={rfq.invitations.length}
            pad={false}
            actions={
              open ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus size={13} />
                  {t("Invite more vendors")}
                </button>
              ) : null
            }
          >
            <ul className="ps-invites">
              {rfq.invitations.map((inv) => {
                const v = s.vendors.find((vv) => vv.id === inv.vendorId);
                const quote = s.quotes.filter((q) => q.rfqId === rfq.id && q.vendorId === inv.vendorId && !q.duplicate)[0];
                const meta = statusMeta("invite", inv.status);
                const lowest = lq.length ? Math.min(...lq.map(quoteTotal)) : 0;
                return (
                  <li key={inv.vendorId} className={`ps-invite ps-invite-${inv.status.toLowerCase()}`}>
                    <Avatar name={v?.name ?? inv.vendorId} size={32} />
                    <span className="ps-invite-name">
                      <Link to={R.vendor(inv.vendorId)} className="truncate">
                        {v?.name ?? inv.vendorId}
                      </Link>
                      <small>
                        {t(ANSWERED[inv.status], { when: stamp(inv.at) })}
                        {inv.reason ? ` · ${inv.reason}` : ""}
                      </small>
                    </span>
                    <Badge tone={meta.tone}>{x(meta.label)}</Badge>
                    <span className="ps-invite-fig">
                      {quote ? (
                        <>
                          <Money value={quoteTotal(quote)} short />
                          <small className={quoteTotal(quote) <= lowest + 0.01 && lq.length > 1 ? "k-text-brand" : "muted"}>
                            {t("{n} days delivery", { n: quote.deliveryDays })}
                          </small>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </span>
                    <span className="ps-invite-act">
                      {quote ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.quote(quote.id))}>
                          <Eye size={13} />
                          {t("View quote")}
                        </button>
                      ) : inv.status === "DECLINED" ? null : (
                        <>
                          {open ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                s.remindVendor(rfq.id, inv.vendorId);
                                toast(t("Reminder sent to {vendor}", { vendor: v?.name ?? inv.vendorId }));
                              }}
                            >
                              <BellRing size={13} />
                              {t("Remind")}
                            </button>
                          ) : null}
                          <Kebab
                            items={[
                              { label: t("Enter their quote"), icon: <FileUp size={14} />, onClick: () => navigate(`${R.uploadQuote(rfq.id)}&vendor=${inv.vendorId}`) },
                              {
                                label: t("Copy invite link"),
                                icon: <Copy size={14} />,
                                onClick: () => {
                                  void navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#${R.vendorPortal}`);
                                  toast(t("Invite link copied"));
                                },
                              },
                            ]}
                          />
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title={t("What vendors price")} icon={<Table2 size={15} />} count={rfq.lines.length} pad={false}>
            <div className="k-table-wrap">
              <table className="k-table ps-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("Description")}</th>
                    <th className="hide-900">{t("Spec")}</th>
                    <th style={{ textAlign: "right" }}>{t("Qty")}</th>
                    <th>{t("Unit")}</th>
                    <th style={{ textAlign: "right" }}>{t("BOQ rate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.lines.map((l, i) => {
                    const m = l.material ? s.materials.find((mm) => mm.key === l.material) : undefined;
                    return (
                      <tr key={l.key}>
                        <td className="muted num-inline">{i + 1}</td>
                        <td>
                          <strong className="ps-strong">{x(l.description)}</strong>
                        </td>
                        <td className="hide-900 muted">{l.spec ?? "—"}</td>
                        <td style={{ textAlign: "right" }} className="num-inline">
                          {fmtQty(l.qty, l.unit)}
                        </td>
                        <td className="muted">{unitLabel(l.unit, lang)}</td>
                        <td style={{ textAlign: "right" }} className="num-inline muted">
                          {m ? m.rate.toFixed(2) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="k-stack">
          <AiPick rfqId={rfq.id} quotes={lq} />
          {rfq.note ? (
            <Panel title={t("Note for vendors")} icon={<StickyNote size={15} />}>
              <p className="k-note">{x(rfq.note)}</p>
            </Panel>
          ) : null}
        </div>
      </div>

      <InviteDialog key={inviteOpen ? "o" : "c"} rfq={rfq} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

function InviteDialog({ rfq, open, onClose }: { rfq: Rfq; open: boolean; onClose: () => void }) {
  const { t, lang } = useL();
  const vendors = useOps((s) => s.vendors);
  const inviteVendors = useOps((s) => s.inviteVendors);
  const [picked, setPicked] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const invited = new Set(rfq.invitations.map((i) => i.vendorId));
  const list = (all ? vendors : vendorsFor(vendors, rfq.trade)).filter((v) => !invited.has(v.id)).sort((a, b) => b.overall - a.overall);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={rfq.ref}
      title={t("Invite more vendors")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!picked.length}
            onClick={() => {
              inviteVendors(rfq.id, picked);
              toast(t("{n} more vendors invited to {ref}", { n: picked.length, ref: rfq.ref }));
              onClose();
            }}
          >
            <Send size={14} />
            {t("Invite {n}", { n: picked.length })}
          </button>
        </>
      }
    >
      <label className="ps-check-row">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        {t("Show vendors of every trade")}
      </label>
      <ul className="ps-vpick ps-vpick-dialog">
        {list.length === 0 ? <li className="ps-col-empty">{t("Every vendor of this trade is already invited.")}</li> : null}
        {list.map((v) => {
          const on = picked.includes(v.id);
          return (
            <li key={v.id}>
              <button type="button" className={`ps-vrow${on ? " on" : ""}`} disabled={v.status === "DISQUALIFIED"} aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x2) => x2 !== v.id) : [...p, v.id]))}>
                <span className="ps-vcheck" aria-hidden="true">
                  {on ? <Check size={12} strokeWidth={3} /> : null}
                </span>
                <span className="ps-vname">
                  <strong className="truncate">{v.name}</strong>
                  <small>
                    {[tradeName(v.trade, lang), v.city, v.avgDeliveryDays > 0 ? t("{n} days", { n: v.avgDeliveryDays }) : ""].filter(Boolean).join(" · ")}
                  </small>
                </span>
                {v.status !== "APPROVED" ? <StatusBadge kind="vendor" status={v.status} /> : null}
                <span className="ps-vstat">
                  <b>{v.overall > 0 ? v.overall.toFixed(1) : "—"}</b>
                  <small>/10</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

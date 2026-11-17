import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CircleCheck, CircleX, PauseCircle, PlayCircle, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import { Badge, DetailHeader, Dialog, Empty, Field, Kebab, KeyFigure, Money, NextBar, PageHero, Panel, StatusBadge, StatusSteps, toast, Trail, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { paymentGate, PATHS, poReceivedShare, poTotal, R, trailOf } from "../../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import { MarkPaidDialog } from "./MarkPaidDialog";
import { BackLink } from "./shared";
import { INV_STATUS, MONEY } from "../../../ops/ext/money-p2";

type CheckRow = { label: string; result: "pass" | "fail" | "warn"; detail: string };

/** A payment voucher: who, what for, the three gates it must pass, and the run actions (pay, hold, release). */
export function PaymentDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const p = s.payments.find((v) => v.id === id);
  const [paying, setPaying] = useState(false);
  const [holding, setHolding] = useState(false);
  const [why, setWhy] = useState("");
  const [justPaid, setJustPaid] = useState(false);

  if (!p) {
    return (
      <div className="k-page po-page">
        <PageHero eyebrow={t("Procurement · Payments")} title={t("Payment not found")} back={{ to: R.payments, label: "Payments" }} />
        <Empty title={t("This payment does not exist.")} />
      </div>
    );
  }

  const po = s.pos.find((o) => o.id === p.poId);
  const vendor = s.vendors.find((v) => v.id === p.vendorId);
  const approval = po?.approvalId ? s.approvals.find((a) => a.id === po.approvalId) : undefined;
  const gate = paymentGate(s, p);
  const bill = s.invoices.find((i) => i.paymentId === p.id && i.status !== "REJECTED") ?? null;
  const share = po ? poReceivedShare(po) : 0;
  const overdue = p.status !== "PAID" && p.dueDate < TODAY;
  const kind = t(p.kind === "ADVANCE" ? "Advance" : p.kind === "RETENTION" ? "Retention" : "On delivery");

  const checks: CheckRow[] = [
    po
      ? po.status === "CANCELLED"
        ? { label: t("Order"), result: "fail", detail: t("{po} was cancelled.", { po: po.ref }) }
        : { label: t("Order"), result: "pass", detail: t("{po} issued {d} for {v}.", { po: po.ref, d: d(po.issuedAt), v: `${fmtMoney(poTotal(po))} AZN` }) }
      : { label: t("Order"), result: "fail", detail: t("No order on file.") },
    p.kind === "ADVANCE"
      ? { label: t("Goods received"), result: "pass", detail: t("Advance: paid before delivery by agreement.") }
      : share >= 0.999 || po?.status === "CLOSED"
        ? { label: t("Goods received"), result: "pass", detail: share >= 0.999 ? t("Everything on the order has arrived.") : t("Order closed short at {p}% received.", { p: Math.round(share * 100) }) }
        : share > 0
          ? { label: t("Goods received"), result: "warn", detail: t("{p}% of the goods are in. The rest is outstanding.", { p: Math.round(share * 100) }) }
          : { label: t("Goods received"), result: "fail", detail: t("Nothing has arrived yet.") },
    approval
      ? approval.status === "APPROVED"
        ? { label: t("Approval"), result: "pass", detail: t("{ref} approved by {n}.", { ref: approval.ref, n: approval.finalBy ?? approval.firstBy ?? "—" }) }
        : { label: t("Approval"), result: "fail", detail: t("{ref} is not approved.", { ref: approval.ref }) }
      : { label: t("Approval"), result: "warn", detail: t("Direct order: no approval on file.") },
  ];

  const nextText =
    p.status === "PAID"
      ? t("Paid {d} by {m}.", { d: d(p.paidAt), m: p.method ? t(p.method).toLowerCase() : "—" })
      : p.status === "READY"
        ? overdue
          ? t("Clear to pay and {n} days overdue. Pay it in this run.", { n: diffDays(p.dueDate, TODAY) })
          : t("Clear to pay. Due {d}.", { d: d(p.dueDate) })
        : p.status === "ON_HOLD"
          ? t("On hold: {r}", { r: p.holdReason ?? "—" })
          : t("Scheduled. It becomes clear to pay when the goods are in.");

  return (
    <div className="k-page po-page">
      <BackLink to={R.payments} label="Payments" />
      <DetailHeader
        refCode={p.ref}
        badges={
          <>
            <StatusBadge kind="payment" status={p.status} />
            {p.status === "SCHEDULED" ? <Badge tone={gate.tone}>{x(gate.label)}</Badge> : null}
            {overdue ? <Badge tone="bad">{t("{n} days overdue", { n: diffDays(p.dueDate, TODAY) })}</Badge> : null}
          </>
        }
        title={vendor?.name ?? p.vendorId}
        meta={
          <>
            <span>{kind}</span>
            <span>
              {t("For")} <Link to={R.order(p.poId)}>{p.poId}</Link>
            </span>
            <span>{t("Due {d}", { d: d(p.dueDate) })}</span>
            {bill ? (
              <span className="pmn-billcell">
                {t("Bill")} <Link to={MONEY.invoice(bill.id)}>{bill.ref}</Link> <Badge tone={INV_STATUS[bill.status].tone}>{x(INV_STATUS[bill.status].label)}</Badge>
              </span>
            ) : (
              <span className="muted">{t("No bill yet")}</span>
            )}
          </>
        }
        aside={<KeyFigure label={t("Amount")} value={<Money value={p.amount} />} tone={p.status === "PAID" ? "ok" : undefined} />}
      >
        <StatusSteps kind="payment" path={PATHS.payment} status={p.status === "ON_HOLD" ? "SCHEDULED" : p.status} rejected={p.status === "ON_HOLD"} />
      </DetailHeader>

      <NextBar text={nextText} tone={p.status === "PAID" ? "ok" : p.status === "ON_HOLD" ? "bad" : p.status === "READY" ? "brand" : "muted"}>
        {p.status === "READY" ? (
          <button type="button" className="btn btn-primary" onClick={() => setPaying(true)}>
            <Wallet size={15} />
            {t("Mark paid")}
          </button>
        ) : null}
        {p.status === "ON_HOLD" ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              s.releasePayment(p.id);
              toast(t("{ref} released", { ref: p.ref }), "brand");
            }}
          >
            <PlayCircle size={15} />
            {t("Release")}
          </button>
        ) : null}
        <Kebab
          items={[
            { label: t("Put on hold"), icon: <PauseCircle size={14} />, disabled: p.status === "PAID" || p.status === "ON_HOLD", onClick: () => setHolding(true) },
            { label: t("Open order"), icon: <Wallet size={14} />, onClick: () => navigate(R.order(p.poId)) },
          ]}
        />
      </NextBar>

      <Trail steps={trailOf(s, "PAYMENT", p.id)} current={p.id} />

      <div className="k-grid-main">
        <div className="k-stack">
          <article className="po-voucher" aria-label={t("Payment voucher")}>
            <header>
              <img src="./brand/nobel-logo.png" alt="Nobel" />
              <div>
                <span>{t("Payment voucher")}</span>
                <strong className="k-mono">{p.ref}</strong>
              </div>
            </header>
            <dl className="po-voucher-grid">
              <div className="wide">
                <dt>{t("Pay to")}</dt>
                <dd>
                  <b>{vendor?.name}</b>
                  {vendor ? <small>{`${t("TRN")} ${vendor.trn} · ${vendor.city}`}</small> : null}
                </dd>
              </div>
              <div className="wide">
                <dt>{t("Payment for")}</dt>
                <dd>
                  <Link to={R.order(p.poId)}>{p.poId}</Link> · {po ? x(po.lines[0]?.description) : "—"}
                  {po && po.lines.length > 1 ? ` +${po.lines.length - 1}` : ""}
                </dd>
              </div>
              <div>
                <dt>{t("Amount")}</dt>
                <dd className="po-voucher-amt num-inline">{fmtMoney(p.amount)} AZN</dd>
              </div>
              <div>
                <dt>{t("Due")}</dt>
                <dd className={overdue ? "k-text-bad" : undefined}>{d(p.dueDate)}</dd>
              </div>
              <div>
                <dt>{t("Terms")}</dt>
                <dd>{po?.paymentTerms ?? vendor?.paymentTerms ?? "—"}</dd>
              </div>
              <div>
                <dt>{t("Kind")}</dt>
                <dd>{kind}</dd>
              </div>
              <div>
                <dt>{t("Paid on")}</dt>
                <dd>{p.paidAt ? d(p.paidAt) : "—"}</dd>
              </div>
              <div>
                <dt>{t("Method")}</dt>
                <dd>{p.method ? t(p.method) : "—"}</dd>
              </div>
              <div className="wide">
                <dt>{t("Bank reference")}</dt>
                <dd className="k-mono">{p.bankRef ?? "—"}</dd>
              </div>
            </dl>
            {p.status === "PAID" ? <span className={`k-stamp-mark po-paid-stamp${justPaid ? "" : " po-stamp-still"}`}>{t("Paid")}</span> : null}
            {p.status === "ON_HOLD" ? <span className="k-stamp-mark po-paid-stamp po-stamp-bad po-stamp-still">{t("On hold")}</span> : null}
          </article>

          <Panel title={t("What it pays for")} pad={false}>
            {po ? (
              <div className="po-tablewrap">
                <table className="po-table">
                  <thead>
                    <tr>
                      <th>{t("Line")}</th>
                      <th className="r">{t("Ordered")}</th>
                      <th className="r">{t("Received")}</th>
                      <th className="r">{t("Amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.lines.map((l) => (
                      <tr key={l.key}>
                        <td>{x(l.description)}</td>
                        <td className="r num-inline">
                          {fmtQty(l.qty, l.unit)} <small className="muted">{unitLabel(l.unit, lang)}</small>
                        </td>
                        <td className={`r num-inline${l.received < l.qty - 1e-6 ? " k-text-warn" : ""}`}>{fmtQty(l.received, l.unit)}</td>
                        <td className="r num-inline">{fmtMoney(l.qty * l.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="k-panel-body muted">{t("No order on file.")}</p>
            )}
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Checks")} icon={<ShieldCheck size={15} />}>
            <ul className="po-paychecks">
              {checks.map((c) => (
                <li key={c.label} className={c.result}>
                  {c.result === "pass" ? <CircleCheck size={17} /> : c.result === "fail" ? <CircleX size={17} /> : <TriangleAlert size={17} />}
                  <span>
                    <b>{c.label}</b>
                    <small>{c.detail}</small>
                  </span>
                </li>
              ))}
              {p.status === "ON_HOLD" ? (
                <li className="fail">
                  <PauseCircle size={17} />
                  <span>
                    <b>{t("Hold")}</b>
                    <small>{p.holdReason ?? "—"}</small>
                  </span>
                </li>
              ) : null}
            </ul>
          </Panel>
        </div>
      </div>

      {paying ? <MarkPaidDialog payment={p} onClose={() => setPaying(false)} onDone={() => setJustPaid(true)} /> : null}

      <Dialog
        open={holding}
        onClose={() => setHolding(false)}
        kicker={p.ref}
        title={t("Put on hold")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setHolding(false)}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!why.trim()}
              onClick={() => {
                s.holdPayment(p.id, why.trim());
                setHolding(false);
                setWhy("");
                toast(t("{ref} put on hold", { ref: p.ref }), "warn");
              }}
            >
              {t("Put on hold")}
            </button>
          </>
        }
      >
        <p className="po-dialog-lead">{t("The payment stays out of the run until someone releases it.")}</p>
        <Field label={t("Reason")}>
          <textarea className="input" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t("e.g. damaged item, invoice mismatch")} />
        </Field>
      </Dialog>
    </div>
  );
}


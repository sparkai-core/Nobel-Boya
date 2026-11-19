import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BadgeCheck, FileText, PackageCheck, Truck, Wallet } from "lucide-react";
import { ApprovalPath, Badge, DetailHeader, Empty, KeyFigure, Money, NextBar, Panel, StatusBadge, toast, useL, type PathStep } from "../../components/kit";
import { useOps } from "../../ops/store";
import { poNet, poTotal, quoteTotal, tradeName } from "../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../lib/format";
import { VENDOR_INV_STATUS } from "../../ops/ext/money-p2";
import { projectTxt } from "../../ops/ext/proc-client";
import { buyerName, orderState, payState, useVendor, VP } from "./model";
import { DispatchDialog, InvoiceDialog, OutcomeBadge, StageBadge } from "./parts";

/** One purchase order from the vendor's side: the PO document, accept → dispatch, deliveries and payments. */
export function VpOrderDetail() {
  const { id } = useParams();
  const { t, x, d, rel, stamp, lang } = useL();
  const { s, view } = useVendor();
  const vendorAcceptPo = useOps((st) => st.vendorAcceptPo);
  const [dispatching, setDispatching] = useState(false);
  const [invoicing, setInvoicing] = useState(false);

  const po = view?.pos.find((p) => p.id === id) ?? null;
  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;
  if (!po)
    return (
      <div className="k-page vp-page">
        <Link to={VP.orders} className="k-back">
          <ArrowLeft size={14} />
          {t("Back to purchase orders")}
        </Link>
        <Empty title={t("This order is not for {vendor}", { vendor: view.vendor.name })}>{t("Switch vendor in the top bar, or open your orders.")}</Empty>
      </div>
    );

  const v = view.vendor;
  const st = orderState(s, po, view.invoices);
  const rfq = po.rfqId ? s.rfqs.find((r) => r.id === po.rfqId) : null;
  const quote = po.quoteId ? s.quotes.find((q) => q.id === po.quoteId) : null;
  const title = rfq ? x(rfq.title) : x(po.lines[0]?.description);
  const net = poNet(po);
  const total = poTotal(po);
  const paid = st.pays.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0);
  const shortLines = po.lines.filter((l) => l.received < l.qty - 1e-6 && l.received > 0).length;

  const accept = () => {
    vendorAcceptPo(po.id);
    toast(t("{ref} accepted. {buyer} can see it.", { ref: po.ref, buyer: buyerName() }));
  };

  const accepted = po.vendorAck === "ACCEPTED";
  const dispatched = !!po.dispatchedAt || st.share > 0;
  const received = st.share > 0.999 || po.status === "CLOSED";
  const allPaid = st.pays.length > 0 && st.unpaid.length === 0;
  const steps: PathStep[] = [
    { label: t("Issued"), state: "done", at: d(po.issuedAt), who: buyerName() },
    { label: t("Accepted"), state: accepted ? "done" : "current", who: accepted ? t("by you") : t("waiting for you") },
    { label: t("Dispatched"), state: dispatched ? "done" : accepted ? "current" : "todo", at: po.dispatchedAt ? stamp(po.dispatchedAt) : undefined, who: po.dispatchNote ?? undefined },
    { label: t("Received on site"), state: received ? "done" : st.share > 0 || st.atGate || st.onWay ? "current" : "todo", who: st.share > 0 ? t("{p}% so far", { p: Math.round(st.share * 100) }) : undefined },
    { label: t("Paid"), state: allPaid ? "done" : received ? "current" : "todo", who: paid ? `${fmtMoney(paid)} AZN` : undefined },
  ];

  const next = (() => {
    switch (st.stage) {
      case "accept":
        return { tone: "warn" as const, text: t("Accept the order to confirm you will deliver by {date}.", { date: d(po.expectedAt) }), btn: <button type="button" className="btn btn-primary" onClick={accept}><BadgeCheck size={15} />{t("Accept order")}</button> };
      case "dispatch":
        return { tone: st.late ? ("bad" as const) : ("brand" as const), text: st.late ? t("Due on site {when}. Dispatch as soon as the goods are loaded.", { when: rel(po.expectedAt) }) : t("Load the goods and dispatch. The site store is told the truck is on the way."), btn: <button type="button" className="btn btn-primary" onClick={() => setDispatching(true)}><Truck size={15} />{t("Dispatch delivery")}</button> };
      case "balance":
        return { tone: "warn" as const, text: t("{n} lines arrived short. Send the rest to close the order.", { n: Math.max(1, shortLines) }), btn: <button type="button" className="btn btn-primary" onClick={() => setDispatching(true)}><Truck size={15} />{t("Dispatch the balance")}</button> };
      case "onway":
        return { tone: "brand" as const, text: t("On the way since {when}. The site store will check it in at the gate.", { when: stamp(po.dispatchedAt) }), btn: null };
      case "gate":
        return { tone: "brand" as const, text: t("At the site gate: the store is checking the delivery in."), btn: null };
      case "invoice":
        return { tone: "brand" as const, text: t("Goods received. Send your invoice to get paid."), btn: <button type="button" className="btn btn-primary" onClick={() => setInvoicing(true)}><Wallet size={15} />{t("Send invoice")}</button> };
      case "waitpay":
        return { tone: "muted" as const, text: t("Invoice {id} sent. Payment due {date}.", { id: st.invoice?.ref ?? "", date: d(st.unpaid[0]?.dueDate) }), btn: null };
      case "paid":
        return { tone: "ok" as const, text: t("Delivered and paid in full. Thank you."), btn: null };
      default:
        return { tone: "muted" as const, text: t("This order was cancelled."), btn: null };
    }
  })();

  return (
    <div className="k-page vp-page">
      <Link to={VP.orders} className="k-back">
        <ArrowLeft size={14} />
        {t("Back to purchase orders")}
      </Link>
      <DetailHeader
        refCode={po.ref}
        badges={
          <>
            <StatusBadge kind="po" status={po.status} />
            <StageBadge stage={st.stage} />
            {st.late ? <Badge tone="bad">{t("Late")}</Badge> : null}
          </>
        }
        title={title}
        meta={
          <>
            <span>{t("issued {date}", { date: d(po.issuedAt) })}</span>
            <span className={st.late ? "k-text-bad" : undefined}>{t("deliver by {date}", { date: d(po.expectedAt) })}</span>
            <span>{t(po.paymentTerms)}</span>
          </>
        }
        aside={<KeyFigure label={t("Order value")} value={<Money value={total} />} sub={t("incl. VAT {p}%", { p: Math.round(po.vatRate * 100) })} />}
      />

      <div className="vp-steps-card">
        <ApprovalPath steps={steps} />
      </div>

      <NextBar tone={next.tone} text={next.text}>
        {next.btn}
      </NextBar>

      <div className="k-grid-main">
        <div className="k-stack">
          <section className="vp-doc" aria-label={t("Purchase order")}>
            <header className="vp-doc-head">
              <div>
                <span className="vp-doc-kind">{t("Purchase order")}</span>
                <strong className="vp-doc-ref">{po.ref}</strong>
              </div>
              <img src="./brand/nobel-mark.png" alt="" className="vp-doc-mark" />
            </header>
            <div className="vp-doc-parties">
              <div>
                <small>{t("From")}</small>
                <b>{buyerName()}</b>
                <span>{x(projectTxt())}</span>
              </div>
              <div>
                <small>{t("To")}</small>
                <b>{v.name}</b>
                <span>
                  {[v.trn ? `${t("TRN")} ${v.trn}` : "", v.city].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              <div>
                <small>{t("Deliver to")}</small>
                <b>{x(po.deliverTo)}</b>
                <span>{t("by {date}", { date: d(po.expectedAt) })}</span>
              </div>
            </div>
            <div className="k-table-wrap">
              <table className="k-table vp-doc-lines">
                <thead>
                  <tr>
                    <th>{t("Item")}</th>
                    <th style={{ textAlign: "right" }}>{t("Qty")}</th>
                    <th style={{ textAlign: "right" }}>{t("Rate")}</th>
                    <th style={{ textAlign: "right" }}>{t("Amount")}</th>
                    <th style={{ textAlign: "right" }}>{t("Received")}</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l) => {
                    const short = l.received > 0 && l.received < l.qty - 1e-6;
                    return (
                      <tr key={l.key}>
                        <td data-label={t("Item")}>{x(l.description)}</td>
                        <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Qty")}>
                          {fmtQty(l.qty, l.unit)} {unitLabel(l.unit, lang)}
                        </td>
                        <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Rate")}>
                          {fmtMoney(l.rate)}
                        </td>
                        <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Amount")}>
                          {fmtMoney(l.qty * l.rate)}
                        </td>
                        <td style={{ textAlign: "right" }} className={`num-inline${short ? " k-text-bad" : l.received >= l.qty - 1e-6 ? " k-text-ok" : " muted"}`} data-label={t("Received")}>
                          {fmtQty(l.received, l.unit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="vp-doc-sum">
              <div>
                <dt>{t("Subtotal")}</dt>
                <dd className="num-inline">{fmtMoney(net)}</dd>
              </div>
              <div>
                <dt>{t("VAT {p}%", { p: Math.round(po.vatRate * 100) })}</dt>
                <dd className="num-inline">{fmtMoney(net * po.vatRate)}</dd>
              </div>
              <div>
                <dt>{t("Shipping")}</dt>
                <dd className="num-inline">{fmtMoney(po.shipping)}</dd>
              </div>
              <div className="total">
                <dt>{t("Total")}</dt>
                <dd>
                  <Money value={total} />
                </dd>
              </div>
            </dl>
            <p className="vp-doc-foot">
              {t("Payment terms")}: <b>{t(po.paymentTerms)}</b> · {rfq ? `${tradeName(rfq.trade, lang)} · ` : ""}
              {po.vendorAck === "ACCEPTED" ? <span className="k-text-ok">{t("Accepted by you")}</span> : <span className="k-text-warn">{t("Not yet accepted")}</span>}
            </p>
          </section>
        </div>

        <div className="k-stack">
          <Panel title={t("Deliveries")} icon={<Truck size={15} />} count={st.grns.length || undefined}>
            <ul className="vp-mini">
              {po.dispatchedAt ? (
                <li>
                  <span className={`vp-mini-dot ${st.onWay ? "brand" : "ok"}`} />
                  <div>
                    <b>{st.onWay ? t("On the way") : t("Dispatched")}</b>
                    <small>
                      {stamp(po.dispatchedAt)}
                      {po.dispatchNote ? ` · ${po.dispatchNote}` : ""}
                    </small>
                  </div>
                </li>
              ) : null}
              {st.grns.map((g) => (
                <li key={g.id}>
                  <span className={`vp-mini-dot ${g.status === "RECEIVED" ? "ok" : g.status === "DRAFT" ? "brand" : "bad"}`} />
                  <div>
                    <b>
                      {g.ref} <StatusBadge kind="grn" status={g.status} />
                    </b>
                    <small>
                      {g.receivedAt ? d(g.receivedAt) : t("being checked")}
                      {g.receivedBy ? ` · ${g.receivedBy}` : ""}
                    </small>
                    {g.remarks ? <small className="k-text-bad">{g.remarks}</small> : null}
                  </div>
                </li>
              ))}
              {!po.dispatchedAt && !st.grns.length ? <li className="muted small">{t("Nothing dispatched yet.")}</li> : null}
            </ul>
            {st.grns.length ? (
              <Link to={VP.deliveries} className="k-link-btn">
                {t("All deliveries")} <ArrowRight size={13} />
              </Link>
            ) : null}
          </Panel>

          <Panel title={t("Payments")} icon={<Wallet size={15} />} count={st.pays.length || undefined}>
            <ul className="vp-mini">
              {st.pays.map((p) => {
                const ps = payState(p);
                return (
                  <li key={p.id}>
                    <span className={`vp-mini-dot pay-${ps}`} />
                    <div>
                      <b>
                        <Money value={p.amount} /> <StatusBadge kind="payment" status={p.status} />
                      </b>
                      <small>
                        {p.ref} · {p.status === "PAID" ? t("paid {date}", { date: d(p.paidAt) }) : t("due {date}", { date: d(p.dueDate) })}
                      </small>
                      {p.holdReason ? <small className="k-text-bad">{p.holdReason}</small> : null}
                    </div>
                  </li>
                );
              })}
              {!st.pays.length ? <li className="muted small">{t("No payments scheduled yet.")}</li> : null}
            </ul>
            {st.invoice ? (
              <p className="muted small">
                <FileText size={12} /> {t("Invoice {id} sent {when}", { id: st.invoice.ref, when: d(st.invoice.date) })} · <Link to={VP.invoices}>{x(VENDOR_INV_STATUS[st.invoice.status].label)}</Link>
              </p>
            ) : st.stage === "invoice" ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInvoicing(true)}>
                <Wallet size={14} />
                {t("Send invoice")}
              </button>
            ) : null}
          </Panel>

          <Panel title={t("The quote this came from")} icon={<PackageCheck size={15} />}>
            {quote ? (
              <div className="vp-from">
                <span className="k-row" style={{ gap: 6 }}>
                  <span className="k-ref">{quote.id}</span>
                  <OutcomeBadge s={s} q={quote} />
                </span>
                <b>
                  <Money value={quoteTotal(quote)} />
                </b>
                <small>
                  {t("sent {date}", { date: d(quote.receivedAt) })} · {quote.ref}
                </small>
                {rfq ? (
                  <Link to={VP.rfq(rfq.id)} className="k-link-btn">
                    {t("Open {ref}", { ref: rfq.ref })} <ArrowRight size={13} />
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="muted small">{t("Placed directly by the buyer, without a quote.")}</p>
            )}
          </Panel>
        </div>
      </div>

      <DispatchDialog open={dispatching} onClose={() => setDispatching(false)} po={po} balance={st.stage === "balance"} />
      <InvoiceDialog open={invoicing} onClose={() => setInvoicing(false)} po={po} vendorId={v.id} />
    </div>
  );
}

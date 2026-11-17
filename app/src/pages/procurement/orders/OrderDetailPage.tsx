import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, Lock, PackageCheck, Printer, Repeat2, Scale, Truck, Wallet } from "lucide-react";
import {
  Badge,
  Breadcrumbs,
  DetailHeader,
  Dialog,
  Empty,
  Kebab,
  KeyFigure,
  Money,
  NextBar,
  PageHero,
  Panel,
  StatusBadge,
  StatusSteps,
  toast,
  Trail,
  useL,
} from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { paymentGate, PATHS, poLate, poNet, poTotal, R, trailOf } from "../../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import { orderShares, short, vendorName } from "./shared";
import { agreementOfPo, PR } from "../purchasing/shared";
import { AgrLink, ChainLife } from "../purchasing/parts";

/** One purchase order: the paper LPO, goods and money side by side, deliveries, payments and the vendor's answer. */
export function OrderDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, stamp, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const po = s.pos.find((p) => p.id === id);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    const done = () => document.body.classList.remove("po-printing");
    window.addEventListener("afterprint", done);
    return () => window.removeEventListener("afterprint", done);
  }, []);

  if (!po) {
    return (
      <div className="k-page po-page">
        <PageHero eyebrow={t("Procurement · Orders")} title={t("Order not found")} back={{ to: R.orders, label: "Purchase orders" }} />
        <Empty title={t("This order does not exist.")} />
      </div>
    );
  }

  const vendor = s.vendors.find((v) => v.id === po.vendorId);
  const quote = po.quoteId ? s.quotes.find((q) => q.id === po.quoteId) : undefined;
  const grns = s.grns.filter((g) => g.poId === po.id);
  const pays = s.payments.filter((p) => p.poId === po.id);
  const sh = orderShares(s, po);
  const net = poNet(po);
  const vat = net * po.vatRate;
  const total = poTotal(po);
  const open = po.status === "ISSUED" || po.status === "PART_RECEIVED";
  const late = poLate(po);
  const draft = grns.find((g) => g.status === "DRAFT");
  const agr = agreementOfPo(s, po.id);

  const verdict =
    sh.goods < 0.001 && sh.paid < 0.001
      ? { tone: "muted", text: t("Nothing has arrived and nothing is paid yet.") }
      : sh.paid - sh.goods > 0.05
        ? { tone: "warn", text: t("Paid ahead of goods: {v} paid for goods not yet in.", { v: short((sh.paid - sh.goods) * total) }) }
        : sh.goods - sh.paid > 0.05
          ? { tone: "brand", text: t("Goods ahead of payment: {v} owed for what has arrived.", { v: short((sh.goods - sh.paid) * total) }) }
          : { tone: "ok", text: t("Paid in step with what has arrived.") };

  const receive = () => {
    const grnId = s.startReceipt(po.id);
    toast(t("{grn} opened for {po}. Count what arrived.", { grn: grnId, po: po.ref }), "brand");
    navigate(R.receipt(grnId));
  };
  const print = () => {
    document.body.classList.add("po-printing");
    window.print();
    setTimeout(() => document.body.classList.remove("po-printing"), 1000);
  };

  const nextText = !open
    ? po.status === "CLOSED"
      ? t("Closed. Goods are in; payments follow their own run.")
      : t("Cancelled. Unpaid payments for this order were removed.")
    : draft
      ? t("{grn} is open at the gate. Finish counting and post it.", { grn: draft.ref })
      : late
        ? t("Delivery is {n} days late. Chase the vendor or receive what has come.", { n: diffDays(po.expectedAt, TODAY) })
        : po.dispatchedAt
          ? t("The vendor has dispatched the goods. Receive them when the truck arrives.")
          : po.vendorAck === "PENDING"
            ? t("Waiting for {v} to accept the order in the vendor portal.", { v: vendor?.name ?? "" })
            : t("Accepted by the vendor. Delivery is expected {when}.", { when: d(po.expectedAt) });

  return (
    <div className="k-page po-page po-print-scope">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Purchase orders"), to: R.orders }, { label: po.ref }]} />
      <DetailHeader
        refCode={po.ref}
        badges={
          <>
            <StatusBadge kind="po" status={po.status} />
            {agr ? <AgrLink a={agr} /> : null}
            {late ? <Badge tone="bad">{t("{n} days late", { n: diffDays(po.expectedAt, TODAY) })}</Badge> : null}
            {open ? <Badge tone={po.vendorAck === "ACCEPTED" ? "ok" : "warn"}>{po.vendorAck === "ACCEPTED" ? t("Accepted by vendor") : t("Not accepted yet")}</Badge> : null}
          </>
        }
        title={vendor?.name ?? po.vendorId}
        meta={
          <>
            <span>{t("Issued {d}", { d: d(po.issuedAt) })}</span>
            <span>{t("Expected {d}", { d: d(po.expectedAt) })}</span>
            <span>{t("{n} lines", { n: po.lines.length })}</span>
          </>
        }
        aside={<KeyFigure label={t("Order total incl. VAT")} value={<Money value={total} />} sub={t("{p}% received", { p: Math.round(sh.goods * 100) })} />}
      >
        <StatusSteps kind="po" path={PATHS.po} status={po.status === "CANCELLED" ? "ISSUED" : po.status} rejected={po.status === "CANCELLED"} />
      </DetailHeader>

      <NextBar text={nextText} tone={!open ? (po.status === "CLOSED" ? "ok" : "muted") : late ? "bad" : "brand"}>
        {open ? (
          <button type="button" className="btn btn-primary" onClick={receive}>
            <PackageCheck size={15} />
            {draft ? t("Continue the receipt") : t("Receive goods")}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={() => navigate(PR.newOrder({ from: po.id }))} title={t("Start a new order with the same vendor and lines")}>
          <Repeat2 size={15} />
          {t("Buy again")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={print}>
          <Printer size={15} />
          {t("Print")}
        </button>
        <Kebab
          items={[
            {
              label: t("Close the order"),
              icon: <Lock size={14} />,
              disabled: !open,
              onClick: () => {
                s.closePo(po.id);
                toast(t("{po} closed. Its payment is released.", { po: po.ref }));
              },
            },
            { label: t("Cancel the order"), icon: <Ban size={14} />, danger: true, disabled: !open || sh.goods > 0, onClick: () => setConfirmCancel(true) },
            { label: t("Open vendor"), icon: <Scale size={14} />, onClick: () => navigate(R.vendor(po.vendorId)) },
          ]}
        />
      </NextBar>

      <Trail steps={trailOf(s, "PO", po.id)} current={po.id} />
      <ChainLife kind="PO" id={po.id} />

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Order, goods and money")} icon={<Scale size={15} />}>
            <div className="po-gm">
              <div className="po-gm-row">
                <span>{t("Goods in")}</span>
                <span className="po-gm-track goods">
                  <i className="k-grow-x" style={{ width: `${sh.goods * 100}%` }} />
                </span>
                <b className="num-inline">{Math.round(sh.goods * 100)}%</b>
                <small className="num-inline">{short(sh.goods * total)}</small>
              </div>
              <div className="po-gm-row">
                <span>{t("Paid")}</span>
                <span className="po-gm-track paid">
                  <i className="k-grow-x" style={{ width: `${sh.paid * 100}%` }} />
                </span>
                <b className="num-inline">{Math.round(sh.paid * 100)}%</b>
                <small className="num-inline">{short(sh.paid * total)}</small>
              </div>
            </div>
            <p className={`po-verdict k-text-${verdict.tone}`}>{verdict.text}</p>
          </Panel>

          <article className="po-lpo" aria-label={t("Local purchase order")}>
            <header className="po-lpo-head">
              <img src="./brand/nobel-logo.png" alt="Nobel" />
              <div>
                <span className="po-lpo-kind">{t("Local purchase order")}</span>
                <strong className="k-mono">{po.ref}</strong>
                <small>{d(po.issuedAt)}</small>
              </div>
            </header>
            <div className="po-lpo-parties">
              <div>
                <span>{t("To")}</span>
                <strong>{vendor?.name}</strong>
                <small>{vendor ? `${vendor.city} · ${t("TRN")} ${vendor.trn}` : null}</small>
                <small>{vendor ? `${vendor.contact} · ${vendor.phone}` : null}</small>
              </div>
              <div>
                <span>{t("Deliver to")}</span>
                <strong>{x(po.deliverTo)}</strong>
                <small>{t("Qobu warehouse and administration building")}</small>
              </div>
            </div>
            <dl className="po-lpo-terms">
              <div>
                <dt>{t("Payment terms")}</dt>
                <dd>{po.paymentTerms}</dd>
              </div>
              <div>
                <dt>{t("Delivery date")}</dt>
                <dd>{d(po.expectedAt)}</dd>
              </div>
              <div>
                <dt>{t("Quote ref")}</dt>
                <dd className="k-mono">{quote?.ref ?? "—"}</dd>
              </div>
            </dl>
            <div className="po-tablewrap">
              <table className="po-table po-lpo-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("Description")}</th>
                    <th className="r">{t("Qty")}</th>
                    <th>{t("Unit")}</th>
                    <th className="r">{t("Rate")}</th>
                    <th className="r">{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l, i) => (
                    <tr key={l.key}>
                      <td className="muted">{i + 1}</td>
                      <td>{x(l.description)}</td>
                      <td className="r num-inline">{fmtQty(l.qty, l.unit)}</td>
                      <td>{unitLabel(l.unit, lang)}</td>
                      <td className="r num-inline">{fmtMoney(l.rate)}</td>
                      <td className="r num-inline">{fmtMoney(l.qty * l.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="po-lpo-sum">
              <div>
                <dt>{t("Subtotal")}</dt>
                <dd className="num-inline">{fmtMoney(net)}</dd>
              </div>
              <div>
                <dt>{t("VAT {p}%", { p: Math.round(po.vatRate * 100) })}</dt>
                <dd className="num-inline">{fmtMoney(vat)}</dd>
              </div>
              <div>
                <dt>{t("Shipping")}</dt>
                <dd className="num-inline">{fmtMoney(po.shipping)}</dd>
              </div>
              <div className="total">
                <dt>{t("Total")}</dt>
                <dd className="num-inline">{fmtMoney(total)} AZN</dd>
              </div>
            </dl>
            <footer className="po-lpo-sign">
              <span>{t("Authorised by")}</span>
              <span>{t("Received by vendor")}</span>
            </footer>
          </article>

          <Panel title={t("Deliveries")} icon={<Truck size={15} />} count={grns.length} pad={false}>
            <div className="po-tablewrap">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>{t("Line")}</th>
                    <th className="r">{t("Ordered")}</th>
                    <th className="r">{t("Received")}</th>
                    <th className="r">{t("Outstanding")}</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l) => {
                    const out = Math.max(0, l.qty - l.received);
                    return (
                      <tr key={l.key}>
                        <td>
                          <span className="po-line-name">{x(l.description)}</span>
                          <span className="po-line-bar">
                            <i style={{ width: `${Math.min(1, l.received / (l.qty || 1)) * 100}%` }} />
                          </span>
                        </td>
                        <td className="r num-inline">{fmtQty(l.qty, l.unit)}</td>
                        <td className="r num-inline">{fmtQty(l.received, l.unit)}</td>
                        <td className={`r num-inline${out > 0 ? " k-text-warn" : ""}`}>{out > 0 ? fmtQty(out, l.unit) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {grns.length ? (
              <ul className="po-links">
                {grns.map((g) => (
                  <li key={g.id}>
                    <Link to={R.receipt(g.id)}>
                      <span className="k-ref">{g.ref}</span>
                      <span>{g.receivedAt ? d(g.receivedAt) : t("being counted")}</span>
                      <span className="muted">{g.receivedBy ?? ""}</span>
                      <StatusBadge kind="grn" status={g.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-panel-body muted small">{t("No receipts yet.")}</p>
            )}
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Vendor's answer")} icon={<Truck size={15} />}>
            <ol className="po-ack">
              <li className="done">
                <b>{t("Order sent")}</b>
                <small>{d(po.issuedAt)}</small>
              </li>
              <li className={po.vendorAck === "ACCEPTED" ? "done" : "wait"}>
                <b>{po.vendorAck === "ACCEPTED" ? t("Accepted in the vendor portal") : t("Not accepted yet")}</b>
                <small>{po.vendorAck === "ACCEPTED" ? vendor?.contact : t("The vendor sees it in the portal")}</small>
              </li>
              <li className={po.dispatchedAt ? "done" : "todo"}>
                <b>{po.dispatchedAt ? t("Dispatched") : t("Not dispatched")}</b>
                <small>{po.dispatchedAt ? `${stamp(po.dispatchedAt)}${po.dispatchNote ? ` · ${po.dispatchNote}` : ""}` : t("Expected {d}", { d: d(po.expectedAt) })}</small>
              </li>
            </ol>
          </Panel>

          <Panel title={t("Payments")} icon={<Wallet size={15} />} count={pays.length} pad={false}>
            {pays.length ? (
              <ul className="po-links">
                {pays.map((p) => {
                  const gate = paymentGate(s, p);
                  return (
                    <li key={p.id}>
                      <Link to={R.payment(p.id)}>
                        <span className="k-ref">{p.ref}</span>
                        <Money value={p.amount} short />
                        <span className="muted small">{p.status === "PAID" ? d(p.paidAt) : t("due {d}", { d: d(p.dueDate, false) })}</span>
                        <Badge tone={gate.tone}>{x(gate.label)}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="k-panel-body muted small">{t("No payments on this order.")}</p>
            )}
          </Panel>
        </div>
      </div>

      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        kicker={po.ref}
        title={t("Cancel this order?")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>
              {t("Keep the order")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                s.cancelPo(po.id);
                setConfirmCancel(false);
                toast(t("{po} cancelled", { po: po.ref }), "bad");
              }}
            >
              {t("Cancel the order")}
            </button>
          </>
        }
      >
        <p className="po-dialog-lead">{t("{v} is told the order is cancelled and unpaid payments are removed. This cannot be undone.", { v: vendorName(s, po.vendorId) })}</p>
      </Dialog>
    </div>
  );
}

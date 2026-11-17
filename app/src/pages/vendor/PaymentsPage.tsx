import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, FileText, Send, Wallet } from "lucide-react";
import { Badge, Empty, Money, PageHero, Panel, Register, StatTiles, StatusBadge, useL, type Column } from "../../components/kit";
import { addDays, diffDays, maxDate, minDate, TODAY } from "../../ops/dates";
import { paymentGate } from "../../ops/select";
import { fmtMoney, fmtMoneyShort } from "../../lib/format";
import { invTotal, VENDOR_INV_STATUS } from "../../ops/ext/money-p2";
import type { Payment, PurchaseOrder } from "../../ops/types";
import { BUYER, canInvoice, payState, useVendor, VP, type PayState } from "./model";
import { InvoiceDialog, useEyebrow } from "./parts";

const KIND: Record<Payment["kind"], string> = { ADVANCE: "Advance", ON_DELIVERY: "On delivery", RETENTION: "Retention" };
const PAY_LABEL: Record<PayState, string> = { paid: "Paid", coming: "Coming", late: "Late", hold: "On hold" };

/** Payments: a cash calendar of every payment on its due date, totals, and invoicing delivered orders. */
export function VpPayments() {
  const { t, x, d, rel } = useL();
  const eyebrow = useEyebrow();
  const navigate = useNavigate();
  const { s, view } = useVendor();
  const [invoicing, setInvoicing] = useState<PurchaseOrder | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const cal = useMemo(() => {
    const pays = view?.payments ?? [];
    const from = addDays(minDate(addDays(TODAY, -30), ...pays.map((p) => p.dueDate)), -6);
    const to = addDays(maxDate(addDays(TODAY, 45), ...pays.map((p) => p.dueDate)), 6);
    const span = Math.max(1, diffDays(from, to));
    const months: string[] = [];
    for (let i = 0; i <= span; i++) {
      const dt = addDays(from, i);
      if (dt.endsWith("-01")) months.push(dt);
    }
    return { from, to, span, months, max: Math.max(1, ...pays.map((p) => p.amount)) };
  }, [view]);

  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;
  const pays = view.payments;
  const sum = (st: PayState[]) => pays.filter((p) => st.includes(payState(p))).reduce((a, p) => a + p.amount, 0);
  const paid = sum(["paid"]);
  const coming = sum(["coming", "late"]);
  const hold = sum(["hold"]);
  const late = pays.filter((p) => payState(p) === "late");
  const toInvoice = view.pos.filter((po) => canInvoice(s, po, view.invoices));
  const X = (date: string) => (diffDays(cal.from, date) / cal.span) * 100;
  const pick = picked ? pays.find((p) => p.id === picked) : null;
  const poTitle = (poId: string) => {
    const po = s.pos.find((p) => p.id === poId);
    if (!po) return poId;
    return po.rfqId ? x(s.rfqs.find((r) => r.id === po.rfqId)?.title) : x(po.lines[0]?.description);
  };

  const columns: Column<Payment>[] = [
    {
      key: "ref",
      header: t("Payment"),
      sort: (p) => p.ref,
      render: (p) => (
        <div className="k-cell-title">
          <span className="k-row" style={{ gap: 6 }}>
            <span className="k-ref">{p.ref}</span>
            <span className="muted small">{t(KIND[p.kind])}</span>
          </span>
          <strong className="truncate">
            {p.poId} · {poTitle(p.poId)}
          </strong>
        </div>
      ),
    },
    {
      key: "due",
      header: t("Due"),
      sort: (p) => p.dueDate,
      render: (p) => (
        <span className={`vp-due-cell${payState(p) === "late" ? " late" : ""}`}>
          <b className="num-inline">{d(p.status === "PAID" ? p.paidAt : p.dueDate)}</b>
          <small>{p.status === "PAID" ? t("paid") : rel(p.dueDate)}</small>
        </span>
      ),
    },
    { key: "amt", header: t("Amount"), align: "right", sort: (p) => p.amount, render: (p) => <Money value={p.amount} /> },
    {
      key: "st",
      header: t("Status"),
      render: (p) => {
        const gate = paymentGate(s, p);
        return (
          <div className="k-cell-title">
            <span>
              <StatusBadge kind="payment" status={p.status} />
            </span>
            {p.status !== "PAID" ? <small>{x(gate.label)}</small> : null}
            {p.holdReason ? <small className="k-text-bad">{p.holdReason}</small> : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="k-page vp-page">
      <PageHero eyebrow={eyebrow("Payments")} title={t("Payments")} subtitle={t("When {buyer} pays you, what is coming and what is held.", { buyer: BUYER })} flow={["Delivered", "Invoice", "Released", "Paid"]} art="pay" />

      <StatTiles
        items={[
          { label: t("Paid so far"), value: <Money value={paid} short />, sub: t("{n} payments", { n: pays.filter((p) => p.status === "PAID").length }), tone: "ok" },
          { label: t("Coming"), value: <Money value={coming} short />, sub: late.length ? t("{n} past the due date", { n: late.length }) : t("scheduled or ready to pay"), tone: late.length ? "bad" : "brand" },
          { label: t("On hold"), value: <Money value={hold} short />, sub: hold ? t("the buyer is holding it") : t("nothing held"), tone: hold ? "bad" : "neutral" },
        ]}
      />

      <Panel title={t("Cash calendar")} icon={<CalendarDays size={15} />} sub={t("Each payment is a stem on its due date; taller means more money. Click one for details.")}>
        {pays.length ? (
          <>
            <div className="vp-cal-scroll">
              <div className="vp-cal">
                <div className="vp-cal-grid">
                  {cal.months.map((m) => (
                    <span key={m} style={{ left: `${X(m)}%` }}>
                      {d(m, false).replace(/^1 /, "")}
                    </span>
                  ))}
                </div>
                <div className="vp-cal-today" style={{ left: `${X(TODAY)}%` }}>
                  <span>{t("Today")}</span>
                </div>
                {pays.map((p, i) => {
                  const ps = payState(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`vp-stem ${ps}${picked === p.id ? " on" : ""}`}
                      style={{ left: `${X(p.dueDate)}%`, height: `${18 + (p.amount / cal.max) * 72}%`, animationDelay: `${i * 70}ms` }}
                      onClick={() => setPicked(picked === p.id ? null : p.id)}
                      title={`${p.ref} · ${fmtMoney(p.amount)} AZN · ${d(p.dueDate)}`}
                    >
                      <span className="vp-stem-head" />
                      <span className="vp-stem-label num-inline">{fmtMoneyShort(p.amount)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="vp-key">
              <span>
                <i style={{ background: "var(--graphite)" }} />
                {t("Paid")}
              </span>
              <span>
                <i style={{ background: "var(--stamp)" }} />
                {t("Coming")}
              </span>
              <span>
                <i style={{ background: "var(--redline)" }} />
                {t("Late")}
              </span>
              <span>
                <i className="hollow" />
                {t("On hold")}
              </span>
            </div>
            {pick ? (
              <div className={`vp-cal-pick k-rise pay-${payState(pick)}`}>
                <span className="k-ref">{pick.ref}</span>
                <b>
                  <Money value={pick.amount} />
                </b>
                <span>
                  {t(PAY_LABEL[payState(pick)])} · {pick.status === "PAID" ? t("paid {date}", { date: d(pick.paidAt) }) : t("due {date}", { date: d(pick.dueDate) })} · {pick.poId}
                </span>
                {pick.holdReason ? <span className="k-text-bad">{pick.holdReason}</span> : null}
                {pick.bankRef ? <span className="k-mono muted small">{pick.bankRef}</span> : null}
                <button type="button" className="k-link-btn" onClick={() => navigate(VP.order(pick.poId))}>
                  {t("Open the order")}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">{t("No payments scheduled yet. They are set when {buyer} issues an order.", { buyer: BUYER })}</p>
        )}
      </Panel>

      <div className="k-grid-main">
        <Register
          rows={pays}
          columns={columns}
          rowKey={(p) => p.id}
          onRowClick={(p) => setPicked(p.id)}
          rowClass={(p) => (payState(p) === "hold" || payState(p) === "late" ? "vp-row-alert" : undefined)}
          initialSort={{ key: "due", dir: "asc" }}
          empty={t("No payments yet.")}
        />

        <div className="k-stack">
          <Panel title={t("Ready to invoice")} icon={<Send size={15} />} count={toInvoice.length || undefined} sub={t("Orders where goods have arrived and money is still owed.")}>
            {toInvoice.length ? (
              <ul className="vp-mini">
                {toInvoice.map((po) => {
                  const owed = s.payments.filter((p) => p.poId === po.id && p.status !== "PAID").reduce((a, p) => a + p.amount, 0);
                  return (
                    <li key={po.id} className="vp-inv-row">
                      <div>
                        <b>
                          {po.ref} · <Money value={owed} short />
                        </b>
                        <small className="truncate">{poTitle(po.id)}</small>
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setInvoicing(po)}>
                        <Wallet size={14} />
                        {t("Send invoice")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small">{t("Nothing to invoice right now.")}</p>
            )}
          </Panel>

          <Panel title={t("Invoices sent")} icon={<FileText size={15} />} count={view.invoices.length || undefined} actions={<Link to={VP.invoices} className="k-link-btn">{t("All invoices")}</Link>}>
            {view.invoices.length ? (
              <ul className="vp-mini">
                {view.invoices.slice(0, 6).map((inv) => {
                  const meta = VENDOR_INV_STATUS[inv.status];
                  return (
                    <li key={inv.id}>
                      <span className={`vp-mini-dot ${meta.tone}`} />
                      <div>
                        <b>
                          {inv.ref} · <Money value={invTotal(inv)} short />
                        </b>
                        <small>
                          {inv.poId} · {d(inv.date)}
                        </small>
                      </div>
                      <Badge tone={meta.tone}>{x(meta.label)}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small">{t("No invoices sent yet.")}</p>
            )}
          </Panel>
        </div>
      </div>

      <InvoiceDialog open={!!invoicing} onClose={() => setInvoicing(null)} po={invoicing} vendorId={view.vendor.id} />
    </div>
  );
}

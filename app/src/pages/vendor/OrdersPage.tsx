import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, BarChart3, Eye, Truck } from "lucide-react";
import { Empty, Money, PageHero, Panel, Register, StatTiles, StatusBadge, toast, useL, type Column } from "../../components/kit";
import { Segmented } from "../../components/ui";
import { useOps } from "../../ops/store";
import { TODAY } from "../../ops/dates";
import { fmtMoneyShort } from "../../lib/format";
import type { PurchaseOrder } from "../../ops/types";
import { BUYER, orderMoney, orderState, useVendor, VP, type OrderStage } from "./model";
import { DispatchDialog, StageBadge, useEyebrow } from "./parts";

type Filter = "open" | "done" | "all";

/** Purchase orders: the order book chart (paid / coming / not yet invoiced), totals and the register. */
export function VpOrders() {
  const { t, x, d, rel } = useL();
  const eyebrow = useEyebrow();
  const navigate = useNavigate();
  const { s, view } = useVendor();
  const vendorAcceptPo = useOps((st) => st.vendorAcceptPo);
  const [filter, setFilter] = useState<Filter>("all");
  const [dispatching, setDispatching] = useState<PurchaseOrder | null>(null);

  const rows = useMemo(() => (view ? view.pos.map((po) => ({ po, st: orderState(s, po, view.invoices), m: orderMoney(s, po, view.invoices) })) : []), [s, view]);
  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;

  const title = (po: PurchaseOrder) => (po.rfqId ? x(s.rfqs.find((r) => r.id === po.rfqId)?.title) : x(po.lines[0]?.description));
  const accept = (po: PurchaseOrder) => {
    vendorAcceptPo(po.id);
    toast(t("{ref} accepted. {buyer} can see it.", { ref: po.ref, buyer: BUYER }));
  };
  const waiting = rows.filter((r) => r.st.stage === "accept");
  const onOrder = rows.reduce((a, r) => a + r.m.total, 0);
  const paid = rows.reduce((a, r) => a + r.m.paid, 0);
  const isOpen = (stage: OrderStage) => stage !== "paid" && stage !== "cancelled" && stage !== "waitpay";
  const shown = rows.filter((r) => filter === "all" || (filter === "open" ? isOpen(r.st.stage) : !isOpen(r.st.stage)));
  const maxTotal = Math.max(1, ...rows.map((r) => r.m.total));

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "po",
      header: t("Order"),
      sort: (r) => r.po.id,
      render: (r) => (
        <div className="k-cell-title">
          <span className="k-row" style={{ gap: 6 }}>
            <span className="k-ref">{r.po.ref}</span>
            <StatusBadge kind="po" status={r.po.status} />
          </span>
          <strong className="truncate">{title(r.po)}</strong>
          <small>{t("issued {date}", { date: d(r.po.issuedAt) })} · {t("{n} lines", { n: r.po.lines.length })}</small>
        </div>
      ),
    },
    {
      key: "due",
      header: t("Due on site"),
      sort: (r) => r.po.expectedAt,
      hideBelow: 900,
      render: (r) => (
        <span className={`vp-due-cell${r.st.late ? " late" : ""}`}>
          <b className="num-inline">{d(r.po.expectedAt)}</b>
          <small>{r.po.status === "CLOSED" ? t("delivered") : rel(r.po.expectedAt)}</small>
        </span>
      ),
    },
    { key: "value", header: t("Value"), align: "right", sort: (r) => r.m.total, render: (r) => <Money value={r.m.total} short /> },
    {
      key: "paid",
      header: t("Paid"),
      align: "right",
      hideBelow: 1100,
      sort: (r) => r.m.paid,
      render: (r) => <span className="num-inline">{Math.round((r.m.paid / Math.max(1, r.m.total)) * 100)}%</span>,
    },
    { key: "stage", header: t("Where it is"), render: (r) => <StageBadge stage={r.st.stage} /> },
    {
      key: "act",
      header: "",
      align: "right",
      render: (r) => (
        <span className="vp-row-actions" onClick={(e) => e.stopPropagation()}>
          {r.st.stage === "accept" ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => accept(r.po)}>
              <BadgeCheck size={14} />
              {t("Accept order")}
            </button>
          ) : r.st.stage === "dispatch" || r.st.stage === "balance" ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setDispatching(r.po)}>
              <Truck size={14} />
              {r.st.stage === "balance" ? t("Dispatch the balance") : t("Dispatch delivery")}
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(VP.order(r.po.id))}>
              <Eye size={14} />
              {t("Open")}
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="k-page vp-page">
      <PageHero
        eyebrow={eyebrow("Purchase orders")}
        title={t("Purchase orders")}
        subtitle={t("Orders {buyer} has placed with you: accept them, dispatch the goods and follow the money.", { buyer: BUYER })}
        flow={["Accept", "Dispatch", "Received on site", "Invoice", "Paid"]}
        art="order"
      />

      {waiting.length ? (
        <section className="vp-accept" aria-label={t("Waiting for you to accept")}>
          <header>
            <h2>{t("Waiting for you to accept")}</h2>
            <p>{t("The buyer has issued these orders. Accept to confirm you will deliver on the date asked.")}</p>
          </header>
          <div className="vp-accept-list">
            {waiting.map(({ po, m }) => (
              <article key={po.id} className="vp-accept-card">
                <div className="vp-accept-main">
                  <span className="k-ref">{po.ref}</span>
                  <strong>{title(po)}</strong>
                  <small>
                    {t("issued {date}", { date: d(po.issuedAt) })} · {t("deliver by {date}", { date: d(po.expectedAt) })} · {t(po.paymentTerms)}
                  </small>
                </div>
                <span className="vp-accept-value">
                  <Money value={m.total} />
                </span>
                <div className="vp-accept-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => navigate(VP.order(po.id))}>
                    {t("Read the order")}
                  </button>
                  <button type="button" className="btn btn-primary btn-lg" onClick={() => accept(po)}>
                    <BadgeCheck size={16} />
                    {t("Accept order")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <StatTiles
        items={[
          { label: t("On order"), value: <Money value={onOrder} short />, sub: t("{n} orders, incl. VAT", { n: rows.length }) },
          { label: t("Paid so far"), value: <Money value={paid} short />, sub: t("{p}% of the order book", { p: Math.round((paid / Math.max(1, onOrder)) * 100) }), tone: "ok" },
          { label: t("Still to come"), value: <Money value={onOrder - paid} short />, sub: rows.some((r) => r.m.hold) ? t("some of it on hold") : t("as you deliver and invoice"), tone: rows.some((r) => r.m.hold) ? "bad" : "brand", onClick: () => navigate(VP.payments) },
        ]}
      />

      <Panel title={t("Order book")} icon={<BarChart3 size={15} />} sub={t("One column per order: paid, coming to you, and not yet invoiced. A red outline means a payment is on hold.")}>
        {rows.length ? (
          <>
            <div className="vp-book-scroll">
              <div className="vp-book" style={{ minWidth: Math.max(300, rows.length * 78) }}>
                {[...rows].reverse().map(({ po, m, st }, i) => (
                  <button key={po.id} type="button" className="vp-book-col" onClick={() => navigate(VP.order(po.id))} title={`${po.ref} · ${fmtMoneyShort(m.total)} AZN`} style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="vp-book-val num-inline">{fmtMoneyShort(m.total)}</span>
                    <span className="vp-book-bar" style={{ height: `${Math.max(6, (m.total / maxTotal) * 100)}%` }}>
                      <i className="seg-rest" style={{ flexGrow: m.rest }} />
                      <i className={`seg-coming${m.hold ? " hold" : ""}`} style={{ flexGrow: m.coming }} />
                      <i className="seg-paid" style={{ flexGrow: m.paid }} />
                    </span>
                    <span className="vp-book-label">{po.ref}</span>
                    <small className={`vp-book-stage${st.stage === "accept" ? " warn" : ""}`}>{st.late ? t("late") : po.expectedAt > TODAY ? d(po.expectedAt, false) : ""}</small>
                  </button>
                ))}
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
                <i className="hold" />
                {t("On hold")}
              </span>
              <span>
                <i className="rest" />
                {t("Not yet invoiced")}
              </span>
            </div>
          </>
        ) : (
          <p className="muted">{t("No orders yet.")}</p>
        )}
      </Panel>

      <Register
        rows={shown}
        columns={columns}
        rowKey={(r) => r.po.id}
        onRowClick={(r) => navigate(VP.order(r.po.id))}
        rowClass={(r) => (r.st.stage === "accept" ? "vp-row-hot" : undefined)}
        toolbar={
          <div className="vp-filterbar">
            <Segmented<Filter>
              label={t("Filter orders")}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t("All"), count: rows.length },
                { value: "open", label: t("Needs work"), count: rows.filter((r) => isOpen(r.st.stage)).length },
                { value: "done", label: t("Delivered"), count: rows.filter((r) => !isOpen(r.st.stage)).length },
              ]}
            />
          </div>
        }
        empty={t("No orders here yet. When {buyer} approves one of your quotes, the order appears here.", { buyer: BUYER })}
      />

      {dispatching ? <DispatchDialog open onClose={() => setDispatching(null)} po={dispatching} balance={orderState(s, dispatching, view.invoices).stage === "balance"} /> : null}
    </div>
  );
}


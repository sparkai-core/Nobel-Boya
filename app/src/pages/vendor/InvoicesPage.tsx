import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, MessageSquareWarning, PackageCheck, ReceiptText, Send } from "lucide-react";
import { Badge, Empty, Money, PageHero, Panel, StatTiles, useL } from "../../components/kit";
import { fmtMoneyShort, fmtQty, unitLabel } from "../../lib/format";
import { matchOf, invTotal, VENDOR_INV_STATUS, vendorQuery } from "../../ops/ext/money-p2";
import type { Invoice, PurchaseOrder } from "../../ops/types";
import { buyerName, canInvoice, queried, useVendor, VP } from "./model";
import { InvoiceDialog, useEyebrow } from "./parts";

const TRACK = [
  { key: "sent", label: "Received" },
  { key: "check", label: "Being checked" },
  { key: "approved", label: "Approved for payment" },
  { key: "paid", label: "Paid" },
] as const;

const stepOf = (i: Invoice) => (i.status === "PAID" ? 3 : i.status === "BOOKED" ? 2 : i.status === "TO_MATCH" ? 0 : 1);

/** Vendor invoices: where each bill is with the buyer, the buyer's queries, and sending a new invoice from a delivery. */
export function VpInvoices() {
  const { t, x, d, lang } = useL();
  const eyebrow = useEyebrow();
  const { s, view } = useVendor();
  const [sending, setSending] = useState<{ po: PurchaseOrder; replaces: Invoice | null } | null>(null);

  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;
  const all = view.invoices;
  const live = all.filter((i) => i.status !== "REJECTED");
  const queries = all.filter(queried);
  const ready = view.pos.filter((po) => canInvoice(s, po, all));
  const at = (k: number) => live.filter((i) => !queried(i) && stepOf(i) === k);
  const sum = (xs: Invoice[]) => xs.reduce((a, i) => a + invTotal(i), 0);
  const poTitle = (po: PurchaseOrder) => (po.rfqId ? x(s.rfqs.find((r) => r.id === po.rfqId)?.title) : x(po.lines[0]?.description));

  return (
    <div className="k-page vp-page">
      <PageHero
        eyebrow={eyebrow("Invoices")}
        title={t("Your invoices")}
        subtitle={t("Send an invoice for what was delivered and follow it until {buyer} pays.", { buyer: buyerName() })}
        flow={["Send", "Being checked", "Approved for payment", "Paid"]}
        art="pay"
        actions={
          ready.length ? (
            <button type="button" className="btn btn-primary" onClick={() => setSending({ po: ready[0]!, replaces: null })}>
              <Send size={15} />
              {t("Send an invoice")}
            </button>
          ) : undefined
        }
      />

      <section className="vp-itrack" aria-label={t("Where your invoices are")}>
        <ol>
          {TRACK.map((st, k) => {
            const xs = at(k);
            return (
              <li key={st.key} className={`s-${st.key}${xs.length ? " has" : ""}`}>
                <span className="vp-itrack-dot">{k === 3 ? <Check size={13} strokeWidth={3} /> : k + 1}</span>
                <strong>{t(st.label)}</strong>
                <b className="num-inline">{xs.length}</b>
                <small className="num-inline">{fmtMoneyShort(sum(xs))} AZN</small>
              </li>
            );
          })}
        </ol>
        {queries.length ? (
          <a href="#vp-queries" className="vp-itrack-query">
            <MessageSquareWarning size={15} />
            <span>{t("{n} with a query from the buyer", { n: queries.length })}</span>
            <b className="num-inline">{fmtMoneyShort(sum(queries))} AZN</b>
          </a>
        ) : null}
      </section>

      <StatTiles
        items={[
          { label: t("Invoiced"), value: <Money value={sum(live)} short />, sub: t("{n} invoices", { n: live.length }) },
          { label: t("Approved for payment"), value: <Money value={sum(at(2))} short />, sub: t("waiting for the pay run"), tone: "brand" },
          { label: t("Paid"), value: <Money value={sum(at(3))} short />, tone: "ok" },
          { label: t("Queries"), value: queries.length, sub: queries.length ? t("answer them to get paid") : t("none open"), tone: queries.length ? "bad" : undefined },
        ]}
      />

      {queries.length ? (
        <section id="vp-queries" className="vp-queries" aria-label={t("Queries from the buyer")}>
          {queries.map((inv) => {
            const q = vendorQuery(s, inv);
            const { po, m } = matchOf(s, inv);
            return (
              <article key={inv.id} className="vp-query k-rise">
                <header>
                  <span className="vp-query-icon">
                    <MessageSquareWarning size={17} />
                  </span>
                  <div>
                    <small>
                      {t("Query from {buyer}", { buyer: buyerName() })} · {inv.ref} · {inv.poId}
                    </small>
                    <strong>{q ? x(q) : t("The buyer is checking a difference on this bill.")}</strong>
                  </div>
                  <Badge tone="bad">{x(VENDOR_INV_STATUS[inv.status].label)}</Badge>
                </header>
                <ul className="vp-query-lines">
                  {m.lines
                    .filter((l) => !l.ok)
                    .map((l) => {
                      const ln = inv.lines.find((y) => y.key === l.key);
                      const u = unitLabel(ln?.unit ?? "", lang);
                      return (
                        <li key={l.key}>
                          <span className="truncate">{x(ln?.description)}</span>
                          <span className="num-inline">
                            {t("you billed")} <b>{fmtQty(l.billed, ln?.unit ?? "")} {u}</b>
                          </span>
                          <span className="num-inline">
                            {t("site received")} <b>{fmtQty(l.received, ln?.unit ?? "")} {u}</b>
                          </span>
                          {Math.abs(l.rateDiff) > 0.005 ? <span className="num-inline k-text-bad">{t("rate {a} vs order {b}", { a: l.rate.toFixed(2), b: (l.poRate ?? 0).toFixed(2) })}</span> : null}
                        </li>
                      );
                    })}
                </ul>
                <div className="k-row">
                  {po ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setSending({ po, replaces: inv })}>
                      <Send size={14} />
                      {t("Send a corrected invoice")}
                    </button>
                  ) : null}
                  <Link to={VP.order(inv.poId)} className="btn btn-ghost btn-sm">
                    {t("See the order")}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      <div className="k-grid-main">
        <Panel title={t("All invoices")} icon={<ReceiptText size={15} />} count={all.length || undefined} pad={false}>
          {all.length ? (
            <ul className="vp-invlist">
              {all.map((inv) => {
                const meta = VENDOR_INV_STATUS[inv.status];
                const k = stepOf(inv);
                const bad = queried(inv);
                return (
                  <li key={inv.id} className={inv.status === "REJECTED" ? "off" : undefined}>
                    <div className="vp-invlist-main">
                      <span className="k-row" style={{ gap: 6 }}>
                        <b className="k-mono">{inv.ref}</b>
                        <Badge tone={meta.tone}>{x(meta.label)}</Badge>
                      </span>
                      <small>
                        <Link to={VP.order(inv.poId)}>{inv.poId}</Link> · {t("sent {date}", { date: d(inv.date) })} · {inv.status === "PAID" ? t("paid") : t("due {date}", { date: d(inv.dueDate) })}
                      </small>
                    </div>
                    {inv.status !== "REJECTED" ? (
                      <span className="vp-invlist-track" aria-label={x(meta.label)}>
                        {TRACK.map((st, i) => (
                          <i key={st.key} className={i < k || (i === k && k === 3) ? "done" : i === k ? (bad ? "bad" : "now") : undefined} title={t(st.label)} />
                        ))}
                      </span>
                    ) : (
                      <span className="muted small">{t("replaced or rejected")}</span>
                    )}
                    <Money value={invTotal(inv)} short />
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title={t("No invoices yet")}>{t("When goods are received on site, send the invoice here.")}</Empty>
          )}
        </Panel>

        <Panel title={t("Ready to invoice")} icon={<PackageCheck size={15} />} count={ready.length || undefined} sub={t("Orders delivered in full or in part, with money still owed and no invoice yet.")}>
          {ready.length ? (
            <ul className="vp-mini">
              {ready.map((po) => (
                <li key={po.id} className="vp-inv-row">
                  <div>
                    <b>{po.ref}</b>
                    <small className="truncate">{poTitle(po)}</small>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setSending({ po, replaces: null })}>
                    <Send size={14} />
                    {t("Send an invoice")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">
              {t("Nothing to invoice right now. Orders appear here once the site has received goods.")}{" "}
              <Link to={VP.deliveries} className="k-link-btn">
                {t("Deliveries")} <ArrowRight size={12} />
              </Link>
            </p>
          )}
        </Panel>
      </div>

      <InvoiceDialog open={!!sending} onClose={() => setSending(null)} po={sending?.po ?? null} vendorId={view.vendor.id} replaces={sending?.replaces ?? null} />
    </div>
  );
}

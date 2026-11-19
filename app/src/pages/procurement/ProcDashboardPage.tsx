import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Building2, ClipboardList, ExternalLink, FileStack, PackageCheck, Plus, Send, ShoppingCart, Truck, Wallet, Zap } from "lucide-react";
import { Avatar, Badge, CountUp, Money, PageHero, Panel, StatTiles, useL } from "../../components/kit";
import { projectName } from "../../lib/loc";
import { hasScore } from "../../ops/ext/proc-client";
import { useOps } from "../../ops/store";
import { addDays, diffDays, TODAY } from "../../ops/dates";
import { budgetOf, paymentGate, poLate, poNet, poReceivedShare, poTotal, quoteTotal, R, to, tradeName, vendorStats } from "../../ops/select";
import { fmtMoneyShort } from "../../lib/format";
import type { Trade } from "../../ops/types";

/**
 * Procurement home: the chain as it stands today (one column per stage), what needs a decision,
 * money against the BOQ budget by trade, deliveries due in the next weeks and the live activity feed.
 */
export function ProcDashboardPage() {
  const { t, x, d, rel, lang, stamp } = useL();
  const navigate = useNavigate();
  const s = useOps();

  const chain = useMemo(() => {
    const mrOpen = s.mrs.filter((m) => m.status === "SUBMITTED" || m.status === "SOURCING");
    const rfqOpen = s.rfqs.filter((r) => r.status === "OPEN");
    const quotesLive = s.quotes.filter((q) => !q.duplicate && q.outcome == null);
    const apprPending = s.approvals.filter((a) => a.status === "PENDING");
    const poOpen = s.pos.filter((p) => p.status === "ISSUED" || p.status === "PART_RECEIVED");
    const grnGate = s.pos.filter((p) => p.dispatchedAt && (p.status === "ISSUED" || p.status === "PART_RECEIVED"));
    const payDue = s.payments.filter((p) => p.status === "READY" || p.status === "SCHEDULED" || p.status === "ON_HOLD");
    return [
      { key: "request", label: "Requests", icon: ClipboardList, count: mrOpen.length, value: mrOpen.reduce((a, m) => a + budgetOf(s, m.lines), 0), note: t("{n} waiting for an RFQ", { n: s.mrs.filter((m) => m.status === "SUBMITTED").length }), to: R.requests },
      { key: "rfq", label: "RFQs out", icon: Send, count: rfqOpen.length, value: rfqOpen.reduce((a, r) => a + budgetOf(s, r.lines), 0), note: t("{n} vendors still to answer", { n: rfqOpen.reduce((a, r) => a + r.invitations.filter((i) => i.status === "INVITED" || i.status === "ACKNOWLEDGED").length, 0) }), to: R.rfqs },
      { key: "quotes", label: "Quotes in", icon: FileStack, count: quotesLive.length, value: quotesLive.reduce((a, q) => a + quoteTotal(q), 0), note: t("{n} to check", { n: s.quotes.filter((q) => q.status === "NEEDS_REVIEW").length }), to: R.quotes },
      { key: "approve", label: "Approvals", icon: BadgeCheck, count: apprPending.length, value: apprPending.reduce((a, x2) => a + x2.amount, 0), note: t("{n} need two signatures", { n: apprPending.filter((a) => a.requiredLevels === 2).length }), to: R.approvals },
      { key: "order", label: "Open orders", icon: ShoppingCart, count: poOpen.length, value: poOpen.reduce((a, p) => a + poTotal(p) * (1 - poReceivedShare(p)), 0), note: t("{n} late", { n: poOpen.filter(poLate).length }), to: R.orders, late: poOpen.filter(poLate).length },
      { key: "receive", label: "On the way", icon: Truck, count: grnGate.length, value: grnGate.reduce((a, p) => a + poTotal(p) * (1 - poReceivedShare(p)), 0), note: t("dispatched by the vendor"), to: R.receipts },
      { key: "pay", label: "To pay", icon: Wallet, count: payDue.length, value: payDue.reduce((a, p) => a + p.amount, 0), note: t("{n} clear to pay now", { n: s.payments.filter((p) => p.status === "READY").length }), to: R.payments },
    ];
  }, [s, t]);

  const money = useMemo(() => {
    const live = s.pos.filter((p) => p.status !== "CANCELLED");
    const committed = live.reduce((a, p) => a + poTotal(p), 0);
    const budget = live.reduce((a, p) => a + budgetOf(s, p.lines), 0) * 1.18;
    const paid = s.payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0);
    const outstanding = live.reduce((a, p) => a + poTotal(p) * (1 - poReceivedShare(p)), 0);
    return { committed, budget, paid, outstanding, saving: budget - committed };
  }, [s]);

  const queue = useMemo(() => {
    const items: { key: string; icon: typeof Zap; tone: "bad" | "warn" | "brand"; title: string; sub: string; action: string; to: string; weight: number }[] = [];
    for (const a of s.approvals.filter((x2) => x2.status === "PENDING"))
      items.push({ key: a.id, icon: BadgeCheck, tone: a.requiredLevels === 2 ? "bad" : "warn", title: t("Approve {ref}: {title}", { ref: a.ref, title: x(a.title) }), sub: `${s.vendors.find((v) => v.id === a.vendorId)?.name ?? ""} · ${fmtMoneyShort(a.amount)} AZN · ${a.level}/${a.requiredLevels} ${t("signatures")}`, action: t("Decide"), to: R.approval(a.id), weight: 100 + a.amount / 1000 });
    for (const r of s.rfqs.filter((x2) => x2.status === "OPEN" && x2.invitations.filter((i) => i.status === "SUBMITTED").length >= 2))
      items.push({ key: r.id, icon: FileStack, tone: "brand", title: t("{ref} is ready to compare", { ref: r.ref }), sub: t("{n} quotes in · closes {when}", { n: r.invitations.filter((i) => i.status === "SUBMITTED").length, when: rel(r.dueDate) }), action: t("Compare"), to: R.compare(r.id), weight: 80 });
    for (const m of s.mrs.filter((x2) => x2.status === "SUBMITTED"))
      items.push({ key: m.id, icon: ClipboardList, tone: diffDays(TODAY, m.neededBy) < 45 ? "warn" : "brand", title: t("Send {ref} to vendors", { ref: m.ref }), sub: `${x(m.title)} · ${t("needed")} ${d(m.neededBy)}`, action: t("Create RFQ"), to: R.newRfq(m.id), weight: 60 - diffDays(TODAY, m.neededBy) / 10 });
    for (const p of s.pos.filter((x2) => x2.dispatchedAt && (x2.status === "ISSUED" || x2.status === "PART_RECEIVED")))
      items.push({ key: `g-${p.id}`, icon: Truck, tone: "brand", title: t("{ref} is at the gate", { ref: p.ref }), sub: `${s.vendors.find((v) => v.id === p.vendorId)?.name ?? ""} · ${p.dispatchNote ?? t("dispatched")}`, action: t("Receive"), to: R.order(p.id), weight: 70 });
    for (const p of s.payments.filter((x2) => x2.status === "READY"))
      items.push({ key: p.id, icon: Wallet, tone: p.dueDate < TODAY ? "bad" : "brand", title: t("Pay {ref}", { ref: p.ref }), sub: `${s.vendors.find((v) => v.id === p.vendorId)?.name ?? ""} · ${fmtMoneyShort(p.amount)} AZN · ${t("due")} ${d(p.dueDate)}`, action: t("Pay"), to: R.payment(p.id), weight: p.dueDate < TODAY ? 90 : 40 });
    return items.sort((a, b) => b.weight - a.weight);
  }, [s, t, x, d, rel]);

  const byTrade = useMemo(() => {
    const map = new Map<Trade, { budget: number; committed: number; paid: number }>();
    for (const m of s.materials) {
      const row = map.get(m.trade) ?? { budget: 0, committed: 0, paid: 0 };
      row.budget += m.rate * m.budgetQty;
      map.set(m.trade, row);
    }
    for (const p of s.pos.filter((x2) => x2.status !== "CANCELLED")) {
      const trade = (p.lines[0]?.material && s.materials.find((m) => m.key === p.lines[0]!.material)?.trade) || s.vendors.find((v) => v.id === p.vendorId)?.trade;
      if (!trade) continue;
      const row = map.get(trade) ?? { budget: 0, committed: 0, paid: 0 };
      row.committed += poNet(p);
      row.paid += s.payments.filter((pay) => pay.poId === p.id && pay.status === "PAID").reduce((a, pay) => a + pay.amount / 1.18, 0);
      map.set(trade, row);
    }
    return [...map.entries()].filter(([, v]) => v.budget > 0).sort((a, b) => b[1].budget - a[1].budget);
  }, [s]);
  const maxBudget = Math.max(1, ...byTrade.map(([, v]) => Math.max(v.budget, v.committed)));

  const deliveries = useMemo(() => {
    const from = addDays(TODAY, -21);
    const span = 49;
    return {
      from,
      span,
      items: s.pos
        .filter((p) => p.status === "ISSUED" || p.status === "PART_RECEIVED")
        .map((p) => ({ po: p, x: Math.max(0, Math.min(1, diffDays(from, p.expectedAt) / span)), late: poLate(p), on: !!p.dispatchedAt }))
        .sort((a, b) => a.x - b.x),
    };
  }, [s.pos]);

  const topVendors = useMemo(
    () =>
      s.vendors
        .map((v) => ({ v, st: vendorStats(s, v.id) }))
        .filter((r) => r.st.ordered > 0)
        .sort((a, b) => b.st.ordered - a.st.ordered)
        .slice(0, 5),
    [s],
  );

  const feed = s.feed.filter((f) => f.module !== "PM").slice(0, 9);
  const maxChain = Math.max(1, ...chain.map((c) => c.value));

  return (
    <div className="k-page ph">
      <PageHero
        eyebrow={`${t("Procurement")} · ${projectName(lang)}`}
        title={t("Procurement")}
        subtitle={t("Every request, quote, order, delivery and payment on {p}, traced back to the bill of quantities.", { p: projectName(lang) })}
        flow={["Request", "RFQ", "Quotes", "Approve", "Order", "Receive", "Pay"]}
        art="procurement"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => navigate(R.newRequest)}>
              <Plus size={15} />
              {t("New request")}
            </button>
            <a className="btn btn-ghost" href="#/vendor" target="_blank" rel="noopener">
              <ExternalLink size={15} />
              {t("Open the vendor portal")}
            </a>
          </>
        }
      />

      {!s.vendors.length || (!s.mrs.length && !s.pos.length) ? (
        <div className="k-callout k-tone-brand">
          <Building2 size={15} />
          <span>
            <b>{t("Start here.")}</b>{" "}
            {!s.vendors.length ? (
              <>
                {t("Add your first vendor, then raise a material request or place an order directly.")} <Link to={R.newVendor}>{t("Add vendor")}</Link>
              </>
            ) : (
              <>
                {t("Raise a material request to get quotes, or place an order directly with a vendor.")} <Link to={R.newRequest}>{t("New request")}</Link> · <Link to={to("procurement/orders/new")}>{t("New purchase order")}</Link>
              </>
            )}
          </span>
        </div>
      ) : null}

      <section className="ph-chain" aria-label={t("The chain right now")}>
        {chain.map((c, i) => {
          const Icon = c.icon;
          return (
            <Link key={c.key} to={c.to} className="ph-stage" style={{ animationDelay: `${i * 50}ms` }}>
              <span className="ph-stage-top">
                <span className="ph-stage-icon">
                  <Icon size={15} />
                </span>
                <span className="ph-stage-label">{t(c.label)}</span>
                {c.late ? <Badge tone="bad">{t("{n} late", { n: c.late })}</Badge> : null}
              </span>
              <strong className="ph-stage-count">
                <CountUp value={c.count} />
              </strong>
              <span className="ph-stage-value">
                <Money value={c.value} short />
              </span>
              <span className="ph-stage-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(4, (c.value / maxChain) * 100)}%` }} />
              </span>
              <span className="ph-stage-note">{c.note}</span>
              {i < chain.length - 1 ? <ArrowRight size={14} className="ph-stage-arrow" aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </section>

      <StatTiles
        items={[
          { label: t("Committed on orders"), value: <Money value={money.committed} short />, sub: t("incl. VAT, {n} orders", { n: s.pos.filter((p) => p.status !== "CANCELLED").length }) },
          money.budget > 0
            ? { label: t("Against the BOQ budget"), value: <span className={money.saving >= 0 ? "k-up" : "k-down"}>{money.saving >= 0 ? "−" : "+"}{fmtMoneyShort(Math.abs(money.saving))} <small className="k-cur">AZN</small></span>, sub: money.saving >= 0 ? t("bought under the BOQ rates") : t("over the BOQ rates"), tone: money.saving >= 0 ? "ok" : "bad" }
            : { label: t("Against the BOQ budget"), value: "—", sub: t("no orders on BOQ materials yet") },
          { label: t("Paid to vendors"), value: <Money value={money.paid} short />, sub: money.committed > 0 ? t("{p} of committed", { p: `${Math.round((money.paid / money.committed) * 100)}%` }) : t("nothing ordered yet") },
          { label: t("Goods still to arrive"), value: <Money value={money.outstanding} short />, sub: t("on open orders"), onClick: () => navigate(R.receipts) },
        ]}
      />

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Needs you")} icon={<Zap size={15} />} count={queue.length} sub={t("Decisions and hand-offs waiting on the buyer, most urgent first.")} pad={false}>
            {queue.length ? (
              <ul className="ph-queue">
                {queue.slice(0, 7).map((q, i) => {
                  const Icon = q.icon;
                  return (
                    <li key={q.key} className={i === 0 ? "first" : undefined}>
                      <span className={`ph-queue-icon k-tone-${q.tone}`}>
                        <Icon size={15} />
                      </span>
                      <div className="ph-queue-text">
                        <strong>{q.title}</strong>
                        <small>{q.sub}</small>
                      </div>
                      <button type="button" className={i === 0 ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"} onClick={() => navigate(q.to)}>
                        {q.action}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="k-panel-body muted">{t("Nothing is waiting on you.")}</p>
            )}
          </Panel>

          <Panel title={t("Budget against orders, by trade")} icon={<PackageCheck size={15} />} actions={<Link to={R.budget} className="k-link-btn">{t("Budget page")} <ArrowRight size={13} /></Link>}>
            {!byTrade.length ? <p className="muted small">{t("The open project's BOQ has no priced materials.")}</p> : null}
            <div className="ph-trades">
              {byTrade.map(([trade, v]) => (
                <div key={trade} className="ph-trade">
                  <span className="ph-trade-name">{tradeName(trade, lang)}</span>
                  <span className="ph-trade-track" title={`${t("Budget")} ${fmtMoneyShort(v.budget)} · ${t("Committed")} ${fmtMoneyShort(v.committed)} · ${t("Paid")} ${fmtMoneyShort(v.paid)}`}>
                    <i className="ph-trade-budget k-grow-x" style={{ width: `${(v.budget / maxBudget) * 100}%` }} />
                    <i className="ph-trade-committed k-grow-x" style={{ width: `${(v.committed / maxBudget) * 100}%` }} />
                    <i className="ph-trade-paid k-grow-x" style={{ width: `${(v.paid / maxBudget) * 100}%` }} />
                  </span>
                  <span className="ph-trade-fig num-inline">
                    {fmtMoneyShort(v.committed)} <small>/ {fmtMoneyShort(v.budget)}</small>
                  </span>
                </div>
              ))}
            </div>
            <div className="k-legend">
              <span style={{ ["--lc" as string]: "var(--sheet-3)" }}>{t("BOQ budget")}</span>
              <span style={{ ["--lc" as string]: "#b7a6e6" }}>{t("Committed")}</span>
              <span style={{ ["--lc" as string]: "var(--stamp)" }}>{t("Paid")}</span>
            </div>
          </Panel>

          <Panel title={t("Deliveries, three weeks either side of today")} icon={<Truck size={15} />} actions={<Link to={R.orders} className="k-link-btn">{t("All orders")} <ArrowRight size={13} /></Link>}>
            <div className="ph-deliv">
              <div className="ph-deliv-axis">
                {[0, 7, 14, 21, 28, 35, 42, 49].map((n) => (
                  <span key={n} style={{ left: `${(n / deliveries.span) * 100}%` }}>
                    {d(addDays(deliveries.from, n), false)}
                  </span>
                ))}
                <b className="ph-deliv-today" style={{ left: `${(21 / deliveries.span) * 100}%` }}>
                  {t("Today")}
                </b>
              </div>
              <div className="ph-deliv-lane">
                {deliveries.items.map((it, i) => (
                  <Link key={it.po.id} to={R.order(it.po.id)} className={`ph-truck${it.late ? " late" : ""}${it.on ? " on" : ""}`} style={{ left: `${it.x * 100}%`, top: `${8 + (i % 3) * 30}px` }} title={`${it.po.ref} · ${d(it.po.expectedAt)}`}>
                    <Truck size={13} />
                    <span>{it.po.ref}</span>
                  </Link>
                ))}
              </div>
              <p className="muted small">
                {!deliveries.items.length ? `${t("No open orders.")} ` : null}
                {t("Red trucks are past their delivery date. Filled trucks have been dispatched by the vendor.")}
              </p>
            </div>
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Live activity")} icon={<Zap size={15} />} sub={t("Buyer and vendor portal events, newest first.")}>
            {!feed.length ? <p className="muted small">{t("Nothing has happened yet. Records you create appear here.")}</p> : null}
            <ol className="ph-feed">
              {feed.map((f) => (
                <li key={f.id}>
                  <span className={`ph-feed-dot ${f.module === "VENDOR" ? "vendor" : ""}`} aria-hidden="true" />
                  <div>
                    {f.link ? <Link to={to(f.link)}>{x(f.text)}</Link> : <span>{x(f.text)}</span>}
                    <small>
                      {f.actor} · {stamp(f.at)}
                      {f.module === "VENDOR" ? <Badge tone="info" dot={false}>{t("Vendor portal")}</Badge> : null}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title={t("Top vendors by order value")} icon={<Wallet size={15} />} pad={false} actions={<Link to={R.vendors} className="k-link-btn">{t("All")} <ArrowRight size={13} /></Link>}>
            {!topVendors.length ? <p className="k-panel-body muted">{s.vendors.length ? t("No orders placed yet.") : <>{t("No vendors yet.")} <Link to={R.newVendor}>{t("Add vendor")}</Link></>}</p> : null}
            <ul className="ph-vendors">
              {topVendors.map(({ v, st }) => (
                <li key={v.id}>
                  <Link to={R.vendor(v.id)}>
                    <Avatar name={v.name} size={30} />
                    <span className="ph-vendor-name">
                      <strong className="truncate">{v.name}</strong>
                      <small>
                        {tradeName(v.trade, lang)} · {t("{n} orders", { n: st.pos.length })}
                      </small>
                    </span>
                    <span className="ph-vendor-score" title={t("Vendor score out of 10")}>
                      {hasScore(v) ? v.overall.toFixed(1) : "—"}
                    </span>
                    <span className="num-inline ph-vendor-value">{fmtMoneyShort(st.ordered)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t("Payments falling due")} icon={<Wallet size={15} />} pad={false}>
            {!s.payments.some((p) => p.status !== "PAID") ? <p className="k-panel-body muted">{t("No payments due. A payment is scheduled when an order is issued.")}</p> : null}
            <ul className="ph-pays">
              {s.payments
                .filter((p) => p.status !== "PAID")
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .slice(0, 5)
                .map((p) => {
                  const gate = paymentGate(s, p);
                  return (
                    <li key={p.id}>
                      <Link to={R.payment(p.id)}>
                        <span className="ph-pay-date">
                          <b>{d(p.dueDate, false)}</b>
                          <small className={p.dueDate < TODAY ? "k-text-bad" : undefined}>{rel(p.dueDate)}</small>
                        </span>
                        <span className="ph-vendor-name">
                          <strong className="truncate">{s.vendors.find((v) => v.id === p.vendorId)?.name}</strong>
                          <small className="ph-pay-meta">
                            <Badge tone={gate.tone}>{x(gate.label)}</Badge>
                            {p.ref}
                          </small>
                        </span>
                        <Money value={p.amount} short currency={false} className="ph-vendor-value" />
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

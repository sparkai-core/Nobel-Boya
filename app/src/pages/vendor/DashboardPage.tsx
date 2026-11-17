import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, FileText, Gauge, Inbox, MessageSquareWarning, PackageCheck, ShieldAlert, Truck, Wallet, Zap, type LucideIcon } from "lucide-react";
import { Badge, Empty, PageHero, Panel, Register, StatTiles, useL, type Column } from "../../components/kit";
import { addDays, diffDays, TODAY } from "../../ops/dates";
import { poTotal, quoteTotal } from "../../ops/select";
import { fmtMoneyShort } from "../../lib/format";
import type { Quotation } from "../../ops/types";
import { BUYER, orderState, portalLink, queried, quoteJourney, useVendor, vendorDocs, VP } from "./model";
import { vendorQuery } from "../../ops/ext/money-p2";
import { OutcomeBadge, ScoreRings, useEyebrow } from "./parts";

type Task = { key: string; icon: LucideIcon; tone: "bad" | "warn" | "brand" | "ok"; title: string; sub: string; due: string | null; action: string; to: string; weight: number };

/** Vendor dashboard: what still needs a reply, the quote-to-cash funnel, latest quotes and the buyer's score. */
export function VpDashboard() {
  const { t, x, d, rel, stamp } = useL();
  const eyebrow = useEyebrow();
  const navigate = useNavigate();
  const { s, view } = useVendor();

  const tasks = useMemo(() => {
    if (!view) return [];
    const out: Task[] = [];
    const v = view.vendor;
    for (const p of view.pos) {
      const st = orderState(s, p, view.invoices);
      const title = p.rfqId ? x(s.rfqs.find((r) => r.id === p.rfqId)?.title) : x(p.lines[0]?.description);
      if (st.stage === "accept")
        out.push({ key: `a-${p.id}`, icon: BadgeCheck, tone: "bad", title: t("Accept order {ref}", { ref: p.ref }), sub: `${title} · ${fmtMoneyShort(poTotal(p))} AZN · ${t("issued {date}", { date: d(p.issuedAt) })}`, due: p.expectedAt, action: t("Review and accept"), to: VP.order(p.id), weight: 100 });
      if (st.stage === "dispatch")
        out.push({ key: `d-${p.id}`, icon: Truck, tone: p.expectedAt <= TODAY ? "bad" : "brand", title: t("Dispatch {ref}", { ref: p.ref }), sub: `${title} · ${t("due on site {when}", { when: rel(p.expectedAt) })}`, due: p.expectedAt, action: t("Dispatch delivery"), to: VP.order(p.id), weight: p.expectedAt <= addDays(TODAY, 3) ? 88 : 70 });
      if (st.stage === "balance")
        out.push({ key: `b-${p.id}`, icon: Truck, tone: "warn", title: t("Send the rest of {ref}", { ref: p.ref }), sub: t("{p}% received so far. The site store reported a shortage.", { p: Math.round(st.share * 100) }), due: p.expectedAt, action: t("Dispatch the balance"), to: VP.order(p.id), weight: 82 });
      if (st.stage === "invoice")
        out.push({ key: `i-${p.id}`, icon: Wallet, tone: "brand", title: t("Send the invoice for {ref}", { ref: p.ref }), sub: t("Goods received. Invoice to get paid."), due: null, action: t("Send invoice"), to: VP.invoices, weight: 60 });
    }
    for (const i of view.invites.filter((r) => r.bucket === "answer")) {
      const n = i.daysLeft;
      out.push({
        key: `r-${i.rfq.id}`,
        icon: Inbox,
        tone: n <= 3 ? "bad" : n <= 7 ? "warn" : "brand",
        title: i.inv.status === "INVITED" ? t("Reply to {ref}: {title}", { ref: i.rfq.ref, title: x(i.rfq.title) }) : t("Send your quote for {ref}: {title}", { ref: i.rfq.ref, title: x(i.rfq.title) }),
        sub: `${t("closes {when}", { when: rel(i.rfq.dueDate) })} · ${t("{n} lines", { n: i.rfq.lines.length })}`,
        due: i.rfq.dueDate,
        action: t("Prepare quote"),
        to: VP.rfq(i.rfq.id),
        weight: 96 - Math.max(0, n) * 1.5,
      });
    }
    for (const inv of view.invoices.filter(queried)) {
      const q = vendorQuery(s, inv);
      out.push({ key: `q-${inv.id}`, icon: MessageSquareWarning, tone: "bad", title: t("Answer the buyer's query on invoice {ref}", { ref: inv.ref }), sub: q ? x(q) : t("The buyer is checking a difference on this bill."), due: inv.dueDate, action: t("See the query"), to: VP.invoices, weight: 90 });
    }
    for (const p of view.payments.filter((x2) => x2.status === "ON_HOLD"))
      out.push({ key: `h-${p.id}`, icon: ShieldAlert, tone: "warn", title: t("Payment {ref} is on hold", { ref: p.ref }), sub: p.holdReason ?? "", due: p.dueDate, action: t("See payment"), to: VP.payments, weight: 74 });
    for (const doc of vendorDocs(s, v).filter((x2) => x2.state === "missing" ? x2.required : x2.state === "expired" || x2.state === "expiring"))
      out.push({
        key: `doc-${doc.key}`,
        icon: ShieldAlert,
        tone: doc.state === "expiring" ? "warn" : "bad",
        title: doc.state === "missing" ? t("{doc} is missing", { doc: x(doc.label) }) : doc.state === "expired" ? t("{doc} has expired", { doc: x(doc.label) }) : t("{doc} expires {when}", { doc: x(doc.label), when: rel(doc.expires!) }),
        sub: doc.required ? t("The buyer cannot place new orders without it.") : t("Optional, but the buyer scores you on it."),
        due: doc.expires,
        action: t("Upload a renewed copy"),
        to: VP.documents,
        weight: doc.state === "expiring" ? 52 : doc.required ? 92 : 48,
      });
    for (const i of view.invites.filter((r) => r.bucket === "sent" && r.quote)) {
      const j = quoteJourney(s, i.quote!);
      out.push({ key: `w-${i.rfq.id}`, icon: Clock3, tone: "ok", title: t("Your quote for {ref} is with the buyer", { ref: i.rfq.ref }), sub: `${t(j.outcome.label)} · ${fmtMoneyShort(quoteTotal(i.quote!))} AZN`, due: null, action: t("Follow it"), to: VP.rfq(i.rfq.id), weight: 10 });
    }
    return out.sort((a, b) => b.weight - a.weight);
  }, [s, view, t, x, d, rel]);

  const funnel = useMemo(() => {
    if (!view) return null;
    const quoted = view.quotes.reduce((a, q) => a + quoteTotal(q), 0);
    const ordered = view.pos.reduce((a, p) => a + poTotal(p), 0);
    const delivered = view.pos.reduce((a, p) => a + orderState(s, p, view.invoices).share * poTotal(p), 0);
    const paid = view.payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0);
    const direct = view.pos.filter((p) => !p.quoteId).length;
    return { stages: [
      { key: "quoted", label: "Quoted", value: quoted },
      { key: "ordered", label: "Won and ordered", value: ordered },
      { key: "delivered", label: "Delivered", value: delivered },
      { key: "paid", label: "Paid", value: paid },
    ], direct };
  }, [s, view]);

  if (!view || !funnel) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;
  const v = view.vendor;
  const [first, ...rest] = tasks.filter((x2) => x2.weight > 10);
  const waiting = tasks.filter((x2) => x2.weight <= 10);
  const myFeed = s.feed.filter((f) => f.actor === v.name || f.text.en.includes(v.name) || view.pos.some((p) => f.link?.includes(p.id))).slice(0, 7);

  const quoteCols: Column<Quotation>[] = [
    { key: "q", header: t("Quote"), render: (q) => (
      <div className="k-cell-title">
        <span className="k-row" style={{ gap: 6 }}><span className="k-ref">{q.id}</span><span className="k-mono muted small">{q.ref}</span></span>
        <strong className="truncate">{q.rfqId ? x(s.rfqs.find((r) => r.id === q.rfqId)?.title) : x(q.lines[0]?.description)}</strong>
      </div>
    ) },
    { key: "sent", header: t("Sent"), hideBelow: 900, render: (q) => <span className="num-inline">{d(q.receivedAt)}</span> },
    { key: "total", header: t("Total"), align: "right", render: (q) => <b className="num-inline">{fmtMoneyShort(quoteTotal(q))}</b> },
    { key: "st", header: t("Where it is"), render: (q) => <OutcomeBadge s={s} q={q} /> },
  ];

  const max = Math.max(1, ...funnel.stages.map((f) => f.value));
  const H = (val: number) => Math.max(4, (val / max) * 100);

  return (
    <div className="k-page vp-page">
      <PageHero
        eyebrow={eyebrow("Dashboard")}
        title={t("What still needs a reply")}
        subtitle={t("Everything {buyer} is waiting on from {vendor}, most urgent first.", { buyer: BUYER, vendor: v.name })}
        flow={["Invited", "Quote", "Order", "Dispatch", "Get paid"]}
        art="portal"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => navigate(VP.rfqs)}>
              <Inbox size={15} />
              {t("Open the RFQ inbox")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(VP.orders)}>
              <PackageCheck size={15} />
              {t("My orders")}
            </button>
          </>
        }
      />

      <section className="vp-next" aria-label={t("Do this next")}>
        <header className="vp-next-head">
          <h2>
            <Zap size={16} /> {t("Do this next")}
          </h2>
          <span className="muted small">{!first ? t("Nothing waiting on you") : rest.length ? t("{n} things waiting on you", { n: rest.length + 1 }) : t("One thing waiting on you")}</span>
        </header>
        {first ? (
          <div className={`vp-next-hero k-tone-${first.tone}`}>
            <span className="vp-next-icon">
              <first.icon size={22} />
            </span>
            <div className="vp-next-copy">
              <strong>{first.title}</strong>
              <span>{first.sub}</span>
            </div>
            {first.due ? (
              <span className="vp-next-due">
                <small>{t("Due")}</small>
                <b>{d(first.due, false)}</b>
                <em>{rel(first.due)}</em>
              </span>
            ) : null}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate(first.to)}>
              {first.action}
              <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <div className="vp-next-hero vp-next-clear k-tone-ok">
            <span className="vp-next-icon">
              <CheckCircle2 size={22} />
            </span>
            <div className="vp-next-copy">
              <strong>{t("You are all caught up")}</strong>
              <span>{t("New requests and orders from {buyer} will appear here.", { buyer: BUYER })}</span>
            </div>
          </div>
        )}
        {rest.length || waiting.length ? (
          <ul className="vp-queue">
            {[...rest, ...waiting].slice(0, 6).map((q, i) => (
              <li key={q.key} style={{ animationDelay: `${i * 45}ms` }}>
                <Link to={q.to}>
                  <span className={`vp-queue-icon k-tone-${q.tone}`}>
                    <q.icon size={15} />
                  </span>
                  <span className="vp-queue-text">
                    <strong className="truncate">{q.title}</strong>
                    <small className="truncate">{q.sub}</small>
                  </span>
                  {q.due ? <span className={`vp-queue-due${q.due < TODAY || diffDays(TODAY, q.due) <= 3 ? " soon" : ""}`}>{rel(q.due)}</span> : null}
                  <span className="vp-queue-go">
                    {q.action}
                    <ArrowRight size={13} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <StatTiles
        items={[
          { label: t("Requests to answer"), value: view.invites.filter((i) => i.bucket === "answer").length, sub: t("{n} invitations in total", { n: view.invites.length }), onClick: () => navigate(VP.rfqs) },
          { label: t("Quotes with the buyer"), value: view.quotes.filter((q) => ["buyer", "approval", "reading"].includes(quoteJourney(s, q).outcome.key)).length, sub: t("waiting for a decision"), onClick: () => navigate(VP.quotes) },
          { label: t("Open orders"), value: view.pos.filter((p) => p.status === "ISSUED" || p.status === "PART_RECEIVED").length, sub: t("{n} closed", { n: view.pos.filter((p) => p.status === "CLOSED").length }), onClick: () => navigate(VP.orders) },
          { label: t("Paid so far"), value: <><span className="num-inline">{fmtMoneyShort(funnel.stages[3]!.value)}</span> <small className="k-cur">AZN</small></>, sub: t("on the Qobu project"), tone: "ok", onClick: () => navigate(VP.payments) },
        ]}
      />

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("From quote to cash")} icon={<Wallet size={15} />} sub={t("What you have quoted to {buyer}, how much became orders, what arrived on site and what has been paid.", { buyer: BUYER })}>
            <div className="vp-funnel">
              <svg className="vp-funnel-links" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
                {funnel.stages.slice(0, -1).map((f, i) => {
                  const a = H(f.value);
                  const b = H(funnel.stages[i + 1]!.value);
                  const x1 = i * 100 + 72;
                  const x2 = (i + 1) * 100 + 28;
                  return <polygon key={f.key} points={`${x1},${50 - a / 2} ${x2},${50 - b / 2} ${x2},${50 + b / 2} ${x1},${50 + a / 2}`} className="vp-funnel-link" style={{ animationDelay: `${i * 90 + 200}ms` }} />;
                })}
              </svg>
              {funnel.stages.map((f, i) => (
                <div key={f.key} className={`vp-fstage s-${f.key}`}>
                  <span className="vp-fvalue num-inline">{fmtMoneyShort(f.value)}</span>
                  <span className="vp-fbar-box">
                    <i className="vp-fbar" style={{ height: `${H(f.value)}%`, animationDelay: `${i * 90}ms` }} />
                  </span>
                  <span className="vp-flabel">{t(f.label)}</span>
                  <small className="vp-fpct">{i === 0 ? t("{n} quotes", { n: view.quotes.length }) : t("{p}% of quoted", { p: funnel.stages[0]!.value ? Math.round((f.value / funnel.stages[0]!.value) * 100) : 0 })}</small>
                </div>
              ))}
            </div>
            {funnel.direct ? <p className="muted small vp-funnel-note">{t("Orders include {n} placed directly, without a quote.", { n: funnel.direct })}</p> : null}
          </Panel>

          <Panel title={t("Your latest quotes")} icon={<FileText size={15} />} pad={false} actions={<Link to={VP.quotes} className="k-link-btn">{t("All quotes")} <ArrowRight size={13} /></Link>}>
            {view.quotes.length ? (
              <Register rows={view.quotes.slice(0, 5)} columns={quoteCols} rowKey={(q) => q.id} onRowClick={(q) => navigate(q.rfqId ? VP.rfq(q.rfqId) : VP.quotes)} dense />
            ) : (
              <Empty title={t("No quotes yet")}>{t("Answer an RFQ and your quote shows here.")}</Empty>
            )}
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("How the buyer scores you")} icon={<Gauge size={15} />} sub={t("From your deliveries, inspections and prices on past orders.")}>
            <ScoreRings vendor={v} />
            {v.note ? (
              <div className="k-callout k-tone-warn vp-score-note">
                <ShieldAlert size={15} />
                <span>{x(v.note)}</span>
              </div>
            ) : null}
            <Link to={VP.profile} className="k-link-btn">
              {t("See your company profile")} <ArrowRight size={13} />
            </Link>
          </Panel>

          <Panel title={t("Recent activity")} icon={<Clock3 size={15} />} sub={t("Your actions and the buyer's, newest first.")}>
            {myFeed.length ? (
              <ol className="vp-feed">
                {myFeed.map((f) => {
                  const to = portalLink(f.link);
                  const mine = f.actor === v.name;
                  return (
                    <li key={f.id}>
                      <span className={`vp-feed-dot${mine ? " mine" : ""}`} aria-hidden="true" />
                      <div>
                        {to ? <Link to={to}>{x(f.text)}</Link> : <span>{x(f.text)}</span>}
                        <small>
                          {mine ? <Badge tone="ok" dot={false}>{t("You")}</Badge> : <span>{BUYER}</span>} · {stamp(f.at)}
                        </small>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="muted small">{t("Nothing yet.")}</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}


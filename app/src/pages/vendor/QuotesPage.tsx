import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, FileText, Inbox } from "lucide-react";
import { Badge, Columns, Empty, FilterChips, Money, PageHero, Panel, StatTiles, toneColor, useL } from "../../components/kit";
import { quoteTotal } from "../../ops/select";
import { fmtMoneyShort } from "../../lib/format";
import { BUYER, quoteJourney, useVendor, VP, type Outcome } from "./model";
import { QuoteJourney, useEyebrow } from "./parts";

type Group = "buyer" | "won" | "lost";
const groupOf = (o: Outcome["key"]): Group => (o === "lost" ? "lost" : o === "won" || o === "ordered" || o === "paid" ? "won" : "buyer");

const OUTCOME_KEY: { key: Outcome["key"]; label: string; tone: Outcome["tone"] }[] = [
  { key: "buyer", label: "With the buyer", tone: "info" },
  { key: "approval", label: "Approval pending", tone: "warn" },
  { key: "won", label: "Won", tone: "ok" },
  { key: "ordered", label: "Order issued", tone: "brand" },
  { key: "paid", label: "Order paid", tone: "ok" },
  { key: "lost", label: "Not selected", tone: "muted" },
];

/** Every quote the vendor sent, a column chart of their values and each quote's journey to an order. */
export function VpQuotes() {
  const { t, x, d } = useL();
  const eyebrow = useEyebrow();
  const { s, view } = useVendor();
  const [group, setGroup] = useState<Group | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const rows = useMemo(() => (view ? view.quotes.map((q) => ({ q, j: quoteJourney(s, q) })) : []), [s, view]);
  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;

  const total = rows.reduce((a, r) => a + quoteTotal(r.q), 0);
  const won = rows.filter((r) => groupOf(r.j.outcome.key) === "won");
  const decided = rows.filter((r) => groupOf(r.j.outcome.key) !== "buyer").length;
  const pending = rows.filter((r) => groupOf(r.j.outcome.key) === "buyer");
  const shown = rows.filter((r) => !group || groupOf(r.j.outcome.key) === group);
  const chart = [...rows].sort((a, b) => a.q.receivedAt.localeCompare(b.q.receivedAt));

  const jump = (id: string) => {
    setPicked(id);
    setGroup(null);
    requestAnimationFrame(() => document.getElementById(`vpq-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <div className="k-page vp-page">
      <PageHero eyebrow={eyebrow("My quotes")} title={t("My quotes")} subtitle={t("Every quote you have sent to {buyer} and where it stands now.", { buyer: BUYER })} flow={["Sent", "Read", "With the buyer", "Order"]} art="quotes" />

      <StatTiles
        items={[
          { label: t("Quotes sent"), value: rows.length, sub: t("{n} through this portal", { n: rows.filter((r) => r.q.source === "PORTAL").length }) },
          { label: t("Quoted in total"), value: <Money value={total} short />, sub: t("incl. VAT") },
          { label: t("Won"), value: won.length, sub: decided ? t("{p}% of decided quotes", { p: Math.round((won.length / decided) * 100) }) : t("none decided yet"), tone: won.length ? "ok" : "neutral", onClick: () => setGroup("won") },
          { label: t("With the buyer"), value: pending.length, sub: <Money value={pending.reduce((a, r) => a + quoteTotal(r.q), 0)} short />, tone: pending.length ? "info" : "neutral", onClick: () => setGroup("buyer") },
        ]}
      />

      <Panel title={t("Your quotes by value")} icon={<BarChart3 size={15} />} sub={t("Oldest on the left. Click a column to jump to the quote.")}>
        {chart.length ? (
          <>
            <div className="vp-cols-scroll">
              <div style={{ minWidth: Math.max(280, chart.length * 64) }}>
                <Columns
                  height={190}
                  format={(v) => fmtMoneyShort(v)}
                  items={chart.map((r) => ({ key: r.q.id, label: r.q.rfqId ?? r.q.id, value: quoteTotal(r.q), tone: r.j.outcome.tone, title: `${r.q.id} · ${t(r.j.outcome.label)}`, onClick: () => jump(r.q.id) }))}
                />
              </div>
            </div>
            <div className="vp-key">
              {OUTCOME_KEY.filter((o) => rows.some((r) => r.j.outcome.key === o.key)).map((o) => (
                <span key={o.key}>
                  <i style={{ background: toneColor(o.tone) }} />
                  {t(o.label)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">{t("No quotes yet.")}</p>
        )}
      </Panel>

      <div className="vp-filterbar">
        <FilterChips<Group>
          value={group}
          onChange={setGroup}
          options={[
            { value: "buyer", label: t("With the buyer"), count: pending.length },
            { value: "won", label: t("Won"), count: won.length },
            { value: "lost", label: t("Not selected"), count: rows.filter((r) => r.j.outcome.key === "lost").length },
          ]}
        />
      </div>

      {shown.length ? (
        <div className="vp-quotes">
          {shown.map(({ q, j }, i) => {
            const rfq = q.rfqId ? s.rfqs.find((r) => r.id === q.rfqId) : null;
            return (
              <article key={q.id} id={`vpq-${q.id}`} className={`vp-quote${picked === q.id ? " picked" : ""} o-${j.outcome.key}`} style={{ animationDelay: `${i * 40}ms` }}>
                <header className="vp-quote-head">
                  <span className="k-ref">{q.id}</span>
                  <span className="k-mono muted small">{q.ref}</span>
                  <Badge tone={j.outcome.tone}>{t(j.outcome.label)}</Badge>
                  <span className="vp-quote-total">
                    <Money value={quoteTotal(q)} />
                  </span>
                </header>
                <h3>{rfq ? x(rfq.title) : x(q.lines[0]?.description)}</h3>
                <p className="vp-quote-meta">
                  {rfq ? <>{rfq.ref} · </> : <>{t("Direct quote")} · </>}
                  {t("sent {date}", { date: d(q.receivedAt) })} · {t("{n} days delivery", { n: q.deliveryDays })} · {t("valid until {date}", { date: d(q.validUntil) })}
                </p>
                <div className="vp-quote-path">
                  <QuoteJourney s={s} q={q} />
                </div>
                <footer className="vp-quote-foot">
                  {j.po ? (
                    <Link to={VP.order(j.po.id)} className="k-link-btn">
                      {t("Open order {ref}", { ref: j.po.ref })} <ArrowRight size={13} />
                    </Link>
                  ) : null}
                  {rfq ? (
                    <Link to={VP.rfq(rfq.id)} className="k-link-btn">
                      {t("Open the request")} <ArrowRight size={13} />
                    </Link>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon={rows.length ? <FileText size={20} /> : <Inbox size={20} />} title={rows.length ? t("No quotes in this group") : t("No quotes yet")} action={!rows.length ? <Link to={VP.rfqs} className="btn btn-primary">{t("Open the RFQ inbox")}</Link> : undefined}>
          {rows.length ? t("Clear the filter to see every quote.") : t("Answer an RFQ and your quote shows here.")}
        </Empty>
      )}
    </div>
  );
}

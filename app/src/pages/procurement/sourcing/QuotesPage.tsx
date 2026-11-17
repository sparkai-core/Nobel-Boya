import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, FileUp, Scale } from "lucide-react";
import {
  Badge,
  FilterChips,
  FlowRail,
  Meter,
  PageHero,
  Register,
  SearchBox,
  StagePath,
  StatusBadge,
  Toolbar,
  useL,
  useSearch,
  type Column,
} from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { budgetOf, PATHS, quoteTotal, R, statusMeta } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { Quotation, Rfq, Risk } from "../../../ops/types";
import { gapWords, rfqOrder } from "./shared";

type Band = { key: string; rfq: Rfq | null; quotes: Quotation[]; budget: number };

/** Quotation intelligence: every quote as a price bar against its rivals, then the register. */
export function QuotesPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [stage, setStage] = useState<string | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [source, setSource] = useState<Quotation["source"] | null>(null);
  const [q, setQ] = useState("");
  const [showDecided, setShowDecided] = useState(false);

  const groups = useMemo(() => {
    const multi: Band[] = [];
    const single: Band[] = [];
    for (const r of rfqOrder(s.rfqs)) {
      const qs = s.quotes.filter((qq) => qq.rfqId === r.id);
      const live = qs.filter((qq) => !qq.duplicate);
      if (!qs.length) continue;
      const band = { key: r.id, rfq: r, quotes: qs, budget: budgetOf(s, r.lines) * 1.18 };
      (live.length >= 2 ? multi : single).push(band);
    }
    const loose: Band[] = s.quotes.filter((qq) => !qq.rfqId).map((qq) => ({ key: qq.id, rfq: null, quotes: [qq], budget: 0 }));
    return { multi, single, loose };
  }, [s]);

  const decided = (b: Band) => b.rfq?.status === "AWARDED" || b.rfq?.status === "CANCELLED";
  const multiShown = showDecided ? groups.multi : groups.multi.filter((b) => !decided(b));
  const hidden = groups.multi.length - multiShown.length;

  const counts = useMemo(() => s.quotes.reduce<Record<string, number>>((a, qq) => ((a[qq.status] = (a[qq.status] ?? 0) + 1), a), {}), [s.quotes]);
  const filtered = useMemo(() => s.quotes.filter((qq) => (!stage || qq.status === stage) && (!risk || qq.risk === risk) && (!source || qq.source === source)), [s.quotes, stage, risk, source]);
  const vname = (id: string) => s.vendors.find((v) => v.id === id)?.name ?? id;
  const rows = useSearch(filtered, q, (qq) => [qq.id, qq.ref, qq.rfqId, vname(qq.vendorId), ...qq.lines.map((l) => l.description)]);

  const columns: Column<Quotation>[] = [
    {
      key: "quote",
      header: t("Quote"),
      sort: (qq) => qq.id,
      render: (qq) => (
        <div className="k-cell-title">
          <span className="k-row" style={{ gap: 6 }}>
            <span className="k-ref">{qq.ref}</span>
            {qq.duplicate ? <Badge tone="bad">{t("Duplicate")}</Badge> : null}
            {qq.source === "MANUAL" ? <Badge tone="neutral" dot={false}>{t("Typed")}</Badge> : qq.source === "PORTAL" ? <Badge tone="info" dot={false}>{t("Portal")}</Badge> : null}
          </span>
          <strong>{vname(qq.vendorId)}</strong>
          <small>
            {qq.id} · {d(qq.receivedAt)}
          </small>
        </div>
      ),
    },
    {
      key: "rfq",
      header: t("RFQ"),
      sort: (qq) => qq.rfqId ?? "",
      hideBelow: 900,
      render: (qq) =>
        qq.rfqId ? (
          <Link to={R.rfq(qq.rfqId)} className="ps-mono-link" onClick={(e) => e.stopPropagation()}>
            {qq.rfqId}
          </Link>
        ) : (
          <span className="muted">{t("No RFQ")}</span>
        ),
    },
    { key: "total", header: t("Total"), align: "right", sort: (qq) => quoteTotal(qq), render: (qq) => <span className="num-inline ps-strong">{fmtMoneyShort(quoteTotal(qq))}</span> },
    {
      key: "conf",
      header: t("Reading confidence"),
      sort: (qq) => qq.confidence,
      hideBelow: 1100,
      render: (qq) => (
        <span className="ps-conf">
          <Meter value={qq.confidence} tone={qq.confidence < 0.75 ? "bad" : qq.confidence < 0.88 ? "warn" : "ok"} label={t("Reading confidence")} />
          <b className="num-inline">{Math.round(qq.confidence * 100)}%</b>
        </span>
      ),
    },
    {
      key: "check",
      header: t("To check"),
      align: "center",
      sort: (qq) => qq.checks.filter((c) => c.result !== "PASSED").length,
      render: (qq) => {
        const failed = qq.checks.filter((c) => c.result === "FAILED").length;
        const warn = qq.checks.filter((c) => c.result === "WARNING").length;
        return failed + warn ? <Badge tone={failed ? "bad" : "warn"}>{failed + warn}</Badge> : <span className="k-text-ok small">✓</span>;
      },
    },
    {
      key: "valid",
      header: t("Validity"),
      sort: (qq) => qq.validUntil,
      hideBelow: 900,
      render: (qq) => {
        const n = diffDays(TODAY, qq.validUntil);
        return (
          <span className="ps-need">
            <b className="num-inline">{d(qq.validUntil)}</b>
            {qq.outcome ? <small className="muted">{t(qq.outcome === "WON" ? "Won" : "Lost")}</small> : n < 0 ? <small className="k-text-bad">{t("expired")}</small> : n <= 7 ? <small className="k-text-warn">{t("expires in {n} days", { n })}</small> : <small className="muted">{t("{n} days left", { n })}</small>}
          </span>
        );
      },
    },
    { key: "stage", header: t("Stage"), sort: (qq) => qq.status, render: (qq) => <StatusBadge kind="quote" status={qq.status} /> },
  ];

  return (
    <div className="k-page ps-page">
      <PageHero
        eyebrow={t("Procurement · Quotations")}
        title={t("Quotation intelligence")}
        subtitle={t("Every vendor quote read, checked against the BOQ and the vendor register, and laid next to its rivals.")}
        flow={["Quote arrives", "Read and checked", "Compared", "Approved"]}
        art="quotes"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate(R.uploadQuote())}>
            <FileUp size={15} />
            {t("Ingest quotations")}
          </button>
        }
      />

      <FlowRail current="quotes" />

      <section className="ps-priceboard" aria-label={t("Price board")}>
        <header className="ps-pb-head">
          <h2>{t("Price board")}</h2>
          <p>{t("Each bar is a quote's total, VAT included. The violet bar is the lowest; the dashed line is the BOQ budget.")}</p>
        </header>

        <BandGroup title={t("Ready to compare")} count={groups.multi.length}>
          {multiShown.map((b, i) => (
            <PriceBand key={b.key} band={b} index={i} compare />
          ))}
          {hidden > 0 ? (
            <button type="button" className="k-link-btn ps-more" onClick={() => setShowDecided(true)}>
              <ChevronDown size={14} />
              {t("Show {n} decided RFQs", { n: hidden })}
            </button>
          ) : null}
        </BandGroup>
        <BandGroup title={t("Waiting for a second quote")} count={groups.single.length}>
          {groups.single.map((b, i) => (
            <PriceBand key={b.key} band={b} index={i} />
          ))}
        </BandGroup>
        <BandGroup title={t("Quotes without an RFQ")} count={groups.loose.length}>
          {groups.loose.map((b, i) => (
            <PriceBand key={b.key} band={b} index={i} />
          ))}
        </BandGroup>
      </section>

      <StagePath kind="quote" path={PATHS.quote} counts={counts} value={stage} onChange={setStage} extras={["MANUAL"]} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(qq) => qq.id}
        onRowClick={(qq) => navigate(R.quote(qq.id))}
        rowClass={(qq) => (qq.duplicate ? "ps-row-dim" : undefined)}
        initialSort={{ key: "quote", dir: "desc" }}
        toolbar={
          <Toolbar
            end={
              <FilterChips
                value={source}
                onChange={setSource}
                options={(["PORTAL", "UPLOAD", "MANUAL"] as const).map((src) => ({ value: src, label: t(src === "PORTAL" ? "Portal" : src === "UPLOAD" ? "Upload" : "Typed"), count: s.quotes.filter((qq) => qq.source === src).length }))}
              />
            }
          >
            <SearchBox value={q} onChange={setQ} placeholder="Search quotes, vendors, lines" />
            <FilterChips value={risk} onChange={setRisk} options={(["LOW", "MEDIUM", "HIGH"] as Risk[]).map((rk) => ({ value: rk, label: x(statusMeta("risk", rk).label), count: s.quotes.filter((qq) => qq.risk === rk).length }))} />
          </Toolbar>
        }
        empty={
          <>
            {t("No quotes match.")}{" "}
            <button type="button" className="k-link-btn" onClick={() => { setStage(null); setRisk(null); setSource(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </>
        }
      />
    </div>
  );
}

function BandGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const { t } = useL();
  return (
    <div className="ps-pb-group">
      <h3>
        {title} <b className="num-inline">{count}</b>
      </h3>
      {count ? <div className="ps-pb-bands">{children}</div> : <p className="ps-col-empty">{t("Nothing here.")}</p>}
    </div>
  );
}

function PriceBand({ band, index, compare }: { band: Band; index: number; compare?: boolean }) {
  const { t, x } = useL();
  const navigate = useNavigate();
  const vendors = useOps((s) => s.vendors);
  const live = band.quotes.filter((q) => !q.duplicate);
  const totals = band.quotes.map(quoteTotal);
  const lowest = live.length ? Math.min(...live.map(quoteTotal)) : 0;
  const max = Math.max(1, ...totals, band.budget);
  const sorted = [...band.quotes].sort((a, b) => quoteTotal(a) - quoteTotal(b));
  const r = band.rfq;
  return (
    <article className="ps-band" style={{ animationDelay: `${index * 50}ms` }}>
      <header className="ps-band-head">
        {r ? (
          <Link to={R.rfq(r.id)} className="ps-band-title">
            <span className="k-ref">{r.ref}</span>
            <strong className="truncate">{x(r.title)}</strong>
          </Link>
        ) : (
          <Link to={R.quote(band.quotes[0]!.id)} className="ps-band-title">
            <span className="k-ref">{band.quotes[0]!.id}</span>
            <strong className="truncate">{x(band.quotes[0]!.lines[0]?.description) || t("Direct quote")}</strong>
          </Link>
        )}
        {r ? <StatusBadge kind="rfq" status={r.status} /> : null}
        {compare && r ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.compare(r.id))}>
            <Scale size={13} />
            {t("Compare")}
          </button>
        ) : null}
      </header>
      <ul className="ps-bars">
        {sorted.map((q) => {
          const total = quoteTotal(q);
          const isLow = !q.duplicate && total <= lowest + 0.005;
          const v = vendors.find((vv) => vv.id === q.vendorId);
          return (
            <li key={q.id}>
              <Link to={R.quote(q.id)} className={`ps-bar${isLow ? " low" : ""}${q.duplicate ? " dup" : ""}`}>
                <span className="ps-bar-name truncate">{v?.name ?? q.vendorId}</span>
                <span className="ps-bar-track">
                  <i className="k-grow-x" style={{ width: `${(total / max) * 100}%` }} />
                  {band.budget > 0 ? <b className="ps-bar-budget" style={{ left: `${(band.budget / max) * 100}%` }} title={t("BOQ budget")} /> : null}
                </span>
                <span className="ps-bar-fig">
                  <b className="num-inline">{fmtMoneyShort(total)}</b>
                  <small>{q.duplicate ? t("Duplicate") : live.length > 1 ? gapWords(t, total, lowest) : band.budget > 0 ? (total <= band.budget ? t("{p}% under the BOQ", { p: Math.round((1 - total / band.budget) * 100) }) : t("{p}% over the BOQ", { p: Math.round((total / band.budget - 1) * 100) })) : t("{n} days delivery", { n: q.deliveryDays })}</small>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

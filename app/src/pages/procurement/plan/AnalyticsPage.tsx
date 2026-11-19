import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, CalendarRange, Clock3, Download, Filter, Gauge, LayoutGrid, PiggyBank, ShoppingCart, Timer, Truck, Wallet } from "lucide-react";
import { Badge, Field, FilterChips, Money, PageHero, Panel, Register, StackedColumns, StatTiles, StatusBadge, toast, useL, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, minDate, PROJECT_START, TODAY } from "../../../ops/dates";
import { pkgOverrides, usePkgPlan } from "../../../ops/ext/proc-client";
import { budgetOf, poNet, poTotal, R, TRADES, tradeName } from "../../../ops/select";
import type { OpsData, PurchaseOrder, Trade } from "../../../ops/types";
import { fmtMoney, fmtMoneyShort } from "../../../lib/format";
import { buildPackages, downloadText, expectedOf, isDated, monthLabel, monthOf, monthsFrom, vendorOnTime } from "./shared";
import { Bullets, Funnel, Scatter, Treemap, type FunnelStage, type ScatterPt } from "./AnalyticsCharts";


const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round(((s[m - 1]! + s[m]!) / 2) * 10) / 10;
};

/** Trade of an order: its first catalogued material, else the vendor's trade. */
function poTrade(s: OpsData, po: PurchaseOrder): Trade | null {
  const mat = po.lines.find((l) => l.material)?.material;
  return (mat && s.materials.find((m) => m.key === mat)?.trade) || s.vendors.find((v) => v.id === po.vendorId)?.trade || null;
}

type SpendRow = { po: PurchaseOrder; vendor: string; trade: Trade | null; committed: number; boq: number; saving: number; paid: number };

/** Spend analytics: where the money goes, against the BOQ, how fast the chain moves and which vendors deliver value. */
export function AnalyticsPage() {
  const { t, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const plan = usePkgPlan((p) => p.plan);
  // The range starts at the project start or the first order, whichever is earlier.
  const FROM = minDate(PROJECT_START, ...s.pos.map((p) => p.issuedAt), TODAY);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [from, setFrom] = useState(FROM);
  const [to, setTo] = useState(TODAY);

  const rows = useMemo<SpendRow[]>(
    () =>
      s.pos
        .filter((p) => p.status !== "CANCELLED" && p.issuedAt >= from && p.issuedAt <= to)
        .map((po) => {
          const committed = poTotal(po);
          const boq = budgetOf(s, po.lines) * (1 + po.vatRate);
          return { po, vendor: s.vendors.find((v) => v.id === po.vendorId)?.name ?? po.vendorId, trade: poTrade(s, po), committed, boq, saving: boq - committed, paid: s.payments.filter((p) => p.poId === po.id && p.status === "PAID").reduce((a, p) => a + p.amount, 0) };
        })
        .filter((r) => !trade || r.trade === trade),
    [s, trade, from, to],
  );

  // On-time: posted receipts of these orders by the PO date, plus balances already past due.
  const onTime = useMemo(() => {
    let on = 0;
    let total = 0;
    for (const r of rows) {
      for (const g of s.grns.filter((x2) => x2.poId === r.po.id && x2.status !== "DRAFT" && x2.receivedAt)) {
        total += 1;
        if (g.receivedAt! <= r.po.expectedAt) on += 1;
      }
      if ((r.po.status === "ISSUED" || r.po.status === "PART_RECEIVED") && expectedOf(s, r.po) < TODAY) total += 1;
    }
    return { on, total, share: total ? on / total : null };
  }, [rows, s]);

  const kpi = useMemo(() => {
    const committed = rows.reduce((a, r) => a + r.committed, 0);
    const paid = rows.reduce((a, r) => a + r.paid, 0);
    const boq = rows.reduce((a, r) => a + r.boq, 0);
    const cycles = rows
      .map((r) => {
        const mr = r.po.mrId ? s.mrs.find((m) => m.id === r.po.mrId) : undefined;
        return mr ? Math.max(0, diffDays(mr.createdAt, r.po.issuedAt)) : null;
      })
      .filter((v): v is number => v != null);
    return { committed, paid, boq, saving: boq - committed, cycle: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null, cycleN: cycles.length };
  }, [rows, s.mrs]);

  const byVendor = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.po.vendorId, (m.get(r.po.vendorId) ?? 0) + r.committed);
    return [...m.entries()].map(([id, v]) => {
      const vendor = s.vendors.find((x2) => x2.id === id);
      return { key: id, label: vendor?.name ?? id, sub: vendor ? tradeName(vendor.trade, lang) : "", value: v };
    });
  }, [rows, s.vendors, lang]);

  const byTrade = useMemo(() => {
    const out = new Map<string, { budget: number; committed: number; boqOfCommitted: number }>();
    for (const m of s.materials) {
      if (trade && m.trade !== trade) continue;
      const r = out.get(m.trade) ?? { budget: 0, committed: 0, boqOfCommitted: 0 };
      r.budget += m.rate * m.budgetQty;
      out.set(m.trade, r);
    }
    for (const r of rows) {
      if (!r.trade) continue;
      const row = out.get(r.trade) ?? { budget: 0, committed: 0, boqOfCommitted: 0 };
      row.committed += poNet(r.po);
      row.boqOfCommitted += budgetOf(s, r.po.lines);
      out.set(r.trade, row);
    }
    return [...out.entries()]
      .filter(([, v]) => v.budget > 0 || v.committed > 0)
      .sort((a, b) => b[1].committed - a[1].committed || b[1].budget - a[1].budget)
      .map(([k, v]) => ({ key: k, label: tradeName(k, lang), ...v }));
  }, [rows, s, trade, lang]);

  const months = useMemo(() => {
    const pkgs = buildPackages(s, pkgOverrides(plan)).filter(isDated).filter((p) => p.status !== "ORDERED" && p.status !== "DELIVERED" && (!trade || p.trade === trade));
    const lastPlan = pkgs.reduce((m, p) => (p.latestPo > m ? p.latestPo : m), TODAY);
    const list = monthsFrom(from, lastPlan > to ? lastPlan : to);
    return list.map((mm) => {
      const inMonth = rows.filter((r) => monthOf(r.po.issuedAt) === mm);
      const committed = inMonth.reduce((a, r) => a + r.committed, 0);
      const paid = inMonth.reduce((a, r) => a + Math.min(r.paid, r.committed), 0);
      const planned = pkgs.filter((p) => monthOf(p.latestPo < TODAY ? TODAY : p.latestPo) === mm).reduce((a, p) => a + p.value * 1.18, 0);
      return { key: mm, label: monthLabel(mm, lang, mm.endsWith("-01") || mm === list[0]), values: [paid, committed - paid, planned] };
    });
  }, [rows, s, plan, trade, from, to, lang]);

  const funnel = useMemo<FunnelStage[]>(() => {
    const mrs = s.mrs.filter((m) => m.status !== "CANCELLED" && m.createdAt >= from && m.createdAt <= to && (!trade || m.trade === trade));
    const reach = { mr: mrs.length, rfq: 0, quote: 0, appr: 0, po: 0, grn: 0, paid: 0 };
    const days: Record<string, number[]> = { rfq: [], quote: [], appr: [], po: [], grn: [], paid: [] };
    for (const m of mrs) {
      const rfq = s.rfqs.filter((r) => r.mrId === m.id && r.status !== "CANCELLED").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      let last = m.createdAt;
      if (rfq) {
        reach.rfq += 1;
        days.rfq!.push(Math.max(0, diffDays(last, rfq.createdAt)));
        last = rfq.createdAt;
        const q = s.quotes.filter((x2) => x2.rfqId === rfq.id && !x2.duplicate).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
        if (q) {
          reach.quote += 1;
          days.quote!.push(Math.max(0, diffDays(last, q.receivedAt)));
          last = q.receivedAt;
          const ap = s.approvals.find((a) => a.rfqId === rfq.id && a.status === "APPROVED" && a.finalAt);
          if (ap) {
            reach.appr += 1;
            days.appr!.push(Math.max(0, diffDays(last, ap.finalAt!)));
            last = ap.finalAt!;
          }
        }
      }
      const po = s.pos.filter((p) => p.mrId === m.id && p.status !== "CANCELLED").sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))[0];
      if (po) {
        reach.po += 1;
        days.po!.push(Math.max(0, diffDays(last, po.issuedAt)));
        const g = s.grns.filter((x2) => x2.poId === po.id && x2.status !== "DRAFT" && x2.receivedAt).sort((a, b) => a.receivedAt!.localeCompare(b.receivedAt!));
        if (g.length) {
          reach.grn += 1;
          days.grn!.push(Math.max(0, diffDays(po.issuedAt, g[0]!.receivedAt!)));
          const pay = s.payments.find((p) => p.poId === po.id && p.kind === "ON_DELIVERY" && p.status === "PAID" && p.paidAt);
          if (pay) {
            reach.paid += 1;
            days.paid!.push(Math.max(0, diffDays(g[g.length - 1]!.receivedAt!, pay.paidAt!)));
          }
        }
      }
    }
    return [
      { key: "mr", label: t("Request"), count: reach.mr, days: null },
      { key: "rfq", label: t("RFQ"), count: reach.rfq, days: median(days.rfq!) },
      { key: "quote", label: t("Quote"), count: reach.quote, days: median(days.quote!) },
      { key: "appr", label: t("Approval"), count: reach.appr, days: median(days.appr!) },
      { key: "po", label: t("PO"), count: reach.po, days: median(days.po!) },
      { key: "grn", label: t("Goods receipt"), count: reach.grn, days: median(days.grn!) },
      { key: "paid", label: t("Paid"), count: reach.paid, days: median(days.paid!) },
    ];
  }, [s, trade, from, to, t]);
  const endToEnd = funnel.slice(1).reduce((a, st) => a + (st.days ?? 0), 0);

  const scatter = useMemo<ScatterPt[]>(() => {
    const rate = (k: string | null) => (k ? (s.materials.find((m) => m.key === k)?.rate ?? 0) : 0);
    const acc = new Map<string, { paid: number; boq: number }>();
    const add = (vendorId: string, paidV: number, boqV: number) => {
      if (boqV <= 0) return;
      const a = acc.get(vendorId) ?? { paid: 0, boq: 0 };
      a.paid += paidV;
      a.boq += boqV;
      acc.set(vendorId, a);
    };
    for (const q of s.quotes) {
      if (q.duplicate || !q.rfqId) continue;
      const rfq = s.rfqs.find((r) => r.id === q.rfqId);
      if (!rfq) continue;
      q.lines.forEach((l, i) => add(q.vendorId, l.qty * l.unitPrice, l.qty * rate(rfq.lines[i]?.material ?? null)));
    }
    for (const p of s.pos) if (p.status !== "CANCELLED" && !p.quoteId) p.lines.forEach((l) => add(p.vendorId, l.qty * l.rate, l.qty * rate(l.material)));
    const ot = vendorOnTime(s);
    return [...acc.entries()]
      .map(([id, a]) => {
        const v = s.vendors.find((x2) => x2.id === id);
        const spend = rows.filter((r) => r.po.vendorId === id).reduce((b, r) => b + r.committed, 0);
        // Reliability: the share delivered on time when there are deliveries, else the buyer's own score.
        const rec = ot.get(id);
        const reliability = rec && rec.total ? Math.round((rec.onTime / rec.total) * 100) : v && v.overall > 0 ? v.scores.delivery : null;
        return v && a.boq > 0 && reliability != null ? { key: id, label: v.name, price: a.paid / a.boq - 1, reliability, spend, trade: v.trade, trades: v.trades } : null;
      })
      .filter((p): p is ScatterPt & { trade: Trade; trades: Trade[] } => !!p && (!trade || p.trades.includes(trade)));
  }, [s, rows, trade]);

  const exportCsv = () => {
    const head = ["PO", "Vendor", "Trade", "Issued", "Status", "Committed AZN", "BOQ value AZN", "Saving AZN", "Paid AZN"];
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = rows.map((r) => [r.po.ref, q(r.vendor), q(r.trade ? tradeName(r.trade, lang) : ""), r.po.issuedAt, r.po.status, r.committed.toFixed(2), r.boq.toFixed(2), r.saving.toFixed(2), r.paid.toFixed(2)].join(","));
    downloadText(`spend-${from}-to-${to}.csv`, [head.join(","), ...body].join("\n"));
    toast(t("Exported {n} orders to CSV.", { n: rows.length }), "ok");
  };

  const columns: Column<SpendRow>[] = [
    { key: "po", header: t("Order"), sort: (r) => r.po.ref, render: (r) => <span className="k-ref">{r.po.ref}</span> },
    { key: "vendor", header: t("Vendor"), sort: (r) => r.vendor, render: (r) => <span className="truncate">{r.vendor}</span> },
    { key: "trade", header: t("Trade"), hideBelow: 1100, sort: (r) => r.trade ?? "", render: (r) => <span className="muted">{r.trade ? tradeName(r.trade, lang) : "—"}</span> },
    { key: "issued", header: t("Issued"), hideBelow: 900, sort: (r) => r.po.issuedAt, render: (r) => <span className="num-inline">{d(r.po.issuedAt)}</span> },
    { key: "committed", header: t("Committed"), align: "right", sort: (r) => r.committed, render: (r) => <Money value={r.committed} /> },
    { key: "saving", header: t("vs BOQ"), align: "right", sort: (r) => r.saving, render: (r) => (Math.abs(r.saving) < 0.5 ? <span className="num-inline muted">0</span> : <span className={`num-inline ${r.saving > 0 ? "k-text-ok" : "k-text-bad"}`}>{r.saving > 0 ? "−" : "+"}{fmtMoneyShort(Math.abs(r.saving))}</span>) },
    { key: "paid", header: t("Paid"), align: "right", hideBelow: 900, sort: (r) => r.paid, render: (r) => <Money value={r.paid} short /> },
    { key: "status", header: t("Status"), sort: (r) => r.po.status, render: (r) => <StatusBadge kind="po" status={r.po.status} /> },
  ];

  const tradeOpts = TRADES.map((tr) => ({ value: tr as Trade, label: tradeName(tr, lang), count: s.pos.filter((p) => p.status !== "CANCELLED" && poTrade(s, p) === tr).length })).filter((o) => o.count > 0);
  const savingPct = kpi.boq ? kpi.saving / kpi.boq : 0;

  return (
    <div className="k-page ppl-page">
      <PageHero
        eyebrow={t("Procurement · Plan")}
        title={t("Spend analytics")}
        subtitle={t("Where the money goes, how it compares with the BOQ, how fast requests turn into paid orders, and which vendors give value.")}
        flow={["Committed", "Against BOQ", "Cycle time", "Vendor value"]}
        art="budget"
        actions={
          <button type="button" className="btn btn-ghost" onClick={exportCsv}>
            <Download size={15} />
            {t("Export CSV")}
          </button>
        }
      />

      <section className="ppl-filters" aria-label={t("Filters")}>
        <span className="ppl-filters-label">
          <Filter size={14} />
          {t("Trade")}
        </span>
        <FilterChips<Trade> value={trade} onChange={setTrade} options={tradeOpts} />
        <div className="ppl-range">
          <CalendarRange size={14} />
          <Field label={t("From date")}>
            <input className="input" type="date" min={FROM} max={to} value={from} onChange={(e) => setFrom(e.target.value || FROM)} />
          </Field>
          <Field label={t("To date")}>
            <input className="input" type="date" min={from} max={TODAY} value={to} onChange={(e) => setTo(e.target.value || TODAY)} />
          </Field>
          {from !== FROM || to !== TODAY || trade ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFrom(FROM);
                setTo(TODAY);
                setTrade(null);
              }}
            >
              {t("Clear filters")}
            </button>
          ) : null}
        </div>
      </section>

      <StatTiles
        items={[
          { label: t("Committed"), value: <Money value={kpi.committed} short />, sub: t("incl. VAT, {n} orders", { n: rows.length }), tone: "brand", icon: <ShoppingCart size={14} /> },
          { label: t("Paid"), value: <Money value={kpi.paid} short />, sub: kpi.committed > 0 ? t("{p} of committed", { p: `${Math.round((kpi.paid / kpi.committed) * 100)}%` }) : t("nothing ordered yet"), tone: "ok", icon: <Wallet size={14} /> },
          kpi.boq > 0
            ? { label: t("Savings vs BOQ"), value: <Money value={kpi.saving} short />, sub: kpi.saving >= 0 ? t("{p}% under the BOQ rates", { p: (savingPct * 100).toFixed(1) }) : t("{p}% over the BOQ rates", { p: (-savingPct * 100).toFixed(1) }), tone: kpi.saving >= 0 ? "ok" : "bad", icon: <PiggyBank size={14} /> }
            : { label: t("Savings vs BOQ"), value: "—", sub: t("no orders on BOQ materials yet"), icon: <PiggyBank size={14} /> },
          { label: t("Average cycle MR→PO"), value: kpi.cycle != null ? t("{n} days", { n: kpi.cycle.toFixed(1) }) : "—", sub: t("over {n} orders with a request", { n: kpi.cycleN }), tone: "neutral", icon: <Timer size={14} /> },
          onTime.share == null
            ? { label: t("On-time delivery"), value: "—", sub: t("no deliveries yet"), icon: <Truck size={14} /> }
            : { label: t("On-time delivery"), value: `${Math.round(onTime.share * 100)}%`, sub: t("{a} of {b} deliveries", { a: onTime.on, b: onTime.total }), tone: onTime.share >= 0.85 ? "ok" : onTime.share >= 0.6 ? "warn" : "bad", icon: <Truck size={14} /> },
        ]}
      />

      <div className="k-grid-2">
        <Panel title={t("Spend by vendor")} icon={<LayoutGrid size={16} />} count={byVendor.length} sub={t("Area is the value ordered. Click a vendor to open its record.")}>
          {byVendor.length ? <Treemap items={byVendor} onPick={(id) => navigate(R.vendor(id))} /> : <p className="ppl-empty">{t("No orders in this range.")}</p>}
        </Panel>
        <Panel title={t("Spend by trade vs BOQ budget")} icon={<Gauge size={16} />} sub={t("Bar: committed (net). Track: the trade's BOQ budget. Tick: what the same quantities cost at BOQ rates.")}>
          {byTrade.length ? <Bullets rows={byTrade} /> : <p className="ppl-empty">{t("No budget for this trade.")}</p>}
        </Panel>
      </div>

      <div className="k-grid-2">
        <Panel title={t("Spend by month")} icon={<BarChart3 size={16} />} sub={t("Orders by the month they were placed, split into paid and still to pay. Hatched: buying the procurement schedule still has to place.")}>
          <StackedColumns
            items={months}
            series={[
              { label: t("Paid"), tone: "ok" },
              { label: t("Committed, not yet paid"), tone: "brand" },
              { label: t("Planned from the schedule"), tone: "info", hatch: true },
            ]}
            marker={monthOf(TODAY)}
            markerLabel={t("Today")}
            format={(v) => `${fmtMoneyShort(v)} AZN`}
            height={210}
          />
        </Panel>
        <Panel title={t("Cycle time, request to paid")} icon={<Clock3 size={16} />} sub={t("How many requests reached each stage, and the median days each hand-off took. End to end: {n} days.", { n: Math.round(endToEnd) })}>
          <Funnel stages={funnel} />
        </Panel>
      </div>

      <Panel
        title={t("Vendor performance")}
        icon={<Gauge size={16} />}
        sub={t("Price against the BOQ rate (left is cheaper) and delivery reliability: share delivered on time, else your score (up is better). Bubble size is the value ordered in range.")}
        actions={<Badge tone="brand">{t("{n} vendors", { n: scatter.length })}</Badge>}
      >
        {scatter.length ? <Scatter points={scatter} onPick={(id) => navigate(R.vendor(id))} /> : <p className="ppl-empty">{t("No priced quotes or orders for this trade.")}</p>}
      </Panel>

      <Register
        rows={rows}
        columns={columns}
        rowKey={(r) => r.po.id}
        onRowClick={(r) => navigate(R.order(r.po.id))}
        initialSort={{ key: "committed", dir: "desc" }}
        toolbar={
          <div className="k-toolbar">
            <div className="k-toolbar-main">
              <strong className="ppl-table-title">{t("Spend by order")}</strong>
              <span className="muted small num-inline">
                {fmtMoney(kpi.committed)} AZN · {d(from)} – {d(to)}
              </span>
            </div>
            <div className="k-toolbar-end">
              <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv} disabled={!rows.length}>
                <Download size={14} />
                {t("Export CSV")}
              </button>
            </div>
          </div>
        }
        empty={t("No orders in this range.")}
      />
    </div>
  );
}

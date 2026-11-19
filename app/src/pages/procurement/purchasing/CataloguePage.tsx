import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileSignature, LibraryBig } from "lucide-react";
import { Avatar, FilterChips, PageHero, Register, SearchBox, StatTiles, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import { tradeName, TRADES } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import type { Material, Trade } from "../../../ops/types";
import { agreementFor, funnelOf, PR, pricesPaid, suppliersOf, type Funnel } from "./shared";
import { MiniFunnel, VarChip } from "./parts";

type Row = { m: Material; f: Funnel; last: number | null; vendors: string[]; agr: string | null; value: number };

/** Materials catalogue: every BOQ material with its buying funnel, last price against the BOQ rate, and who supplies it. */
export function CataloguePage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [only, setOnly] = useState<"live" | null>(null);
  const [q, setQ] = useState("");

  const all = useMemo<Row[]>(
    () =>
      s.materials.map((m) => {
        const paid = pricesPaid(s, m.key);
        return {
          m,
          f: funnelOf(s, m.key),
          last: paid.length ? paid[paid.length - 1]!.rate : null,
          vendors: suppliersOf(s, m).slice(0, 4).map((v) => v.name),
          agr: agreementFor(s, m.key)?.ref ?? null,
          value: m.budgetQty * m.rate,
        };
      }),
    [s],
  );

  const byTrade = useMemo(() => {
    const map = new Map<string, { budget: number; ordered: number; received: number; n: number }>();
    for (const r of all) {
      const e = map.get(r.m.trade) ?? { budget: 0, ordered: 0, received: 0, n: 0 };
      e.budget += r.value;
      e.n += 1;
      map.set(r.m.trade, e);
    }
    for (const p of s.pos.filter((p) => p.status !== "CANCELLED")) {
      for (const l of p.lines) {
        const m = s.materials.find((y) => y.key === l.material);
        if (!m) continue;
        const e = map.get(m.trade) ?? { budget: 0, ordered: 0, received: 0, n: 0 };
        e.ordered += l.qty * l.rate;
        e.received += l.received * l.rate;
        map.set(m.trade, e);
      }
    }
    return TRADES.map((tr) => ({ trade: tr as Trade, ...(map.get(tr) ?? { budget: 0, ordered: 0, received: 0, n: 0 }) })).filter((e) => e.n > 0);
  }, [all, s.pos, s.materials]);
  const topBudget = Math.max(1, ...byTrade.map((e) => Math.max(e.budget, e.ordered)));

  const filtered = useMemo(
    () => all.filter((r) => (trade ? r.m.trade === trade : r.m.trade !== "Building services")).filter((r) => !only || r.f.requested > 0 || r.f.ordered > 0),
    [all, trade, only],
  );
  const rows = useSearch(filtered, q, (r) => [r.m.key, r.m.name, r.m.trade, tradeName(r.m.trade, "az"), ...r.vendors]);

  const live = all.filter((r) => r.f.ordered > 0);
  const budget = all.reduce((a, r) => a + r.value, 0);
  const orderedValue = byTrade.reduce((a, e) => a + e.ordered, 0);
  const covered = all.filter((r) => r.agr).length;
  const over = live.filter((r) => r.last != null && r.last > r.m.rate * 1.005).length;

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t("Material"),
      sort: (r) => x(r.m.name),
      render: (r) => (
        <span className="k-cell-title">
          <strong>
            <Link to={PR.material(r.m.key)} onClick={(e) => e.stopPropagation()}>
              {x(r.m.name)}
            </Link>
          </strong>
          <small>
            <span className="k-mono">{r.m.key}</span>
            {r.agr ? (
              <span className="pur-agr-mini" title={t("Covered by framework agreement {ref}", { ref: r.agr })}>
                <FileSignature size={10} /> {r.agr}
              </span>
            ) : null}
          </small>
        </span>
      ),
    },
    { key: "trade", header: t("Trade"), hideBelow: 1100, sort: (r) => tradeName(r.m.trade, lang), render: (r) => <span className="muted">{tradeName(r.m.trade, lang)}</span> },
    {
      key: "boq",
      header: t("BOQ qty"),
      align: "right",
      sort: (r) => r.value,
      render: (r) => (
        <span className="pur-qtycell">
          <b className="num-inline">{r.m.budgetQty > 0 ? fmtQty(r.m.budgetQty, r.m.unit) : "—"}</b>
          <small>{unitLabel(r.m.unit, lang)}</small>
        </span>
      ),
    },
    {
      key: "funnel",
      header: t("Requested / Ordered / Received / Issued"),
      sort: (r) => (r.f.boq ? r.f.ordered / r.f.boq : r.f.ordered ? 1 : 0),
      render: (r) => (
        <span className="pur-funnelcell">
          <MiniFunnel f={r.f} />
          <small className="num-inline">{r.f.ordered > 0 || r.f.requested > 0 ? (r.f.boq ? t("{p}% ordered", { p: Math.round((r.f.ordered / r.f.boq) * 100) }) : t("{q} ordered", { q: fmtQty(r.f.ordered, r.m.unit) })) : t("not started")}</small>
        </span>
      ),
    },
    {
      key: "price",
      header: t("Last price vs BOQ"),
      align: "right",
      hideBelow: 700,
      sort: (r) => (r.last != null ? r.last / (r.m.rate || 1) : 0),
      render: (r) =>
        r.last != null ? (
          <span className="pur-pricecell">
            <b className="num-inline">{fmtMoney(r.last)}</b>
            <VarChip rate={r.last} boq={r.m.rate} />
          </span>
        ) : (
          <span className="pur-pricecell muted">
            <span className="num-inline">{fmtMoney(r.m.rate)}</span>
            <small>{t("BOQ")}</small>
          </span>
        ),
    },
    {
      key: "vendors",
      header: t("Vendors"),
      hideBelow: 900,
      sort: (r) => r.vendors.length,
      render: (r) =>
        r.vendors.length ? (
          <span className="pur-avstack">
            {r.vendors.slice(0, 3).map((n) => (
              <Avatar key={n} name={n} size={24} />
            ))}
            {r.vendors.length > 3 ? <b>+{r.vendors.length - 3}</b> : null}
          </span>
        ) : (
          <span className="muted small">—</span>
        ),
    },
  ];

  return (
    <div className="k-page pur-page">
      <PageHero
        eyebrow={t("Procurement · Purchasing")}
        title={t("Materials catalogue")}
        subtitle={t("Every BOQ material: how much is requested, ordered, received and used, what we paid, and who supplies it.")}
        flow={["BOQ", "Requested", "Ordered", "Received", "Issued"]}
        art="stock"
      />

      <StatTiles
        items={[
          { label: t("Materials"), value: all.length, sub: t("{n} with orders", { n: live.length }), tone: "brand" },
          { label: t("BOQ value"), value: `${fmtMoneyShort(budget)} AZN`, sub: t("at the bill rates") },
          { label: t("Ordered so far"), value: `${fmtMoneyShort(orderedValue)} AZN`, sub: budget > 0 ? t("{p} of the BOQ", { p: `${Math.round((orderedValue / budget) * 100)}%` }) : "—", tone: "ok" },
          { label: t("Covered by agreements"), value: covered, sub: over ? t("{n} bought above the BOQ rate", { n: over }) : live.length ? t("All bought at or under BOQ") : t("nothing ordered yet"), tone: over ? "warn" : live.length ? "ok" : undefined },
        ]}
      />

      <section className="pur-visual" aria-label={t("Buying by trade")}>
        <header className="pur-vhead">
          <div>
            <h2>{t("Buying by trade")}</h2>
            <p>{t("Grey is the BOQ budget, violet is ordered, green is already on site. Click a trade to filter.")}</p>
          </div>
          <span className="muted small">{t("as of {d}", { d: d(TODAY) })}</span>
        </header>
        <ul className="pur-trades">
          {byTrade.map((e, i) => {
            const on = trade === e.trade;
            return (
              <li key={e.trade}>
                <button type="button" className={`pur-trade${on ? " on" : ""}${trade && !on ? " dim" : ""}`} aria-pressed={on} onClick={() => setTrade(on ? null : e.trade)}>
                  <span className="pur-trade-name">
                    <b>{tradeName(e.trade, lang)}</b>
                    <small>{t("{n} materials", { n: e.n })}</small>
                  </span>
                  <span className="pur-trade-track">
                    <i className="budget k-grow-x" style={{ width: `${(e.budget / topBudget) * 100}%`, animationDelay: `${i * 40}ms` }} />
                    <i className="ordered k-grow-x" style={{ width: `${(e.ordered / topBudget) * 100}%`, animationDelay: `${i * 40 + 120}ms` }} />
                    <i className="received k-grow-x" style={{ width: `${(e.received / topBudget) * 100}%`, animationDelay: `${i * 40 + 220}ms` }} />
                  </span>
                  <span className="pur-trade-val num-inline">
                    <b>{fmtMoneyShort(e.ordered)}</b>
                    <small>/ {fmtMoneyShort(e.budget)}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Register
        rows={rows}
        columns={columns}
        rowKey={(r) => r.m.key}
        onRowClick={(r) => navigate(PR.material(r.m.key))}
        initialSort={{ key: "boq", dir: "desc" }}
        pageSize={15}
        empty={t("No materials match. Building services show when you pick that trade.")}
        toolbar={
          <Toolbar end={<SearchBox value={q} onChange={setQ} placeholder="Search materials, codes, vendors" />}>
            <FilterChips<Trade>
              options={TRADES.map((tr) => ({ value: tr as Trade, label: tradeName(tr, lang), count: all.filter((r) => r.m.trade === tr).length }))}
              value={trade}
              onChange={setTrade}
            />
            <FilterChips<"live"> options={[{ value: "live", label: <><LibraryBig size={12} /> {t("Requested or ordered")}</>, count: all.filter((r) => r.f.requested > 0 || r.f.ordered > 0).length }]} value={only} onChange={setOnly} />
          </Toolbar>
        }
      />
    </div>
  );
}

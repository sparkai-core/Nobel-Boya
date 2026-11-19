import { Link, useNavigate, useParams } from "react-router-dom";
import { Boxes, CalendarRange, ClipboardList, FilePlus2, FileSignature, LineChart, ShoppingCart, Store, Warehouse } from "lucide-react";
import { Avatar, Badge, Breadcrumbs, DetailHeader, Empty, Kebab, KeyFigure, Meter, Money, NextBar, PageHero, Panel, StatusBadge, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { monthShort, TODAY, toDate } from "../../../ops/dates";
import { R, tradeName } from "../../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import type { Material, OpsData } from "../../../ops/types";
import { agreementFor, funnelOf, matOf, onTimeOf, placesOf, PR, pricesPaid, seriesOf, suppliersOf, type Funnel, type PricePoint } from "./shared";
import { VarChip } from "./parts";

/** One material: the buying funnel from BOQ to site, prices paid against the market and BOQ, suppliers, work that uses it and stock. */
export function MaterialDetailPage() {
  const { key = "" } = useParams();
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const m = matOf(s, decodeURIComponent(key));

  if (!m) {
    return (
      <div className="k-page pur-page">
        <PageHero eyebrow={t("Procurement · Purchasing")} title={t("Material not found")} back={{ to: PR.catalogue, label: "Materials catalogue" }} />
        <Empty title={t("This material is not in the catalogue.")} />
      </div>
    );
  }

  const f = funnelOf(s, m.key);
  const paid = pricesPaid(s, m.key);
  const agr = agreementFor(s, m.key);
  const agrRate = agr?.rates.find((r) => r.material === m.key);
  const stock = s.stock.filter((x2) => x2.key === m.key);
  const onHand = stock.reduce((a, x2) => a + x2.onHand, 0);
  const reorder = stock.reduce((a, x2) => a + x2.reorder, 0);
  const low = stock.length > 0 && reorder > 0 && onHand < reorder;
  const moves = s.movements.filter((v) => v.key === m.key).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
  const acts = linkedActivities(s, m);
  const mrs = s.mrs.filter((r) => r.status !== "CANCELLED" && r.lines.some((l) => l.material === m.key));
  const pos = s.pos.filter((p) => p.status !== "CANCELLED" && p.lines.some((l) => l.material === m.key));
  const vendors = suppliersOf(s, m).slice(0, 6);
  const u = unitLabel(m.unit, lang);
  const mrLink = `${R.newRequest}${acts[0] ? `?activity=${acts[0].id}` : ""}`;

  return (
    <div className="k-page pur-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Materials catalogue"), to: PR.catalogue }, { label: x(m.name) }]} />
      <DetailHeader
        refCode={m.key}
        badges={
          <>
            <Badge tone="neutral" dot={false}>
              {tradeName(m.trade, lang)}
            </Badge>
            {agr ? (
              <Link to={PR.agreement(agr.id)} className="pur-agr-badge">
                <FileSignature size={12} />
                {t("Framework {ref}", { ref: agr.ref })}
              </Link>
            ) : null}
            {stock.length ? <Badge tone={low ? "warn" : onHand > 0 ? "ok" : "muted"}>{low ? t("Below reorder") : onHand > 0 ? t("In stock") : t("None in stock")}</Badge> : null}
          </>
        }
        title={x(m.name)}
        meta={
          <>
            <span>{t("BOQ rate {r} AZN / {u}", { r: fmtMoney(m.rate), u })}</span>
            <span>{m.budgetQty > 0 ? t("BOQ quantity {q} {u}", { q: fmtQty(m.budgetQty, m.unit), u }) : t("Not measured in the BOQ")}</span>
            <span>{t("{n} activities use it", { n: acts.length })}</span>
          </>
        }
        aside={<KeyFigure label={t("Budget value")} value={<Money value={m.rate * m.budgetQty} />} sub={t("{q} {u} × {r}", { q: fmtQty(m.budgetQty, m.unit), u, r: fmtMoney(m.rate) })} />}
      />

      <NextBar text={f.boq > 0 ? (f.toBuy > 0 ? t("{q} {u} still to buy against the BOQ ({p}% ordered).", { q: fmtQty(f.toBuy, m.unit), u, p: Math.round((f.ordered / f.boq) * 100) }) : t("Fully ordered against the BOQ.")) : t("Bought as needed: this item is not measured in the BOQ.")} tone={f.boq > 0 && f.toBuy <= 0 ? "ok" : low ? "warn" : "brand"}>
        {agr ? (
          <button type="button" className="btn btn-primary" onClick={() => navigate(PR.newOrder({ agreement: agr.id }))}>
            <FileSignature size={15} />
            {t("Buy from agreement")}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => navigate(PR.newOrder({ material: m.key }))}>
            <ShoppingCart size={15} />
            {t("Direct PO")}
          </button>
        )}
        <Link to={mrLink} className="btn btn-ghost">
          <FilePlus2 size={15} />
          {t("Raise MR")}
        </Link>
        <Kebab
          items={[
            { label: t("Direct PO"), icon: <ShoppingCart size={14} />, onClick: () => navigate(PR.newOrder({ material: m.key })) },
            { label: t("Open the stock shelf"), icon: <Warehouse size={14} />, onClick: () => navigate(R.inventory) },
          ]}
        />
      </NextBar>

      <section className="pur-visual" aria-label={t("Buying funnel")}>
        <header className="pur-vhead">
          <div>
            <h2>{t("Buying funnel")}</h2>
            <p>{t("From the BOQ quantity to what is fixed in the works, in {u}.", { u })}</p>
          </div>
        </header>
        <BigFunnel f={f} unit={m.unit} />
      </section>

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Price history")} icon={<LineChart size={15} />} sub={t("Prices paid on orders, the market price and its forecast, against the BOQ rate.")}>
            <PriceChart s={s} m={m} paid={paid} agreementRate={agrRate && agrRate.unit === m.unit ? agrRate.rate : null} />
          </Panel>

          <Panel title={t("Vendors")} icon={<Store size={15} />} count={vendors.length} pad={false}>
            {vendors.length ? (
              <div className="pur-tablewrap">
                <table className="pur-table">
                  <thead>
                    <tr>
                      <th>{t("Vendor")}</th>
                      <th className="r">{t("Last price")}</th>
                      <th className="r">{t("Orders")}</th>
                      <th>{t("On time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => {
                      const vp = paid.filter((p) => p.vendorId === v.id);
                      const vpos = pos.filter((p) => p.vendorId === v.id);
                      const ot = onTimeOf(s, s.pos.filter((p) => p.vendorId === v.id && p.status !== "CANCELLED"));
                      const share = ot.share ?? (v.overall > 0 ? v.scores.delivery / 100 : null);
                      return (
                        <tr key={v.id}>
                          <td>
                            <Link to={R.vendor(v.id)} className="pur-vrow">
                              <Avatar name={v.name} size={24} />
                              <span>
                                <b>{v.name}</b>
                                <small>{tradeName(v.trade, lang)}</small>
                              </span>
                            </Link>
                          </td>
                          <td className="r">
                            {vp.length ? (
                              <span className="pur-pricecell">
                                <b className="num-inline">{fmtMoney(vp[vp.length - 1]!.rate)}</b>
                                <VarChip rate={vp[vp.length - 1]!.rate} boq={m.rate} />
                              </span>
                            ) : (
                              <span className="muted small">{t("not bought yet")}</span>
                            )}
                          </td>
                          <td className="r num-inline">{vpos.length || <span className="muted">—</span>}</td>
                          <td>
                            {share == null ? (
                              <span className="muted">—</span>
                            ) : (
                            <span className="pur-ontime">
                              <Meter value={share} tone={share >= 0.85 ? "ok" : share >= 0.65 ? "warn" : "bad"} />
                              <small className="num-inline">
                                {Math.round(share * 100)}%{ot.share == null ? ` ${t("score")}` : ""}
                              </small>
                            </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="k-panel-body muted small">{t("No vendor covers this trade yet.")}</p>
            )}
          </Panel>

          <Panel title={t("Linked activities")} icon={<CalendarRange size={15} />} count={acts.length} pad={false}>
            {acts.length ? (
              <ul className="pur-acts">
                {acts.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <Link to={R.programme(a.id)}>
                      <span className="k-mono">{a.code}</span>
                      <span className="pur-acts-name">{x(a.name)}</span>
                      <span className="muted small num-inline">
                        {d(a.start, false)} → {d(a.end, false)}
                      </span>
                      <span className="pur-acts-pct">
                        <Meter value={a.pct / 100} tone={a.status === "BLOCKED" ? "bad" : a.status === "COMPLETED" ? "ok" : "brand"} />
                      </span>
                      <StatusBadge kind="activity" status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-panel-body muted small">{t("No programme activity is linked to this material.")}</p>
            )}
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Stock on hand")} icon={<Boxes size={15} />}>
            {stock.length ? (
              <>
                <div className="pur-stockfig">
                  <strong className={`num-inline${low ? " k-text-warn" : ""}`}>{fmtQty(onHand, m.unit)}</strong>
                  <span>{u}</span>
                  <small>{stock.map((x2) => t(x2.store)).join(" · ")}</small>
                </div>
                {reorder > 0 ? (
                  <>
                    <Meter value={onHand / (reorder * 2)} marker={0.5} tone={low ? "warn" : "ok"} />
                    <small className="muted">{t("Reorder line {q} {u}", { q: fmtQty(reorder, m.unit), u })}</small>
                  </>
                ) : null}
              </>
            ) : (
              <p className="muted small">{t("Not kept in the store. Delivered straight to the works.")}</p>
            )}
            {moves.length ? (
              <ul className="pur-moves">
                {moves.map((v) => (
                  <li key={v.id} className={v.qty >= 0 ? "in" : "out"}>
                    <b className="num-inline">
                      {v.qty >= 0 ? "+" : "−"}
                      {fmtQty(Math.abs(v.qty), m.unit)}
                    </b>
                    <span>{v.ref.startsWith("GRN") ? <Link to={R.receipt(v.ref)}>{v.ref}</Link> : <span className="k-mono">{v.ref}</span>}</span>
                    <small className="muted">{v.note ? x(v.note) : t(v.type === "RECEIPT" ? "Received" : v.type === "ISSUE" ? "Issued" : v.type === "TRANSFER" ? "Transfer" : "Count adjustment")}</small>
                    <small className="muted num-inline">{d(v.at, false)}</small>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>

          {agr && agrRate ? (
            <Panel title={t("Framework agreement")} icon={<FileSignature size={15} />}>
              <div className="pur-agrbox">
                <Link to={PR.agreement(agr.id)}>{x(agr.title)}</Link>
                <small>
                  {agr.ref} · {s.vendors.find((v) => v.id === agr.vendorId)?.name}
                </small>
                <div className="pur-agrbox-rate">
                  <b className="num-inline">{fmtMoney(agrRate.rate)}</b>
                  <span>/ {unitLabel(agrRate.unit, lang)}</span>
                  {agrRate.unit === m.unit ? <VarChip rate={agrRate.rate} boq={m.rate} /> : null}
                </div>
                <small className="muted">{t("Minimum call-off {q} {u}", { q: fmtQty(agrRate.minQty, agrRate.unit), u: unitLabel(agrRate.unit, lang) })}</small>
              </div>
            </Panel>
          ) : null}

          <Panel title={t("Requests and orders")} icon={<ClipboardList size={15} />} count={mrs.length + pos.length} pad={false}>
            {mrs.length || pos.length ? (
              <ul className="pur-reclist">
                {mrs.map((r) => (
                  <li key={r.id}>
                    <Link to={R.request(r.id)}>
                      <span className="k-ref">{r.ref}</span>
                      <span className="num-inline small">
                        {fmtQty(r.lines.filter((l) => l.material === m.key).reduce((a, l) => a + l.qty, 0), m.unit)} {u}
                      </span>
                      <StatusBadge kind="mr" status={r.status} />
                    </Link>
                  </li>
                ))}
                {pos.map((p) => (
                  <li key={p.id}>
                    <Link to={R.order(p.id)}>
                      <span className="k-ref">{p.ref}</span>
                      <span className="num-inline small">
                        {fmtQty(p.lines.filter((l) => l.material === m.key).reduce((a, l) => a + l.qty, 0), m.unit)} {u}
                      </span>
                      <StatusBadge kind="po" status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-panel-body muted small">{t("Nothing requested or ordered yet.")}</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Activities in the BOQ sections and buildings where the material is measured; else those its requests name. */
function linkedActivities(s: OpsData, m: Material) {
  const { sections, buildings } = placesOf(m.key);
  const byPlace = s.activities.filter((a) => a.section && sections.has(a.section) && buildings.has(a.building));
  const byMr = s.mrs.filter((r) => r.activityId && r.lines.some((l) => l.material === m.key)).map((r) => r.activityId!);
  const ids = new Set([...byMr, ...byPlace.map((a) => a.id)]);
  return s.activities.filter((a) => ids.has(a.id)).sort((a, b) => a.start.localeCompare(b.start));
}

/** The funnel: BOQ → requested → ordered → received → issued, and what is still to buy. */
function BigFunnel({ f, unit }: { f: Funnel; unit: string }) {
  const { t, lang } = useL();
  const top = Math.max(f.boq, f.requested, f.ordered, 1e-9);
  const stages: { key: string; label: string; v: number; hint: string }[] = [
    { key: "boq", label: t("BOQ"), v: f.boq, hint: t("measured from the drawings") },
    { key: "req", label: t("Requested"), v: f.requested, hint: t("on material requests") },
    { key: "ord", label: t("Ordered"), v: f.ordered, hint: t("on purchase orders") },
    { key: "rec", label: t("Received"), v: f.received, hint: t("counted at the gate") },
    { key: "iss", label: t("Issued"), v: f.issued, hint: t("taken from the store to the works") },
  ];
  const ofBoq = (v: number) => (f.boq > 0 ? `${Math.round((v / f.boq) * 100)}%` : "—");
  return (
    <div className="pur-funnel">
      {stages.map((st, i) => {
        const w = Math.max(st.v > 0 ? 4 : 0, (st.v / top) * 100);
        const prev = i > 0 ? stages[i - 1]!.v : null;
        return (
          <div key={st.key} className={`pur-funnel-row ${st.key}`} style={{ animationDelay: `${i * 80}ms` }}>
            <span className="pur-funnel-label">
              <b>{st.label}</b>
              <small>{st.hint}</small>
            </span>
            <span className="pur-funnel-track">
              <i className="k-grow-x" style={{ width: `${w}%`, marginLeft: `${(100 - w) / 2}%` }} />
            </span>
            <span className="pur-funnel-val">
              <b className="num-inline">{fmtQty(st.v, unit)}</b>
              <small className="num-inline">
                {unitLabel(unit, lang)} · {i === 0 ? "100%" : ofBoq(st.v)}
              </small>
              {prev != null && prev > 0 && i > 1 ? <em className="num-inline">{t("{p} of the step before", { p: `${Math.round((st.v / prev) * 100)}%` })}</em> : null}
            </span>
          </div>
        );
      })}
      <div className="pur-funnel-row tobuy" style={{ animationDelay: `${stages.length * 80}ms` }}>
        <span className="pur-funnel-label">
          <b>{t("Still to buy")}</b>
          <small>{t("BOQ less what is ordered")}</small>
        </span>
        <span className="pur-funnel-track">
          <i className="k-grow-x" style={{ width: `${Math.max(f.toBuy > 0 ? 4 : 0, (f.toBuy / top) * 100)}%`, marginLeft: `${(100 - Math.max(f.toBuy > 0 ? 4 : 0, (f.toBuy / top) * 100)) / 2}%` }} />
        </span>
        <span className="pur-funnel-val">
          <b className="num-inline">{fmtQty(f.toBuy, unit)}</b>
          <small className="num-inline">
            {unitLabel(unit, lang)} · {ofBoq(f.toBuy)}
          </small>
        </span>
      </div>
    </div>
  );
}

/** Monthly price line: market history and forecast band, order prices as dots, BOQ (and agreement) rate as lines. */
function PriceChart({ s, m, paid, agreementRate }: { s: OpsData; m: Material; paid: PricePoint[]; agreementRate: number | null }) {
  const { t, d, lang } = useL();
  const series = seriesOf(s, m);
  const W = 640;
  const H = 220;
  const pad = { l: 48, r: 16, t: 16, b: 28 };
  const first = series ? `${series.history[0]!.month}-01` : `${(paid[0]?.date ?? TODAY).slice(0, 7)}-01`;
  const lastMonth = series ? series.forecast[series.forecast.length - 1]!.month : TODAY.slice(0, 7);
  const y0 = Number(first.slice(0, 4));
  const m0 = Number(first.slice(5, 7));
  const idx = (iso: string) => (Number(iso.slice(0, 4)) - y0) * 12 + (Number(iso.slice(5, 7)) - m0) + (iso.length >= 10 ? (Number(iso.slice(8, 10)) - 1) / 30 : 0);
  const n = Math.max(1, idx(`${lastMonth}-28`));
  const vals = [m.rate, ...paid.map((p) => p.rate), ...(agreementRate ? [agreementRate] : []), ...(series ? [...series.history.map((h) => h.price), ...series.forecast.flatMap((h) => [h.low, h.high])] : [])];
  const lo = Math.min(...vals) * 0.95;
  const hi = Math.max(...vals) * 1.05;
  const X = (iso: string) => pad.l + (idx(iso) / n) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1e-9, hi - lo)) * (H - pad.t - pad.b);
  const hist = series?.history.map((h) => `${X(`${h.month}-15`).toFixed(1)} ${Y(h.price).toFixed(1)}`) ?? [];
  const lastH = series?.history[series.history.length - 1];
  const fc = series ? [`${X(`${lastH!.month}-15`)} ${Y(lastH!.price)}`, ...series.forecast.map((h) => `${X(`${h.month}-15`).toFixed(1)} ${Y(h.price).toFixed(1)}`)] : [];
  const band = series ? [...series.forecast.map((h) => `${X(`${h.month}-15`).toFixed(1)} ${Y(h.high).toFixed(1)}`), ...[...series.forecast].reverse().map((h) => `${X(`${h.month}-15`).toFixed(1)} ${Y(h.low).toFixed(1)}`)] : [];
  const months: string[] = [];
  for (let i = 0; i <= Math.floor(n); i++) {
    const mm = m0 - 1 + i;
    months.push(`${y0 + Math.floor(mm / 12)}-${String((mm % 12) + 1).padStart(2, "0")}`);
  }
  const step = Math.ceil(months.length / 8);
  const ticks = [0, 0.33, 0.66, 1].map((k) => lo + (hi - lo) * k);

  if (!series && !paid.length) {
    return <p className="muted small">{t("No prices yet. The BOQ rate is {r} AZN / {u}.", { r: fmtMoney(m.rate), u: unitLabel(m.unit, lang) })}</p>;
  }
  return (
    <div className="pur-price">
      {series ? (
        <p className={`pur-call ${series.call.toLowerCase()}`}>
          <b>{t(series.call === "BUY_NOW" ? "Buy now" : series.call === "WAIT" ? "Wait" : "Hold")}</b> · {t("Market {a} → {b} in 6 months, lead time {n} days.", { a: fmtMoney(lastH!.price), b: fmtMoney(series.forecast[series.forecast.length - 1]!.price), n: series.leadDays })}
        </p>
      ) : null}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Price history")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} className="pur-grid" />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" className="pur-axis">
              {fmtMoney(v)}
            </text>
          </g>
        ))}
        {months.map((mm, i) =>
          i % step === 0 ? (
            <text key={mm} x={X(`${mm}-15`)} y={H - 8} textAnchor="middle" className="pur-axis">
              {monthShort(toDate(`${mm}-01`).getUTCMonth(), lang)}
            </text>
          ) : null,
        )}
        {band.length ? <polygon points={band.join(" ")} className="pur-band" /> : null}
        <line x1={pad.l} x2={W - pad.r} y1={Y(m.rate)} y2={Y(m.rate)} className="pur-boqline" />
        <text x={W - pad.r} y={Y(m.rate) - 5} textAnchor="end" className="pur-axis pur-boqt">
          {t("BOQ {r}", { r: fmtMoney(m.rate) })}
        </text>
        {agreementRate ? <line x1={pad.l} x2={W - pad.r} y1={Y(agreementRate)} y2={Y(agreementRate)} className="pur-agrline" /> : null}
        {hist.length ? <path d={`M${hist.join(" L")}`} className="pur-market" /> : null}
        {fc.length ? <path d={`M${fc.join(" L")}`} className="pur-forecast" /> : null}
        <line x1={X(TODAY)} x2={X(TODAY)} y1={pad.t} y2={H - pad.b} className="pur-todayl" />
        {paid.map((p, i) => (
          <circle key={`${p.poId}-${i}`} cx={X(p.date)} cy={Y(p.rate)} r={5.5} className="pur-paid">
            <title>{`${p.poId} · ${d(p.date)} · ${fmtMoney(p.rate)} AZN`}</title>
          </circle>
        ))}
      </svg>
      <div className="k-legend">
        <span className="pur-lg-paid">{t("Paid on orders")}</span>
        {series ? <span className="pur-lg-market">{t("Market")}</span> : null}
        {series ? <span className="pur-lg-forecast">{t("Forecast")}</span> : null}
        <span className="pur-lg-boq">{t("BOQ rate")}</span>
        {agreementRate ? <span className="pur-lg-agr">{t("Agreement rate")}</span> : null}
      </div>
    </div>
  );
}

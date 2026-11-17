import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, PieChart } from "lucide-react";
import { Badge, PageHero, Panel, StatTiles, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { poPaid, poTotal, R, tradeName } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { Material, Trade } from "../../../ops/types";
import { poTrade } from "./shared";

type Fig = { budget: number; committed: number; atBoq: number; received: number; paid: number; pos: Set<string> };
const isOver = (f: Fig) => (f.budget > 0 && f.committed > f.budget + 1) || f.committed > f.atBoq * 1.02;

function Bars({ f, scale }: { f: Fig; scale: number }) {
  return (
    <span className={`po-bud-track${isOver(f) ? " over" : ""}`}>
      <i className="b k-grow-x" style={{ width: `${(f.budget / scale) * 100}%` }} />
      <i className="c k-grow-x" style={{ width: `${(f.committed / scale) * 100}%` }} />
      <i className="r k-grow-x" style={{ width: `${(f.received / scale) * 100}%` }} />
      <i className="p k-grow-x" style={{ width: `${(f.paid / scale) * 100}%` }} />
    </span>
  );
}

const empty = (): Fig => ({ budget: 0, committed: 0, atBoq: 0, received: 0, paid: 0, pos: new Set() });

/** Budget vs committed: BOQ budget, orders, goods received and payments per trade and per material. */
export function BudgetPage() {
  const { t, x, lang } = useL();
  const s = useOps();
  const [open, setOpen] = useState<Trade | null>(null);
  const [onlyBought, setOnlyBought] = useState(true);

  const data = useMemo(() => {
    const trades = new Map<Trade, Fig & { mats: Map<string, Fig> }>();
    const row = (tr: Trade) => {
      let r = trades.get(tr);
      if (!r) trades.set(tr, (r = { ...empty(), mats: new Map() }));
      return r;
    };
    const mat = (tr: Trade, key: string) => {
      const r = row(tr);
      let m = r.mats.get(key);
      if (!m) r.mats.set(key, (m = empty()));
      return m;
    };
    for (const m of s.materials) {
      const b = m.rate * m.budgetQty;
      if (b <= 0) continue;
      row(m.trade).budget += b;
      mat(m.trade, m.key).budget += b;
    }
    for (const po of s.pos.filter((p) => p.status !== "CANCELLED")) {
      const paidShare = Math.min(1, poPaid(s, po.id) / (poTotal(po) || 1));
      const fallback = poTrade(s, po) ?? "Concrete";
      for (const l of po.lines) {
        const m = l.material ? s.materials.find((v) => v.key === l.material) : undefined;
        const tr = m?.trade ?? fallback;
        const key = m?.key ?? `free:${x(l.description)}`;
        const net = l.qty * l.rate;
        for (const f of [row(tr), mat(tr, key)]) {
          f.committed += net;
          f.atBoq += m ? l.qty * m.rate : net;
          f.received += Math.min(l.received, l.qty) * l.rate;
          f.paid += net * paidShare;
          f.pos.add(po.id);
        }
      }
    }
    const list = [...trades.entries()].sort((a, b) => b[1].budget - a[1].budget);
    const tot = list.reduce((a, [, v]) => ({ budget: a.budget + v.budget, committed: a.committed + v.committed, atBoq: a.atBoq + v.atBoq, received: a.received + v.received, paid: a.paid + v.paid }), { budget: 0, committed: 0, atBoq: 0, received: 0, paid: 0 });
    return { list, tot };
  }, [s, x]);

  const matName = (key: string) => {
    if (key.startsWith("free:")) return key.slice(5);
    const m: Material | undefined = s.materials.find((v) => v.key === key);
    return m ? x(m.name) : key;
  };
  const over = isOver;
  const variance = data.tot.atBoq - data.tot.committed;
  const maxBudget = Math.max(1, ...data.list.map(([, v]) => Math.max(v.budget, v.committed)));

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Budget")}
        title={t("Budget vs committed")}
        subtitle={t("The BOQ budget for each trade and material against what is ordered, delivered and paid.")}
        flow={["BOQ budget", "Committed on orders", "Received", "Paid"]}
        art="budget"
      />

      <StatTiles
        items={[
          { label: t("BOQ budget"), value: `${fmtMoneyShort(data.tot.budget)}`, sub: t("rate × measured quantity, net") },
          { label: t("Committed on orders"), value: fmtMoneyShort(data.tot.committed), sub: t("{p}% of the budget", { p: ((data.tot.committed / (data.tot.budget || 1)) * 100).toFixed(1) }) },
          { label: t("Received value"), value: fmtMoneyShort(data.tot.received), sub: t("{p}% of committed", { p: Math.round((data.tot.received / (data.tot.committed || 1)) * 100) }) },
          { label: t("Paid"), value: fmtMoneyShort(data.tot.paid), sub: t("net of VAT") },
          { label: t("Against BOQ rates"), value: `${variance >= 0 ? "−" : "+"}${fmtMoneyShort(Math.abs(variance))}`, tone: variance >= 0 ? "ok" : "bad", sub: variance >= 0 ? t("bought under the BOQ rates") : t("over the BOQ rates") },
        ]}
      />

      <Panel
        title={t("By trade")}
        icon={<PieChart size={15} />}
        sub={t("Bars share one scale. Open a trade to see its materials and the orders behind each number.")}
        actions={
          <label className="po-switch">
            <input type="checkbox" checked={onlyBought} onChange={(e) => setOnlyBought(e.target.checked)} />
            <span />
            {t("Only bought materials")}
          </label>
        }
        pad={false}
      >
        <div className="po-bud-legend k-legend">
          <span style={{ ["--lc" as string]: "var(--sheet-3)" }}>{t("BOQ budget")}</span>
          <span style={{ ["--lc" as string]: "#cfc3ef" }}>{t("Committed")}</span>
          <span style={{ ["--lc" as string]: "#7d5fc9" }}>{t("Received")}</span>
          <span style={{ ["--lc" as string]: "var(--stamp)" }}>{t("Paid")}</span>
          <span style={{ ["--lc" as string]: "var(--redline)" }}>{t("Over budget")}</span>
        </div>
        <div className="po-tablewrap">
          <table className="po-table po-bud">
            <thead>
              <tr>
                <th>{t("Trade")}</th>
                <th className="po-bud-barcol" />
                <th className="r">{t("Budget")}</th>
                <th className="r">{t("Committed")}</th>
                <th className="r hide-900">{t("Received")}</th>
                <th className="r hide-900">{t("Paid")}</th>
                <th className="r">{t("Variance")}</th>
              </tr>
            </thead>
            <tbody>
              {data.list.map(([tr, f], i) => {
                const isOpen = open === tr;
                const v = f.atBoq - f.committed;
                const mats = [...f.mats.entries()].filter(([, m]) => !onlyBought || m.committed > 0).sort((a, b) => b[1].committed - a[1].committed || b[1].budget - a[1].budget);
                const mscale = Math.max(1, ...mats.map(([, m]) => Math.max(m.budget, m.committed)));
                return (
                  <Fragment key={tr}>
                    <tr className={`po-bud-trade${isOpen ? " open" : ""}${over(f) ? " over" : ""}`} onClick={() => setOpen(isOpen ? null : tr)} style={{ animationDelay: `${i * 40}ms` }}>
                      <td>
                        <button type="button" className="po-bud-name" aria-expanded={isOpen}>
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {tradeName(tr, lang)}
                        </button>
                      </td>
                      <td className="po-bud-barcol">
                        <Bars f={f} scale={maxBudget} />
                      </td>
                      <td className="r num-inline">{fmtMoneyShort(f.budget)}</td>
                      <td className="r num-inline">
                        {fmtMoneyShort(f.committed)}
                        <small className="po-bud-pct">{f.budget ? `${Math.round((f.committed / f.budget) * 100)}%` : t("not in BOQ")}</small>
                      </td>
                      <td className="r num-inline hide-900">{fmtMoneyShort(f.received)}</td>
                      <td className="r num-inline hide-900">{fmtMoneyShort(f.paid)}</td>
                      <td className={`r num-inline ${f.committed ? (v >= 0 ? "k-text-ok" : "k-text-bad") : "muted"}`}>{f.committed ? `${v >= 0 ? "−" : "+"}${fmtMoneyShort(Math.abs(v))}` : "—"}</td>
                    </tr>
                    {isOpen
                      ? mats.length
                        ? mats.map(([key, m]) => {
                            const mv = m.atBoq - m.committed;
                            return (
                              <tr key={key} className={`po-bud-mat${over(m) ? " over" : ""}`}>
                                <td>
                                  <span className="po-bud-matname">{matName(key)}</span>
                                  {m.pos.size ? (
                                    <span className="po-bud-pos">
                                      {[...m.pos].map((id) => (
                                        <Link key={id} to={R.order(id)} className="po-chip-link">
                                          {id}
                                        </Link>
                                      ))}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="po-bud-barcol">
                                  <Bars f={m} scale={mscale} />
                                </td>
                                <td className="r num-inline">{m.budget ? fmtMoneyShort(m.budget) : <Badge tone="warn">{t("not in BOQ")}</Badge>}</td>
                                <td className="r num-inline">
                                  {m.committed ? fmtMoneyShort(m.committed) : "—"}
                                  {m.budget && m.committed ? <small className="po-bud-pct">{Math.round((m.committed / m.budget) * 100)}%</small> : null}
                                </td>
                                <td className="r num-inline hide-900">{m.received ? fmtMoneyShort(m.received) : "—"}</td>
                                <td className="r num-inline hide-900">{m.paid ? fmtMoneyShort(m.paid) : "—"}</td>
                                <td className={`r num-inline ${m.committed ? (mv >= 0 ? "k-text-ok" : "k-text-bad") : "muted"}`}>{m.committed ? `${mv >= 0 ? "−" : "+"}${fmtMoneyShort(Math.abs(mv))}` : "—"}</td>
                              </tr>
                            );
                          })
                        : [
                            <tr key="none" className="po-bud-mat">
                              <td colSpan={7} className="muted small">
                                {t("Nothing ordered in this trade yet.")}
                              </td>
                            </tr>,
                          ]
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="k-panel-body muted small">{t("Variance compares what was ordered with the same quantities at BOQ rates: a minus means bought for less.")}</p>
      </Panel>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquareWarning, PackageCheck, Truck } from "lucide-react";
import { Empty, PageHero, Panel, StatusBadge, useL } from "../../components/kit";
import { Segmented } from "../../components/ui";
import { poNet } from "../../ops/select";
import { fmtQty, unitLabel } from "../../lib/format";
import type { GrnStatus, ShortReason } from "../../ops/types";
import { BUYER, orderState, useVendor, VP } from "./model";
import { useEyebrow } from "./parts";

type Filter = "all" | "PART_RECEIVED" | "REJECTED" | "RECEIVED";
const REASON: Record<ShortReason, string> = { NOT_DELIVERED: "Not delivered", DAMAGED: "Damaged", WRONG_ITEM: "Wrong item" };

/** Deliveries: what the site store checked in, line by line, with shortages in red and the store's note. */
export function VpDeliveries() {
  const { t, x, d, stamp, lang } = useL();
  const eyebrow = useEyebrow();
  const { s, view } = useVendor();
  const [filter, setFilter] = useState<Filter>("all");

  const fill = useMemo(() => {
    if (!view) return [];
    return view.pos
      .map((po) => {
        const st = orderState(s, po, view.invoices);
        const net = poNet(po) || 1;
        const received = po.lines.reduce((a, l) => a + Math.min(l.received, l.qty) * l.rate, 0) / net;
        const shortVal = st.posted.reduce((a, g) => a + g.lines.filter((l) => l.shortReason).reduce((b, l) => b + Math.max(0, l.ordered - l.prior - l.accepted) * (po.lines.find((pl) => l.key.startsWith(pl.key))?.rate ?? 0), 0), 0);
        const short = po.status === "CLOSED" ? 0 : Math.min(1 - received, shortVal / net);
        return { po, st, received, short, rest: Math.max(0, 1 - received - short) };
      })
      .filter((r) => r.st.grns.length || r.po.dispatchedAt);
  }, [s, view]);

  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;
  const grns = view.grns;
  const count = (st: GrnStatus) => grns.filter((g) => g.status === st).length;
  const shown = grns.filter((g) => filter === "all" || g.status === filter);
  const moving = fill.filter((r) => r.st.onWay || r.st.atGate);

  return (
    <div className="k-page vp-page">
      <PageHero eyebrow={eyebrow("Deliveries")} title={t("Deliveries")} subtitle={t("What the Qobu site store has checked in from you, line by line.")} flow={["Dispatched", "At the gate", "Checked in", "Short or in full"]} art="receipt" />

      {moving.length ? (
        <section className="vp-moving" aria-label={t("On the way")}>
          {moving.map(({ po, st }) => (
            <Link key={po.id} to={VP.order(po.id)} className="vp-moving-card">
              <span className="vp-moving-road" aria-hidden="true">
                <Truck size={18} className={st.atGate ? "at-gate" : ""} />
              </span>
              <span className="vp-moving-text">
                <b>
                  {po.ref} · {st.atGate ? t("At the site gate") : t("On the way")}
                </b>
                <small>
                  {stamp(po.dispatchedAt)}
                  {po.dispatchNote ? ` · ${po.dispatchNote}` : ""}
                </small>
              </span>
              <ArrowRight size={14} />
            </Link>
          ))}
        </section>
      ) : null}

      <Panel title={t("What arrived against what was ordered")} icon={<PackageCheck size={15} />} sub={t("By order value. Red is what the store reported short; grey is still to deliver.")}>
        {fill.length ? (
          <ul className="vp-fill">
            {fill.map(({ po, st, received, short, rest }, i) => (
              <li key={po.id}>
                <Link to={VP.order(po.id)}>
                  <span className="vp-fill-name">
                    <b>{po.ref}</b>
                    <small className="truncate">{po.rfqId ? x(s.rfqs.find((r) => r.id === po.rfqId)?.title) : x(po.lines[0]?.description)}</small>
                  </span>
                  <span className="vp-fill-track">
                    <i className="ok k-grow-x" style={{ width: `${received * 100}%`, animationDelay: `${i * 60}ms` }} />
                    <i className="short k-grow-x" style={{ width: `${short * 100}%`, animationDelay: `${i * 60 + 120}ms` }} />
                    <i className="rest" style={{ width: `${rest * 100}%` }} />
                    {st.onWay || st.atGate ? <Truck size={13} className="vp-fill-truck" style={{ left: `calc(${Math.min(96, (received + short) * 100)}% - 6px)` }} /> : null}
                  </span>
                  <span className="vp-fill-pct num-inline">{Math.round(received * 100)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t("Nothing dispatched yet.")}</p>
        )}
        <div className="vp-key">
          <span>
            <i style={{ background: "var(--ok)" }} />
            {t("Received")}
          </span>
          <span>
            <i style={{ background: "var(--redline)" }} />
            {t("Reported short")}
          </span>
          <span>
            <i className="rest" />
            {t("Still to deliver")}
          </span>
        </div>
      </Panel>

      <div className="vp-filterbar">
        <Segmented<Filter>
          label={t("Filter receipts")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("All"), count: grns.length },
            { value: "PART_RECEIVED", label: t("Part received"), count: count("PART_RECEIVED") },
            { value: "REJECTED", label: t("Rejected"), count: count("REJECTED") },
            { value: "RECEIVED", label: t("Received in full"), count: count("RECEIVED") },
          ]}
        />
      </div>

      {shown.length ? (
        <div className="vp-grns">
          {shown.map((g, i) => {
            const draft = g.status === "DRAFT";
            return (
              <article key={g.id} className={`vp-grn s-${g.status}`} style={{ animationDelay: `${i * 45}ms` }}>
                <header className="vp-grn-head">
                  <span className="k-ref">{g.ref}</span>
                  <StatusBadge kind="grn" status={g.status} />
                  <Link to={VP.order(g.poId)} className="k-link-btn">
                    {g.poId} <ArrowRight size={12} />
                  </Link>
                  <span className="vp-grn-when">{g.receivedAt ? `${d(g.receivedAt)}${g.receivedBy ? ` · ${g.receivedBy}` : ""}` : t("being checked at the gate")}</span>
                </header>
                <div className="k-table-wrap">
                  <table className="k-table vp-grn-lines">
                    <thead>
                      <tr>
                        <th>{t("Item")}</th>
                        <th style={{ textAlign: "right" }}>{t("Ordered")}</th>
                        <th style={{ textAlign: "right" }}>{t("Received")}</th>
                        <th style={{ textAlign: "right" }}>{t("Short")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.lines.map((l) => {
                        const short = Math.max(0, l.ordered - l.prior - l.accepted);
                        return (
                          <tr key={l.key}>
                            <td data-label={t("Item")}>
                              <div className="k-cell-title">
                                <strong>{x(l.description)}</strong>
                                {l.shortReason ? <small className="k-text-bad">{t(REASON[l.shortReason])}</small> : null}
                              </div>
                            </td>
                            <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Ordered")}>
                              {fmtQty(l.ordered, l.unit)} {unitLabel(l.unit, lang)}
                            </td>
                            <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Received")}>
                              {draft ? "—" : fmtQty(l.accepted, l.unit)}
                              {l.prior > 0 ? <small className="muted"> {t("+{q} earlier", { q: fmtQty(l.prior, l.unit) })}</small> : null}
                            </td>
                            <td style={{ textAlign: "right" }} className={`num-inline${short > 0 && !draft ? " vp-short" : " muted"}`} data-label={t("Short")}>
                              {draft ? "—" : short > 0 ? fmtQty(short, l.unit) : "0"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {g.remarks ? (
                  <p className="vp-grn-note">
                    <MessageSquareWarning size={14} />
                    <span>
                      <b>{t("Warehouse note")}</b> {g.remarks}
                    </span>
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon={<Truck size={20} />} title={grns.length ? t("No receipts in this group") : t("No deliveries yet")}>
          {grns.length ? t("Pick another filter.") : t("When the {buyer} site store checks in your goods, the receipt appears here.", { buyer: BUYER })}
        </Empty>
      )}
    </div>
  );
}

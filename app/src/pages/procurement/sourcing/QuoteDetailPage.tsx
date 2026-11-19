import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, Copy, FileText, PencilLine, Scale, ShoppingCart, Store, XCircle } from "lucide-react";
import {
  Avatar,
  Badge,
  Empty,
  Kebab,
  Money,
  NextBar,
  Panel,
  RingGauge,
  StatusBadge,
  StatusSteps,
  TabBar,
  Timeline,
  toast,
  Trail,
  useL,
  Breadcrumbs,
} from "../../../components/kit";
import { ChainLife } from "../purchasing/parts";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { budgetOf, PATHS, quoteNet, quoteTotal, R, statusMeta, trailOf, tradeName } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import { editQuotePrices } from "../../../ops/ext/sourcing";
import { approvalFor, gapWords, liveQuotes } from "./shared";

type Tab = "lines" | "checks" | "others" | "history" | "follows";

export function QuoteDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, stamp, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const q = s.quotes.find((qq) => qq.id === id);
  const [tab, setTab] = useState<Tab>("lines");
  const [editing, setEditing] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const others = useMemo(() => (q?.rfqId ? s.quotes.filter((qq) => qq.rfqId === q.rfqId && qq.id !== q.id) : []), [s.quotes, q]);

  if (!q) {
    return (
      <div className="k-page">
        <Empty title={t("Quote not found")} action={<Link className="btn btn-ghost" to={R.quotes}>{t("Back to quotations")}</Link>}>
          {t("{id} is not in this project.", { id })}
        </Empty>
      </div>
    );
  }

  const v = s.vendors.find((vv) => vv.id === q.vendorId);
  const rfq = q.rfqId ? s.rfqs.find((r) => r.id === q.rfqId) : undefined;
  const total = quoteTotal(q);
  const net = quoteNet(q);
  const live = q.rfqId ? liveQuotes(s.quotes, q.rfqId) : [q];
  const appr = approvalFor(s.approvals, [q.id]);
  const rivalAppr = !appr && q.rfqId ? approvalFor(s.approvals, live.map((l) => l.id)) : undefined;
  const po = appr?.poId ? s.pos.find((p) => p.id === appr.poId) : undefined;
  const passed = q.checks.filter((c) => c.result === "PASSED").length;
  const passShare = q.checks.length ? passed / q.checks.length : 1;
  const budget = rfq ? budgetOf(s, rfq.lines) : q.lines.reduce((a, l) => a + l.qty * (s.materials.find((m) => m.name.en === l.description.en)?.rate ?? 0), 0);
  const validDays = diffDays(TODAY, q.validUntil);
  const dupOf = q.duplicate ? s.quotes.find((o) => o.id !== q.id && o.vendorId === q.vendorId && o.ref === q.ref && !o.duplicate) : undefined;
  const lowest = live.length ? Math.min(...live.map(quoteTotal)) : total;

  const startEdit = () => {
    setPrices(Object.fromEntries(q.lines.map((l) => [l.key, String(l.unitPrice)])));
    setEditing(true);
    setTab("lines");
  };
  const saveEdit = () => {
    const lines = q.lines.map((l) => ({ ...l, unitPrice: Math.max(0, Number(prices[l.key] ?? l.unitPrice) || 0) }));
    editQuotePrices(q.id, lines);
    setEditing(false);
    toast(t("Prices saved on {id}", { id: q.id }));
  };
  const requestApproval = () => {
    const aid = s.sendForApproval(q.id);
    toast(t("{ref} raised for approval", { ref: aid }));
    navigate(R.approval(aid));
  };

  // ---- next step
  let text: ReactNode = "";
  let tone: "brand" | "ok" | "warn" | "bad" | "muted" = "brand";
  let primary: ReactNode = null;
  if (q.duplicate) {
    text = dupOf ? t("Possible duplicate of {id}: same vendor, reference and total. It is left out of comparisons.", { id: dupOf.id }) : t("Possible duplicate. It is left out of comparisons.");
    tone = "bad";
    primary = dupOf ? <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.quote(dupOf.id))}>{t("Open the original")}</button> : null;
  } else if (editing) {
    text = t("Change the unit prices to what the vendor quoted, then save.");
    tone = "warn";
    primary = (
      <>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
          {t("Cancel")}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>
          <CheckCircle2 size={13} />
          {t("Save prices")}
        </button>
      </>
    );
  } else if (q.status === "NEEDS_REVIEW") {
    text = t("Check the unit prices against the vendor's quote before comparing.");
    tone = "warn";
    primary = (
      <button type="button" className="btn btn-primary btn-sm" onClick={startEdit}>
        <PencilLine size={13} />
        {t("Edit prices")}
      </button>
    );
  } else if (appr?.status === "PENDING") {
    text = t("{ref} is waiting for approval ({n} of {m} signatures).", { ref: appr.ref, n: appr.level, m: appr.requiredLevels });
    tone = "warn";
    primary = <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.approval(appr.id))}>{t("Open the approval")}</button>;
  } else if (appr?.status === "APPROVED") {
    text = po ? t("Approved. {po} was issued to the vendor.", { po: po.ref }) : t("Approved.");
    tone = "ok";
    primary = po ? <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.order(po.id))}>{t("Open the order")}</button> : null;
  } else if (q.outcome === "LOST" || rivalAppr) {
    text = t("Another vendor's quote was taken forward on this RFQ.");
    tone = "muted";
    primary = rivalAppr ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.approval(rivalAppr.id))}>{t("Open the approval")}</button> : null;
  } else if (rfq && live.length >= 2) {
    text = t("{n} quotes answer {rfq}. Compare them before asking for approval.", { n: live.length, rfq: rfq.ref });
    primary = (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.compare(rfq.id))}>
        <Scale size={13} />
        {t("Compare the quotes")}
      </button>
    );
  } else {
    text = rfq ? t("This is the only quote on {rfq}. Take it to approval or wait for more.", { rfq: rfq.ref }) : t("This quote has no RFQ to compare against. Take it to approval on its own.");
    primary = (
      <button type="button" className="btn btn-primary btn-sm" onClick={requestApproval}>
        <BadgeCheck size={13} />
        {t("Request approval")}
      </button>
    );
  }

  const srcLabel = t(q.source === "PORTAL" ? "Portal" : q.source === "UPLOAD" ? "Upload" : "Typed");

  return (
    <div className="k-page ps-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Quotations"), to: R.quotes }, { label: q.id }]} />

      <section className="ps-qhead">
        <div className="ps-lh">
          <Avatar name={v?.name ?? q.vendorId} size={46} />
          <div className="ps-lh-text">
            <Link to={R.vendor(q.vendorId)} className="ps-lh-name">
              {v?.name ?? q.vendorId}
            </Link>
            <small>
              {v ? [v.city, tradeName(v.trade, lang), v.trn ? `${t("TRN")} ${v.trn}` : ""].filter(Boolean).join(" · ") : ""}
            </small>
            <small>{v ? `${v.email} · ${v.phone}` : ""}</small>
            <div className="ps-qbadges">
              <StatusBadge kind="quote" status={q.status} />
              <Badge tone={q.source === "PORTAL" ? "info" : "neutral"} dot={false}>
                {srcLabel}
              </Badge>
              {q.duplicate ? <Badge tone="bad">{t("Possible duplicate")}</Badge> : null}
              {q.outcome ? <Badge tone={q.outcome === "WON" ? "ok" : "muted"}>{t(q.outcome === "WON" ? "Won" : "Lost")}</Badge> : null}
              <Badge tone={statusMeta("risk", q.risk).tone}>{x(statusMeta("risk", q.risk).label)}</Badge>
            </div>
          </div>
        </div>
        <dl className="ps-qfigs">
          <div>
            <dt>{t("This quote")}</dt>
            <dd className="k-mono">{q.ref}</dd>
            <small>
              {q.id} · {stamp(q.receivedAt)}
            </small>
          </div>
          <div>
            <dt>{t("Answers")}</dt>
            <dd>{rfq ? <Link to={R.rfq(rfq.id)} className="ps-mono-link">{rfq.ref}</Link> : <span className="muted">{t("No RFQ")}</span>}</dd>
            <small className="truncate">{rfq ? x(rfq.title) : t("Direct quote")}</small>
          </div>
          <div className="ps-qfig-total">
            <dt>{t("Quoted total")}</dt>
            <dd>
              <Money value={total} />
            </dd>
            <small className={validDays < 0 ? "k-text-bad" : validDays <= 7 ? "k-text-warn" : undefined}>{validDays < 0 ? t("price expired {date}", { date: d(q.validUntil) }) : t("price holds until {date}", { date: d(q.validUntil) })}</small>
          </div>
        </dl>
        <StatusSteps kind="quote" path={PATHS.quote} status={q.status === "MANUAL" ? "EXTRACTED" : q.status} />
      </section>

      <NextBar text={text} tone={tone}>
        {primary}
        <Kebab
          items={[
            { label: t("Edit prices"), icon: <PencilLine size={14} />, disabled: editing || q.duplicate, onClick: startEdit },
            { label: t("Open the vendor"), icon: <Store size={14} />, onClick: () => navigate(R.vendor(q.vendorId)) },
            {
              label: t("Copy reference"),
              icon: <Copy size={14} />,
              onClick: () => {
                void navigator.clipboard?.writeText(q.ref);
                toast(t("Reference copied"));
              },
            },
          ]}
        />
      </NextBar>

      <Trail steps={trailOf(s, "QUOTE", q.id)} current={q.id} />
      <ChainLife kind="QUOTE" id={q.id} />

      <div className="k-grid-main">
        <div className="k-panel ps-tabs-panel">
          <div className="ps-tabbar">
            <TabBar<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "lines", label: t("Lines"), count: q.lines.length },
                { value: "checks", label: t("To check"), count: q.checks.filter((c) => c.result !== "PASSED").length || undefined },
                { value: "others", label: t("Other quotes"), count: others.length },
                { value: "history", label: t("History") },
                { value: "follows", label: t("What follows") },
              ]}
            />
          </div>
          <div className="ps-tab-body" key={tab}>
            {tab === "lines" ? (
              <div className="k-table-wrap">
                <table className="k-table ps-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("Line")}</th>
                      <th style={{ textAlign: "right" }}>{t("Qty")}</th>
                      <th style={{ textAlign: "right" }}>{t("Unit price")}</th>
                      <th style={{ textAlign: "right" }}>{t("Amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.lines.map((l, i) => {
                      const price = editing ? Number(prices[l.key] ?? l.unitPrice) || 0 : l.unitPrice;
                      return (
                        <tr key={l.key} className={l.match !== "MATCHED" ? "ps-row-warn" : undefined}>
                          <td className="muted num-inline">{i + 1}</td>
                          <td>
                            <strong className="ps-strong">{x(l.description)}</strong>
                            {l.match !== "MATCHED" ? <small className="k-text-warn ps-block">{t("Check this line")}</small> : null}
                          </td>
                          <td style={{ textAlign: "right" }} className="num-inline">
                            {fmtQty(l.qty, l.unit)} <span className="muted">{unitLabel(l.unit, lang)}</span>
                          </td>
                          <td style={{ textAlign: "right" }} className="num-inline">
                            {editing ? <input className="input num ps-price-input" type="number" min={0} step="0.01" value={prices[l.key] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [l.key]: e.target.value }))} aria-label={t("Unit price")} /> : fmtMoney(l.unitPrice)}
                          </td>
                          <td style={{ textAlign: "right" }} className="num-inline ps-strong">
                            {fmtMoney(l.qty * price)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <SumRow label={t("Subtotal")} value={editing ? q.lines.reduce((a, l) => a + l.qty * (Number(prices[l.key] ?? l.unitPrice) || 0), 0) : net} />
                    <SumRow label={t("VAT {p}%", { p: Math.round(q.vatRate * 100) })} value={(editing ? q.lines.reduce((a, l) => a + l.qty * (Number(prices[l.key] ?? l.unitPrice) || 0), 0) : net) * q.vatRate} />
                    <SumRow label={t("Shipping")} value={q.shipping} />
                    <SumRow label={t("Total")} value={editing ? q.lines.reduce((a, l) => a + l.qty * (Number(prices[l.key] ?? l.unitPrice) || 0), 0) * (1 + q.vatRate) + q.shipping : total} strong />
                  </tfoot>
                </table>
              </div>
            ) : null}

            {tab === "checks" ? (
              <div className="ps-checks">
                <div className="ps-checks-head">
                  <RingGauge value={Math.round(passShare * 100)} size={84} stroke={8} tone={passShare >= 0.99 ? "ok" : q.checks.some((c) => c.result === "FAILED") ? "bad" : "warn"} label="%" />
                  <div>
                    <strong>{t("{p}% of the rules passed", { p: Math.round(passShare * 100) })}</strong>
                    <p className="muted small">{t("Checked against the BOQ and the vendor register.")}</p>
                  </div>
                </div>
                <ul>
                  {q.checks.map((c, i) => (
                    <li key={i} className={`ps-check ps-check-${c.result.toLowerCase()}`}>
                      {c.result === "PASSED" ? <CheckCircle2 size={16} /> : c.result === "WARNING" ? <AlertTriangle size={16} /> : <XCircle size={16} />}
                      <span>
                        <strong>{x(c.label)}</strong>
                        <small>{x(c.detail)}</small>
                      </span>
                      <Badge tone={c.result === "PASSED" ? "ok" : c.result === "WARNING" ? "warn" : "bad"}>{t(c.result === "PASSED" ? "Passed" : c.result === "WARNING" ? "Warning" : "Failed")}</Badge>
                    </li>
                  ))}
                  {q.checks.length === 0 ? <li className="muted">{t("No checks recorded.")}</li> : null}
                </ul>
              </div>
            ) : null}

            {tab === "others" ? (
              others.length ? (
                <ul className="ps-list">
                  {[q, ...others]
                    .sort((a, b) => quoteTotal(a) - quoteTotal(b))
                    .map((o) => (
                      <li key={o.id}>
                        <Link to={R.quote(o.id)} className={`ps-list-row${o.id === q.id ? " current" : ""}`}>
                          <span className="ps-list-main">
                            <strong className="truncate">
                              {s.vendors.find((vv) => vv.id === o.vendorId)?.name}
                              {o.id === q.id ? ` · ${t("this quote")}` : ""}
                            </strong>
                            <small className="muted">
                              {o.id} · {t("{n} days delivery", { n: o.deliveryDays })}
                            </small>
                          </span>
                          <span className="ps-list-fig">
                            <Money value={quoteTotal(o)} short />
                            <small className={o.duplicate ? "k-text-bad" : quoteTotal(o) <= lowest + 0.005 ? "k-text-brand" : "muted"}>{o.duplicate ? t("Duplicate") : gapWords(t, quoteTotal(o), lowest)}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="muted">{rfq ? t("No other vendor has quoted on {rfq} yet.", { rfq: rfq.ref }) : t("This quote has no RFQ, so there are no rival quotes.")}</p>
              )
            ) : null}

            {tab === "history" ? <Timeline events={q.history} /> : null}

            {tab === "follows" ? (
              <ol className="ps-follows">
                <Follow
                  icon={<Scale size={16} />}
                  label={t("Comparison")}
                  state={live.length >= 2 ? "done" : "todo"}
                  sub={live.length >= 2 ? t("{n} quotes side by side", { n: live.length }) : t("Needs a second quote")}
                  to={live.length >= 2 && q.rfqId ? R.compare(q.rfqId) : undefined}
                />
                <Follow
                  icon={<BadgeCheck size={16} />}
                  label={t("Approval")}
                  state={appr ? (appr.status === "APPROVED" ? "done" : appr.status === "REJECTED" ? "bad" : "current") : "todo"}
                  sub={appr ? `${appr.ref} · ${x(statusMeta("approval", appr.status).label)}` : t("Not requested yet")}
                  to={appr ? R.approval(appr.id) : undefined}
                />
                <Follow icon={<ShoppingCart size={16} />} label={t("Purchase order")} state={po ? "done" : "todo"} sub={po ? `${po.ref} · ${x(statusMeta("po", po.status).label)}` : t("Issued after approval")} to={po ? R.order(po.id) : undefined} />
              </ol>
            ) : null}
          </div>
        </div>

        <div className="k-stack">
          <Panel title={t("Against the BOQ")} icon={<FileText size={15} />}>
            {budget > 0 ? (
              <div className="ps-vsboq">
                <BudgetBars net={net} budget={budget} />
                <p className="small">
                  {net <= budget ? (
                    <span className="k-text-ok">{t("{p}% under the BOQ rates, {a} AZN less before VAT.", { p: Math.round((1 - net / budget) * 100), a: fmtMoneyShort(budget - net) })}</span>
                  ) : (
                    <span className="k-text-bad">{t("{p}% over the BOQ rates, {a} AZN more before VAT.", { p: Math.round((net / budget - 1) * 100), a: fmtMoneyShort(net - budget) })}</span>
                  )}
                </p>
              </div>
            ) : (
              <p className="muted">{t("No BOQ rate for these lines.")}</p>
            )}
          </Panel>
          <Panel title={t("Terms")} icon={<FileText size={15} />}>
            <dl className="ps-terms">
              <div>
                <dt>{t("Delivery")}</dt>
                <dd>{t("{n} days", { n: q.deliveryDays })}</dd>
              </div>
              <div>
                <dt>{t("Payment terms")}</dt>
                <dd>{q.paymentTerms}</dd>
              </div>
              <div>
                <dt>{t("Price holds until")}</dt>
                <dd>{d(q.validUntil)}</dd>
              </div>
              <div>
                <dt>{t("Vendor score")}</dt>
                <dd>{v && v.overall > 0 ? `${v.overall.toFixed(1)} / 10` : "—"}</dd>
              </div>
            </dl>
            {q.notes ? <p className="k-note" style={{ marginTop: 12 }}>{x(q.notes)}</p> : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SumRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr className={strong ? "ps-sum strong" : "ps-sum"}>
      <td colSpan={4} style={{ textAlign: "right" }}>
        {label}
      </td>
      <td style={{ textAlign: "right" }} className="num-inline">
        {fmtMoney(value)}
      </td>
      <td className="hide-900" />
    </tr>
  );
}

function BudgetBars({ net, budget }: { net: number; budget: number }) {
  const { t } = useL();
  const max = Math.max(net, budget) || 1;
  return (
    <div className="ps-bb">
      <div>
        <span>{t("BOQ budget")}</span>
        <span className="ps-bb-track">
          <i className="k-grow-x ps-bb-budget" style={{ width: `${(budget / max) * 100}%` }} />
        </span>
        <b className="num-inline">{fmtMoneyShort(budget)}</b>
      </div>
      <div>
        <span>{t("This quote")}</span>
        <span className="ps-bb-track">
          <i className={`k-grow-x ps-bb-quote${net > budget ? " over" : ""}`} style={{ width: `${(net / max) * 100}%` }} />
        </span>
        <b className="num-inline">{fmtMoneyShort(net)}</b>
      </div>
    </div>
  );
}

function Follow({ icon, label, sub, state, to }: { icon: ReactNode; label: string; sub: string; state: "done" | "current" | "todo" | "bad"; to?: string }) {
  const inner = (
    <>
      <span className="ps-follow-icon">{icon}</span>
      <span className="ps-follow-text">
        <strong>{label}</strong>
        <small>{sub}</small>
      </span>
      {to ? <ArrowRight size={14} className="muted" /> : null}
    </>
  );
  return <li className={`ps-follow ${state}`}>{to ? <Link to={to}>{inner}</Link> : <div>{inner}</div>}</li>;
}


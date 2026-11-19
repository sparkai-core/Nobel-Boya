import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, BadgeCheck, Copy, ExternalLink, Globe, History, ListChecks, Mail, PauseCircle, Pencil, Phone, Plus, TrendingUp, User } from "lucide-react";
import { Badge, Breadcrumbs, DetailHeader, Empty, Kebab, KeyVals, Money, NextBar, PageHero, Panel, Sparkline, StatusBadge, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, monthShort, toDate, TODAY } from "../../../ops/dates";
import { grnShort, poLate, poTotal, R, statusMeta, tradeName, vendorStats } from "../../../ops/select";
import type { VendorStatus } from "../../../ops/types";
import { scoreLabel } from "./shared";
import { monthsFrom, onTimeOf } from "../purchasing/shared";
import { ChainLife } from "../purchasing/parts";
import { EditVendorDialog, PastProjectDialog, ScoreDialog } from "./VendorDialogs";
import { hasScore } from "../../../ops/ext/proc-client";
import { projectName } from "../../../lib/loc";

type Mark = { at: string; ref: string; to: string | null; tone: "brand" | "ok" | "bad" | "warn" | "muted" };

/** One vendor: the score and verdict, the record over time in five lanes, an AI brief before the next order, and portal access. */
export function VendorDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, lang } = useL();
  const s = useOps();
  const v = s.vendors.find((o) => o.id === id);
  const st = useMemo(() => (v ? vendorStats(s, v.id) : null), [s, v]);
  const [pickPo, setPickPo] = useState<string | null>(null);
  const [dlg, setDlg] = useState<"edit" | "score" | "past" | null>(null);

  const lanes = useMemo(() => {
    if (!v) return null;
    const asked: Mark[] = s.rfqs.flatMap((r) => r.invitations.filter((i) => i.vendorId === v.id).map((i) => ({ at: (i.at || r.createdAt).slice(0, 10), ref: r.ref, to: R.rfq(r.id), tone: (i.status === "DECLINED" ? "bad" : "brand") as Mark["tone"] })));
    const quoted: Mark[] = s.quotes.filter((q) => q.vendorId === v.id && !q.duplicate).map((q) => ({ at: q.receivedAt.slice(0, 10), ref: q.id, to: R.quote(q.id), tone: q.outcome === "WON" ? "ok" : q.outcome === "LOST" ? "muted" : "brand" }));
    const ordered: Mark[] = s.pos.filter((p) => p.vendorId === v.id && p.status !== "CANCELLED").map((p) => ({ at: p.issuedAt, ref: p.ref, to: R.order(p.id), tone: poLate(p) ? "bad" : "brand" }));
    const received: Mark[] = s.grns.filter((g) => g.vendorId === v.id && g.receivedAt).map((g) => ({ at: g.receivedAt!.slice(0, 10), ref: g.ref, to: R.receipt(g.id), tone: g.status === "REJECTED" ? "bad" : grnShort(g) ? "warn" : "ok" }));
    const paid: Mark[] = s.payments.filter((p) => p.vendorId === v.id && p.paidAt).map((p) => ({ at: p.paidAt!, ref: p.ref, to: R.payment(p.id), tone: "ok" }));
    const all = [...asked, ...quoted, ...ordered, ...received, ...paid].map((m) => m.at);
    const from = all.reduce((a, b) => (b < a ? b : a), addDays(TODAY, -60));
    const start = `${from.slice(0, 7)}-01`;
    const end = addDays(TODAY, 10);
    return {
      start,
      end,
      span: Math.max(1, diffDays(start, end)),
      rows: [
        { key: "asked", label: t("Asked"), marks: asked },
        { key: "quoted", label: t("Quoted"), marks: quoted },
        { key: "ordered", label: t("Ordered"), marks: ordered },
        { key: "received", label: t("Received"), marks: received },
        { key: "paid", label: t("Paid"), marks: paid },
      ],
    };
  }, [s, v, t]);

  if (!v || !st || !lanes) {
    return (
      <div className="k-page po-page">
        <PageHero eyebrow={t("Procurement · Vendors")} title={t("Vendor not found")} back={{ to: R.vendors, label: "Vendors" }} />
        <Empty title={t("This vendor does not exist.")} />
      </div>
    );
  }

  const label = scoreLabel(v.overall);
  const parts = [
    { key: "reliability", label: t("Reliability"), value: v.scores.reliability },
    { key: "quality", label: t("Quality"), value: v.scores.quality },
    { key: "price", label: t("Price"), value: v.scores.price },
    { key: "delivery", label: t("Delivery"), value: v.scores.delivery },
  ];
  const best = parts.reduce((a, b) => (b.value > a.value ? b : a));
  const worst = parts.reduce((a, b) => (b.value < a.value ? b : a));
  const scored = hasScore(v);
  const verdict =
    v.status === "DISQUALIFIED"
      ? t("Disqualified: do not invite to new RFQs.")
      : v.status === "ON_HOLD"
        ? t("On hold: orders wait until the hold is lifted.")
        : !scored
          ? t("Not scored yet. Score the vendor once you have worked with them.")
          : t("Strongest on {b} ({bv}), weakest on {w} ({wv}).", { b: best.label.toLowerCase(), bv: best.value, w: worst.label.toLowerCase(), wv: worst.value });

  // Brief before the next order, built from the record.
  const shortGrns = s.grns.filter((g) => g.vendorId === v.id && grnShort(g));
  const latePos = st.pos.filter(poLate);
  const onTime = v.history.filter((h) => h.onTime).length;
  const brief: { tone: "bad" | "warn" | "ok" | "brand"; text: string }[] = [];
  if (!v.licence) brief.push({ tone: "bad", text: t("No valid trade licence on file. Hold new orders until it is renewed.") });
  for (const p of latePos) brief.push({ tone: "bad", text: t("{po} is {n} days late on delivery.", { po: p.ref, n: diffDays(p.expectedAt, TODAY) }) });
  for (const g of shortGrns) {
    const reasons = [...new Set(g.lines.map((l) => l.shortReason).filter(Boolean))].map((r) => t(r === "DAMAGED" ? "damaged" : r === "WRONG_ITEM" ? "wrong item" : "not delivered"));
    brief.push({ tone: "warn", text: t("{grn} came in short ({r}).", { grn: g.ref, r: reasons.join(", ") || t("short") }) });
  }
  if (v.history.length) brief.push({ tone: onTime === v.history.length ? "ok" : "warn", text: t("{a} of {b} past projects delivered on time.", { a: onTime, b: v.history.length }) });
  if (v.avgDeliveryDays > 0) brief.push({ tone: scored && worst.value < 65 ? "warn" : "brand", text: t("Usual delivery is {n} days; plan the order date around it.", { n: v.avgDeliveryDays }) });
  if (!brief.length) brief.push({ tone: "brand", text: t("Nothing on record yet: no orders, receipts or notes.") });
  if (v.note) brief.push({ tone: "brand", text: x(v.note) });
  const advice = !v.licence || v.status !== "APPROVED" ? t("Do not place the next order until the papers and status are in order.") : latePos.length || shortGrns.length ? t("Order, but agree delivery dates in writing and count every load at the gate.") : t("Safe to order on the usual terms.");

  const setStatus = (status: VendorStatus) => {
    s.updateVendor(v.id, { status });
    toast(t("{v} is now {s}", { v: v.name, s: statusMeta("vendor", status).label[lang].toLowerCase() }), status === "APPROVED" ? "ok" : status === "ON_HOLD" ? "warn" : "bad");
  };
  const portalUrl = `${window.location.origin}${window.location.pathname}#/vendor?as=${v.id}`;

  const months: string[] = [];
  for (let m = lanes.start; m <= lanes.end; m = `${addDays(`${m.slice(0, 7)}-28`, 7).slice(0, 7)}-01`) months.push(m);
  const X = (iso: string) => `${(diffDays(lanes.start, iso) / lanes.span) * 100}%`;

  // Lifecycle of one of the vendor's orders (open one first), and the monthly trends.
  const vpos = [...st.pos].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const lifePo = vpos.find((p) => p.id === pickPo) ?? vpos.find((p) => p.status === "ISSUED" || p.status === "PART_RECEIVED") ?? vpos[0];
  const trendMonths = monthsFrom(addDays(TODAY, -182), TODAY);
  const spend = trendMonths.map((m) => st.pos.filter((p) => p.issuedAt.slice(0, 7) === m).reduce((a, p) => a + poTotal(p), 0));
  const firstRec = (poId: string) => s.grns.filter((g) => g.poId === poId && g.receivedAt && g.status !== "DRAFT").map((g) => g.receivedAt!.slice(0, 10)).sort()[0];
  const onTimeM = trendMonths.map((m) => onTimeOf(s, st.pos.filter((p) => firstRec(p.id)?.slice(0, 7) === m)));
  const onTimeAll = onTimeOf(s, st.pos);
  const spend6 = spend.reduce((a, b) => a + b, 0);

  return (
    <div className="k-page po-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Vendors"), to: R.vendors }, { label: v.name }]} />
      <DetailHeader
        refCode={v.id}
        badges={
          <>
            <StatusBadge kind="vendor" status={v.status} />
            <Badge tone={statusMeta("risk", v.risk).tone}>{statusMeta("risk", v.risk).label[lang]}</Badge>
            {v.portal ? <Badge tone="info">{t("On the portal")}</Badge> : null}
          </>
        }
        title={v.name}
        meta={
          <>
            <span>{[tradeName(v.trade, lang), v.city].filter(Boolean).join(" · ")}</span>
            <span>{t("On the register since {d}", { d: d(v.since) })}</span>
            {v.trn ? (
              <span>
                {t("TRN")} <span className="k-mono">{v.trn}</span>
              </span>
            ) : null}
          </>
        }
        aside={
          scored ? (
            <div className={`po-bigscore ${v.overall >= 8 ? "hi" : v.overall >= 6.5 ? "mid" : "lo"}`}>
              <strong className="num-inline">
                {v.overall.toFixed(1)}
                <small>/10</small>
              </strong>
              <span>{t(label)}</span>
            </div>
          ) : (
            <div className="po-bigscore">
              <strong className="num-inline">—</strong>
              <span>{t("Not scored")}</span>
            </div>
          )
        }
      >
        <p className="po-verdict-line">{verdict}</p>
      </DetailHeader>

      <NextBar text={advice} tone={!v.licence || v.status !== "APPROVED" ? "bad" : latePos.length || shortGrns.length ? "warn" : "ok"}>
        {v.status !== "APPROVED" ? (
          <button type="button" className="btn btn-primary" onClick={() => setStatus("APPROVED")}>
            <BadgeCheck size={15} />
            {t("Approve")}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={() => setDlg("edit")}>
          <Pencil size={15} />
          {t("Edit details")}
        </button>
        <Kebab
          items={[
            { label: t("Score this vendor"), icon: <ListChecks size={14} />, onClick: () => setDlg("score") },
            { label: t("Approve"), icon: <BadgeCheck size={14} />, disabled: v.status === "APPROVED", onClick: () => setStatus("APPROVED") },
            { label: t("Put on hold"), icon: <PauseCircle size={14} />, disabled: v.status === "ON_HOLD", onClick: () => setStatus("ON_HOLD") },
            { label: t("Disqualify"), icon: <Ban size={14} />, danger: true, disabled: v.status === "DISQUALIFIED", onClick: () => setStatus("DISQUALIFIED") },
          ]}
        />
      </NextBar>

      {lifePo ? (
        <ChainLife
          kind="PO"
          id={lifePo.id}
          title={t("Order lifecycle · {po}", { po: lifePo.ref })}
          extra={
            vpos.length > 1 ? (
              <div className="pur-life-chips" role="group" aria-label={t("Orders")}>
                {vpos.slice(0, 6).map((p) => (
                  <button key={p.id} type="button" className={p.id === lifePo.id ? "on" : undefined} aria-pressed={p.id === lifePo.id} onClick={() => setPickPo(p.id)}>
                    {p.ref}
                  </button>
                ))}
              </div>
            ) : null
          }
        />
      ) : null}

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Record")} icon={<History size={15} />} sub={t("Invitations, quotes, orders, receipts and payments since {d}.", { d: d(lanes.start) })}>
            <div className="po-rec-scroll">
              <div className="po-rec">
                <div className="po-rec-axis">
                  {months.map((m) => (
                    <span key={m} style={{ left: X(m) }}>
                      {monthShort(toDate(m).getUTCMonth(), lang)}
                    </span>
                  ))}
                  <b className="po-rec-today" style={{ left: X(TODAY) }}>
                    {t("Today")}
                  </b>
                </div>
                {lanes.rows.map((row) => (
                  <div key={row.key} className="po-rec-lane">
                    <span className="po-rec-label">
                      {row.label} <b className="num-inline">{row.marks.length}</b>
                    </span>
                    <span className="po-rec-track">
                      {row.marks.map((m, i) =>
                        m.to ? (
                          <Link key={`${m.ref}-${i}`} to={m.to} className={`po-rec-mark k-tone-${m.tone}`} style={{ left: X(m.at), animationDelay: `${i * 40}ms` }} title={`${m.ref} · ${d(m.at)}`} />
                        ) : null,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <section className="k-ai" aria-label={t("Before the next order")}>
            <span className="k-ai-tag">{t("From the record")}</span>
            <h2 className="po-ai-h">{t("Before the next order")}</h2>
            <ul className="po-brief">
              {brief.map((b, i) => (
                <li key={i} className={`k-tone-${b.tone} k-rise`} style={{ animationDelay: `${i * 80}ms` }}>
                  <i aria-hidden="true" />
                  {b.text}
                </li>
              ))}
            </ul>
            <p className="po-brief-advice">{advice}</p>
          </section>

          <Panel
            title={t("Past projects")}
            icon={<History size={15} />}
            pad={false}
            actions={
              <button type="button" className="k-link-btn" onClick={() => setDlg("past")}>
                <Plus size={13} /> {t("Add")}
              </button>
            }
          >
            <div className="po-tablewrap">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>{t("Project")}</th>
                    <th>{t("Year")}</th>
                    <th className="r">{t("Value")}</th>
                    <th>{t("Delivery")}</th>
                  </tr>
                </thead>
                <tbody>
                  {v.history.map((h, i) => (
                    <tr key={i}>
                      <td>{h.project}</td>
                      <td className="num-inline">{h.year}</td>
                      <td className="r">
                        <Money value={h.value} short />
                      </td>
                      <td>{h.onTime ? <Badge tone="ok">{t("On time")}</Badge> : <Badge tone="warn">{t("Late")}</Badge>}</td>
                    </tr>
                  ))}
                  {st.pos.length ? (
                    <tr className="po-row-hot">
                      <td>{t("{p} (this project)", { p: projectName(lang) })}</td>
                      <td className="num-inline">{st.pos.map((p) => p.issuedAt.slice(0, 4)).sort()[0]}</td>
                      <td className="r">
                        <Money value={st.ordered} short />
                      </td>
                      <td>{st.late ? <Badge tone="bad">{t("{n} late", { n: st.late })}</Badge> : <Badge tone="ok">{t("On time")}</Badge>}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {!v.history.length && !st.pos.length ? <p className="k-panel-body muted small">{t("No past projects on record yet.")}</p> : null}
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Spend and delivery")} icon={<TrendingUp size={15} />} sub={t("Last six months on this project.")}>
            <div className="pur-trend">
              <div className="pur-trend-head">
                <span>{t("Monthly spend")}</span>
                <b className="num-inline">
                  <Money value={spend6} short />
                </b>
              </div>
              {spend.some((v2) => v2 > 0) ? <Sparkline values={spend} width={300} height={46} tone="brand" /> : <p className="muted small">{t("No orders in the last six months.")}</p>}
              <div className="pur-trend-cols">
                {trendMonths.map((m, i) => (
                  <span key={m} title={`${m}: ${Math.round(spend[i] ?? 0).toLocaleString("en-GB")} AZN`}>
                    <i className="k-grow-y" style={{ height: `${(spend[i]! / Math.max(1, ...spend)) * 100}%` }} />
                    <small>{monthShort(toDate(`${m}-01`).getUTCMonth(), lang)}</small>
                  </span>
                ))}
              </div>
            </div>
            <div className="pur-trend">
              <div className="pur-trend-head">
                <span>{t("On-time delivery")}</span>
                <b className={`num-inline${onTimeAll.share == null ? "" : onTimeAll.share >= 0.85 ? " k-text-ok" : onTimeAll.share >= 0.6 ? " k-text-warn" : " k-text-bad"}`}>{onTimeAll.share == null ? "—" : `${Math.round(onTimeAll.share * 100)}%`}</b>
              </div>
              <div className="pur-trend-dots">
                {trendMonths.map((m, i) => {
                  const o = onTimeM[i]!;
                  const cls = o.share == null ? "none" : o.share >= 0.85 ? "ok" : o.share >= 0.6 ? "warn" : "bad";
                  return (
                    <span key={m} className={cls} title={o.share == null ? t("No deliveries") : t("{a} of {b} on time", { a: o.ok, b: o.done })}>
                      <i>{o.share == null ? "" : `${Math.round(o.share * 100)}`}</i>
                      <small>{monthShort(toDate(`${m}-01`).getUTCMonth(), lang)}</small>
                    </span>
                  );
                })}
              </div>
              <small className="muted">{onTimeAll.done ? t("{a} of {b} first deliveries arrived by the promised date.", { a: onTimeAll.ok, b: onTimeAll.done }) : t("No deliveries counted yet.")}</small>
            </div>
          </Panel>

          <Panel
            title={t("Score card")}
            icon={<BadgeCheck size={15} />}
            actions={
              <button type="button" className="k-link-btn" onClick={() => setDlg("score")}>
                {scored ? t("Change") : t("Score")}
              </button>
            }
          >
            {!scored ? <p className="muted small">{t("Not scored yet. Give each part a score from 0 to 100 once you have worked with the vendor.")}</p> : null}
            {scored ? (
            <ul className="po-scorecard">
              {parts.map((p) => (
                <li key={p.key}>
                  <span>{p.label}</span>
                  <span className="po-scorecard-track">
                    <i className={`k-grow-x ${p.value >= 80 ? "hi" : p.value >= 65 ? "mid" : "lo"}`} style={{ width: `${p.value}%` }} />
                  </span>
                  <b className="num-inline">{p.value}</b>
                </li>
              ))}
            </ul>
            ) : null}
            <KeyVals
              items={[
                { k: t("Orders"), v: st.pos.length },
                { k: t("Ordered"), v: <Money value={st.ordered} short /> },
                { k: t("Quotes"), v: t("{a} sent · {b} won", { a: st.quotes.length, b: st.won }) },
                { k: t("Paid"), v: <Money value={st.paid} short /> },
              ]}
            />
          </Panel>

          <Panel title={t("Contact")} icon={<User size={15} />}>
            <ul className="po-contact">
              <li>
                <User size={14} />
                {v.contact || "—"}
              </li>
              <li>
                <Mail size={14} />
                {v.email ? <a href={`mailto:${v.email}`}>{v.email}</a> : "—"}
              </li>
              <li>
                <Phone size={14} />
                {v.phone.replace(/[\s+]|994/g, "") ? <a href={`tel:${v.phone.replace(/\s/g, "")}`}>{v.phone}</a> : "—"}
              </li>
              {v.website ? (
                <li>
                  <Globe size={14} />
                  <span>{v.website}</span>
                </li>
              ) : null}
            </ul>
            <KeyVals
              items={[
                { k: t("Payment terms"), v: t(v.paymentTerms) },
                { k: t("Licence"), v: v.licence ? <span className="k-mono">{v.licence}</span> : <Badge tone="bad">{t("Missing")}</Badge> },
              ]}
            />
          </Panel>

          <Panel title={t("Portal access")} icon={<ExternalLink size={15} />}>
            <label className="po-switch po-switch-row">
              <input
                type="checkbox"
                checked={v.portal}
                onChange={(e) => {
                  s.updateVendor(v.id, { portal: e.target.checked });
                  toast(e.target.checked ? t("Portal access turned on for {v}", { v: v.name }) : t("Portal access turned off for {v}", { v: v.name }), e.target.checked ? "ok" : "neutral");
                }}
              />
              <span />
              <b>{v.portal ? t("Can use the vendor portal") : t("No portal access")}</b>
            </label>
            <p className="muted small po-mt">{t("On the portal the vendor answers RFQs, sends quotes, accepts orders and marks dispatch.")}</p>
            <div className="po-invite">
              <input className="input" readOnly value={portalUrl} aria-label={t("Invite link")} onFocus={(e) => e.currentTarget.select()} />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!v.portal}
                onClick={() => {
                  void navigator.clipboard?.writeText(portalUrl);
                  toast(t("Invite link copied"));
                }}
              >
                <Copy size={14} />
                {t("Copy")}
              </button>
            </div>
            <a className={`btn btn-primary btn-sm po-mt${v.portal ? "" : " po-disabled"}`} href={`#/vendor?as=${v.id}`} target="_blank" rel="noopener" aria-disabled={!v.portal} onClick={(e) => !v.portal && e.preventDefault()}>
              <ExternalLink size={14} />
              {t("Open the portal as this vendor")}
            </a>
          </Panel>
        </div>
      </div>
      <EditVendorDialog open={dlg === "edit"} onClose={() => setDlg(null)} vendor={v} />
      <ScoreDialog open={dlg === "score"} onClose={() => setDlg(null)} vendor={v} />
      <PastProjectDialog open={dlg === "past"} onClose={() => setDlg(null)} vendor={v} />
    </div>
  );
}

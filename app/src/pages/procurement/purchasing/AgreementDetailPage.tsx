import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, CalendarPlus, FileSignature, FileText, LineChart, PlayCircle, ShoppingCart, Store, Tags } from "lucide-react";
import { Avatar, Breadcrumbs, DetailHeader, Empty, Kebab, KeyFigure, KeyVals, Money, NextBar, PageHero, Panel, StatusBadge, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { poReceivedShare, poTotal, R, tradeName } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import type { Agreement, PurchaseOrder } from "../../../ops/types";
import { addMonths, agrOpen, agrPos, agrSaved, agrState, agrUsed, matOf, PR } from "./shared";
import { AgrStatus, CapMeter, ValidityBar, VarChip } from "./parts";

/** One framework agreement: price list against BOQ rates, call-offs, spend over time against the cap, and terms. */
export function AgreementDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const a = s.agreements.find((g) => g.id === id);

  if (!a) {
    return (
      <div className="k-page pur-page">
        <PageHero eyebrow={t("Procurement · Purchasing")} title={t("Agreement not found")} back={{ to: PR.agreements, label: "Framework agreements" }} />
        <Empty title={t("This agreement does not exist.")} />
      </div>
    );
  }

  const v = s.vendors.find((y) => y.id === a.vendorId);
  const st = agrState(a);
  const used = agrUsed(s, a);
  const pos = agrPos(s, a).sort((p, q) => p.issuedAt.localeCompare(q.issuedAt));
  const saved = agrSaved(s, a);
  const left = a.cap - used;
  const daysLeft = diffDays(TODAY, a.to);
  const canCall = agrOpen(a);

  const extend = () => {
    const to = addMonths(a.to, 3);
    s.patchItem("agreements", a.id, { to, status: a.status === "DRAFT" ? "DRAFT" : "ACTIVE" });
    s.pushFeed("PROC", { en: `${a.ref} extended to ${to}`, az: `${a.ref} ${to} tarixinədək uzadıldı` }, `procurement/agreements/${a.id}`);
    toast(t("{ref} extended to {d}", { ref: a.ref, d: d(to) }));
  };
  const expire = () => {
    s.patchItem("agreements", a.id, { status: "EXPIRED" });
    s.pushFeed("PROC", { en: `${a.ref} marked expired`, az: `${a.ref} müddəti bitmiş kimi qeyd edildi` }, `procurement/agreements/${a.id}`);
    toast(t("{ref} marked expired. No more call-offs.", { ref: a.ref }), "warn");
  };
  const activate = () => {
    s.patchItem("agreements", a.id, { status: "ACTIVE" });
    s.pushFeed("PROC", { en: `${a.ref} activated with ${v?.name ?? a.vendorId}`, az: `${a.ref} ${v?.name ?? a.vendorId} ilə qüvvəyə mindi` }, `procurement/agreements/${a.id}`);
    toast(t("{ref} is active. Call-offs can start.", { ref: a.ref }));
  };

  const next =
    st === "DRAFT"
      ? { text: t("Draft. Activate it to start call-offs at these rates."), tone: "muted" as const }
      : st === "EXPIRED"
        ? { text: t("Expired. New orders need quotes or a new agreement."), tone: "muted" as const }
        : st === "EXPIRING"
          ? { text: t("Ends in {n} days with {v} left on the cap. Extend it or prepare a new tender.", { n: daysLeft, v: `${fmtMoneyShort(Math.max(0, left))} AZN` }), tone: "warn" as const }
          : TODAY < a.from
            ? { text: t("Starts {d}. Call-offs open then.", { d: d(a.from) }), tone: "brand" as const }
            : left < 0
              ? { text: t("Over the cap by {v}. Extend the cap before the next call-off.", { v: `${fmtMoneyShort(-left)} AZN` }), tone: "bad" as const }
              : { text: t("Call off at agreed rates. {v} left on the cap.", { v: `${fmtMoneyShort(left)} AZN` }), tone: "ok" as const };

  return (
    <div className="k-page pur-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Framework agreements"), to: PR.agreements }, { label: a.ref }]} />
      <DetailHeader
        refCode={a.ref}
        badges={
          <>
            <AgrStatus a={a} />
            <span className="k-mono muted small">{a.id}</span>
          </>
        }
        title={x(a.title)}
        meta={
          <>
            <span>
              <Link to={R.vendor(a.vendorId)}>{v?.name ?? a.vendorId}</Link>
            </span>
            <span>
              {d(a.from)} → {d(a.to)}
            </span>
            <span>{t("{n} rates", { n: a.rates.length })}</span>
          </>
        }
        aside={<KeyFigure label={t("Cap used")} value={a.cap ? `${Math.round((used / a.cap) * 100)}%` : "—"} sub={`${fmtMoneyShort(used)} / ${fmtMoneyShort(a.cap)} AZN`} tone={left < 0 ? "bad" : used / (a.cap || 1) > 0.85 ? "warn" : undefined} />}
      >
        <ValidityBar a={a} />
      </DetailHeader>

      <NextBar text={next.text} tone={next.tone}>
        {st === "DRAFT" ? (
          <button type="button" className="btn btn-primary" onClick={activate}>
            <PlayCircle size={15} />
            {t("Activate")}
          </button>
        ) : st === "EXPIRED" ? (
          <button type="button" className="btn btn-primary" onClick={extend}>
            <CalendarPlus size={15} />
            {t("Extend 3 months")}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!canCall} onClick={() => navigate(PR.newOrder({ agreement: a.id }))}>
            <ShoppingCart size={15} />
            {t("Call off")}
          </button>
        )}
        <Kebab
          items={[
            { label: t("Extend 3 months"), icon: <CalendarPlus size={14} />, onClick: extend },
            { label: t("Activate"), icon: <PlayCircle size={14} />, disabled: a.status !== "DRAFT", onClick: activate },
            { label: t("Mark expired"), icon: <Ban size={14} />, danger: true, disabled: st === "EXPIRED", onClick: expire },
            { label: t("Open vendor"), icon: <Store size={14} />, onClick: () => navigate(R.vendor(a.vendorId)) },
          ]}
        />
      </NextBar>

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Rates")} icon={<Tags size={15} />} count={a.rates.length} pad={false} sub={t("Agreed rates against the BOQ sample rates. Green is cheaper than the budget.")}>
            <div className="pur-tablewrap">
              <table className="pur-table">
                <thead>
                  <tr>
                    <th>{t("Material")}</th>
                    <th>{t("Unit")}</th>
                    <th className="r">{t("Agreement rate")}</th>
                    <th className="r">{t("BOQ rate")}</th>
                    <th className="r">{t("Saving")}</th>
                    <th className="r">{t("Min qty")}</th>
                    <th className="r">{t("Called off")}</th>
                  </tr>
                </thead>
                <tbody>
                  {a.rates.map((r) => {
                    const m = matOf(s, r.material);
                    const qty = pos.reduce((q, p) => q + p.lines.filter((l) => l.material === r.material).reduce((y, l) => y + l.qty, 0), 0);
                    const sameUnit = m && m.unit === r.unit;
                    return (
                      <tr key={r.material}>
                        <td>{m ? <Link to={PR.material(m.key)}>{x(m.name)}</Link> : <span className="k-mono">{r.material}</span>}</td>
                        <td>{unitLabel(r.unit, lang)}</td>
                        <td className="r num-inline">
                          <b>{fmtMoney(r.rate)}</b>
                        </td>
                        <td className="r num-inline muted">{m && sameUnit ? fmtMoney(m.rate) : "—"}</td>
                        <td className="r">{m && sameUnit ? <VarChip rate={r.rate} boq={m.rate} /> : <span className="muted small">{t("other unit")}</span>}</td>
                        <td className="r num-inline">{fmtQty(r.minQty, r.unit)}</td>
                        <td className="r num-inline">{qty ? fmtQty(qty, r.unit) : <span className="muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title={t("Spend over time")} icon={<LineChart size={15} />} sub={t("Committed spend against the cap. The dashed line is an even spend over the term.")}>
            <SpendChart a={a} pos={pos} />
          </Panel>

          <Panel title={t("Call-offs")} icon={<ShoppingCart size={15} />} count={pos.length} pad={false}>
            {pos.length ? (
              <ul className="pur-calloffs">
                {pos.map((p) => {
                  const share = poReceivedShare(p);
                  return (
                    <li key={p.id}>
                      <Link to={R.order(p.id)}>
                        <span className="k-ref">{p.ref}</span>
                        <span className="muted small">{d(p.issuedAt)}</span>
                        <span className="pur-calloff-bar" title={t("{p}% received", { p: Math.round(share * 100) })}>
                          <i className="k-grow-x" style={{ width: `${share * 100}%` }} />
                        </span>
                        <Money value={poTotal(p)} short />
                        <StatusBadge kind="po" status={p.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="k-panel-body muted small">{t("No call-offs yet.")}</p>
            )}
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Money")} icon={<FileSignature size={15} />}>
            <CapMeter used={used} cap={a.cap} />
            <KeyVals
              cols={2}
              items={[
                { k: t("Cap"), v: <Money value={a.cap} short /> },
                { k: t("Committed"), v: <Money value={used} short /> },
                { k: t("Left"), v: <span className={left < 0 ? "k-text-bad" : undefined}><Money value={left} short /></span> },
                { k: t("Saved vs BOQ"), v: <span className={saved >= 0 ? "k-text-ok" : "k-text-bad"}><Money value={saved} short /></span> },
              ]}
            />
          </Panel>

          <Panel title={t("Terms")} icon={<FileText size={15} />}>
            <p className="pur-terms">{x(a.terms)}</p>
            <KeyVals
              cols={1}
              items={[
                { k: t("Valid"), v: `${d(a.from)} → ${d(a.to)}` },
                { k: t("Payment terms"), v: v?.paymentTerms ?? "—" },
              ]}
            />
          </Panel>

          {v ? (
            <Panel title={t("Vendor")} icon={<Store size={15} />}>
              <div className="pur-vmini">
                <Avatar name={v.name} size={36} />
                <div>
                  <Link to={R.vendor(v.id)}>{v.name}</Link>
                  <small>
                    {[tradeName(v.trade, lang), v.city, v.overall > 0 ? t("score {n}", { n: v.overall.toFixed(1) }) : ""].filter(Boolean).join(" · ")}
                  </small>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Cumulative committed spend (steps at each call-off) against the cap and an even-spend line. */
function SpendChart({ a, pos }: { a: Agreement; pos: PurchaseOrder[] }) {
  const { t, d } = useL();
  const W = 640;
  const H = 210;
  const pad = { l: 46, r: 16, t: 14, b: 26 };
  const span = Math.max(1, diffDays(a.from, a.to));
  let acc = 0;
  const pts = pos.map((p) => ({ date: p.issuedAt < a.from ? a.from : p.issuedAt, v: (acc += poTotal(p)), ref: p.ref }));
  const top = Math.max(a.cap, acc, 1) * 1.12;
  const X = (iso: string) => pad.l + (Math.max(0, Math.min(span, diffDays(a.from, iso))) / span) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const end = TODAY < a.from ? a.from : TODAY > a.to ? a.to : TODAY;
  let path = `M${X(a.from)} ${Y(0)}`;
  let prev = 0;
  for (const p of pts) {
    path += ` L${X(p.date)} ${Y(prev)} L${X(p.date)} ${Y(p.v)}`;
    prev = p.v;
  }
  path += ` L${X(end)} ${Y(prev)}`;
  const area = `${path} L${X(end)} ${Y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * a.cap);
  return (
    <div className="pur-spend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Spend over time")}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} className="pur-grid" />
            <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" className="pur-axis">
              {fmtMoneyShort(v)}
            </text>
          </g>
        ))}
        <line x1={X(a.from)} x2={X(a.to)} y1={Y(0)} y2={Y(a.cap)} className="pur-plan" />
        <line x1={pad.l} x2={W - pad.r} y1={Y(a.cap)} y2={Y(a.cap)} className="pur-capline" />
        <text x={W - pad.r} y={Y(a.cap) - 5} textAnchor="end" className="pur-axis pur-capl">
          {t("Cap")}
        </text>
        <path d={area} className="pur-area" />
        <path d={path} className="pur-spendline" />
        {pts.map((p) => (
          <circle key={p.ref} cx={X(p.date)} cy={Y(p.v)} r={4.5} className="pur-dot">
            <title>{`${p.ref} · ${d(p.date)} · ${fmtMoneyShort(p.v)} AZN`}</title>
          </circle>
        ))}
        {TODAY >= a.from && TODAY <= a.to ? <line x1={X(TODAY)} x2={X(TODAY)} y1={pad.t} y2={H - pad.b} className="pur-todayl" /> : null}
        <text x={X(a.from)} y={H - 7} className="pur-axis">
          {d(a.from, false)}
        </text>
        <text x={X(a.to)} y={H - 7} textAnchor="end" className="pur-axis">
          {d(a.to, false)}
        </text>
        {TODAY > a.from && TODAY < a.to && diffDays(a.from, TODAY) / span > 0.12 && diffDays(TODAY, a.to) / span > 0.12 ? (
          <text x={X(TODAY)} y={H - 7} textAnchor="middle" className="pur-axis pur-todayt">
            {t("Today")}
          </text>
        ) : null}
      </svg>
      <div className="k-legend">
        <span className="pur-lg-spend">{t("Committed")}</span>
        <span className="pur-lg-plan">{t("Even spend")}</span>
        <span className="pur-lg-cap">{t("Cap")}</span>
      </div>
    </div>
  );
}

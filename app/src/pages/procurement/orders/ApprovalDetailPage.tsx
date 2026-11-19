import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Award, BadgeCheck, Check, FileText, Scale, ShieldAlert, X } from "lucide-react";
import {
  ApprovalPath,
  Badge,
  DetailHeader,
  Dialog,
  Empty,
  Field,
  Kebab,
  KeyFigure,
  KeyVals,
  Money,
  NextBar,
  PageHero,
  Panel,
  StatusBadge,
  StatusSteps,
  toast,
  Trail,
  useL,
  type PathStep,
} from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { decideApprovalAt, hasScore } from "../../../ops/ext/proc-client";
import { APPROVAL_LIMIT, diffDays, TODAY } from "../../../ops/dates";
import { PATHS, PRESETS, quoteNet, quoteTotal, R, scoreQuotes, statusMeta, trailOf } from "../../../ops/select";
import { fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import { BackLink, quoteBudget, vendorName } from "./shared";

/** One approval: who signs and when, why this vendor, the amount against the limit and the budget, and the decision. */
export function ApprovalDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, stamp, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const a = s.approvals.find((v) => v.id === id);
  const q = a ? s.quotes.find((v) => v.id === a.quoteId) : undefined;
  const [mode, setMode] = useState<"APPROVE" | "REJECT" | null>(null);
  const [notes, setNotes] = useState("");

  const scored = useMemo(() => {
    if (!q?.rfqId) return [];
    return scoreQuotes(s, s.quotes.filter((v) => v.rfqId === q.rfqId), PRESETS.best.weights);
  }, [s, q]);

  if (!a || !q) {
    return (
      <div className="k-page po-page">
        <PageHero eyebrow={t("Procurement · Approvals")} title={t("Approval not found")} back={{ to: R.approvals, label: "Approvals" }} />
        <Empty title={t("This approval does not exist.")} />
      </div>
    );
  }

  const vendor = s.vendors.find((v) => v.id === a.vendorId);
  const rfq = q.rfqId ? s.rfqs.find((r) => r.id === q.rfqId) : undefined;
  const budget = quoteBudget(s, q) * (1 + q.vatRate);
  const last = a.level + 1 >= a.requiredLevels;
  const pending = a.status === "PENDING";
  const openChecks = q.checks.filter((c) => c.result !== "PASSED");
  const top = scored[0];
  const agrees = !top || top.quote.id === q.id;
  const scaleMax = Math.max(a.amount, APPROVAL_LIMIT, budget) * 1.15;

  const steps: PathStep[] = [
    { label: t("Requested"), who: a.requestedBy, at: stamp(a.requestedAt), state: "done" },
    {
      label: t("First approval"),
      who: a.firstBy ?? (pending ? t("Waiting") : "—"),
      at: a.firstAt ? stamp(a.firstAt) : undefined,
      state: a.level >= 1 || (a.status === "APPROVED" && a.requiredLevels === 1) ? "done" : a.status === "REJECTED" ? "rejected" : "current",
    },
    ...(a.requiredLevels === 2
      ? [
          {
            label: t("Final approval"),
            who: a.status === "APPROVED" ? (a.finalBy ?? "—") : a.status === "REJECTED" && a.level >= 1 ? (a.finalBy ?? "—") : t("Final approver"),
            at: a.status === "APPROVED" && a.finalAt ? stamp(a.finalAt) : undefined,
            state: (a.status === "APPROVED" ? "done" : a.status === "REJECTED" && a.level >= 1 ? "rejected" : a.level >= 1 ? "current" : "todo") as PathStep["state"],
          },
        ]
      : []),
    { label: t("Purchase order"), who: a.poId ? <Link to={R.order(a.poId)}>{a.poId}</Link> : "—", state: a.poId ? "done" : "todo" },
  ];

  const decide = () => {
    if (!mode) return;
    const poId = decideApprovalAt(a.id, mode, notes.trim() || undefined);
    setMode(null);
    setNotes("");
    if (mode === "REJECT") toast(t("{ref} rejected", { ref: a.ref }), "bad");
    else if (poId) toast(t("{po} issued", { po: poId }), "ok", { label: t("Open order"), onClick: () => navigate(R.order(poId)) });
    else toast(t("First approval given on {ref}. It now needs the final signature.", { ref: a.ref }), "brand");
  };

  const nextText = pending
    ? last
      ? t("Your signature is the last one. Approving issues the purchase order to {v}.", { v: vendor?.name ?? "" })
      : t("This needs two signatures (company rule). Yours is the first; the final approver signs after you.")
    : a.status === "APPROVED"
      ? t("Approved. The order {po} is with the vendor.", { po: a.poId ?? "" })
      : t("Rejected. The buyer can send another quote for approval.");

  return (
    <div className="k-page po-page">
      <BackLink to={R.approvals} label="Approvals" />
      <DetailHeader
        refCode={a.ref}
        badges={
          <>
            <StatusBadge kind="approval" status={a.status} />
            <Badge tone={a.requiredLevels === 2 ? "warn" : "neutral"}>{a.requiredLevels === 2 ? t("Two signatures") : t("One signature")}</Badge>
          </>
        }
        title={x(a.title)}
        meta={
          <>
            <span>{vendor ? <Link to={R.vendor(vendor.id)}>{vendor.name}</Link> : null}</span>
            <span>{t("Requested by {n}", { n: a.requestedBy })}</span>
            <span>{d(a.requestedAt)}</span>
          </>
        }
        aside={<KeyFigure label={t("Amount incl. VAT")} value={<Money value={a.amount} />} sub={t("Quote {ref}", { ref: q.ref })} />}
      >
        <StatusSteps kind="approval" path={a.status === "REJECTED" ? ["PENDING", "REJECTED"] : PATHS.approval} status={a.status} rejected={a.status === "REJECTED"} />
      </DetailHeader>

      <NextBar text={nextText} tone={pending ? "brand" : a.status === "APPROVED" ? "ok" : "bad"}>
        {pending ? (
          <>
            <button type="button" className="btn btn-primary" onClick={() => setMode("APPROVE")}>
              <Check size={15} />
              {last ? t("Approve and issue the order") : t("Approve")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("REJECT")}>
              <X size={15} />
              {t("Reject")}
            </button>
          </>
        ) : a.poId ? (
          <button type="button" className="btn btn-primary" onClick={() => navigate(R.order(a.poId!))}>
            {t("Open order")}
          </button>
        ) : null}
        <Kebab
          items={[
            { label: t("Open the quote"), icon: <FileText size={14} />, onClick: () => navigate(R.quote(q.id)) },
            { label: t("Compare quotes"), icon: <Scale size={14} />, disabled: !rfq, onClick: () => navigate(R.compare(rfq?.id)) },
            { label: t("Open vendor"), icon: <Award size={14} />, onClick: () => navigate(R.vendor(a.vendorId)) },
          ]}
        />
      </NextBar>

      <Trail steps={trailOf(s, "APPROVAL", a.id)} current={a.id} />

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Approval path")} icon={<BadgeCheck size={15} />}>
            <ApprovalPath steps={steps} />
            {a.notes ? <p className="k-note po-mt">{a.notes}</p> : null}
          </Panel>

          <Panel title={t("Why this vendor")} icon={<Award size={15} />} sub={rfq ? t("Quotes received for {ref}, scored on price, delivery, record, reliability and risk.", { ref: rfq.ref }) : undefined} pad={false}>
            {scored.length > 1 ? (
              <>
                <ul className="po-why">
                  {scored.map((r) => {
                    const me = r.quote.id === q.id;
                    return (
                      <li key={r.quote.id} className={me ? "me" : undefined}>
                        <span className="po-why-rank">{r.rank}</span>
                        <span className="po-why-name">
                          <strong className="truncate">{r.vendor.name}</strong>
                          <small>
                            {t("{n} days delivery", { n: r.quote.deliveryDays })}
                            {r.tags.includes("cheapest") ? ` · ${t("cheapest")}` : ""}
                            {r.tags.includes("check") ? ` · ${t("needs a check")}` : ""}
                          </small>
                        </span>
                        <Money value={r.total} short />
                        <span className="po-why-score" style={{ ["--p" as string]: `${r.score}%` }}>
                          <b className="num-inline">{r.score}</b>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className={`k-callout po-why-verdict k-tone-${agrees ? "ok" : "warn"}`}>
                  {agrees ? <Check size={15} /> : <ShieldAlert size={15} />}
                  <span>
                    {agrees
                      ? t("The recommendation agrees: this quote scores highest on the balanced weighting.")
                      : t("The scoring prefers {v} ({n} points). Check the reason in the notes before signing.", { v: top!.vendor.name, n: top!.score })}
                  </span>
                </div>
              </>
            ) : (
              <p className="k-panel-body muted">{t("Single quote: there was no competing offer for this purchase.")}</p>
            )}
          </Panel>

          <Panel title={t("What is being bought")} icon={<FileText size={15} />} pad={false}>
            <div className="po-tablewrap">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("Description")}</th>
                    <th className="r">{t("Qty")}</th>
                    <th className="r">{t("Rate")}</th>
                    <th className="r">{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {q.lines.map((l, i) => (
                    <tr key={l.key}>
                      <td className="muted">{i + 1}</td>
                      <td>{x(l.description)}</td>
                      <td className="r num-inline">
                        {fmtQty(l.qty, l.unit)} <small className="muted">{unitLabel(l.unit, lang)}</small>
                      </td>
                      <td className="r num-inline">{l.unitPrice.toFixed(2)}</td>
                      <td className="r num-inline">{fmtMoneyShort(l.qty * l.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="r">{t("Net")}</td>
                    <td className="r num-inline">{fmtMoneyShort(quoteNet(q))}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="r">{t("Quote total incl. VAT and shipping")}</td>
                    <td className="r num-inline">
                      <b>{fmtMoneyShort(quoteTotal(q))}</b>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="k-panel-body">
              <KeyVals
                items={[
                  { k: t("Delivery"), v: t("{n} days after the order", { n: q.deliveryDays }) },
                  { k: t("Payment terms"), v: q.paymentTerms },
                  { k: t("Price holds until"), v: <span className={diffDays(TODAY, q.validUntil) < 7 ? "k-text-bad" : undefined}>{d(q.validUntil)}</span> },
                  { k: t("Shipping"), v: <Money value={q.shipping} /> },
                ]}
              />
            </div>
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Against the limit")} icon={<Scale size={15} />}>
            <div className="po-scale">
              <div className="po-scale-track">
                <i className="po-scale-fill k-grow-x" style={{ width: `${(a.amount / scaleMax) * 100}%` }} />
                <span className="po-scale-mark limit" style={{ left: `${(APPROVAL_LIMIT / scaleMax) * 100}%` }}>
                  <em>{t("Limit")}</em>
                </span>
                {budget > 0 ? (
                  <span className="po-scale-mark budget" style={{ left: `${(budget / scaleMax) * 100}%` }}>
                    <em>{t("BOQ")}</em>
                  </span>
                ) : null}
              </div>
              <dl className="po-scale-key">
                <div>
                  <dt>{t("This request")}</dt>
                  <dd className="num-inline">{fmtMoneyShort(a.amount)}</dd>
                </div>
                <div>
                  <dt>{t("Two-signature limit (company rule)")}</dt>
                  <dd className="num-inline">{fmtMoneyShort(APPROVAL_LIMIT)}</dd>
                </div>
                <div>
                  <dt>{t("BOQ budget incl. VAT")}</dt>
                  <dd className="num-inline">{budget > 0 ? fmtMoneyShort(budget) : "—"}</dd>
                </div>
              </dl>
              <p className="po-scale-say">
                {a.amount > APPROVAL_LIMIT ? t("{v} above the limit, so two signatures are needed.", { v: fmtMoneyShort(a.amount - APPROVAL_LIMIT) }) : t("Within the limit: one signature is enough.")}{" "}
                {budget > 0
                  ? a.amount <= budget
                    ? t("{p}% under the BOQ budget.", { p: Math.round((1 - a.amount / budget) * 100) })
                    : t("{p}% over the BOQ budget.", { p: Math.round((a.amount / budget - 1) * 100) })
                  : t("No BOQ line to compare with.")}
              </p>
            </div>
          </Panel>

          <Panel title={t("Open checks")} icon={<ShieldAlert size={15} />} count={openChecks.length}>
            {openChecks.length ? (
              <ul className="po-checks">
                {openChecks.map((c, i) => (
                  <li key={i} className={c.result === "FAILED" ? "bad" : "warn"}>
                    <strong>{x(c.label)}</strong>
                    <small>{x(c.detail)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t("Every automatic check passed.")}</p>
            )}
          </Panel>

          {vendor ? (
            <Panel title={t("Vendor")} icon={<Award size={15} />}>
              <KeyVals
                cols={2}
                items={[
                  { k: t("Score"), v: hasScore(vendor) ? <b className="num-inline">{vendor.overall.toFixed(1)} / 10</b> : t("Not scored") },
                  { k: t("Risk"), v: x(statusMeta("risk", vendor.risk).label) },
                  { k: t("Status"), v: <StatusBadge kind="vendor" status={vendor.status} /> },
                  { k: t("Usual delivery"), v: vendor.avgDeliveryDays > 0 ? t("{n} days", { n: vendor.avgDeliveryDays }) : "—" },
                ]}
              />
            </Panel>
          ) : null}
        </div>
      </div>

      <Dialog
        open={mode != null}
        onClose={() => setMode(null)}
        kicker={a.ref}
        title={mode === "REJECT" ? t("Reject this request") : last ? t("Approve and issue the order") : t("Give the first approval")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={decide} disabled={mode === "REJECT" && !notes.trim()}>
              {mode === "REJECT" ? t("Reject") : last ? t("Approve and issue the order") : t("Approve")}
            </button>
          </>
        }
      >
        <p className="po-dialog-lead">
          {mode === "REJECT"
            ? t("The buyer is told why. The quote stays on file.")
            : last
              ? t("A purchase order goes to {v} for {amt}. A delivery payment is scheduled.", { v: vendorName(s, a.vendorId), amt: `${fmtMoneyShort(a.amount)} AZN` })
              : t("Your signature is recorded and the request moves to the final approver.")}
        </p>
        <Field label={mode === "REJECT" ? t("Reason") : t("Notes (optional)")}>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={mode === "REJECT" ? t("Why it is rejected") : t("Anything the next person should know")} />
        </Field>
      </Dialog>
    </div>
  );
}

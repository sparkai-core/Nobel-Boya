import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronDown, Clock3, ShieldAlert, Trophy, Wallet } from "lucide-react";
import { Avatar, Badge, RingGauge, useL } from "../../../components/kit";
import { FACTOR_LABEL, FACTORS, quoteNet, R, statusMeta, type Scored, type Weights } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import type { Approval, Line } from "../../../ops/types";

const TAG: Record<Scored["tags"][number], { label: string; tone: "brand" | "ok" | "info" | "warn" }> = {
  top: { label: "Top pick", tone: "brand" },
  cheapest: { label: "Cheapest", tone: "ok" },
  fastest: { label: "Fastest", tone: "info" },
  check: { label: "Check first", tone: "warn" },
};

/** One vendor's scored quote: ring that counts up, tags, key figures and the factor breakdown. */
export function VendorCard({ row, weights, big, run, lowest, children }: { row: Scored; weights: Weights; big?: boolean; run: number; lowest: number; children?: ReactNode }) {
  const { t, x } = useL();
  const [open, setOpen] = useState(false);
  const wsum = FACTORS.reduce((a, f) => a + weights[f], 0) || 1;
  const risk = statusMeta("risk", row.quote.risk === "LOW" ? row.vendor.risk : row.quote.risk);
  const gap = row.total / Math.max(1, lowest) - 1;
  return (
    <article className={`ps-vcard${big ? " big" : ""}${row.rank === 1 ? " top" : ""}`} style={{ animationDelay: `${(row.rank - 1) * 80}ms` }}>
      <header className="ps-vcard-head">
        <span className="ps-vcard-rank num-inline">{row.rank === 1 ? <Trophy size={14} /> : `#${row.rank}`}</span>
        <Avatar name={row.vendor.name} size={big ? 36 : 28} />
        <span className="ps-vcard-name">
          <Link to={R.quote(row.quote.id)} className="truncate">
            {row.vendor.name}
          </Link>
          <small>
            {row.quote.ref} · {row.quote.id}
          </small>
        </span>
      </header>
      <div className="ps-vcard-tags">
        {row.tags.map((tg) => (
          <Badge key={tg} tone={TAG[tg].tone}>
            {t(TAG[tg].label)}
          </Badge>
        ))}
      </div>
      <div className="ps-vcard-body">
        <button type="button" className="ps-ringbtn" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={t("Show how the score is made")}>
          <RingGauge key={run} value={row.score} size={big ? 132 : 92} stroke={big ? 11 : 8} tone={row.rank === 1 ? "brand" : row.score >= 70 ? "info" : "muted"} label={t("of 100")} />
          <span className="ps-ringbtn-hint">
            {t("How it scores")}
            <ChevronDown size={12} className={open ? "flip" : undefined} />
          </span>
        </button>
        <dl className="ps-vcard-figs">
          <div>
            <dt>
              <Wallet size={12} />
              {t("Total")}
            </dt>
            <dd className="num-inline">{fmtMoneyShort(row.total)}</dd>
            <small className={gap <= 0.0001 ? "k-text-ok" : "muted"}>{gap <= 0.0001 ? t("Lowest") : t("+{p}% over lowest", { p: Math.max(1, Math.round(gap * 100)) })}</small>
          </div>
          <div>
            <dt>
              <Clock3 size={12} />
              {t("Delivery")}
            </dt>
            <dd className="num-inline">{t("{n} days", { n: row.quote.deliveryDays })}</dd>
          </div>
          <div>
            <dt>
              <BadgeCheck size={12} />
              {t("Vendor score")}
            </dt>
            <dd className="num-inline">{row.vendor.overall > 0 ? `${row.vendor.overall.toFixed(1)}/10` : "—"}</dd>
          </div>
          <div>
            <dt>
              <ShieldAlert size={12} />
              {t("Risk")}
            </dt>
            <dd>
              <span className={`k-text-${risk.tone}`}>{x(risk.label)}</span>
            </dd>
          </div>
        </dl>
      </div>
      {open ? (
        <table className="ps-factors k-rise">
          <thead>
            <tr>
              <th>{t("Factor")}</th>
              <th className="r">{t("Score")}</th>
              <th className="r">{t("Weight")}</th>
              <th className="r">{t("Points")}</th>
            </tr>
          </thead>
          <tbody>
            {FACTORS.map((f) => (
              <tr key={f}>
                <td>{x(FACTOR_LABEL[f])}</td>
                <td className="r num-inline">
                  <span className="ps-fbar">
                    <i style={{ width: `${row.factors[f]}%` }} />
                  </span>
                  {row.factors[f]}
                </td>
                <td className="r num-inline">{Math.round((weights[f] / wsum) * 100)}%</td>
                <td className="r num-inline">{((row.factors[f] * weights[f]) / wsum).toFixed(1)}</td>
              </tr>
            ))}
            <tr className="sum">
              <td colSpan={3}>{t("Score")}</td>
              <td className="r num-inline">{row.score}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
      {children}
    </article>
  );
}

/** State of an approval already raised in this scope. */
export function ApprovalState({ appr }: { appr: Approval }) {
  const { t, x } = useL();
  const meta = statusMeta("approval", appr.status);
  return (
    <div className={`ps-apprstate k-tone-${meta.tone}`}>
      <BadgeCheck size={16} />
      <span>
        <strong>
          {appr.ref} · {x(meta.label)}
        </strong>
        <small>{appr.status === "APPROVED" && appr.poId ? t("{po} issued", { po: appr.poId }) : t("{n} of {m} signatures", { n: appr.level, m: appr.requiredLevels })}</small>
      </span>
      <Link to={appr.poId ? R.order(appr.poId) : R.approval(appr.id)} className="btn btn-ghost btn-sm">
        {appr.poId ? t("Open the order") : t("Open the approval")}
      </Link>
    </div>
  );
}

/** Lines × vendors with the best unit price per row highlighted, then totals and terms. */
export function LineGrid({ rows, lines }: { rows: Scored[]; lines: Pick<Line, "description" | "qty" | "unit">[] }) {
  const { t, x, d, lang } = useL();
  const best = (vals: number[], dir: "min" | "max") => (dir === "min" ? Math.min(...vals) : Math.max(...vals));
  const numRow = (label: string, get: (r: Scored) => number, fmt: (v: number) => string, dir: "min" | "max" = "min", strong = false) => {
    const vals = rows.map(get);
    const b = best(vals, dir);
    return (
      <tr className={strong ? "strong" : undefined}>
        <th scope="row">{label}</th>
        {rows.map((r, i) => (
          <td key={r.quote.id} className={`num-inline${vals[i] === b && rows.length > 1 ? " best" : ""}`}>
            {fmt(vals[i]!)}
          </td>
        ))}
      </tr>
    );
  };
  return (
    <div className="ps-grid-wrap">
      <table className="ps-grid">
        <thead>
          <tr>
            <th>{t("Line")}</th>
            {rows.map((r) => (
              <th key={r.quote.id} className={r.rank === 1 ? "top" : undefined}>
                <span className="truncate">{r.vendor.name}</span>
                <small>#{r.rank}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const vals = rows.map((r) => r.quote.lines[i]?.unitPrice ?? NaN);
            const ok = vals.filter((v) => Number.isFinite(v) && v > 0);
            const b = ok.length ? Math.min(...ok) : NaN;
            return (
              <tr key={i}>
                <th scope="row">
                  <span className="ps-grid-line">{x(l.description)}</span>
                  <small>
                    {fmtQty(l.qty, l.unit)} {unitLabel(l.unit, lang)}
                  </small>
                </th>
                {vals.map((v, j) => (
                  <td key={rows[j]!.quote.id} className={`num-inline${v === b && ok.length > 1 ? " best" : ""}`}>
                    {Number.isFinite(v) ? fmtMoney(v) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="gap">
            <td colSpan={rows.length + 1} />
          </tr>
          {numRow(t("Subtotal"), (r) => quoteNet(r.quote), fmtMoney)}
          {numRow(t("VAT"), (r) => quoteNet(r.quote) * r.quote.vatRate, fmtMoney)}
          {numRow(t("Shipping"), (r) => r.quote.shipping, fmtMoney)}
          {numRow(t("Total"), (r) => r.total, fmtMoney, "min", true)}
          {numRow(t("Delivery days"), (r) => r.quote.deliveryDays, (v) => String(v))}
          <tr>
            <th scope="row">{t("Payment terms")}</th>
            {rows.map((r) => (
              <td key={r.quote.id}>{r.quote.paymentTerms}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">{t("Price holds until")}</th>
            {rows.map((r) => (
              <td key={r.quote.id}>{d(r.quote.validUntil)}</td>
            ))}
          </tr>
          {numRow(t("Vendor score"), (r) => r.vendor.overall, (v) => (v > 0 ? `${v.toFixed(1)}/10` : "—"), "max")}
          <tr>
            <th scope="row">{t("Risk")}</th>
            {rows.map((r) => {
              const m = statusMeta("risk", r.quote.risk === "LOW" ? r.vendor.risk : r.quote.risk);
              return (
                <td key={r.quote.id}>
                  <span className={`k-text-${m.tone}`}>{x(m.label)}</span>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

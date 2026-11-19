import type { ReactNode } from "react";
import { Badge, useL } from "../../../components/kit";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import { diffDays, TODAY } from "../../../ops/dates";
import { INV_EXTRAS, INV_PATH, INV_STATUS, invNet, invTotal } from "../../../ops/ext/money-p2";
import type { Invoice, InvoiceLine, OpsData } from "../../../ops/types";
import { buyerLabel } from "../../../ops/ext/proc-client";

export const vendorName = (s: Pick<OpsData, "vendors">, id: string) => s.vendors.find((v) => v.id === id)?.name ?? id;

/** Invoice status pill (buyer's words). */
export function InvBadge({ status }: { status: Invoice["status"] }) {
  const { x } = useL();
  const meta = INV_STATUS[status];
  return <Badge tone={meta.tone}>{x(meta.label)}</Badge>;
}

/** "In 2 days" / "Due today" / "Overdue 3 days", coloured. */
export function DueTag({ due, settled }: { due: string; settled?: boolean }) {
  const { t, d } = useL();
  if (settled) return <span className="pmn-due muted">{d(due, false)}</span>;
  const n = diffDays(TODAY, due);
  const cls = n < 0 ? "bad" : n <= 3 ? "warn" : "ok";
  return <span className={`pmn-due ${cls}`}>{n < 0 ? t("Overdue {n} days", { n: -n }) : n === 0 ? t("Due today") : n === 1 ? t("In 1 day") : t("In {n} days", { n })}</span>;
}

/** Stage arrows for invoices (same look as the kit StagePath, with invoice words). */
export function InvStagePath({ counts, value, onChange }: { counts: Record<string, number>; value: string | null; onChange: (v: string | null) => void }) {
  const { x, t } = useL();
  return (
    <div className="k-stagepath" role="group" aria-label={t("Filter by stage")}>
      <div className="k-stagepath-arrows">
        {INV_PATH.map((st, i) => {
          const meta = INV_STATUS[st];
          const on = value === st;
          return (
            <button key={st} type="button" className={`k-stage k-tone-${meta.tone}${on ? " on" : ""}${value && !on ? " dim" : ""}`} style={{ zIndex: INV_PATH.length - i }} aria-pressed={on} onClick={() => onChange(on ? null : st)}>
              <span>{x(meta.label)}</span>
              <b className="num-inline">{counts[st] ?? 0}</b>
            </button>
          );
        })}
      </div>
      {INV_EXTRAS.filter((e) => counts[e]).map((e) => {
        const on = value === e;
        return (
          <button key={e} type="button" className={`k-stage-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? null : e)}>
            {x(INV_STATUS[e].label)} <b className="num-inline">{counts[e]}</b>
          </button>
        );
      })}
    </div>
  );
}

/** Confidence of a read field: under 90% shows amber. */
export type FieldConf = Partial<Record<"vendor" | "ref" | "date" | "po" | "total", number>>;

/**
 * The supplier's bill drawn as a sheet of paper: letterhead, bill-to, lines, VAT and total.
 * Fields read with low confidence are marked amber; a stamp shows PAID / REJECTED.
 */
export function InvoicePaper({
  vendor,
  vendorCity,
  refNo,
  date,
  due,
  poRef,
  lines,
  vatRate,
  status,
  conf,
  lineConf,
  scanned,
}: {
  vendor: string;
  vendorCity?: string;
  refNo: string;
  date: string;
  due?: string;
  poRef: string;
  lines: InvoiceLine[];
  vatRate: number;
  status?: Invoice["status"];
  conf?: FieldConf;
  lineConf?: number[];
  scanned?: boolean;
}) {
  const { t, x, d, lang } = useL();
  const amber = (k: keyof FieldConf) => (conf && (conf[k] ?? 1) < 0.9 ? " amber" : "");
  const net = invNet({ lines });
  const total = invTotal({ lines, vatRate });
  const stamp: ReactNode = status === "PAID" ? <span className="k-stamp-mark pmn-paper-stamp">{t("Paid")}</span> : status === "REJECTED" ? <span className="k-stamp-mark pmn-paper-stamp bad">{t("Rejected")}</span> : null;
  return (
    <article className={`pmn-paper${scanned ? " scanned" : ""}`} aria-label={t("Original invoice")}>
      {scanned ? <span className="pmn-scanline" aria-hidden="true" /> : null}
      <header className="pmn-paper-head">
        <div>
          <strong className={`pmn-f${amber("vendor")}`}>{vendor}</strong>
          <small>{vendorCity ? `${vendorCity}, ` : ""}{t("Azerbaijan")}</small>
        </div>
        <div className="pmn-paper-title">
          <b>{t("INVOICE")}</b>
          <span className={`k-mono pmn-f${amber("ref")}`}>№ {refNo}</span>
        </div>
      </header>
      <dl className="pmn-paper-meta">
        <div>
          <dt>{t("Bill to")}</dt>
          <dd>{buyerLabel(lang)}</dd>
        </div>
        <div>
          <dt>{t("Date")}</dt>
          <dd className={`pmn-f${amber("date")}`}>{d(date)}</dd>
        </div>
        <div>
          <dt>{t("Your order")}</dt>
          <dd className={`k-mono pmn-f${amber("po")}`}>{poRef}</dd>
        </div>
        {due ? (
          <div>
            <dt>{t("Pay by")}</dt>
            <dd>{d(due)}</dd>
          </div>
        ) : null}
      </dl>
      <table className="pmn-paper-lines">
        <thead>
          <tr>
            <th>{t("Description")}</th>
            <th>{t("Qty")}</th>
            <th>{t("Rate")}</th>
            <th>{t("Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.key} className={lineConf && (lineConf[i] ?? 1) < 0.9 ? "amber" : undefined}>
              <td>{x(l.description)}</td>
              <td className="num-inline">
                {fmtQty(l.qty, l.unit)} {unitLabel(l.unit, lang)}
              </td>
              <td className="num-inline">{fmtMoney(l.rate)}</td>
              <td className="num-inline">{fmtMoney(l.qty * l.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="pmn-paper-sum">
        <div>
          <dt>{t("Subtotal")}</dt>
          <dd className="num-inline">{fmtMoney(net)}</dd>
        </div>
        <div>
          <dt>{t("VAT {p}%", { p: Math.round(vatRate * 100) })}</dt>
          <dd className="num-inline">{fmtMoney(total - net)}</dd>
        </div>
        <div className="total">
          <dt>{t("Total due")}</dt>
          <dd className={`num-inline pmn-f${amber("total")}`}>{fmtMoney(total)} AZN</dd>
        </div>
      </dl>
      {stamp}
    </article>
  );
}

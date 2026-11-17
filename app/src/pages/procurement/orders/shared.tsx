import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useL } from "../../../components/kit";
import { budgetOf, poPaid, poReceivedShare, poTotal } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { OpsData, PurchaseOrder, Quotation, Trade } from "../../../ops/types";

/** Helpers shared by the Procurement · Orders pages (approvals → orders → receipts → stock → payments → vendors). */

export const vendorName = (s: Pick<OpsData, "vendors">, id: string) => s.vendors.find((v) => v.id === id)?.name ?? id;

export const short = (v: number) => `${fmtMoneyShort(v)} AZN`;

/** Trade of an order: the trade of its first catalogued line, else the vendor's main trade. */
export function poTrade(s: Pick<OpsData, "materials" | "vendors">, po: PurchaseOrder): Trade | null {
  const key = po.lines.find((l) => l.material)?.material;
  const m = key ? s.materials.find((x) => x.key === key) : undefined;
  return m?.trade ?? s.vendors.find((v) => v.id === po.vendorId)?.trade ?? null;
}

/** BOQ budget (net) of a quote: from the RFQ lines, or by matching the quote lines to catalogue names. */
export function quoteBudget(s: Pick<OpsData, "materials" | "rfqs">, q: Quotation) {
  const rfq = q.rfqId ? s.rfqs.find((r) => r.id === q.rfqId) : undefined;
  if (rfq) return budgetOf(s, rfq.lines);
  return q.lines.reduce((a, l) => a + l.qty * (s.materials.find((m) => m.name.en === l.description.en)?.rate ?? 0), 0);
}

/** Received and paid shares of an order (0–1). */
export function orderShares(s: Pick<OpsData, "payments">, po: PurchaseOrder) {
  const total = poTotal(po) || 1;
  return { goods: poReceivedShare(po), paid: Math.min(1, poPaid(s, po.id) / total), total };
}

/** Two thin stacked bars: goods in (violet) and paid (green). */
export function TwoBars({ goods, paid, labels }: { goods: number; paid: number; labels?: [string, string] }) {
  return (
    <span className="po-twobars" title={labels ? `${labels[0]} ${Math.round(goods * 100)}% · ${labels[1]} ${Math.round(paid * 100)}%` : undefined}>
      <span className="po-twobar goods">
        <i className="k-grow-x" style={{ width: `${Math.max(0, Math.min(1, goods)) * 100}%` }} />
      </span>
      <span className="po-twobar paid">
        <i className="k-grow-x" style={{ width: `${Math.max(0, Math.min(1, paid)) * 100}%` }} />
      </span>
    </span>
  );
}

/** Small section heading used inside signature visuals. */
export function VisualHead({ title, sentence, children }: { title: ReactNode; sentence?: ReactNode; children?: ReactNode }) {
  return (
    <header className="po-vhead">
      <div>
        <h2>{title}</h2>
        {sentence ? <p>{sentence}</p> : null}
      </div>
      {children ? <div className="po-vhead-end">{children}</div> : null}
    </header>
  );
}

/** Signature pips: filled for signatures given, hollow for those still needed. */
export function Pips({ level, required }: { level: number; required: number }) {
  return (
    <span className="po-pips" aria-label={`${level}/${required}`}>
      {Array.from({ length: required }, (_, i) => (
        <i key={i} className={i < level ? "on" : undefined} />
      ))}
    </span>
  );
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Back link above a detail header. */
export function BackLink({ to, label }: { to: string; label: string }) {
  const { t } = useL();
  return (
    <Link to={to} className="k-back po-back">
      <ArrowLeft size={14} />
      {t(label)}
    </Link>
  );
}

/** Qualification label for a 0–10 vendor score. */
export const scoreLabel = (v: number) => (v >= 8 ? "Highly qualified" : v >= 6.5 ? "Qualified" : "Review required");

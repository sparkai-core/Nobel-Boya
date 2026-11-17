import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { ApprovalPath, Badge, CountUp, Dialog, Dropzone, Field, fmtBytes, Money, ReadSteps, toast, useFakeRead, useL, type ReadStep } from "../../components/kit";
import { useOps, type OpsState } from "../../ops/store";
import { matchInvoice } from "../../ops/store-phase2";
import { addDays, diffDays, TODAY } from "../../ops/dates";
import { sendDocument } from "../../ops/ext/vendor";
import { invTotal, linesFromPo, sendPortalInvoice } from "../../ops/ext/money-p2";
import { fmtMoney, fmtQty, unitLabel } from "../../lib/format";
import type { Invoice, InvoiceLine, PurchaseOrder, Quotation, Vendor } from "../../ops/types";
import { BUYER, quoteJourney, STAGE_META, type OrderStage, type VendorDoc } from "./model";

// ---------------------------------------------------------------- score rings

const RINGS = [
  { key: "reliability", label: "Reliability", color: "var(--stamp)" },
  { key: "quality", label: "Quality", color: "var(--accent)" },
  { key: "price", label: "Price", color: "#7a63c9" },
] as const;

/** Three concentric rings (reliability / quality / price) with the overall score out of 10 in the middle. */
export function ScoreRings({ vendor, size = 188 }: { vendor: Vendor; size?: number }) {
  const { t } = useL();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const c = size / 2;
  const stroke = size * 0.07;
  return (
    <div className="vp-rings">
      <div className="vp-rings-art" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("How the buyer scores you")}>
          {RINGS.map((r, i) => {
            const rad = c - stroke / 2 - i * (stroke + 5);
            const len = 2 * Math.PI * rad;
            const v = vendor.scores[r.key] / 100;
            return (
              <g key={r.key}>
                <circle cx={c} cy={c} r={rad} fill="none" stroke="var(--sheet-3)" strokeWidth={stroke} />
                <circle
                  cx={c}
                  cy={c}
                  r={rad}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={len}
                  strokeDashoffset={on ? len * (1 - v) : len}
                  transform={`rotate(-90 ${c} ${c})`}
                  className="vp-ring-arc"
                  style={{ transitionDelay: `${i * 120}ms` }}
                />
              </g>
            );
          })}
        </svg>
        <div className="vp-rings-mid">
          <strong>
            <CountUp value={vendor.overall * 10} format={(v) => (v / 10).toFixed(1)} />
          </strong>
          <small>{t("out of 10")}</small>
        </div>
      </div>
      <ul className="vp-rings-key">
        {RINGS.map((r) => (
          <li key={r.key}>
            <i style={{ background: r.color }} />
            <span>{t(r.label)}</span>
            <b className="num-inline">{vendor.scores[r.key]}</b>
          </li>
        ))}
        <li className="vp-rings-extra">
          <i />
          <span>{t("Delivery")}</span>
          <b className="num-inline">{vendor.scores.delivery}</b>
        </li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- countdown ring

/** Ring that is full at 30+ days to go and empties towards the due date; red in the last 3 days. */
export function Countdown({ due, size = 64, closed = false }: { due: string; size?: number; closed?: boolean }) {
  const { t } = useL();
  const left = diffDays(TODAY, due);
  const frac = closed ? 0 : Math.max(0, Math.min(1, left / 30));
  const tone = closed ? "muted" : left <= 3 ? "bad" : left <= 7 ? "warn" : "brand";
  const stroke = Math.max(4, size * 0.09);
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <div className={`vp-count k-tone-${tone}`} style={{ width: size, height: size }} title={closed ? t("Closed") : left < 0 ? t("{n} days past due", { n: -left }) : t("{n} days left", { n: left })}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sheet-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tc)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - frac)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="vp-ring-arc" />
      </svg>
      <span className="vp-count-mid">
        {closed ? (
          <small>{t("closed")}</small>
        ) : left < 0 ? (
          <>
            <b>{-left}</b>
            <small>{t("late")}</small>
          </>
        ) : (
          <>
            <b>{left}</b>
            <small>{left === 1 ? t("day") : t("days")}</small>
          </>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- quote journey

export function QuoteJourney({ s, q }: { s: OpsState; q: Quotation }) {
  const { t, d } = useL();
  const j = quoteJourney(s, q);
  return (
    <ApprovalPath
      steps={j.steps.map((st) => ({
        label: t(st.label),
        state: st.state,
        who: st.note ? t(st.note) : undefined,
        at: st.at ? d(st.at) : undefined,
      }))}
    />
  );
}

export function OutcomeBadge({ s, q }: { s: OpsState; q: Quotation }) {
  const { t } = useL();
  const o = quoteJourney(s, q).outcome;
  return <Badge tone={o.tone}>{t(o.label)}</Badge>;
}

export function StageBadge({ stage }: { stage: OrderStage }) {
  const { t } = useL();
  const m = STAGE_META[stage];
  return <Badge tone={m.tone}>{t(m.label)}</Badge>;
}

// ---------------------------------------------------------------- page hero eyebrow

export function useEyebrow() {
  const { t } = useL();
  return (page: string) => `${t("Vendor portal")} · ${t(page)}`;
}

// ---------------------------------------------------------------- dialogs

const DECLINE_REASONS = ["No capacity before the due date", "Not in our product range", "Cannot meet the specification", "Price would not be competitive at this volume"];

export function DeclineDialog({ open, onClose, rfqId, rfqRef, vendorId }: { open: boolean; onClose: () => void; rfqId: string; rfqRef: string; vendorId: string }) {
  const { t } = useL();
  const vendorRespond = useOps((s) => s.vendorRespond);
  const [reason, setReason] = useState("");
  const submit = () => {
    vendorRespond(rfqId, vendorId, "DECLINED", reason.trim() || t(DECLINE_REASONS[0]!));
    toast(t("You declined {ref}. The buyer has been told.", { ref: rfqRef }), "warn");
    setReason("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={rfqRef}
      title={t("Decline this request?")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Keep it")}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {t("Decline")}
          </button>
        </>
      }
    >
      <div className="k-stack">
        <p className="muted">{t("A short reason helps {buyer} plan. They will see it next to your name.", { buyer: BUYER })}</p>
        <div className="k-quick">
          {DECLINE_REASONS.map((r) => (
            <button key={r} type="button" className={reason === t(r) ? "on" : undefined} onClick={() => setReason(t(r))}>
              {t(r)}
            </button>
          ))}
        </div>
        <Field label={t("Reason")}>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Why you cannot quote")} />
        </Field>
      </div>
    </Dialog>
  );
}

export function DispatchDialog({ open, onClose, po, balance }: { open: boolean; onClose: () => void; po: PurchaseOrder; balance?: boolean }) {
  const { t, x, d } = useL();
  const vendorDispatch = useOps((s) => s.vendorDispatch);
  const [truck, setTruck] = useState("");
  const [driver, setDriver] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState(false);
  const submit = () => {
    if (!truck.trim()) {
      setErr(true);
      return;
    }
    const text = `${t("Truck")} ${truck.trim()}${driver.trim() ? `, ${t("driver")} ${driver.trim()}` : ""}${note.trim() ? `. ${note.trim()}` : ""}`;
    vendorDispatch(po.id, text);
    toast(t("{ref} dispatched. The site can see the truck is on the way.", { ref: po.ref }));
    setTruck("");
    setDriver("");
    setNote("");
    setErr(false);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={po.ref}
      title={balance ? t("Dispatch the balance") : t("Dispatch delivery")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {t("Dispatch now")}
          </button>
        </>
      }
    >
      <div className="k-stack">
        <div className="k-callout k-tone-info">
          <span>
            {t("Deliver to")}: <b>{x(po.deliverTo)}</b> · {t("expected {date}", { date: d(po.expectedAt) })}
          </span>
        </div>
        <div className="k-form">
          <Field label={t("Truck plate")} error={err ? t("Enter the truck plate") : undefined}>
            <input className="input" value={truck} onChange={(e) => setTruck(e.target.value)} placeholder="10-QA-417" autoFocus />
          </Field>
          <Field label={t("Driver")}>
            <input className="input" value={driver} onChange={(e) => setDriver(e.target.value)} placeholder={t("Name and phone")} />
          </Field>
          <Field label={t("Note for the site store")} wide>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. Arrives before 10:00, needs a forklift")} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

/** Vendor's own invoice number suggestion: company initials, year-month and a running number. */
function suggestRef(vendor: string, n: number) {
  const ini = vendor
    .split(/\s+/)
    .filter((w) => !/^(MMC|ASC|QSC)$/i.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 3);
  return `${ini}-${TODAY.slice(2, 4)}${TODAY.slice(5, 7)}-${String(n).padStart(2, "0")}`;
}

/**
 * Send an invoice for a delivered (or part-delivered) order: lines prefilled with what the site received,
 * editable. It becomes a real bill on the buyer's side, matched three ways the moment it lands.
 * With `replaces`, it is a corrected invoice for a queried one.
 */
export function InvoiceDialog({ open, onClose, po, vendorId, replaces }: { open: boolean; onClose: () => void; po: PurchaseOrder | null; vendorId: string; replaces?: Invoice | null }) {
  const { t, x, lang } = useL();
  const vendors = useOps((s) => s.vendors);
  const invoices = useOps((s) => s.invoices);
  const vendor = vendors.find((v) => v.id === vendorId)?.name ?? vendorId;
  const [ref, setRef] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const key = `${po?.id ?? ""}|${replaces?.id ?? ""}`;
  const [seen, setSeen] = useState("");
  // Prefill each time the dialog opens (or opens for another order).
  if (open && po && seen !== key) {
    setSeen(key);
    setLines(linesFromPo(po, `VP-${po.id}`, true));
    setRef("");
  }
  if (!open && seen) setSeen("");
  if (!po) return null;
  const mine = invoices.filter((i) => i.vendorId === vendorId).length;
  const suggested = replaces ? `${replaces.ref}-R` : suggestRef(vendor, mine + 1);
  const total = invTotal({ lines, vatRate: po.vatRate });
  const m = matchInvoice({ lines }, po);
  const usedRef = (ref.trim() || suggested).trim();
  const clash = invoices.some((i) => i.vendorId === vendorId && i.ref === usedRef && i.id !== replaces?.id);
  const submit = () => {
    if (!lines.some((l) => l.qty > 0)) return;
    sendPortalInvoice(vendorId, po.id, usedRef, lines.filter((l) => l.qty > 0), replaces?.id ?? null);
    toast(t("Invoice {ref} sent. The buyer sees it now.", { ref: usedRef }));
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={`${po.ref}${replaces ? ` · ${t("replaces {ref}", { ref: replaces.ref })}` : ""}`}
      title={replaces ? t("Send a corrected invoice") : t("Send an invoice")}
      width={640}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!lines.some((l) => l.qty > 0)}>
            {t("Send invoice")}
          </button>
        </>
      }
    >
      <div className="k-stack">
        <p className="muted small">{t("Lines start at what the site received. Bill only what arrived; the buyer checks it against the order and the delivery at once.")}</p>
        <div className="vp-invl-wrap">
          <table className="vp-invl">
            <thead>
              <tr>
                <th>{t("Item")}</th>
                <th>{t("Ordered")}</th>
                <th>{t("Received")}</th>
                <th>{t("You bill")}</th>
                <th>{t("Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const pl = po.lines.find((y) => y.key === l.poLineKey);
                const off = pl ? Math.abs(l.qty - pl.received) > 1e-6 : false;
                return (
                  <tr key={l.key} className={off ? "off" : undefined}>
                    <td>{x(l.description)}</td>
                    <td className="num-inline">{pl ? fmtQty(pl.qty, l.unit) : "—"}</td>
                    <td className="num-inline">{pl ? fmtQty(pl.received, l.unit) : "—"}</td>
                    <td>
                      <span className="vp-invl-qty">
                        <input className="input" type="number" min={0} step="any" value={l.qty} aria-label={t("Quantity to bill")} onChange={(e) => setLines((ls) => ls.map((y, j) => (j === i ? { ...y, qty: Math.max(0, Number(e.target.value) || 0) } : y)))} />
                        <small>{unitLabel(l.unit, lang)}</small>
                      </span>
                    </td>
                    <td className="num-inline">{fmtMoney(l.qty * l.rate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="vp-inv-figure">
          <span>{t("Invoice total incl. VAT")}</span>
          <strong>
            <Money value={total} />
          </strong>
          <small className={m.ok ? "k-text-ok" : "k-text-warn"}>{m.ok ? t("Matches the order and what the site received") : t("Differs from what the site received. The buyer will raise a query.")}</small>
        </div>
        <Field label={t("Your invoice number")} hint={clash ? undefined : t("Leave empty to use {ref}", { ref: suggested })} error={clash ? t("You already sent {ref}. Use a new number.", { ref: usedRef }) : undefined}>
          <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={suggested} />
        </Field>
      </div>
    </Dialog>
  );
}

const DOC_STEPS: ReadStep[] = [
  { label: "Checking the file", ms: 550 },
  { label: "Reading the issue and expiry dates", ms: 800 },
  { label: "Sending it to the buyer", ms: 550 },
];

/** Upload a renewed compliance document: the file is "read" and the expiry moves a year on. */
export function DocDialog({ open, onClose, doc, vendorId }: { open: boolean; onClose: () => void; doc: VendorDoc | null; vendorId: string }) {
  const { t, x, d } = useL();
  const reader = useFakeRead(DOC_STEPS);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (!doc) return null;
  const close = () => {
    reader.reset();
    setFile(null);
    setDone(null);
    onClose();
  };
  const take = async (f: { name: string; size: number }) => {
    setFile(f);
    await reader.start();
    const expires = addDays(TODAY, 365);
    sendDocument(vendorId, doc.key, doc.label, f.name, doc.key === "vat" ? null : expires);
    setDone(expires);
    toast(t("{doc} renewed. Valid until {date}.", { doc: x(doc.label), date: d(expires) }));
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      kicker={x(doc.label)}
      title={doc.state === "missing" ? t("Upload the document") : t("Upload a renewed copy")}
      footer={
        <button type="button" className="btn btn-primary" onClick={close} disabled={reader.running}>
          {done ? t("Done") : t("Close")}
        </button>
      }
    >
      {done ? (
        <div className="vp-doc-done k-rise">
          <span className="k-stamp-mark">{t("Valid")}</span>
          <p>
            <b>{file?.name}</b>
          </p>
          <p className="muted">{t("Now valid until {date}. The buyer sees the renewed copy.", { date: d(done) })}</p>
        </div>
      ) : file ? (
        <div className="k-stack">
          <p>
            <b>{file.name}</b> <small className="muted">{fmtBytes(file.size)}</small>
          </p>
          <ReadSteps steps={DOC_STEPS} step={reader.step} />
        </div>
      ) : (
        <Dropzone accept=".pdf,image/*" title={t("Drop the renewed document")} hint={t("PDF or a photo of the document. Only the file name is kept in this demo.")} onFile={(f) => void take(f)} compact>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void take({ name: `${doc.key}-${TODAY}.pdf`, size: 248_000 })}>
            {t("Use a sample file")}
          </button>
        </Dropzone>
      )}
    </Dialog>
  );
}

/** File chooser that keeps only the file name (the demo has no storage). */
export function FilePick({ value, onChange, hint, label }: { value: string; onChange: (name: string) => void; hint?: ReactNode; label?: string }) {
  const { t } = useL();
  return (
    <label className={`vp-file${value ? " has" : ""}`}>
      <input type="file" onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")} />
      <span className="vp-file-icon" aria-hidden="true">
        {value ? <Check size={18} /> : "+"}
      </span>
      <span className="vp-file-text">
        <b>{value || t(label ?? "Choose a file")}</b>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

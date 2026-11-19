import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Inbox, Paperclip, Plus } from "lucide-react";
import { Empty, PageHero, Panel, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { matchInvoice } from "../../../ops/store-phase2";
import { addDays, TODAY } from "../../../ops/dates";
import { to } from "../../../ops/select";
import { fmtMoney, unitLabel } from "../../../lib/format";
import { invTotal, MONEY } from "../../../ops/ext/money-p2";
import { captureInvoice, termDays } from "../../../ops/ext/proc-client";
import type { InvoiceLine, PurchaseOrder } from "../../../ops/types";
import { InvBadge, InvoicePaper, vendorName } from "./parts";

type Form = { poId: string; ref: string; date: string; due: string; file: string; lines: InvoiceLine[] };

/** Lines prefilled from the order (what was received, else what was ordered) as a convenience; every value stays editable. */
function linesFor(po: PurchaseOrder): InvoiceLine[] {
  return po.lines.map((l, i) => ({ key: `NEW-${po.id}-${i}`, description: l.description, unit: l.unit, qty: l.received > 0 ? l.received : l.qty, rate: l.rate, poLineKey: l.key }));
}

const blank = (): Form => ({ poId: "", ref: "", date: TODAY, due: "", file: "", lines: [] });

/**
 * Enter a supplier invoice: pick the order, type the invoice number, dates and amounts from the paper bill.
 * Nothing is read from a file; the file name can be noted for reference. The bill is matched against the
 * order and the goods received as soon as it is saved.
 */
export function InvoiceInboxPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [f, setF] = useState<Form>(blank);
  const [tried, setTried] = useState(false);

  const pos = useMemo(() => s.pos.filter((p) => p.status !== "CANCELLED" && p.status !== "DRAFT").sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id.localeCompare(a.id)), [s.pos]);
  const po = s.pos.find((p) => p.id === f.poId);
  const vendorId = po?.vendorId ?? "";

  const pickPo = (id: string) => {
    const np = s.pos.find((p) => p.id === id);
    if (!np) return setF((o) => ({ ...o, poId: "", lines: [] }));
    const days = termDays(s.vendors.find((v) => v.id === np.vendorId)?.paymentTerms ?? np.paymentTerms);
    setF((o) => ({ ...o, poId: np.id, lines: linesFor(np), due: addDays(o.date || TODAY, days) }));
  };
  const setLine = (i: number, k: "qty" | "rate", v: string) => setF((o) => ({ ...o, lines: o.lines.map((y, j) => (j === i ? { ...y, [k]: Math.max(0, Number(v) || 0) } : y)) }));

  const billed = f.lines.filter((l) => l.qty > 0);
  const m = po ? matchInvoice({ lines: billed }, po) : null;
  const dup = po && f.ref.trim() ? s.invoices.find((i) => i.vendorId === vendorId && i.ref === f.ref.trim()) : undefined;
  const total = invTotal({ lines: billed, vatRate: po?.vatRate ?? 0.18 });
  const errors = {
    po: !po ? t("Pick the purchase order") : undefined,
    ref: !f.ref.trim() ? t("Required") : undefined,
    date: !f.date ? t("Required") : undefined,
    due: f.due && f.date && f.due < f.date ? t("The due date is before the invoice date.") : undefined,
    lines: po && !billed.length ? t("Bill at least one line") : undefined,
  };
  const valid = !errors.po && !errors.ref && !errors.date && !errors.due && !errors.lines;

  const save = () => {
    setTried(true);
    if (!valid || !po) return;
    const id = captureInvoice({ vendorId, poId: po.id, ref: f.ref, date: f.date, dueDate: f.due || f.date, lines: billed, file: f.file || null });
    const inv = useOps.getState().invoices.find((i) => i.id === id);
    toast(inv?.status === "SIGN_OFF" ? t("{id} saved. It matches and is ready for sign-off.", { id }) : t("{id} saved to bills. The match found a difference.", { id }), inv?.status === "SIGN_OFF" ? "ok" : "warn");
    setF(blank());
    setTried(false);
    navigate(MONEY.invoice(id));
  };

  const entered = useMemo(() => s.invoices.filter((i) => i.source !== "PORTAL").slice(0, 12), [s.invoices]);

  return (
    <div className="k-page pmn-page">
      <PageHero
        eyebrow={t("Procurement · Invoice inbox")}
        title={t("Enter a supplier invoice")}
        subtitle={t("Pick the order, then type the invoice number, dates and amounts from the bill. It is matched against the order and the goods received.")}
        flow={["Pick the order", "Type the bill", "Match", "Saved to bills"]}
        art="pay"
        back={{ to: MONEY.invoices, label: "Supplier invoices" }}
      />

      <div className="k-grid-main pmn-inbox">
        <div className="k-stack">
          {!pos.length ? (
            <Empty
              icon={<FileText size={22} />}
              title={t("No purchase orders yet")}
              action={
                <Link to={to("procurement/orders/new")} className="btn btn-primary">
                  <Plus size={15} /> {t("New purchase order")}
                </Link>
              }
            >
              {t("A supplier invoice is entered against a purchase order. Place an order first.")}
            </Empty>
          ) : (
            <section className="pmn-review k-rise" aria-label={t("Invoice details")}>
              <header className="pmn-review-head">
                <div>
                  <h2>{t("Invoice details")}</h2>
                  <p className="muted small">{t("Lines start from the order as a convenience. Change them to what the bill says.")}</p>
                </div>
                {f.file ? (
                  <span className="pmn-review-file">
                    <Paperclip size={14} /> <span className="truncate">{f.file}</span>
                  </span>
                ) : null}
              </header>
              <div className="pmn-review-body">
                <div className="pmn-review-orig">
                  <span className="pmn-review-label">{t("Preview")}</span>
                  {po ? (
                    <InvoicePaper vendor={vendorName(s, vendorId)} vendorCity={s.vendors.find((v) => v.id === vendorId)?.city} refNo={f.ref || "—"} date={f.date || TODAY} poRef={po.ref} due={f.due || undefined} lines={billed} vatRate={po.vatRate} />
                  ) : (
                    <p className="muted small">{t("Pick the purchase order to start.")}</p>
                  )}
                </div>
                <div className="pmn-review-fields">
                  <span className="pmn-review-label">{t("From the bill")}</span>
                  <div className="pmn-fields">
                    <label className="pmn-field">
                      <span>{t("Purchase order")}</span>
                      <select className="input select" value={f.poId} onChange={(e) => pickPo(e.target.value)}>
                        <option value="">{t("Choose…")}</option>
                        {pos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.ref} · {vendorName(s, p.vendorId)}
                          </option>
                        ))}
                      </select>
                      {tried && errors.po ? <small className="k-field-error">{errors.po}</small> : null}
                    </label>
                    <label className="pmn-field">
                      <span>{t("Invoice no")}</span>
                      <input className="input" value={f.ref} onChange={(e) => setF((o) => ({ ...o, ref: e.target.value }))} />
                      {tried && errors.ref ? <small className="k-field-error">{errors.ref}</small> : null}
                    </label>
                    <label className="pmn-field">
                      <span>{t("Date")}</span>
                      <input className="input" type="date" value={f.date} onChange={(e) => setF((o) => ({ ...o, date: e.target.value }))} />
                      {tried && errors.date ? <small className="k-field-error">{errors.date}</small> : null}
                    </label>
                    <label className="pmn-field">
                      <span>{t("Pay by")}</span>
                      <input className="input" type="date" value={f.due} onChange={(e) => setF((o) => ({ ...o, due: e.target.value }))} />
                      {errors.due ? <small className="k-field-error">{errors.due}</small> : null}
                    </label>
                    <label className="pmn-field">
                      <span>{t("File (optional)")}</span>
                      <input className="input" type="file" accept=".pdf,image/*" onChange={(e) => setF((o) => ({ ...o, file: e.target.files?.[0]?.name ?? "" }))} />
                      <small className="muted">{t("Only the file name is kept, for reference.")}</small>
                    </label>
                  </div>

                  {po ? (
                    <table className="pmn-rlines">
                      <thead>
                        <tr>
                          <th>{t("Line")}</th>
                          <th>{t("Qty")}</th>
                          <th>{t("Rate")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.lines.map((l, i) => (
                          <tr key={l.key}>
                            <td>
                              <span className="pmn-rline-name">{x(l.description)}</span>
                            </td>
                            <td>
                              <span className="pmn-qty">
                                <input className="input" type="number" min={0} step="any" value={l.qty} aria-label={t("Quantity")} onChange={(e) => setLine(i, "qty", e.target.value)} />
                                <small>{unitLabel(l.unit, lang)}</small>
                              </span>
                            </td>
                            <td>
                              <input className="input" type="number" min={0} step="any" value={l.rate} aria-label={t("Rate")} onChange={(e) => setLine(i, "rate", e.target.value)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {tried && errors.lines ? <small className="k-field-error">{errors.lines}</small> : null}

                  <div className="pmn-review-total">
                    <span>{t("Total with VAT")}</span>
                    <b className="num-inline">{fmtMoney(total)} AZN</b>
                  </div>

                  {m && billed.length ? (
                    <div className={`k-callout k-tone-${m.ok ? "ok" : "warn"}`}>
                      {m.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                      <span>{m.ok ? t("Matches {po} and what was received. It goes straight to sign-off.", { po: po!.ref }) : t("Differs from what was received on {po} by {a} AZN before VAT. It will land in Fix the match.", { po: po!.ref, a: fmtMoney(m.over) })}</span>
                    </div>
                  ) : null}
                  {dup ? (
                    <div className="k-callout k-tone-bad">
                      <AlertTriangle size={15} />
                      <span>{t("Same supplier and number as {id}. It will be flagged as a duplicate.", { id: dup.id })}</span>
                    </div>
                  ) : null}

                  <div className="k-row pmn-review-actions">
                    <button type="button" className="btn btn-primary" onClick={save}>
                      {t("Save to bills")}
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setF(blank());
                        setTried(false);
                      }}
                    >
                      {t("Clear")}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="k-stack">
          <Panel title={t("Entered by hand")} icon={<Inbox size={15} />} count={entered.length || undefined} pad={false}>
            {entered.length ? (
              <ul className="pmn-uploads">
                {entered.map((i) => (
                  <li key={i.id} className="u-saved">
                    <span className="pmn-upload-icon">
                      <CheckCircle2 size={15} />
                    </span>
                    <Link to={MONEY.invoice(i.id)} className="pmn-upload-text">
                      <b className="truncate">
                        {i.ref} · {i.id}
                      </b>
                      <small className="truncate">
                        {vendorName(s, i.vendorId)} · {i.poId}
                      </small>
                    </Link>
                    <span className="pmn-upload-side">
                      <InvBadge status={i.status} />
                      <small>{d(i.date, false)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title={t("Nothing here")}>{t("Invoices you enter appear here.")}</Empty>
            )}
          </Panel>
          <div className="k-note">{t("Bills sent by suppliers through the vendor portal skip this step: they arrive already matched.")}</div>
        </div>
      </div>
    </div>
  );
}

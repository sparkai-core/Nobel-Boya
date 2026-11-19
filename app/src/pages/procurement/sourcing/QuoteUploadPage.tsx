import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, FileText, Keyboard, Plus, Trash2 } from "lucide-react";
import { Empty, Field, PageHero, Panel, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { R, tradeName } from "../../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import { enterQuote } from "../../../ops/ext/proc-client";
import type { Rfq, Txt, Vendor } from "../../../ops/types";
import { rfqOrder, vendorsFor } from "./shared";

type DocLine = { description: Txt; qty: number; unit: string; unitPrice: number };

/** Enter a quotation by hand from the vendor's document (the file name can be kept for reference). */
export function QuoteUploadPage() {
  const { t, x, lang } = useL();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rfqs = useOps((s) => s.rfqs);
  const vendors = useOps((s) => s.vendors);
  const quotes = useOps((s) => s.quotes);

  const openRfqs = useMemo(() => rfqOrder(rfqs).filter((r) => r.status === "OPEN" || r.status === "CLOSED"), [rfqs]);
  const [rfqId, setRfqId] = useState(() => params.get("rfq") ?? "");
  const rfq = rfqs.find((r) => r.id === rfqId);
  const firstVendor = (r: Rfq | undefined) => {
    if (!r) return vendors[0]?.id ?? "";
    const waiting = r.invitations.find((i) => i.status !== "SUBMITTED" && i.status !== "DECLINED");
    return waiting?.vendorId ?? vendorsFor(vendors, r.trade).find((v) => !quotes.some((q) => q.rfqId === r.id && q.vendorId === v.id))?.id ?? vendors[0]?.id ?? "";
  };
  const [vendorId, setVendorId] = useState(() => params.get("vendor") ?? firstVendor(rfq));
  const vendor = vendors.find((v) => v.id === vendorId);

  const vendorList = useMemo(() => {
    const list = [...vendors].filter((v) => v.status !== "DISQUALIFIED");
    if (!rfq) return list;
    return list.sort((a, b) => Number(rfq.invitations.some((i) => i.vendorId === b.id)) - Number(rfq.invitations.some((i) => i.vendorId === a.id)) || Number(b.trade === rfq.trade) - Number(a.trade === rfq.trade));
  }, [vendors, rfq]);
  const already = rfq && vendor ? quotes.find((q) => q.rfqId === rfq.id && q.vendorId === vendor.id && !q.duplicate) : undefined;
  const invited = rfq && vendor ? rfq.invitations.some((i) => i.vendorId === vendor.id) : true;

  return (
    <div className="k-page ps-page">
      <PageHero
        eyebrow={t("Procurement · Quotations")}
        title={t("Enter a quotation")}
        subtitle={t("Type the vendor's prices and terms from their quote. You can note the file it came from.")}
        flow={["Pick vendor and RFQ", "Type the prices", "Save the quote"]}
        art="quotes"
        back={{ to: R.quotes, label: "Quotations" }}
      />

      {!vendors.length ? (
        <Empty
          title={t("No vendors yet")}
          action={
            <Link to={R.newVendor} className="btn btn-primary">
              <Plus size={15} /> {t("Add vendor")}
            </Link>
          }
        >
          {t("A quotation comes from a vendor. Add the vendor first.")}
        </Empty>
      ) : (
      <>
      <Panel title={t("Context")} icon={<FileText size={15} />}>
        <div className="k-form">
          <Field label={t("From")} hint={vendor ? [tradeName(vendor.trade, lang), vendor.city, t("pays {terms}", { terms: t(vendor.paymentTerms) })].filter(Boolean).join(" · ") : undefined}>
            <select className="input select" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              {vendorList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {rfq?.invitations.some((i) => i.vendorId === v.id) ? ` · ${t("invited")}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Answers")} hint={rfq ? t("{n} lines; quantities come from the RFQ.", { n: rfq.lines.length }) : t("A quote without an RFQ is compared on its own.")}>
            <select
              className="input select"
              value={rfqId}
              onChange={(e) => {
                setRfqId(e.target.value);
                const r = rfqs.find((rr) => rr.id === e.target.value);
                if (r) setVendorId(firstVendor(r));
              }}
            >
              <option value="">{t("No RFQ (direct quote)")}</option>
              {openRfqs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.ref} · {x(r.title)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {already ? <p className="k-callout k-tone-warn ps-mt">{t("{vendor} already quoted on {rfq} ({id}). A second one will be checked for duplicates.", { vendor: vendor!.name, rfq: rfq!.ref, id: already.id })}</p> : !invited ? <p className="k-callout k-tone-brand ps-mt">{t("{vendor} was not invited to {rfq}; saving adds them to it.", { vendor: vendor!.name, rfq: rfq!.ref })}</p> : null}
      </Panel>

      {vendor ? (
        <TypeForm
          key={`${vendorId}-${rfqId}`}
          vendor={vendor}
          rfq={rfq}
          onSave={(input, file) => {
            const id = enterQuote({ rfqId: rfq?.id ?? null, vendorId: vendor.id, ...input }, file || null);
            toast(t("{id} saved", { id }));
            navigate(R.quote(id));
          }}
        />
      ) : null}
      </>
      )}
    </div>
  );
}

type TypeLine = { id: number; description: string; qty: string; unit: string; price: string; txt: Txt | null };

function TypeForm({ vendor, rfq, onSave }: { vendor: Vendor; rfq: Rfq | undefined; onSave: (input: { ref: string; lines: DocLine[]; deliveryDays: number; validDays: number; paymentTerms: string; shipping: number; notes: string }, file: string) => void }) {
  const { t, x, lang } = useL();
  const [lines, setLines] = useState<TypeLine[]>(() =>
    rfq?.lines.length ? rfq.lines.map((l, i) => ({ id: i, description: x(l.description), qty: String(l.qty), unit: l.unit, price: "", txt: l.description })) : [{ id: 0, description: "", qty: "", unit: "ədəd", price: "", txt: null }],
  );
  const [ref, setRef] = useState("");
  const [delivery, setDelivery] = useState(vendor.avgDeliveryDays > 0 ? String(vendor.avgDeliveryDays) : "");
  const [file, setFile] = useState("");
  const [valid, setValid] = useState("30");
  const [payment, setPayment] = useState(vendor.paymentTerms);
  const [shipping, setShipping] = useState("0");
  const [notes, setNotes] = useState("");
  const set = (id: number, patch: Partial<TypeLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const net = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const total = net * 1.18 + (Number(shipping) || 0);
  const ok = lines.length > 0 && lines.every((l) => Number(l.qty) > 0 && Number(l.price) > 0 && l.description.trim());

  return (
    <Panel title={t("Type the quote in")} icon={<Keyboard size={15} />} sub={rfq ? t("Quantities come from {rfq}. Fill in the vendor's unit prices.", { rfq: rfq.ref }) : t("Add each line the vendor priced.")}>
      <div className="k-table-wrap">
        <table className="k-lines-table ps-type-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t("Description")}</th>
              <th className="r">{t("Qty")}</th>
              <th>{t("Unit")}</th>
              <th className="r">{t("Unit price")}</th>
              <th className="r">{t("Amount")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <td className="muted num-inline">{i + 1}</td>
                <td>{rfq ? <span className="ps-strong">{l.description}</span> : <input className="input" value={l.description} placeholder={t("Describe the material")} onChange={(e) => set(l.id, { description: e.target.value, txt: null })} />}</td>
                <td className="r">{rfq ? <span className="num-inline">{fmtQty(Number(l.qty), l.unit)}</span> : <input className="input num" type="number" min={0} value={l.qty} onChange={(e) => set(l.id, { qty: e.target.value })} />}</td>
                <td>{rfq ? <span className="muted">{unitLabel(l.unit, lang)}</span> : <input className="input" style={{ width: 70 }} value={l.unit} onChange={(e) => set(l.id, { unit: e.target.value })} />}</td>
                <td className="r">
                  <input className="input num ps-price-input" type="number" min={0} step="0.01" value={l.price} placeholder="0.00" onChange={(e) => set(l.id, { price: e.target.value })} aria-label={t("Unit price")} />
                </td>
                <td className="r num-inline">{fmtMoney((Number(l.qty) || 0) * (Number(l.price) || 0))}</td>
                <td>
                  {!rfq ? (
                    <button type="button" className="icon-btn" aria-label={t("Remove line")} onClick={() => setLines((ls) => ls.filter((x2) => x2.id !== l.id))}>
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rfq ? (
        <button type="button" className="btn btn-ghost btn-sm ps-mt" onClick={() => setLines((ls) => [...ls, { id: Date.now(), description: "", qty: "", unit: "ədəd", price: "", txt: null }])}>
          <Plus size={14} />
          {t("Add line")}
        </button>
      ) : null}
      <div className="k-form ps-mt">
        <Field label={t("Vendor's reference")}>
          <input className="input" value={ref} placeholder={t("Leave empty to use the quote number")} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label={t("Vendor's file (optional)")} hint={t("Only the file name is kept, for reference.")}>
          <input className="input" type="file" accept=".pdf,.xls,.xlsx,image/*" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
        </Field>
        <Field label={t("Payment terms")}>
          <input className="input" value={payment} onChange={(e) => setPayment(e.target.value)} />
        </Field>
        <Field label={t("Delivery days")}>
          <input className="input num" type="number" min={0} value={delivery} onChange={(e) => setDelivery(e.target.value)} />
        </Field>
        <Field label={t("Price holds for (days)")}>
          <input className="input num" type="number" min={1} value={valid} onChange={(e) => setValid(e.target.value)} />
        </Field>
        <Field label={t("Shipping, AZN")}>
          <input className="input num" type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} />
        </Field>
        <Field label={t("Notes")}>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="ps-type-foot">
        <span>
          {t("Subtotal")} <b className="num-inline">{fmtMoney(net)}</b> · {t("VAT 18%")} <b className="num-inline">{fmtMoney(net * 0.18)}</b> · {t("Total")} <b className="num-inline ps-strong">{fmtMoney(total)} AZN</b>
        </span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ok}
          onClick={() =>
            onSave({
              ref: ref.trim(),
              lines: lines.map((l) => ({ description: l.txt ?? { en: l.description.trim(), az: l.description.trim() }, qty: Number(l.qty), unit: l.unit, unitPrice: Number(l.price) })),
              deliveryDays: Number(delivery) || 0,
              validDays: Number(valid) || 30,
              paymentTerms: payment,
              shipping: Number(shipping) || 0,
              notes: notes.trim(),
            }, file)
          }
        >
          <Check size={14} />
          {ok ? t("Save the quote") : t("Price every line to save")}
        </button>
      </div>
    </Panel>
  );
}

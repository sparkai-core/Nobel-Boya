import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, FileText, Keyboard, Plus, RotateCcw, ScanText, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { Field, PageHero, Panel, toast, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { addDays, TODAY } from "../../../ops/dates";
import { R, tradeName } from "../../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import type { Rfq, Txt, Vendor } from "../../../ops/types";
import { hash01, reducedMotion, rfqOrder, vendorsFor } from "./shared";

type Mode = "read" | "type";
type DocLine = { description: Txt; qty: number; unit: string; unitPrice: number };
type Doc = { ref: string; date: string; validUntil: string; validDays: number; payment: string; delivery: number; lines: DocLine[]; subtotal: number; shipping: number; total: number };
type FieldKey = "ref" | "date" | "lines" | "valid" | "payment" | "delivery" | "subtotal" | "shipping" | "total";

const STEPS: { key: FieldKey; label: string; region: "head" | "terms" | "table" | "totals" }[] = [
  { key: "ref", label: "Reference", region: "head" },
  { key: "date", label: "Quote date", region: "head" },
  { key: "valid", label: "Price holds until", region: "terms" },
  { key: "payment", label: "Payment terms", region: "terms" },
  { key: "delivery", label: "Delivery", region: "terms" },
  { key: "lines", label: "Lines", region: "table" },
  { key: "subtotal", label: "Subtotal", region: "totals" },
  { key: "shipping", label: "Shipping", region: "totals" },
  { key: "total", label: "Quoted total", region: "totals" },
];
const REGION: Record<string, { top: number; height: number }> = {
  head: { top: 3, height: 17 },
  terms: { top: 21, height: 15 },
  table: { top: 37, height: 36 },
  totals: { top: 73, height: 17 },
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The vendor's document, generated from the vendor and the RFQ lines (prices vary per vendor, deterministically). */
function buildDoc(vendor: Vendor, rfq: Rfq | undefined, materials: { key: string; rate: number; name: Txt; unit: string; trade: string }[], n: number): Doc {
  const src = rfq?.lines.length
    ? rfq.lines.map((l) => ({ description: l.description, qty: l.qty, unit: l.unit, rate: l.material ? (materials.find((m) => m.key === l.material)?.rate ?? 0) : 0 }))
    : materials
        .filter((m) => m.trade === vendor.trade)
        .slice(0, 2)
        .map((m, i) => ({ description: m.name, qty: i ? 40 : 120, unit: m.unit, rate: m.rate }));
  const lines = src.map((l, i) => {
    const k = hash01(`${vendor.id}:${i}:${l.qty}`);
    const base = l.rate > 0 ? l.rate : 12 + k * 60;
    return { description: l.description, qty: l.qty, unit: l.unit, unitPrice: r2(base * (0.91 + k * 0.16)) };
  });
  const subtotal = r2(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
  const shipping = hash01(vendor.id + (rfq?.id ?? "")) > 0.5 ? Math.round((subtotal * 0.008) / 50) * 50 : 0;
  const validDays = 30;
  return {
    ref: `${vendor.name.split(" ")[0]!.slice(0, 3).toUpperCase()}-2026-${300 + n}`,
    date: TODAY,
    validUntil: addDays(TODAY, validDays),
    validDays,
    payment: vendor.paymentTerms,
    delivery: vendor.avgDeliveryDays,
    lines,
    subtotal,
    shipping,
    total: r2(subtotal * 1.18 + shipping),
  };
}

/** Ingest quotations: read a vendor file on the reading desk, or type the quote in. */
export function QuoteUploadPage() {
  const { t, x, lang } = useL();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rfqs = useOps((s) => s.rfqs);
  const vendors = useOps((s) => s.vendors);
  const quotes = useOps((s) => s.quotes);
  const materials = useOps((s) => s.materials);
  const seq = useOps((s) => s.seq);
  const submitQuote = useOps((s) => s.submitQuote);

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
  const [mode, setMode] = useState<Mode>("read");

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
        title={t("Ingest quotations")}
        subtitle={t("Drop the vendor's file and the reading desk pulls out the prices and terms, or type the quote in by hand.")}
        flow={["Pick vendor and RFQ", "Read or type", "Check the fields", "Save the quote"]}
        art="quotes"
        back={{ to: R.quotes, label: "Quotations" }}
      />

      <Panel title={t("Context")} icon={<FileText size={15} />} actions={<Segmented<Mode> value={mode} onChange={setMode} label={t("How to enter it")} options={[{ value: "read", label: <span className="ps-seg-ic"><ScanText size={13} />{t("Read a file")}</span> }, { value: "type", label: <span className="ps-seg-ic"><Keyboard size={13} />{t("Type it in")}</span> }]} />}>
        <div className="k-form">
          <Field label={t("From")} hint={vendor ? `${tradeName(vendor.trade, lang)} · ${vendor.city} · ${t("pays {terms}", { terms: vendor.paymentTerms })}` : undefined}>
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
        mode === "read" ? (
          <ReadingDesk
            key={`${vendorId}-${rfqId}`}
            vendor={vendor}
            rfq={rfq}
            doc={buildDoc(vendor, rfq, materials, (seq.QT ?? 0) + 1)}
            onSave={(doc, edits) => {
              const id = submitQuote({ rfqId: rfq?.id ?? null, vendorId: vendor.id, ref: edits.ref, lines: doc.lines, deliveryDays: edits.delivery, validDays: edits.validDays, paymentTerms: edits.payment, shipping: edits.shipping, notes: "", source: "UPLOAD" });
              toast(t("{id} saved from {vendor}'s file", { id, vendor: vendor.name }));
              navigate(R.quote(id));
            }}
          />
        ) : (
          <TypeForm
            key={`${vendorId}-${rfqId}`}
            vendor={vendor}
            rfq={rfq}
            onSave={(input) => {
              const id = submitQuote({ rfqId: rfq?.id ?? null, vendorId: vendor.id, ...input, source: "MANUAL" });
              toast(t("{id} saved", { id }));
              navigate(R.quote(id));
            }}
          />
        )
      ) : null}
    </div>
  );
}

type Edits = { ref: string; delivery: number; validDays: number; payment: string; shipping: number };

function ReadingDesk({ vendor, rfq, doc, onSave }: { vendor: Vendor; rfq: Rfq | undefined; doc: Doc; onSave: (doc: Doc, edits: Edits) => void }) {
  const { t, x, d, lang } = useL();
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "done">("idle");
  const [lit, setLit] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [over, setOver] = useState(false);
  const [edits, setEdits] = useState<Edits>({ ref: doc.ref, delivery: doc.delivery, validDays: doc.validDays, payment: doc.payment, shipping: doc.shipping });
  const input = useRef<HTMLInputElement>(null);

  const conf = (k: FieldKey) => Math.round((0.86 + hash01(`${vendor.id}${k}`) * 0.13) * 100);

  useEffect(() => {
    if (phase !== "reading") return;
    if (reducedMotion()) {
      setLit(STEPS.length);
      setPhase("done");
      return;
    }
    const start = performance.now();
    const tick = window.setInterval(() => setElapsed((performance.now() - start) / 1000), 100);
    let i = 0;
    const step = window.setInterval(() => {
      i += 1;
      setLit(i);
      if (i >= STEPS.length) {
        window.clearInterval(step);
        window.clearInterval(tick);
        setElapsed((performance.now() - start) / 1000);
        setPhase("done");
      }
    }, 480);
    return () => {
      window.clearInterval(step);
      window.clearInterval(tick);
    };
  }, [phase]);

  const take = (f: { name: string; size: number }) => {
    setFile(f);
    setLit(0);
    setElapsed(0);
    setPhase("reading");
  };
  const sample = () => take({ name: `${vendor.name.split(" ")[0]!.toLowerCase()}_${(rfq?.ref ?? "offer").toLowerCase()}.pdf`, size: 184_000 + Math.round(hash01(vendor.id) * 220_000) });
  const reset = () => {
    setFile(null);
    setPhase("idle");
    setLit(0);
  };

  const current = phase === "reading" ? STEPS[Math.min(lit, STEPS.length - 1)] : null;
  const region = current ? REGION[current.region]! : null;
  const value = (k: FieldKey): string => {
    switch (k) {
      case "ref":
        return doc.ref;
      case "date":
        return d(doc.date);
      case "valid":
        return d(doc.validUntil);
      case "payment":
        return doc.payment;
      case "delivery":
        return t("{n} days", { n: doc.delivery });
      case "lines":
        return rfq ? t("{n} of {m} lines matched", { n: doc.lines.length, m: rfq.lines.length }) : t("{n} lines", { n: doc.lines.length });
      case "subtotal":
        return `${fmtMoney(doc.subtotal)} AZN`;
      case "shipping":
        return `${fmtMoney(doc.shipping)} AZN`;
      case "total":
        return `${fmtMoney(doc.total)} AZN`;
    }
  };

  return (
    <section className="ps-desk-wrap">
      <div
        className={`ps-drop${over ? " over" : ""}${file ? " has" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) take({ name: f.name, size: f.size });
        }}
      >
        <UploadCloud size={22} />
        <div>
          <strong>{t("Drop the vendor's quote here")}</strong>
          <small>{t("PDF, scan or photo. Nothing leaves this browser.")}</small>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          accept=".pdf,.png,.jpg,.jpeg,.xlsx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) take({ name: f.name, size: f.size });
            e.target.value = "";
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}>
          {t("Choose a file")}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={sample}>
          <Sparkles size={13} />
          {t("Use the vendor's file")}
        </button>
      </div>

      {file ? (
        <div className="ps-tray">
          <span className="ps-tray-icon">
            <FileText size={16} />
          </span>
          <span className="ps-tray-name">
            <strong className="truncate">{file.name}</strong>
            <small>{Math.round(file.size / 1024)} KB</small>
          </span>
          <span className={`ps-tray-state ${phase}`}>
            {phase === "done" ? <Check size={13} strokeWidth={3} /> : <i className="ps-spin" aria-hidden="true" />}
            {phase === "done" ? t("Read in {s} s", { s: elapsed.toFixed(1) }) : t("Reading… {s} s", { s: elapsed.toFixed(1) })}
          </span>
          <button type="button" className="icon-btn" onClick={reset} aria-label={t("Remove file")}>
            <Trash2 size={15} />
          </button>
        </div>
      ) : null}

      <div className={`ps-desk${file ? " on" : ""}`}>
        <div className="ps-paper-wrap">
          <div className={`ps-paper${file ? "" : " blank"}`} aria-label={t("Vendor document")}>
            {region ? <span className="ps-sweep" style={{ top: `${region.top}%`, height: `${region.height}%` }} aria-hidden="true" /> : null}
            <header className="ps-paper-head">
              <span className="ps-paper-logo">{vendor.name.slice(0, 1)}</span>
              <span>
                <strong>{vendor.name}</strong>
                <small>
                  {vendor.city}, Azərbaycan · {t("TRN")} {vendor.trn}
                </small>
                <small>
                  {vendor.phone} · {vendor.email}
                </small>
              </span>
            </header>
            <h4>{t("Commercial offer")}</h4>
            <dl className="ps-paper-meta">
              <div>
                <dt>№</dt>
                <dd>{doc.ref}</dd>
              </div>
              <div>
                <dt>{t("Date")}</dt>
                <dd>{d(doc.date)}</dd>
              </div>
              <div>
                <dt>{t("Valid until")}</dt>
                <dd>{d(doc.validUntil)}</dd>
              </div>
              <div>
                <dt>{t("Payment")}</dt>
                <dd>{doc.payment}</dd>
              </div>
              <div>
                <dt>{t("Delivery")}</dt>
                <dd>{t("{n} days", { n: doc.delivery })}</dd>
              </div>
              <div>
                <dt>{t("To")}</dt>
                <dd>Nobel · Qobu</dd>
              </div>
            </dl>
            <table className="ps-paper-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("Description")}</th>
                  <th className="r">{t("Qty")}</th>
                  <th className="r">{t("Price")}</th>
                  <th className="r">{t("Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="truncate">{x(l.description)}</td>
                    <td className="r">
                      {fmtQty(l.qty, l.unit)} {unitLabel(l.unit, lang)}
                    </td>
                    <td className="r">{fmtMoney(l.unitPrice)}</td>
                    <td className="r">{fmtMoney(l.qty * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="ps-paper-totals">
              <div>
                <dt>{t("Subtotal")}</dt>
                <dd>{fmtMoney(doc.subtotal)}</dd>
              </div>
              <div>
                <dt>{t("VAT 18%")}</dt>
                <dd>{fmtMoney(doc.subtotal * 0.18)}</dd>
              </div>
              <div>
                <dt>{t("Shipping")}</dt>
                <dd>{fmtMoney(doc.shipping)}</dd>
              </div>
              <div className="grand">
                <dt>{t("Total, AZN")}</dt>
                <dd>{fmtMoney(doc.total)}</dd>
              </div>
            </dl>
            <footer className="ps-paper-sign">
              <span className="ps-paper-stamp">{vendor.name.split(" ")[0]}</span>
              <small>{vendor.contact}</small>
            </footer>
            {!file ? <div className="ps-paper-veil">{t("The vendor's document appears here once a file is in.")}</div> : null}
          </div>
        </div>

        <div className="ps-fields">
          <header className="ps-fields-head">
            <span className="k-ai-tag">
              <ScanText size={13} />
              {t("Read off the page")}
            </span>
            <small className="muted">{phase === "idle" ? t("Waiting for a file") : t("{n} of {m} fields", { n: Math.min(lit, STEPS.length), m: STEPS.length })}</small>
          </header>
          <ol>
            {STEPS.map((st, i) => {
              const on = phase !== "idle" && i < lit;
              const c = conf(st.key);
              return (
                <li key={st.key} className={`ps-field${on ? " on" : ""}${current?.key === st.key ? " now" : ""}`}>
                  <span className="ps-field-label">{t(st.label)}</span>
                  <span className="ps-field-value">{on ? value(st.key) : <i className="ps-skel" aria-hidden="true" />}</span>
                  <span className={`ps-field-conf ${c < 90 ? "warn" : "ok"}`}>{on ? `${c}%` : ""}</span>
                </li>
              );
            })}
          </ol>
          {phase === "done" ? (
            <div className="ps-confirm k-rise">
              <p className="small muted">{t("Check what was read. Change anything that is wrong, then save.")}</p>
              <div className="k-form">
                <Field label={t("Reference")}>
                  <input className="input" value={edits.ref} onChange={(e) => setEdits({ ...edits, ref: e.target.value })} />
                </Field>
                <Field label={t("Payment terms")}>
                  <input className="input" value={edits.payment} onChange={(e) => setEdits({ ...edits, payment: e.target.value })} />
                </Field>
                <Field label={t("Delivery days")}>
                  <input className="input num" type="number" min={0} value={edits.delivery} onChange={(e) => setEdits({ ...edits, delivery: Number(e.target.value) || 0 })} />
                </Field>
                <Field label={t("Price holds for (days)")}>
                  <input className="input num" type="number" min={1} value={edits.validDays} onChange={(e) => setEdits({ ...edits, validDays: Number(e.target.value) || 1 })} />
                </Field>
                <Field label={t("Shipping, AZN")}>
                  <input className="input num" type="number" min={0} value={edits.shipping} onChange={(e) => setEdits({ ...edits, shipping: Number(e.target.value) || 0 })} />
                </Field>
              </div>
              <div className="ps-actions">
                <button type="button" className="btn btn-ghost" onClick={() => take(file!)}>
                  <RotateCcw size={14} />
                  {t("Read again")}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => onSave(doc, edits)}>
                  <Check size={14} />
                  {t("Save the quote")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type TypeLine = { id: number; description: string; qty: string; unit: string; price: string; txt: Txt | null };

function TypeForm({ vendor, rfq, onSave }: { vendor: Vendor; rfq: Rfq | undefined; onSave: (input: { ref: string; lines: DocLine[]; deliveryDays: number; validDays: number; paymentTerms: string; shipping: number; notes: string }) => void }) {
  const { t, x, lang } = useL();
  const [lines, setLines] = useState<TypeLine[]>(() =>
    rfq?.lines.length ? rfq.lines.map((l, i) => ({ id: i, description: x(l.description), qty: String(l.qty), unit: l.unit, price: "", txt: l.description })) : [{ id: 0, description: "", qty: "", unit: "ədəd", price: "", txt: null }],
  );
  const [ref, setRef] = useState("");
  const [delivery, setDelivery] = useState(String(vendor.avgDeliveryDays));
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
          <input className="input" value={ref} placeholder={t("Leave empty to number it automatically")} onChange={(e) => setRef(e.target.value)} />
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
            })
          }
        >
          <Check size={14} />
          {ok ? t("Save the quote") : t("Price every line to save")}
        </button>
      </div>
    </Panel>
  );
}

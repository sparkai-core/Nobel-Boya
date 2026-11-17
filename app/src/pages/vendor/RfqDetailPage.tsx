import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Check, CheckCircle2, FileUp, Keyboard, MessageSquareText, Send, Sparkles, X } from "lucide-react";
import { Badge, DetailHeader, Empty, Field, KeyFigure, KeyVals, Meter, Money, NextBar, Panel, StatusBadge, toast, useL } from "../../components/kit";
import { Segmented } from "../../components/ui";
import { useOps } from "../../ops/store";
import { PEOPLE } from "../../ops/seed";
import { quoteTotal, tradeName } from "../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../lib/format";
import type { Quotation, Rfq, Vendor } from "../../ops/types";
import { BUCKET_LABEL, BUCKET_TONE, BUYER, useVendor, VP } from "./model";
import { Countdown, DeclineDialog, FilePick, OutcomeBadge, QuoteJourney } from "./parts";

const TERMS = ["15 days", "30 days", "45 days", "60 days", "30% advance, balance on delivery", "Monthly in advance"];
const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** One RFQ from the vendor's side: what the buyer asked for, the quote form, and the sent quote's journey. */
export function VpRfqDetail() {
  const { id } = useParams();
  const { t, x, d, rel, lang } = useL();
  const { s, view } = useVendor();
  const vendorRespond = useOps((st) => st.vendorRespond);
  const [justSent, setJustSent] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const row = view?.invites.find((i) => i.rfq.id === id) ?? null;
  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;
  if (!row)
    return (
      <div className="k-page vp-page">
        <Link to={VP.rfqs} className="k-back">
          <ArrowLeft size={14} />
          {t("Back to the RFQ inbox")}
        </Link>
        <Empty title={t("This request was not sent to {vendor}", { vendor: view.vendor.name })}>{t("Switch vendor in the top bar, or open the inbox.")}</Empty>
      </div>
    );

  const { rfq, inv, bucket } = row;
  const v = view.vendor;
  const quote = row.quote;
  const canQuote = bucket === "answer";
  const ack = () => {
    vendorRespond(rfq.id, v.id, "ACKNOWLEDGED");
    toast(t("{ref} acknowledged. The buyer can see you are pricing it.", { ref: rfq.ref }));
  };

  return (
    <div className="k-page vp-page">
      <Link to={VP.rfqs} className="k-back">
        <ArrowLeft size={14} />
        {t("Back to the RFQ inbox")}
      </Link>
      <DetailHeader
        refCode={rfq.ref}
        badges={
          <>
            <Badge tone={BUCKET_TONE[bucket]}>{t(BUCKET_LABEL[bucket])}</Badge>
            {rfq.status !== "OPEN" ? <StatusBadge kind="rfq" status={rfq.status} /> : null}
            {quote ? <OutcomeBadge s={s} q={quote} /> : null}
          </>
        }
        title={x(rfq.title)}
        meta={
          <>
            <span>
              <Building2 size={13} /> {BUYER}
            </span>
            <span>{tradeName(rfq.trade, lang)}</span>
            <span>{t("sent {date}", { date: d(rfq.createdAt) })}</span>
            {row.neededBy ? <span>{t("needed on site {date}", { date: d(row.neededBy) })}</span> : null}
          </>
        }
        aside={
          <div className="vp-head-aside">
            <Countdown due={rfq.dueDate} closed={rfq.status !== "OPEN"} size={78} />
            <KeyFigure label={t("Answer by")} value={d(rfq.dueDate)} sub={rfq.status === "OPEN" ? rel(rfq.dueDate) : t("Closed")} tone={rfq.status === "OPEN" && row.daysLeft <= 3 ? "bad" : undefined} />
          </div>
        }
      />

      {canQuote ? (
        <NextBar text={inv.status === "INVITED" ? t("Acknowledge so the buyer knows you are pricing it, then fill in your prices below.") : t("Price every line below and send. The buyer sees your quote the moment you submit.")}>
          {inv.status === "INVITED" ? (
            <button type="button" className="btn btn-ghost" onClick={ack}>
              <Check size={15} />
              {t("Acknowledge")}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            {t("Prepare quote")}
          </button>
          <button type="button" className="btn btn-ghost vp-danger" onClick={() => setDeclining(true)}>
            <X size={15} />
            {t("Decline")}
          </button>
        </NextBar>
      ) : quote ? (
        <NextBar tone="ok" text={t("Your quote {id} is with {buyer}. You will see here when they decide.", { id: quote.id, buyer: BUYER })} />
      ) : (
        <NextBar tone="muted" text={inv.status === "DECLINED" ? t("You declined this request: {reason}", { reason: inv.reason ?? "—" }) : t("This request is closed. No quote was sent.")} />
      )}

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("What the buyer asked for")} icon={<MessageSquareText size={15} />} count={rfq.lines.length} pad={false}>
            <div className="k-table-wrap">
              <table className="k-table vp-ask">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>#</th>
                    <th>{t("Item")}</th>
                    <th style={{ textAlign: "right" }}>{t("Qty")}</th>
                    <th>{t("Unit")}</th>
                    <th className="hide-900">{t("Needed by")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rfq.lines.map((l, i) => (
                    <tr key={l.key}>
                      <td className="muted num-inline" data-label="#">{i + 1}</td>
                      <td data-label={t("Item")}>
                        <div className="k-cell-title">
                          <strong>{x(l.description)}</strong>
                          {l.spec ? <small>{l.spec}</small> : null}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Qty")}>
                        <b>{fmtQty(l.qty, l.unit)}</b>
                      </td>
                      <td data-label={t("Unit")}>{unitLabel(l.unit, lang)}</td>
                      <td className="hide-900" data-label={t("Needed by")}>
                        {row.neededBy ? d(row.neededBy) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rfq.note ? (
              <div className="vp-buyer-note vp-buyer-note-pad">
                <MessageSquareText size={14} />
                <span>
                  <b>{t("Note from the buyer")}</b> {x(rfq.note)}
                </span>
              </div>
            ) : null}
          </Panel>

          <div ref={formRef} className="vp-anchor">
            {quote ? (
              <SentQuote q={quote} rfq={rfq} fresh={justSent === quote.id} />
            ) : canQuote ? (
              <QuoteForm rfq={rfq} vendor={v} onSent={setJustSent} />
            ) : null}
          </div>
        </div>

        <div className="k-stack">
          <Panel title={t("About this request")} icon={<Building2 size={15} />}>
            <KeyVals
              cols={1}
              items={[
                { k: t("Buyer"), v: BUYER },
                { k: t("Project"), v: t("Qobu warehouse and administration building") },
                { k: t("Contact"), v: `${PEOPLE.buyer} · ${t("Procurement")}` },
                { k: t("Deliver to"), v: t("Qobu site, main gate, Absheron district") },
                { k: t("Other vendors invited"), v: t("{n} vendors", { n: Math.max(0, rfq.invitations.length - 1) }) },
              ]}
            />
            <p className="muted small vp-fair">{t("Other vendors' names and prices are never shown to you, and yours are never shown to them.")}</p>
          </Panel>
        </div>
      </div>

      <DeclineDialog open={declining} onClose={() => setDeclining(false)} rfqId={rfq.id} rfqRef={rfq.ref} vendorId={v.id} />
    </div>
  );
}

function QuoteForm({ rfq, vendor, onSent }: { rfq: Rfq; vendor: Vendor; onSent: (id: string) => void }) {
  const { t, x, lang } = useL();
  const submitQuote = useOps((s) => s.submitQuote);
  const materials = useOps((s) => s.materials);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [shipping, setShipping] = useState("0");
  const [days, setDays] = useState(String(vendor.avgDeliveryDays));
  const [valid, setValid] = useState("30");
  const [terms, setTerms] = useState(vendor.paymentTerms);
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"type" | "file">("type");
  const [file, setFile] = useState("");
  const [reading, setReading] = useState(false);
  const [readFrom, setReadFrom] = useState("");
  const [tried, setTried] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const net = rfq.lines.reduce((a, l) => a + l.qty * num(prices[l.key]), 0);
  const vat = net * 0.18;
  const ship = Math.max(0, num(shipping));
  const total = net + vat + ship;
  const priced = rfq.lines.filter((l) => num(prices[l.key]) > 0).length;
  const missing = rfq.lines.length - priced;
  const termOptions = useMemo(() => (TERMS.includes(vendor.paymentTerms) ? TERMS : [vendor.paymentTerms, ...TERMS]), [vendor.paymentTerms]);

  const pickFile = (name: string) => {
    setFile(name);
    if (!name) return;
    setReading(true);
    const vn = Number(vendor.id.slice(2)) || 1;
    timer.current = window.setTimeout(() => {
      const next: Record<string, string> = {};
      rfq.lines.forEach((l, i) => {
        const rate = materials.find((m) => m.key === l.material)?.rate ?? 10;
        const factor = 0.96 + (((i + 1) * 37 + vn * 11) % 10) / 100;
        next[l.key] = (Math.round(rate * factor * 100) / 100).toFixed(2);
      });
      setPrices(next);
      setReading(false);
      setReadFrom(name);
      setMode("type");
    }, 1300);
  };

  const submit = () => {
    setTried(true);
    if (missing > 0 || num(days) <= 0 || num(valid) <= 0) {
      toast(t("Price every line and set the delivery time before you send."), "warn");
      return;
    }
    const note = [notes.trim(), readFrom ? `${t("Attached file")}: ${readFrom}` : ""].filter(Boolean).join(" · ");
    const id = submitQuote({
      rfqId: rfq.id,
      vendorId: vendor.id,
      ref: ref.trim() || undefined,
      lines: rfq.lines.map((l) => ({ description: l.description, qty: l.qty, unit: l.unit, unitPrice: num(prices[l.key]) })),
      deliveryDays: Math.round(num(days)),
      validDays: Math.round(num(valid)),
      paymentTerms: terms,
      shipping: ship,
      notes: note,
      source: "PORTAL",
    });
    toast(t("Quote {id} sent to {buyer}.", { id, buyer: BUYER }));
    onSent(id);
  };

  return (
    <section className="vp-qform k-rise" aria-label={t("Your quote")}>
      <header className="vp-qform-head">
        <div>
          <span className="k-eyebrow">{t("Your quote")}</span>
          <h2>{t("Price this request")}</h2>
        </div>
        <Segmented<"type" | "file">
          label={t("How to quote")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "type", label: <><Keyboard size={14} /> {t("Type prices")}</> },
            { value: "file", label: <><FileUp size={14} /> {t("Upload a file instead")}</> },
          ]}
        />
      </header>

      {mode === "file" ? (
        <div className="vp-upload">
          <FilePick value={file} onChange={pickFile} label="Choose your quotation file" hint={t("PDF, Excel or a photo. We read the prices into the form so you can check them. Only the file name is kept in this demo.")} />
          {reading ? (
            <p className="vp-reading">
              <Sparkles size={14} />
              <span className="k-typing">{t("Reading {file}", { file })}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {readFrom ? (
            <div className="k-callout k-tone-brand vp-readfrom">
              <Sparkles size={15} />
              <span>{t("{n} prices read from {file}. Check them before you send.", { n: rfq.lines.length, file: readFrom })}</span>
            </div>
          ) : null}
          <div className="vp-qlines">
            <div className="vp-qline vp-qline-head" aria-hidden="true">
              <span>{t("Item")}</span>
              <span className="r">{t("Qty")}</span>
              <span className="r">{t("Unit price, AZN")}</span>
              <span className="r">{t("Amount")}</span>
            </div>
            {rfq.lines.map((l) => {
              const p = num(prices[l.key]);
              const bad = tried && !(p > 0);
              return (
                <div key={l.key} className={`vp-qline${bad ? " bad" : ""}${p > 0 ? " done" : ""}`}>
                  <span className="vp-qline-item">
                    <strong>{x(l.description)}</strong>
                    {l.spec ? <small>{l.spec}</small> : null}
                  </span>
                  <span className="r num-inline vp-qline-qty">
                    {fmtQty(l.qty, l.unit)} <small>{unitLabel(l.unit, lang)}</small>
                  </span>
                  <span className="r">
                    <input
                      className="input num vp-price"
                      inputMode="decimal"
                      value={prices[l.key] ?? ""}
                      placeholder="0.00"
                      aria-label={t("Unit price for {item}", { item: x(l.description) })}
                      onChange={(e) => setPrices((cur) => ({ ...cur, [l.key]: e.target.value }))}
                    />
                  </span>
                  <span className="r num-inline vp-qline-amt">{p > 0 ? fmtMoney(l.qty * p) : "—"}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="vp-qform-grid">
        <div className="k-form">
          <Field label={t("Delivery time, days")} error={tried && num(days) <= 0 ? t("Required") : undefined}>
            <input className="input num" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <Field label={t("Price valid for, days")} error={tried && num(valid) <= 0 ? t("Required") : undefined}>
            <input className="input num" inputMode="numeric" value={valid} onChange={(e) => setValid(e.target.value)} />
          </Field>
          <Field label={t("Payment terms")}>
            <select className="input select" value={terms} onChange={(e) => setTerms(e.target.value)}>
              {termOptions.map((o) => (
                <option key={o} value={o}>
                  {t(o)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Shipping, AZN")}>
            <input className="input num" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} />
          </Field>
          <Field label={t("Your reference")} hint={t("Your own quote number, if you have one")}>
            <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={`${vendor.name.split(" ")[0]!.slice(0, 3).toUpperCase()}-2026-…`} />
          </Field>
          <Field label={t("Notes for the buyer")} wide>
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Exclusions, alternatives, delivery lots…")} />
          </Field>
        </div>

        <aside className="vp-total">
          <div className="vp-total-row">
            <span>{t("Subtotal")}</span>
            <b className="num-inline">{fmtMoney(net)}</b>
          </div>
          <div className="vp-total-row">
            <span>{t("VAT 18%")}</span>
            <b className="num-inline">{fmtMoney(vat)}</b>
          </div>
          <div className="vp-total-row">
            <span>{t("Shipping")}</span>
            <b className="num-inline">{fmtMoney(ship)}</b>
          </div>
          <div className="vp-total-sum">
            <span>{t("Total")}</span>
            <strong>
              <Money value={total} />
            </strong>
          </div>
          <div className="vp-total-meter">
            <Meter value={rfq.lines.length ? priced / rfq.lines.length : 0} tone={missing ? "brand" : "ok"} label={t("Lines priced")} />
            <small className={missing && tried ? "k-text-bad" : "muted"}>{missing ? t("{n} of {m} lines priced", { n: priced, m: rfq.lines.length }) : t("Every line priced")}</small>
          </div>
          <button type="button" className="btn btn-primary btn-lg vp-send" onClick={submit} disabled={reading}>
            <Send size={15} />
            {t("Send quote to {buyer}", { buyer: BUYER })}
          </button>
          <p className="muted small">{t("Sent straight to the buyer's quotations list. No email needed.")}</p>
        </aside>
      </div>
    </section>
  );
}

function SentQuote({ q, rfq, fresh }: { q: Quotation; rfq: Rfq; fresh: boolean }) {
  const { t, x, d, lang } = useL();
  const s = useOps();
  const net = q.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  return (
    <section className={`vp-sent${fresh ? " fresh" : ""}`} aria-label={t("Your quote")}>
      <header className="vp-sent-head">
        <span className="vp-sent-check">
          <CheckCircle2 size={26} />
        </span>
        <div>
          <span className="k-eyebrow">{t("Your quote")} · {q.id}</span>
          <h2>{fresh ? t("Sent to {buyer}: the buyer can see it now", { buyer: BUYER }) : t("Sent to {buyer} on {date}", { buyer: BUYER, date: d(q.receivedAt) })}</h2>
          <p className="muted">{t("Reference {ref} · for {rfq}", { ref: q.ref, rfq: rfq.ref })}</p>
        </div>
        <OutcomeBadge s={s} q={q} />
      </header>
      <div className="vp-sent-journey">
        <QuoteJourney s={s} q={q} />
      </div>
      <div className="vp-sent-figs">
        <div>
          <small>{t("Total incl. VAT")}</small>
          <strong>
            <Money value={quoteTotal(q)} />
          </strong>
        </div>
        <div>
          <small>{t("Delivery")}</small>
          <strong>{t("{n} days", { n: q.deliveryDays })}</strong>
        </div>
        <div>
          <small>{t("Price valid until")}</small>
          <strong>{d(q.validUntil)}</strong>
        </div>
        <div>
          <small>{t("Payment terms")}</small>
          <strong>{t(q.paymentTerms)}</strong>
        </div>
      </div>
      <div className="k-table-wrap">
        <table className="k-table vp-sent-lines">
          <thead>
            <tr>
              <th>{t("Item")}</th>
              <th style={{ textAlign: "right" }}>{t("Qty")}</th>
              <th style={{ textAlign: "right" }}>{t("Unit price")}</th>
              <th style={{ textAlign: "right" }}>{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l) => (
              <tr key={l.key}>
                <td data-label={t("Item")}>{x(l.description)}</td>
                <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Qty")}>
                  {fmtQty(l.qty, l.unit)} {unitLabel(l.unit, lang)}
                </td>
                <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Unit price")}>
                  {fmtMoney(l.unitPrice)}
                </td>
                <td style={{ textAlign: "right" }} className="num-inline" data-label={t("Amount")}>
                  {fmtMoney(l.qty * l.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {[
              { k: t("Subtotal"), v: net },
              { k: t("VAT 18%"), v: net * q.vatRate },
              { k: t("Shipping"), v: q.shipping },
            ].map((r) => (
              <tr key={r.k}>
                <td colSpan={3} style={{ textAlign: "right" }}>
                  {r.k}
                </td>
                <td style={{ textAlign: "right" }} className="num-inline">
                  {fmtMoney(r.v)}
                </td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      {q.notes ? <p className="k-note">{x(q.notes)}</p> : null}
    </section>
  );
}

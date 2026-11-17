import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarRange, FilePlus2, FileSignature, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Avatar, Dialog, Empty, Field, FilterChips, FlowRail, Money, PageHero, SearchBox, StatTiles, toast, Toolbar, useL, useSearch } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, monthShort, same, toDate, TODAY } from "../../../ops/dates";
import { tradeName } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort, unitLabel } from "../../../lib/format";
import type { Agreement } from "../../../ops/types";
import { addMonths, AGR_META, agrOpen, agrPos, agrSaved, agrState, agrUsed, matOf, monthsFrom, PR, type AgrState } from "./shared";
import { AgrStatus, CapMeter, ValidityBar } from "./parts";

/** Framework agreements: validity and spend on one timeline, then a card per agreement with its cap meter. */
export function AgreementsPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [state, setState] = useState<AgrState | null>(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const vname = (id: string) => s.vendors.find((v) => v.id === id)?.name ?? id;
  const counts = useMemo(() => s.agreements.reduce<Record<string, number>>((a, g) => ((a[agrState(g)] = (a[agrState(g)] ?? 0) + 1), a), {}), [s.agreements]);
  const filtered = useMemo(() => s.agreements.filter((a) => !state || agrState(a) === state), [s.agreements, state]);
  const rows = useSearch(filtered, q, (a) => [a.ref, a.id, a.title, vname(a.vendorId), ...a.rates.map((r) => matOf(s, r.material)?.name)]);

  const open = s.agreements.filter(agrOpen);
  const committed = s.agreements.reduce((a, g) => a + agrUsed(s, g), 0);
  const saved = s.agreements.reduce((a, g) => a + agrSaved(s, g), 0);
  const expiring = s.agreements.filter((a) => agrState(a) === "EXPIRING");

  // timeline window
  const from = s.agreements.reduce((m, a) => (a.from < m ? a.from : m), TODAY);
  const to = s.agreements.reduce((m, a) => (a.to > m ? a.to : m), TODAY);
  const start = `${from.slice(0, 7)}-01`;
  const months = monthsFrom(start, to);
  const end = `${addMonths(`${months[months.length - 1]}-01`, 1)}`;
  const span = Math.max(1, diffDays(start, end));
  const X = (iso: string) => `${(Math.max(0, Math.min(span, diffDays(start, iso))) / span) * 100}%`;

  return (
    <div className="k-page pur-page">
      <PageHero
        eyebrow={t("Procurement · Purchasing")}
        title={t("Framework agreements")}
        subtitle={t("Price lists agreed with vendors for the whole job. Call off at agreed rates without new quotes.")}
        flow={["Agree rates", "Call off", "Track the cap", "Renew"]}
        art="approve"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <FilePlus2 size={15} />
            {t("New agreement")}
          </button>
        }
      />
      <FlowRail current="order" />

      <StatTiles
        items={[
          { label: t("Active agreements"), value: open.length, sub: t("{n} in total", { n: s.agreements.length }), tone: "brand", onClick: () => setState("ACTIVE") },
          { label: t("Committed through agreements"), value: <Money value={committed} short />, sub: t("{n} call-offs", { n: s.agreements.reduce((a, g) => a + agrPos(s, g).length, 0) }) },
          { label: t("Expiring soon"), value: expiring.length, sub: expiring.length ? expiring.map((a) => a.ref).join(", ") : t("None in the next 45 days"), tone: expiring.length ? "warn" : "ok", onClick: () => setState("EXPIRING") },
          { label: t("Savings vs BOQ rates"), value: <Money value={saved} short />, sub: t("on the call-offs placed so far"), tone: saved >= 0 ? "ok" : "bad" },
        ]}
      />

      <section className="pur-visual" aria-label={t("Validity and spend")}>
        <header className="pur-vhead">
          <div>
            <h2>{t("Validity and spend")}</h2>
            <p>{t("Each bar is an agreement's validity; the fill is how much of its cap is spent. Dots are call-offs.")}</p>
          </div>
          <span className="pur-legend">
            <i className="ok" /> {t("Active")} <i className="warn" /> {t("Expiring soon")} <i className="muted" /> {t("Expired")} <i className="draft" /> {t("Draft")}
          </span>
        </header>
        <div className="pur-tl-scroll">
          <div className="pur-tl">
            <div className="pur-tl-axis">
              {months.map((m, i) => (
                <span key={m} style={{ left: X(`${m}-01`) }}>
                  {i === 0 || m.endsWith("-01") ? `${monthShort(toDate(`${m}-01`).getUTCMonth(), lang)} ${m.slice(2, 4)}` : monthShort(toDate(`${m}-01`).getUTCMonth(), lang)}
                </span>
              ))}
              <b className="pur-tl-today" style={{ left: X(TODAY) }}>
                {t("Today")}
              </b>
            </div>
            {s.agreements.map((a, i) => {
              const st = agrState(a);
              const used = agrUsed(s, a);
              const share = a.cap ? Math.min(1, used / a.cap) : 0;
              return (
                <button key={a.id} type="button" className={`pur-tl-lane ${st.toLowerCase()}`} onClick={() => navigate(PR.agreement(a.id))} style={{ animationDelay: `${i * 60}ms` }}>
                  <span className="pur-tl-label">
                    <b>{a.ref}</b>
                    <small>{vname(a.vendorId)}</small>
                  </span>
                  <span className="pur-tl-track">
                    <span className="pur-tl-bar" style={{ left: X(a.from), width: `calc(${X(a.to)} - ${X(a.from)})` }} title={`${x(a.title)} · ${d(a.from)} → ${d(a.to)}`}>
                      <i className="k-grow-x" style={{ width: `${share * 100}%` }} />
                      <em>{`${Math.round(share * 100)}%`}</em>
                    </span>
                    <u className="pur-tl-now" style={{ left: X(TODAY) }} aria-hidden="true" />
                    {agrPos(s, a).map((p) => (
                      <s key={p.id} className="pur-tl-dot" style={{ left: X(p.issuedAt) }} title={`${p.ref} · ${d(p.issuedAt)}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Toolbar end={<SearchBox value={q} onChange={setQ} placeholder="Search agreements, vendors, materials" />}>
        <FilterChips<AgrState>
          options={(["ACTIVE", "EXPIRING", "EXPIRED", "DRAFT"] as AgrState[]).map((k) => ({ value: k, label: x(AGR_META[k].label), count: counts[k] ?? 0 }))}
          value={state}
          onChange={setState}
        />
      </Toolbar>

      {rows.length ? (
        <div className="pur-cards">
          {rows.map((a, i) => (
            <AgreementCard key={a.id} a={a} delay={i * 50} />
          ))}
        </div>
      ) : (
        <Empty icon={<FileSignature size={18} />} title={t("No agreements match")}>
          {t("Clear the filters or add a new agreement.")}
        </Empty>
      )}

      <NewAgreementDialog open={adding} onClose={() => setAdding(false)} onSaved={(id) => navigate(PR.agreement(id))} />
    </div>
  );
}

function AgreementCard({ a, delay }: { a: Agreement; delay: number }) {
  const { t, x, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const v = s.vendors.find((y) => y.id === a.vendorId);
  const used = agrUsed(s, a);
  const pos = agrPos(s, a);
  const st = agrState(a);
  return (
    <article className={`pur-card k-rise ${st.toLowerCase()}`} style={{ animationDelay: `${delay}ms` }}>
      <header>
        <Avatar name={v?.name ?? a.vendorId} size={34} />
        <div>
          <Link to={PR.agreement(a.id)} className="pur-card-title">
            {x(a.title)}
          </Link>
          <small>
            <span className="k-mono">{a.ref}</span> · {v?.name}
          </small>
        </div>
        <AgrStatus a={a} />
      </header>
      <ValidityBar a={a} />
      <div className="pur-card-cap">
        <div className="pur-card-capline">
          <span>{t("Cap used")}</span>
          <b className="num-inline">{a.cap ? `${Math.round((used / a.cap) * 100)}%` : "—"}</b>
        </div>
        <CapMeter used={used} cap={a.cap} />
        <small className="muted num-inline">
          {fmtMoneyShort(used)} / {fmtMoneyShort(a.cap)} AZN
        </small>
      </div>
      <dl className="pur-card-figs">
        <div>
          <dt>{t("Call-offs")}</dt>
          <dd className="num-inline">{pos.length}</dd>
        </div>
        <div>
          <dt>{t("Rates")}</dt>
          <dd className="num-inline">{a.rates.length}</dd>
        </div>
        <div>
          <dt>{t("Trade")}</dt>
          <dd>{v ? tradeName(v.trade, lang) : "—"}</dd>
        </div>
      </dl>
      <footer>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(PR.agreement(a.id))}>
          {t("Open")}
        </button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!agrOpen(a)} onClick={() => navigate(PR.newOrder({ agreement: a.id }))}>
          <ShoppingCart size={14} />
          {t("Call off")}
        </button>
      </footer>
    </article>
  );
}

type DraftRate = { id: string; material: string; rate: number; minQty: number };
let rid = 0;

function NewAgreementDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const { t, x, lang } = useL();
  const s = useOps();
  const [vendorId, setVendorId] = useState("");
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState(TODAY);
  const [to, setTo] = useState(addMonths(TODAY, 12));
  const [cap, setCap] = useState(100_000);
  const [terms, setTerms] = useState("");
  const [rates, setRates] = useState<DraftRate[]>([]);
  const [tried, setTried] = useState(false);
  const vendor = s.vendors.find((v) => v.id === vendorId);
  const mats = useMemo(() => s.materials.filter((m) => !vendor || m.trade === vendor.trade || vendor.trades.includes(m.trade)), [s.materials, vendor]);

  const reset = () => {
    setVendorId("");
    setTitle("");
    setFrom(TODAY);
    setTo(addMonths(TODAY, 12));
    setCap(100_000);
    setTerms("");
    setRates([]);
    setTried(false);
  };
  const addRate = () => {
    const m = mats.find((y) => !rates.some((r) => r.material === y.key));
    if (m) setRates((rs) => [...rs, { id: `r${++rid}`, material: m.key, rate: Math.round(m.rate * 0.96 * 100) / 100, minQty: 1 }]);
  };
  const errs = { vendor: !vendor, title: !title.trim(), dates: to <= from, cap: !(cap > 0), rates: !rates.length || rates.some((r) => !(r.rate > 0)) };
  const save = (activate: boolean) => {
    setTried(true);
    if (Object.values(errs).some(Boolean) || !vendor) return;
    const id = s.nextRef("AGR");
    const n = Number(id.slice(-4));
    const a: Agreement = {
      id,
      ref: `FA-${from.slice(0, 4)}-${String(n).padStart(2, "0")}`,
      vendorId: vendor.id,
      title: same(title.trim()),
      from,
      to,
      cap,
      rates: rates.map((r) => ({ material: r.material, rate: r.rate, unit: matOf(s, r.material)?.unit ?? "ədəd", minQty: r.minQty })),
      status: activate ? "ACTIVE" : "DRAFT",
      terms: same(terms.trim() || "Prices fixed for the term of the agreement."),
      poIds: [],
    };
    s.addItem("agreements", a);
    s.pushFeed("PROC", { en: `Framework agreement ${a.ref} ${activate ? "signed" : "drafted"} with ${vendor.name}`, az: `${vendor.name} ilə ${a.ref} çərçivə sazişi ${activate ? "imzalandı" : "qaralama kimi yaradıldı"}` }, `procurement/agreements/${id}`);
    toast(activate ? t("{ref} is active. Call-offs can start.", { ref: a.ref }) : t("{ref} saved as a draft.", { ref: a.ref }));
    reset();
    onClose();
    onSaved(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={t("Framework agreement")}
      title={t("New agreement")}
      width={680}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => save(false)}>
            {t("Save as draft")}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save(true)}>
            <FileSignature size={15} />
            {t("Save and activate")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Vendor")} error={tried && errs.vendor ? t("Required") : undefined}>
          <select className="input select" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">{t("Choose a vendor…")}</option>
            {s.vendors
              .filter((v) => v.status === "APPROVED")
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {tradeName(v.trade, lang)}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t("Spend cap (AZN)")} error={tried && errs.cap ? t("Required") : undefined}>
          <input className="input num" type="number" min={0} step={1000} value={cap || ""} onChange={(e) => setCap(Number(e.target.value))} />
        </Field>
        <Field label={t("Title")} wide error={tried && errs.title ? t("Required") : undefined}>
          <input className="input" value={title} placeholder={t("e.g. Ready-mix concrete, all grades")} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t("Valid from")}>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("Valid to")} error={tried && errs.dates ? t("Must be after the start") : undefined}>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="k-field k-field-wide">
          <span className="k-field-label">
            <CalendarRange size={13} /> {t("Rates")}
          </span>
          {rates.length ? (
            <div className="pur-rate-rows">
              {rates.map((r) => {
                const m = matOf(s, r.material);
                return (
                  <div key={r.id} className="pur-rate-row">
                    <select className="input select" value={r.material} aria-label={t("Material")} onChange={(e) => setRates((rs) => rs.map((y) => (y.id === r.id ? { ...y, material: e.target.value, rate: matOf(s, e.target.value)?.rate ?? y.rate } : y)))}>
                      {mats.map((mm) => (
                        <option key={mm.key} value={mm.key}>
                          {x(mm.name)}
                        </option>
                      ))}
                    </select>
                    <label>
                      <small>{t("Rate")}</small>
                      <input className="input num" type="number" min={0} step="any" value={r.rate || ""} onChange={(e) => setRates((rs) => rs.map((y) => (y.id === r.id ? { ...y, rate: Number(e.target.value) } : y)))} />
                    </label>
                    <label>
                      <small>{t("Min qty")}</small>
                      <input className="input num" type="number" min={0} step="any" value={r.minQty || ""} onChange={(e) => setRates((rs) => rs.map((y) => (y.id === r.id ? { ...y, minQty: Number(e.target.value) } : y)))} />
                    </label>
                    <small className="muted pur-rate-boq">{m ? t("BOQ {r} / {u}", { r: fmtMoney(m.rate), u: unitLabel(m.unit, lang) }) : null}</small>
                    <button type="button" className="icon-btn" aria-label={t("Remove line")} onClick={() => setRates((rs) => rs.filter((y) => y.id !== r.id))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted small">{vendor ? t("Add the materials this vendor will supply at fixed rates.") : t("Pick the vendor first; materials follow its trades.")}</p>
          )}
          {tried && errs.rates ? <span className="k-field-error">{t("Add at least one rate above zero.")}</span> : null}
          <button type="button" className="btn btn-ghost btn-sm pur-mt-s" onClick={addRate} disabled={!vendor}>
            <Plus size={14} />
            {t("Add a rate")}
          </button>
        </div>
        <Field label={t("Terms")} wide>
          <textarea className="input" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t("e.g. Prices fixed for 12 months. Delivery within 48 hours.")} />
        </Field>
      </div>
    </Dialog>
  );
}

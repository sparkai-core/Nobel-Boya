import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, FileSignature, Lock, PackagePlus, Plus, Send, ShoppingCart, Trash2, Truck } from "lucide-react";
import { Avatar, Badge, Breadcrumbs, Empty, Field, Money, PageHero, Panel, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, APPROVAL_LIMIT, same, TODAY } from "../../../ops/dates";
import { R, statusMeta, tradeName } from "../../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import type { Agreement, OpsData, Txt } from "../../../ops/types";
import { agreementOfPo, agrOpen, agrUsed, matOf, PR, suppliersOf, VAT } from "./shared";
import { AgrStatus, CapMeter, VarChip } from "./parts";

type Mode = "DIRECT" | "CALLOFF";
type DLine = { id: string; material: string | null; description: Txt; qty: number; unit: string; rate: number };

const DELIVER: Txt = { en: "Qobu site, main gate, Absheron district", az: "Qobu meydançası, əsas darvaza, Abşeron rayonu" };
let uid = 0;
const nid = () => `nl${++uid}`;

type Init = { mode: Mode; agreementId: string | null; vendorId: string; lines: DLine[]; expectedAt: string; mrId: string | null; note: string; source: string | null };

/** Reads ?agreement= / ?from= / ?mr= / ?material= into a starting order. */
function initialOrder(s: OpsData, p: URLSearchParams, repeat: (ref: string) => string): Init {
  const eta = (vendorId: string) => addDays(TODAY, s.vendors.find((v) => v.id === vendorId)?.avgDeliveryDays ?? 7);
  const base: Init = { mode: "DIRECT", agreementId: null, vendorId: "", lines: [], expectedAt: addDays(TODAY, 7), mrId: null, note: "", source: null };
  const agrLines = (a: Agreement, keys?: { key: string; qty: number }[]): DLine[] =>
    (keys ?? a.rates.slice(0, 1).map((r) => ({ key: r.material, qty: r.minQty })))
      .map((k): DLine | null => {
        const r = a.rates.find((x) => x.material === k.key);
        const m = matOf(s, k.key);
        return r ? { id: nid(), material: r.material, description: m?.name ?? same(r.material), qty: Math.max(k.qty, r.minQty), unit: r.unit, rate: r.rate } : null;
      })
      .filter((x): x is DLine => !!x);

  const agr = s.agreements.find((a) => a.id === p.get("agreement"));
  if (agr) return { ...base, mode: "CALLOFF", agreementId: agr.id, vendorId: agr.vendorId, lines: agrLines(agr), expectedAt: eta(agr.vendorId), source: agr.ref };

  const po = s.pos.find((x) => x.id === p.get("from"));
  if (po) {
    const a = agreementOfPo(s, po.id);
    if (a && agrOpen(a)) {
      const ls = agrLines(a, po.lines.filter((l) => l.material).map((l) => ({ key: l.material!, qty: l.qty })));
      if (ls.length) return { ...base, mode: "CALLOFF", agreementId: a.id, vendorId: po.vendorId, lines: ls, expectedAt: eta(po.vendorId), mrId: po.mrId, note: repeat(po.ref), source: po.ref };
    }
    return { ...base, vendorId: po.vendorId, lines: po.lines.map((l) => ({ id: nid(), material: l.material, description: l.description, qty: l.qty, unit: l.unit, rate: l.rate })), expectedAt: eta(po.vendorId), mrId: po.mrId, note: repeat(po.ref), source: po.ref };
  }

  const mr = s.mrs.find((x) => x.id === p.get("mr"));
  if (mr) {
    const v = s.vendors.find((x) => x.status === "APPROVED" && (x.trade === mr.trade || x.trades.includes(mr.trade)));
    return { ...base, vendorId: v?.id ?? "", lines: mr.lines.map((l) => ({ id: nid(), material: l.material, description: l.description, qty: l.qty, unit: l.unit, rate: matOf(s, l.material)?.rate ?? 0 })), expectedAt: v ? eta(v.id) : mr.neededBy, mrId: mr.id, source: mr.ref };
  }

  const m = matOf(s, p.get("material"));
  if (m) {
    const v = suppliersOf(s, m).find((x) => x.status === "APPROVED");
    return { ...base, vendorId: v?.id ?? "", lines: [{ id: nid(), material: m.key, description: m.name, qty: 0, unit: m.unit, rate: m.rate }], expectedAt: v ? eta(v.id) : base.expectedAt, source: m.key };
  }
  return base;
}

/** New purchase order: a direct small purchase or a call-off at agreement rates, with a live paper LPO beside the form. */
export function NewOrderPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const s = useOps();
  const [init] = useState(() => initialOrder(s, params, (ref) => t("Repeat of {ref}", { ref })));
  const [mode, setMode] = useState<Mode>(init.mode);
  const [agrId, setAgrId] = useState<string | null>(init.agreementId);
  const [vendorId, setVendorId] = useState(init.vendorId);
  const [lines, setLines] = useState<DLine[]>(init.lines);
  const [expectedAt, setExpectedAt] = useState(init.expectedAt);
  const [deliverTo, setDeliverTo] = useState(x(DELIVER));
  const [note, setNote] = useState(init.note);
  const [mrId, setMrId] = useState<string | null>(init.mrId);
  const [pickQ, setPickQ] = useState("");
  const [tried, setTried] = useState(false);

  const agreements = useMemo(() => s.agreements.filter(agrOpen), [s.agreements]);
  const agr = mode === "CALLOFF" ? s.agreements.find((a) => a.id === agrId) : undefined;
  const vendor = s.vendors.find((v) => v.id === vendorId);
  const vendorAgr = mode === "DIRECT" && vendor ? agreements.find((a) => a.vendorId === vendor.id) : undefined;
  const openMrs = s.mrs.filter((m) => m.status === "SUBMITTED" || m.status === "SOURCING" || m.status === "DRAFT" || m.id === mrId);

  const net = lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const vat = net * VAT;
  const total = net + vat;
  const boqNet = lines.reduce((a, l) => a + l.qty * (matOf(s, l.material)?.rate ?? l.rate), 0);
  const used = agr ? agrUsed(s, agr) : 0;
  const overLimit = mode === "DIRECT" && total > APPROVAL_LIMIT;
  const overCap = !!agr && used + total > agr.cap;
  const nextRef = `PO-${String((s.seq.PO ?? 0) + 1).padStart(4, "0")}`;

  // ---- validation
  const minOf = (l: DLine) => agr?.rates.find((r) => r.material === l.material)?.minQty ?? 0;
  const lineErr = (l: DLine) => (!x(l.description).trim() ? t("Describe the line") : l.qty <= 0 ? t("Enter a quantity") : l.qty < minOf(l) ? t("Minimum {n} {u} on this agreement", { n: fmtQty(minOf(l), l.unit), u: unitLabel(l.unit, lang) }) : l.rate <= 0 ? t("Enter a rate") : null);
  const problems: string[] = [];
  if (mode === "CALLOFF" && !agr) problems.push(t("Pick the agreement to call off from."));
  if (!vendor) problems.push(t("Pick a vendor."));
  else if (vendor.status !== "APPROVED") problems.push(t("{v} is {s}. Orders wait until the vendor is approved.", { v: vendor.name, s: x(statusMeta("vendor", vendor.status).label).toLowerCase() }));
  if (!lines.length) problems.push(t("Add at least one line."));
  if (lines.some((l) => lineErr(l))) problems.push(t("Fix the lines marked in red."));
  if (expectedAt < TODAY) problems.push(t("The delivery date is in the past."));
  if (overLimit) problems.push(t("Above the limit — this needs approval"));
  const blocked = problems.length > 0;

  // ---- actions
  const fromAgreement = (a: Agreement, keep: DLine[]) => {
    const kept = keep
      .filter((l) => l.material && a.rates.some((r) => r.material === l.material))
      .map((l) => {
        const r = a.rates.find((y) => y.material === l.material)!;
        return { ...l, rate: r.rate, unit: r.unit, qty: Math.max(l.qty, r.minQty) };
      });
    if (kept.length) return kept;
    const r = a.rates[0];
    return r ? [{ id: nid(), material: r.material, description: matOf(s, r.material)?.name ?? same(r.material), qty: r.minQty, unit: r.unit, rate: r.rate }] : [];
  };
  const chooseAgreement = (a: Agreement) => {
    setAgrId(a.id);
    setVendorId(a.vendorId);
    setLines((ls) => fromAgreement(a, ls));
    setExpectedAt(addDays(TODAY, s.vendors.find((v) => v.id === a.vendorId)?.avgDeliveryDays ?? 3));
  };
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    if (m === "CALLOFF") {
      const a = s.agreements.find((y) => y.id === agrId && agrOpen(y)) ?? agreements.find((y) => y.vendorId === vendorId) ?? agreements[0];
      if (a) chooseAgreement(a);
    }
  };
  const setLine = (id: string, patch: Partial<DLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addMaterial = (key: string) => {
    const m = matOf(s, key);
    if (!m) return;
    const r = agr?.rates.find((y) => y.material === key);
    setLines((ls) => [...ls, { id: nid(), material: m.key, description: m.name, qty: r?.minQty ?? 0, unit: r?.unit ?? m.unit, rate: r?.rate ?? m.rate }]);
    setPickQ("");
  };
  const catalogue = useMemo(() => {
    const q = pickQ.trim().toLowerCase();
    const list = s.materials.filter((m) => !lines.some((l) => l.material === m.key));
    return (q ? list.filter((m) => m.name.en.toLowerCase().includes(q) || m.name.az.toLowerCase().includes(q) || m.key.includes(q)) : list).slice(0, 60);
  }, [s.materials, lines, pickQ]);

  const suggested = useMemo(() => {
    const trades = new Set(lines.map((l) => matOf(s, l.material)?.trade).filter(Boolean));
    return s.vendors.filter((v) => trades.has(v.trade) || v.trades.some((tr) => trades.has(tr)));
  }, [s, lines]);

  const issue = () => {
    setTried(true);
    if (blocked || !vendor) return;
    const id = s.createDirectPo({
      vendorId: vendor.id,
      lines: lines.map((l) => ({ material: l.material, description: l.description, qty: l.qty, unit: l.unit, rate: l.rate })),
      expectedAt,
      agreementId: mode === "CALLOFF" ? (agr?.id ?? null) : null,
      mrId,
      note: note.trim(),
    });
    const dt = deliverTo.trim();
    if (dt && dt !== DELIVER.en && dt !== DELIVER.az) s.patchItem("pos", id, { deliverTo: same(dt) });
    toast(mode === "CALLOFF" && agr ? t("{po} called off from {a}. {v} sees it in the portal.", { po: id, a: agr.ref, v: vendor.name }) : t("{po} issued to {v}. Waiting for the vendor to accept.", { po: id, v: vendor.name }), "ok");
    navigate(R.order(id));
  };

  return (
    <div className="k-page pur-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Purchase orders"), to: R.orders }, { label: t("New purchase order") }]} />
      <PageHero
        eyebrow={t("Procurement · Purchasing")}
        title={t("New purchase order")}
        subtitle={init.source ? t("Started from {ref}. Check the lines and issue the order.", { ref: init.source }) : t("Buy small items directly, or call off at the rates of a framework agreement.")}
        flow={["Pick the vendor", "Add lines", "Check the limit", "Issue"]}
        art="order"
      />

      <div className="pur-modes" role="radiogroup" aria-label={t("Kind of order")}>
        <button type="button" role="radio" aria-checked={mode === "DIRECT"} className={mode === "DIRECT" ? "on" : undefined} onClick={() => switchMode("DIRECT")}>
          <ShoppingCart size={18} />
          <span>
            <b>{t("Direct purchase")}</b>
            <small>{t("Small value, under {v} AZN. Goes straight to the vendor.", { v: fmtMoney(APPROVAL_LIMIT).replace(/\.00$/, "") })}</small>
          </span>
        </button>
        <button type="button" role="radio" aria-checked={mode === "CALLOFF"} className={mode === "CALLOFF" ? "on" : undefined} onClick={() => switchMode("CALLOFF")} disabled={!agreements.length}>
          <FileSignature size={18} />
          <span>
            <b>{t("Call-off from an agreement")}</b>
            <small>{agreements.length ? t("Agreed rates, no quotes needed. {n} agreements open.", { n: agreements.length }) : t("No open agreements.")}</small>
          </span>
        </button>
      </div>

      <div className="pur-neworder">
        <div className="k-stack">
          {mode === "CALLOFF" ? (
            <Panel title={t("Agreement")} icon={<FileSignature size={15} />} count={agreements.length}>
              <div className="pur-agrpick">
                {agreements.map((a) => {
                  const v = s.vendors.find((y) => y.id === a.vendorId);
                  const u = agrUsed(s, a);
                  const on = a.id === agrId;
                  return (
                    <button key={a.id} type="button" className={`pur-agrpick-card${on ? " on" : ""}`} aria-pressed={on} onClick={() => chooseAgreement(a)}>
                      <span className="pur-agrpick-top">
                        <Avatar name={v?.name ?? a.vendorId} size={26} />
                        <span>
                          <b>{x(a.title)}</b>
                          <small>
                            {a.ref} · {v?.name}
                          </small>
                        </span>
                        <AgrStatus a={a} />
                      </span>
                      <CapMeter used={u} cap={a.cap} pending={on ? total : 0} />
                      <small className="num-inline">{t("{a} of {b} used · {n} rates", { a: fmtMoney(u), b: fmtMoney(a.cap), n: a.rates.length })}</small>
                    </button>
                  );
                })}
              </div>
            </Panel>
          ) : (
            <Panel title={t("Vendor")} icon={<Truck size={15} />}>
              <Field label={t("Vendor")} error={tried && !vendor ? t("Required") : undefined}>
                <select
                  className="input select"
                  value={vendorId}
                  onChange={(e) => {
                    setVendorId(e.target.value);
                    const v = s.vendors.find((y) => y.id === e.target.value);
                    if (v) setExpectedAt(addDays(TODAY, v.avgDeliveryDays));
                  }}
                >
                  <option value="">{t("Choose a vendor…")}</option>
                  {suggested.length ? (
                    <optgroup label={t("Suggested for these lines")}>
                      {suggested.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} · {tradeName(v.trade, lang)}
                          {v.status !== "APPROVED" ? ` (${x(statusMeta("vendor", v.status).label)})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <optgroup label={t("All vendors")}>
                    {s.vendors
                      .filter((v) => !suggested.includes(v))
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} · {tradeName(v.trade, lang)}
                          {v.status !== "APPROVED" ? ` (${x(statusMeta("vendor", v.status).label)})` : ""}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </Field>
              {vendor ? (
                <div className="pur-vcard k-rise">
                  <Avatar name={vendor.name} size={38} />
                  <div>
                    <Link to={R.vendor(vendor.id)} className="pur-vcard-name">
                      {vendor.name}
                    </Link>
                    <small>
                      {tradeName(vendor.trade, lang)} · {vendor.city} · {t("pays {terms}", { terms: vendor.paymentTerms })}
                    </small>
                  </div>
                  <dl>
                    <div>
                      <dt>{t("Score")}</dt>
                      <dd className="num-inline">{vendor.overall.toFixed(1)}</dd>
                    </div>
                    <div>
                      <dt>{t("Delivers in")}</dt>
                      <dd className="num-inline">{t("{n} d", { n: vendor.avgDeliveryDays })}</dd>
                    </div>
                  </dl>
                  {vendor.status !== "APPROVED" ? <Badge tone={statusMeta("vendor", vendor.status).tone}>{x(statusMeta("vendor", vendor.status).label)}</Badge> : null}
                </div>
              ) : null}
              {vendorAgr ? (
                <div className="k-callout k-tone-brand pur-mt">
                  <FileSignature size={16} />
                  <div>
                    <b>{t("{v} has framework agreement {ref}.", { v: vendor?.name ?? "", ref: vendorAgr.ref })}</b> {t("Agreed rates may be cheaper and need no quotes.")}{" "}
                    <button type="button" className="k-link-btn" onClick={() => switchMode("CALLOFF")}>
                      {t("Call off instead")}
                    </button>
                  </div>
                </div>
              ) : null}
            </Panel>
          )}

          <Panel
            title={t("Lines")}
            icon={<PackagePlus size={15} />}
            count={lines.length}
            sub={mode === "CALLOFF" ? t("Only the agreement's materials, at the agreed rates. Minimum quantities apply.") : t("Rates start at the BOQ rate. Change them to the vendor's price.")}
          >
            {lines.length ? (
              <div className="pur-lines">
                <div className="pur-line pur-line-head" aria-hidden="true">
                  <span>#</span>
                  <span>{t("Material")}</span>
                  <span className="r">{t("Qty")}</span>
                  <span>{t("Unit")}</span>
                  <span className="r">{t("Rate")}</span>
                  <span className="r">{t("Amount")}</span>
                  <span className="r">{t("vs BOQ")}</span>
                  <span />
                </div>
                {lines.map((l, i) => {
                  const m = matOf(s, l.material);
                  const err = tried || l.qty > 0 ? lineErr(l) : null;
                  const locked = mode === "CALLOFF";
                  return (
                    <div key={l.id} className={`pur-line${err ? " err" : ""}`}>
                      <span className="pur-line-no num-inline">{i + 1}</span>
                      <span className="pur-line-desc">
                        {m ? (
                          <>
                            <Link to={PR.material(m.key)}>{x(m.name)}</Link>
                            <small>
                              {t("BOQ {r} AZN / {u}", { r: fmtMoney(m.rate), u: unitLabel(m.unit, lang) })}
                              {locked && minOf(l) ? ` · ${t("min {n}", { n: fmtQty(minOf(l), l.unit) })}` : ""}
                            </small>
                          </>
                        ) : (
                          <input className="input" value={x(l.description)} placeholder={t("Describe the item")} onChange={(e) => setLine(l.id, { description: same(e.target.value) })} />
                        )}
                        {err ? <em>{err}</em> : null}
                      </span>
                      <span className="pur-line-qty">
                        <input className="input num" type="number" min={0} step="any" inputMode="decimal" value={l.qty || ""} placeholder="0" aria-label={t("Qty")} onChange={(e) => setLine(l.id, { qty: Math.max(0, Number(e.target.value)) })} />
                      </span>
                      <span className="pur-line-unit">{m || locked ? unitLabel(l.unit, lang) : <input className="input" value={l.unit} aria-label={t("Unit")} onChange={(e) => setLine(l.id, { unit: e.target.value })} />}</span>
                      <span className="pur-line-rate">
                        {locked ? (
                          <span className="pur-locked" title={t("Agreement rate, locked")}>
                            <Lock size={11} />
                            <span className="num-inline">{fmtMoney(l.rate)}</span>
                          </span>
                        ) : (
                          <input className="input num" type="number" min={0} step="any" inputMode="decimal" value={l.rate || ""} placeholder="0.00" aria-label={t("Rate")} onChange={(e) => setLine(l.id, { rate: Math.max(0, Number(e.target.value)) })} />
                        )}
                      </span>
                      <span className="pur-line-amt num-inline">{fmtMoney(l.qty * l.rate)}</span>
                      <span className="pur-line-var">
                        <VarChip rate={l.rate} boq={m?.rate} />
                      </span>
                      <button type="button" className="icon-btn pur-line-del" aria-label={t("Remove line")} onClick={() => setLines((ls) => ls.filter((y) => y.id !== l.id))}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty icon={<PackagePlus size={18} />} title={t("No lines yet")}>
                {mode === "CALLOFF" ? t("Pick materials from the agreement's price list below.") : t("Add materials from the BOQ catalogue, or a free line.")}
              </Empty>
            )}

            {mode === "CALLOFF" && agr ? (
              <div className="pur-ratechips">
                <span className="k-field-label">{t("Price list of {ref}", { ref: agr.ref })}</span>
                <div className="k-quick">
                  {agr.rates.map((r) => {
                    const inUse = lines.some((l) => l.material === r.material);
                    return (
                      <button key={r.material} type="button" className={inUse ? "on" : undefined} disabled={inUse} onClick={() => addMaterial(r.material)}>
                        {inUse ? null : <Plus size={11} />} {x(matOf(s, r.material)?.name ?? same(r.material))} · <span className="num-inline">{fmtMoney(r.rate)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : mode === "DIRECT" ? (
              <div className="pur-addline">
                <input
                  className="input"
                  list="pur-materials"
                  value={pickQ}
                  placeholder={t("Add a material from the BOQ catalogue…")}
                  onChange={(e) => {
                    const v = e.target.value;
                    const m = s.materials.find((y) => x(y.name) === v);
                    if (m) addMaterial(m.key);
                    else setPickQ(v);
                  }}
                />
                <datalist id="pur-materials">
                  {catalogue.map((m) => (
                    <option key={m.key} value={x(m.name)} />
                  ))}
                </datalist>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, { id: nid(), material: null, description: same(pickQ), qty: 0, unit: "ədəd", rate: 0 }])}>
                  <Plus size={14} />
                  {t("Free line")}
                </button>
              </div>
            ) : null}

            <dl className="pur-totals">
              <div>
                <dt>{t("Subtotal")}</dt>
                <dd className="num-inline">{fmtMoney(net)}</dd>
              </div>
              <div>
                <dt>{t("VAT {p}%", { p: Math.round(VAT * 100) })}</dt>
                <dd className="num-inline">{fmtMoney(vat)}</dd>
              </div>
              <div className="total">
                <dt>{t("Total")}</dt>
                <dd>
                  <Money value={total} />
                </dd>
              </div>
              {boqNet > 0 ? (
                <div>
                  <dt>{t("Against BOQ rates")}</dt>
                  <dd>
                    <VarChip rate={net} boq={boqNet} /> <small className="muted num-inline">{t("BOQ {v}", { v: fmtMoney(boqNet) })}</small>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          <Panel title={t("Delivery")} icon={<Truck size={15} />}>
            <div className="k-form">
              <Field label={t("Expected delivery")} error={tried && expectedAt < TODAY ? t("In the past") : undefined} hint={vendor ? t("{v} usually delivers in {n} days.", { v: vendor.name, n: vendor.avgDeliveryDays }) : undefined}>
                <input className="input" type="date" value={expectedAt} min={TODAY} onChange={(e) => setExpectedAt(e.target.value)} />
              </Field>
              <Field label={t("For material request")} hint={t("Optional. Links the order to the request.")}>
                <select className="input select" value={mrId ?? ""} onChange={(e) => setMrId(e.target.value || null)}>
                  <option value="">{t("No request")}</option>
                  {openMrs.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ref} · {x(m.title)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Deliver to")} wide>
                <input className="input" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} />
              </Field>
              <Field label={t("Note to the vendor")} wide>
                <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("e.g. call the site 1 hour before arrival")} />
              </Field>
            </div>
          </Panel>
        </div>

        <aside className="pur-preview">
          <section className={`pur-gauge${overLimit || overCap ? " over" : ""}`} aria-label={t("Limit")}>
            {mode === "DIRECT" ? (
              <>
                <header>
                  <span>{t("Direct purchase limit")}</span>
                  <b className="num-inline">
                    {fmtMoney(total)} / {fmtMoney(APPROVAL_LIMIT)}
                  </b>
                </header>
                <CapMeter used={0} cap={APPROVAL_LIMIT} pending={total} />
                {overLimit ? (
                  <div className="k-callout k-tone-bad pur-mt">
                    <AlertTriangle size={16} />
                    <div>
                      <b>{t("Above the limit — this needs approval")}</b>
                      <p>{t("Orders over {v} AZN go out to quotes and two signatures.", { v: fmtMoney(APPROVAL_LIMIT).replace(/\.00$/, "") })}</p>
                      <div className="k-row pur-mt-s">
                        <Link className="btn btn-primary btn-sm" to={R.newRfq(mrId ?? undefined)}>
                          {t("Raise an RFQ instead")}
                        </Link>
                        <Link className="btn btn-ghost btn-sm" to={R.approvals}>
                          {t("How approval works")}
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <small className="muted">{t("{v} left before quotes and approval are needed.", { v: fmtMoney(Math.max(0, APPROVAL_LIMIT - total)) })}</small>
                )}
              </>
            ) : agr ? (
              <>
                <header>
                  <span>{t("{ref} cap", { ref: agr.ref })}</span>
                  <b className="num-inline">
                    {fmtMoney(used + total)} / {fmtMoney(agr.cap)}
                  </b>
                </header>
                <CapMeter used={used} cap={agr.cap} pending={total} />
                {overCap ? (
                  <div className="k-callout k-tone-warn pur-mt">
                    <AlertTriangle size={16} />
                    <div>
                      <b>{t("This call-off takes the agreement over its cap by {v} AZN.", { v: fmtMoney(used + total - agr.cap) })}</b>
                      <p>{t("Extend the agreement or split the order.")}</p>
                      <Link className="k-link-btn" to={PR.agreement(agr.id)}>
                        {t("Open the agreement")}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <small className="muted">{t("{v} left on the agreement after this call-off.", { v: fmtMoney(agr.cap - used - total) })}</small>
                )}
              </>
            ) : null}
          </section>

          <article className="po-lpo pur-lpo" aria-label={t("Local purchase order")}>
            <span className="pur-lpo-draft" aria-hidden="true">
              {t("Draft")}
            </span>
            <header className="po-lpo-head">
              <img src="./brand/nobel-logo.png" alt="Nobel" />
              <div>
                <span className="po-lpo-kind">{mode === "CALLOFF" ? t("Call-off order") : t("Local purchase order")}</span>
                <strong className="k-mono">{nextRef}</strong>
                <small>{d(TODAY)}</small>
              </div>
            </header>
            <div className="po-lpo-parties">
              <div>
                <span>{t("To")}</span>
                <strong>{vendor?.name ?? <span className="muted">{t("Choose a vendor…")}</span>}</strong>
                <small>{vendor ? `${vendor.city} · ${t("TRN")} ${vendor.trn}` : null}</small>
                <small>{vendor ? `${vendor.contact} · ${vendor.phone}` : null}</small>
              </div>
              <div>
                <span>{t("Deliver to")}</span>
                <strong>{deliverTo || "—"}</strong>
                <small>{t("Qobu warehouse and administration building")}</small>
              </div>
            </div>
            <dl className="po-lpo-terms">
              <div>
                <dt>{t("Payment terms")}</dt>
                <dd>{vendor?.paymentTerms ?? "—"}</dd>
              </div>
              <div>
                <dt>{t("Delivery date")}</dt>
                <dd>{d(expectedAt)}</dd>
              </div>
              <div>
                <dt>{mode === "CALLOFF" ? t("Agreement") : t("Request")}</dt>
                <dd className="k-mono">{mode === "CALLOFF" ? (agr?.ref ?? "—") : (s.mrs.find((m) => m.id === mrId)?.ref ?? "—")}</dd>
              </div>
            </dl>
            <div className="po-tablewrap">
              <table className="po-table po-lpo-table">
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
                  {lines.length ? (
                    lines.map((l, i) => (
                      <tr key={l.id} className="pur-lpo-row">
                        <td className="muted">{i + 1}</td>
                        <td>{x(l.description) || <span className="muted">—</span>}</td>
                        <td className="r num-inline">
                          {fmtQty(l.qty, l.unit)} <small className="muted">{unitLabel(l.unit, lang)}</small>
                        </td>
                        <td className="r num-inline">{fmtMoney(l.rate)}</td>
                        <td className="r num-inline">{fmtMoney(l.qty * l.rate)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="muted pur-lpo-empty">
                        {t("Lines appear here as you add them.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <dl className="po-lpo-sum">
              <div>
                <dt>{t("Subtotal")}</dt>
                <dd className="num-inline">{fmtMoney(net)}</dd>
              </div>
              <div>
                <dt>{t("VAT {p}%", { p: Math.round(VAT * 100) })}</dt>
                <dd className="num-inline">{fmtMoney(vat)}</dd>
              </div>
              <div className="total">
                <dt>{t("Total")}</dt>
                <dd className="num-inline">{fmtMoney(total)} AZN</dd>
              </div>
            </dl>
            {note.trim() ? <p className="pur-lpo-note">{note}</p> : null}
            <footer className="po-lpo-sign">
              <span>{t("Authorised by")}</span>
              <span>{t("Received by vendor")}</span>
            </footer>
          </article>

          {tried && problems.length ? (
            <ul className="pur-problems k-rise" role="alert">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <div className="pur-issue">
            <button type="button" className="btn btn-primary btn-lg" onClick={issue} disabled={tried && blocked}>
              <Send size={16} />
              {mode === "CALLOFF" ? t("Issue the call-off") : t("Issue order")}
            </button>
            <Link to={R.orders} className="btn btn-ghost btn-lg">
              {t("Cancel")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

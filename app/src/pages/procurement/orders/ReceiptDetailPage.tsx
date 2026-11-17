import { Fragment, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRightLeft, Camera, ChevronRight, ClipboardCheck, Minus, PackageX, Plus, Receipt, Stamp } from "lucide-react";
import { Badge, Breadcrumbs, DetailHeader, Dialog, Empty, Field, KeyFigure, KeyVals, NextBar, PageHero, Panel, StatusBadge, StatusSteps, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { PEOPLE } from "../../../ops/seed/pm";
import { TODAY } from "../../../ops/dates";
import { PATHS, R, statusMeta } from "../../../ops/select";
import { postReceiptOn } from "../../../ops/ext/orders";
import { fmtQty, qtyDigits, unitLabel } from "../../../lib/format";
import type { ShortReason } from "../../../ops/types";
import { vendorName } from "./shared";
import { sheetImage } from "../../../data";
import { INVOICE_META, invoiceHref, matOf, photoSheets } from "../purchasing/shared";
import { ChainLife } from "../purchasing/parts";

const REASONS: { value: ShortReason; label: string }[] = [
  { value: "NOT_DELIVERED", label: "Not delivered" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "WRONG_ITEM", label: "Wrong item" },
];

type Row = { accepted: number; reason: ShortReason | null };

/** The GRN check sheet: count each line at the gate, explain anything short, then post a signed record. */
export function ReceiptDetailPage() {
  const { id = "" } = useParams();
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const g = s.grns.find((v) => v.id === id);
  const po = g ? s.pos.find((p) => p.id === g.poId) : undefined;
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [by, setBy] = useState(PEOPLE.store);
  const [on, setOn] = useState(TODAY);
  const [remarks, setRemarks] = useState("");
  const [rest, setRest] = useState<"coming" | "close">("coming");
  const [rejecting, setRejecting] = useState(false);
  const [rejectWhy, setRejectWhy] = useState("");
  const [justPosted, setJustPosted] = useState(false);
  const [tried, setTried] = useState(false);

  const [rowsFor, setRowsFor] = useState<string | null>(null);
  if (g && rowsFor !== g.id) {
    // A different receipt was opened: start its sheet from what is stored.
    setRowsFor(g.id);
    setRows(Object.fromEntries(g.lines.map((l) => [l.key, { accepted: l.accepted, reason: l.shortReason }])));
  }

  if (!g || !po) {
    return (
      <div className="k-page po-page">
        <PageHero eyebrow={t("Procurement · Goods receipt")} title={t("Receipt not found")} back={{ to: R.receipts, label: "Goods receipt" }} />
        <Empty title={t("This receipt does not exist.")} />
      </div>
    );
  }

  const draft = g.status === "DRAFT";
  const row = (key: string): Row => rows[key] ?? { accepted: 0, reason: null };
  const remaining = (l: (typeof g.lines)[number]) => Math.max(0, l.ordered - l.prior);
  const setRow = (key: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [key]: { ...row(key), ...patch } }));
  const setQty = (l: (typeof g.lines)[number], v: number) => {
    const max = remaining(l);
    const dg = qtyDigits(l.unit);
    const n = Math.max(0, Math.min(max, Number.isFinite(v) ? Number(v.toFixed(dg)) : 0));
    setRow(l.key, { accepted: n, reason: n >= max - 1e-6 ? null : row(l.key).reason });
  };
  const step = (l: (typeof g.lines)[number]) => {
    const max = remaining(l);
    return max >= 1000 ? 100 : max >= 100 ? 10 : 1;
  };
  const shortLines = g.lines.filter((l) => row(l.key).accepted < remaining(l) - 1e-6);
  const missingReason = shortLines.filter((l) => !row(l.key).reason);
  const nothing = g.lines.every((l) => row(l.key).accepted <= 0);
  const allIn = shortLines.length === 0;
  const stockLines = g.lines.filter((l) => l.material && row(l.key).accepted > 0).length;
  const payment = s.payments.find((p) => p.poId === po.id && p.kind === "ON_DELIVERY");
  const closes = allIn || rest === "close";
  const moves = s.movements.filter((v) => v.ref === g.id);
  const invoices = s.invoices.filter((i) => i.poId === po.id && !i.duplicate);
  const photos = photoSheets(g.id, matOf(s, g.lines.find((l) => l.material)?.material)?.trade ?? null);

  const fillAll = () => {
    setRows(Object.fromEntries(g.lines.map((l) => [l.key, { accepted: remaining(l), reason: null }])));
    toast(t("Every line filled with what was outstanding."), "brand");
  };

  const post = () => {
    setTried(true);
    if (nothing || missingReason.length || !by.trim()) return;
    postReceiptOn(
      g.id,
      { lines: g.lines.map((l) => ({ key: l.key, accepted: row(l.key).accepted, shortReason: row(l.key).accepted < remaining(l) - 1e-6 ? row(l.key).reason : null })), receivedBy: by.trim(), remarks: remarks.trim(), closeShort: !allIn && rest === "close" },
      on,
    );
    setJustPosted(true);
    toast(allIn ? t("{grn} posted. Stock updated and the payment is ready.", { grn: g.ref }) : closes ? t("{grn} posted short and the order closed.", { grn: g.ref }) : t("{grn} posted short. The rest stays open on {po}.", { grn: g.ref, po: po.ref }));
  };

  const trail = [
    { label: t("Order"), ref: po.ref, to: R.order(po.id), tone: statusMeta("po", po.status).tone },
    { label: t("This receipt"), ref: g.ref, to: null, tone: "brand" as const },
    { label: t("Stock"), ref: t("{n} items", { n: g.lines.filter((l) => l.material).length }), to: R.inventory, tone: draft ? ("muted" as const) : ("ok" as const) },
    ...(payment ? [{ label: t("Payment"), ref: payment.ref, to: R.payment(payment.id), tone: statusMeta("payment", payment.status).tone }] : []),
  ];

  return (
    <div className="k-page po-page po-grn">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Goods receipt"), to: R.receipts }, { label: g.ref }]} />
      <DetailHeader
        refCode={g.ref}
        badges={<StatusBadge kind="grn" status={g.status} />}
        title={t("Delivery from {v}", { v: vendorName(s, g.vendorId) })}
        meta={
          <>
            <span>
              {t("Against")} <Link to={R.order(po.id)}>{po.ref}</Link>
            </span>
            <span>{t("{n} lines", { n: g.lines.length })}</span>
            {g.receivedAt ? <span>{d(g.receivedAt)}</span> : null}
          </>
        }
        aside={<KeyFigure label={draft ? t("Lines counted") : t("Lines in full")} value={`${draft ? g.lines.filter((l) => row(l.key).accepted > 0).length : g.lines.filter((l) => l.prior + l.accepted >= l.ordered - 1e-6).length} / ${g.lines.length}`} />}
      >
        <StatusSteps kind="grn" path={g.status === "REJECTED" ? ["DRAFT", "REJECTED"] : PATHS.grn} status={g.status} rejected={g.status === "REJECTED"} />
      </DetailHeader>

      <nav className="k-trail" aria-label={t("Came from")}>
        {trail.map((st, i) => (
          <Fragment key={i}>
            {i ? <ChevronRight size={13} className="k-trail-sep" aria-hidden="true" /> : null}
            {st.to ? (
              <Link to={st.to} className={`k-trail-step k-tone-${st.tone}`}>
                <small>{st.label}</small>
                <b>{st.ref}</b>
              </Link>
            ) : (
              <span className="k-trail-step current">
                <small>{st.label}</small>
                <b>{st.ref}</b>
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      <ChainLife kind="GRN" id={g.id} />

      {draft ? (
        <>
          <NextBar text={t("Count each line against the delivery note. Anything short needs a reason.")}>
            <button type="button" className="btn btn-primary" onClick={fillAll}>
              <ClipboardCheck size={15} />
              {t("All arrived")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setRejecting(true)}>
              <PackageX size={15} />
              {t("Reject delivery")}
            </button>
          </NextBar>

          <div className="k-grid-main">
            <section className="po-sheet" aria-label={t("Check sheet")}>
              {g.lines.map((l, i) => {
                const r = row(l.key);
                const max = remaining(l);
                const isShort = r.accepted < max - 1e-6;
                const need = isShort && tried && !r.reason;
                return (
                  <article key={l.key} className={`po-sline${!isShort ? " full" : r.accepted > 0 ? " part" : ""}`}>
                    <header>
                      <span className="po-sline-no">{i + 1}</span>
                      <strong>{x(l.description)}</strong>
                    </header>
                    <dl className="po-sline-figs">
                      <div>
                        <dt>{t("Ordered")}</dt>
                        <dd className="num-inline">{fmtQty(l.ordered, l.unit)}</dd>
                      </div>
                      <div>
                        <dt>{t("Already received")}</dt>
                        <dd className="num-inline">{fmtQty(l.prior, l.unit)}</dd>
                      </div>
                      <div>
                        <dt>{t("Outstanding")}</dt>
                        <dd className="num-inline">{fmtQty(max, l.unit)}</dd>
                      </div>
                    </dl>
                    <div className="po-stepper">
                      <span className="po-stepper-label">{t("Accept now")}</span>
                      <button type="button" aria-label={t("Less")} onClick={() => setQty(l, r.accepted - step(l))} disabled={r.accepted <= 0}>
                        <Minus size={18} />
                      </button>
                      <input className="input num" inputMode="decimal" type="number" min={0} max={max} value={r.accepted} onChange={(e) => setQty(l, Number(e.target.value))} aria-label={t("Accept now")} />
                      <span className="po-stepper-unit">{unitLabel(l.unit, lang)}</span>
                      <button type="button" aria-label={t("More")} onClick={() => setQty(l, r.accepted + step(l))} disabled={r.accepted >= max}>
                        <Plus size={18} />
                      </button>
                      <button type="button" className="po-stepper-all" onClick={() => setQty(l, max)} disabled={r.accepted >= max}>
                        {t("All")}
                      </button>
                    </div>
                    {isShort ? (
                      <div className={`po-reasons${need ? " need" : ""}`} role="radiogroup" aria-label={t("Why is it short?")}>
                        <span>{t("Why is it short?")}</span>
                        {REASONS.map((rs) => (
                          <button key={rs.value} type="button" role="radio" aria-checked={r.reason === rs.value} className={r.reason === rs.value ? "on" : undefined} onClick={() => setRow(l.key, { reason: rs.value })}>
                            {t(rs.label)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>

            <div className="k-stack">
              <Panel title={t("Before you post")} icon={<Stamp size={15} />}>
                <ul className="po-effects">
                  <li>
                    <b>{t("Stock")}</b>
                    <span>{stockLines ? t("{n} lines go into the store and show on the inventory shelf.", { n: stockLines }) : t("Nothing goes into stock yet.")}</span>
                  </li>
                  <li>
                    <b>{t("Order")}</b>
                    <span>{closes ? t("{po} closes.", { po: po.ref }) : t("{po} stays open as part received.", { po: po.ref })}</span>
                  </li>
                  <li>
                    <b>{t("Payment")}</b>
                    <span>{payment ? (closes ? t("{ref} becomes ready to pay.", { ref: payment.ref }) : t("{ref} waits until the rest arrives.", { ref: payment.ref })) : t("No delivery payment on this order.")}</span>
                  </li>
                </ul>
                {!allIn ? (
                  <div className="po-rest">
                    <span className="k-field-label">{t("{n} lines short. What about the rest?", { n: shortLines.length })}</span>
                    <div className="segmented" role="group">
                      <button type="button" aria-pressed={rest === "coming"} onClick={() => setRest("coming")}>
                        {t("Rest is coming")}
                      </button>
                      <button type="button" aria-pressed={rest === "close"} onClick={() => setRest("close")}>
                        {t("Close the order short")}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="k-form po-mt" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Field label={t("Received by")} error={tried && !by.trim() ? t("Required") : undefined}>
                    <input className="input" value={by} onChange={(e) => setBy(e.target.value)} />
                  </Field>
                  <Field label={t("Arrived on")}>
                    <input className="input" type="date" value={on} max={TODAY} onChange={(e) => setOn(e.target.value)} />
                  </Field>
                  <Field label={t("Remarks")} wide>
                    <textarea className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={t("Truck, driver, condition of the load")} />
                  </Field>
                </div>
                {tried && (nothing || missingReason.length) ? (
                  <p className="k-field-error po-mt">{nothing ? t("Count at least one line before posting.") : t("Give a reason for every short line.")}</p>
                ) : null}
                <button type="button" className="btn btn-primary btn-lg po-post" onClick={post}>
                  <Stamp size={16} />
                  {t("Post the receipt")}
                </button>
              </Panel>
            </div>
          </div>
        </>
      ) : (
        <div className="k-grid-main">
          <div className="k-stack">
          <Panel title={t("Counted lines")} icon={<ClipboardCheck size={15} />} pad={false}>
            <ul className="pur-tally" aria-label={t("Line tally")}>
              {g.lines.map((l, i) => {
                const tot = Math.max(l.ordered, 1e-9);
                const sh = Math.max(0, l.ordered - l.prior - l.accepted);
                return (
                  <li key={l.key} style={{ animationDelay: `${i * 70}ms` }}>
                    <span className="pur-tally-name">
                      <b>{x(l.description)}</b>
                      <small className="num-inline">
                        {fmtQty(l.prior + l.accepted, l.unit)} / {fmtQty(l.ordered, l.unit)} {unitLabel(l.unit, lang)}
                      </small>
                    </span>
                    <span className="pur-tally-bar" title={`${t("Before")} ${fmtQty(l.prior, l.unit)} · ${t("Accepted")} ${fmtQty(l.accepted, l.unit)}${sh > 0 ? ` · ${t("Short")} ${fmtQty(sh, l.unit)}` : ""}`}>
                      <i className="prior k-grow-x" style={{ width: `${(l.prior / tot) * 100}%` }} />
                      <i className={`now k-grow-x${g.status === "REJECTED" ? " rej" : ""}`} style={{ width: `${(l.accepted / tot) * 100}%` }} />
                      {sh > 0 ? <i className="short" style={{ width: `${(sh / tot) * 100}%` }} /> : null}
                    </span>
                    <span className="pur-tally-tag">{sh > 0 ? <Badge tone="warn">{l.shortReason ? t(REASONS.find((r) => r.value === l.shortReason)?.label ?? "") : t("short")}</Badge> : <span className="k-text-ok small">{t("in full")}</span>}</span>
                  </li>
                );
              })}
            </ul>
            <p className="pur-legend pur-tally-legend">
              <i className="prior" /> {t("Before")} <i className="now" /> {t("This receipt")} <i className="short" /> {t("Short")}
            </p>
            <div className="po-tablewrap">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>{t("Line")}</th>
                    <th className="r">{t("Ordered")}</th>
                    <th className="r">{t("Before")}</th>
                    <th className="r">{t("Accepted")}</th>
                    <th>{t("Short")}</th>
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map((l) => {
                    const sh = Math.max(0, l.ordered - l.prior - l.accepted);
                    return (
                      <tr key={l.key}>
                        <td>{x(l.description)}</td>
                        <td className="r num-inline">{fmtQty(l.ordered, l.unit)}</td>
                        <td className="r num-inline">{fmtQty(l.prior, l.unit)}</td>
                        <td className="r num-inline">
                          <b>{fmtQty(l.accepted, l.unit)}</b> <small className="muted">{unitLabel(l.unit, lang)}</small>
                        </td>
                        <td>{sh > 0 ? <Badge tone="warn">{`${fmtQty(sh, l.unit)} · ${l.shortReason ? t(REASONS.find((r) => r.value === l.shortReason)?.label ?? "") : t("short")}`}</Badge> : <span className="k-text-ok small">{t("in full")}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title={t("Delivery photos")} icon={<Camera size={15} />} count={photos.length} sub={t("Taken at the gate when the load was counted.")}>
            <div className="pur-photos">
              {photos.map((p, i) => (
                <a key={p} href={sheetImage(p)} target="_blank" rel="noopener" className="pur-photo k-rise" style={{ animationDelay: `${i * 80}ms` }}>
                  <img src={sheetImage(p, true)} alt={t("Delivery photo {n}", { n: i + 1 })} loading="lazy" />
                  <span>
                    {t("Photo {n}", { n: i + 1 })} · {d(g.receivedAt, false)}
                  </span>
                </a>
              ))}
            </div>
          </Panel>
          </div>
          <div className="k-stack">
          <Panel title={t("Signed record")} icon={<Stamp size={15} />}>
            <div className="po-signed">
              <span className={`k-stamp-mark${g.status === "REJECTED" ? " po-stamp-bad" : ""}${justPosted ? "" : " po-stamp-still"}`}>{g.status === "REJECTED" ? t("Rejected") : t("Signed record")}</span>
              <KeyVals
                cols={1}
                items={[
                  { k: t("Received by"), v: g.receivedBy ?? "—" },
                  { k: t("Arrived on"), v: d(g.receivedAt) },
                  { k: t("Remarks"), v: g.remarks ?? "—" },
                ]}
              />
              {justPosted && payment ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.payment(payment.id))}>
                  {t("See the payment")}
                </button>
              ) : null}
            </div>
          </Panel>
          <Panel title={t("Stock movement")} icon={<ArrowRightLeft size={15} />} count={moves.length} pad={false}>
            {moves.length ? (
              <ul className="pur-moves pur-moves-pad">
                {moves.map((v) => {
                  const m = matOf(s, v.key);
                  return (
                    <li key={v.id} className={v.qty >= 0 ? "in" : "out"}>
                      <b className="num-inline">
                        {v.qty >= 0 ? "+" : "−"}
                        {fmtQty(Math.abs(v.qty), m?.unit ?? "")}
                      </b>
                      <span>{m ? <Link to={`${R.inventory}`}>{x(m.name)}</Link> : v.key}</span>
                      <small className="muted">{m ? unitLabel(m.unit, lang) : ""}</small>
                      <small className="muted num-inline">{d(v.at, false)}</small>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="k-panel-body muted small">{g.status === "REJECTED" ? t("Nothing went into stock: the load was rejected.") : t("No stock movement: these lines go straight to the works.")}</p>
            )}
          </Panel>
          <Panel title={t("Invoice")} icon={<Receipt size={15} />} count={invoices.length} pad={false}>
            {invoices.length ? (
              <ul className="po-links">
                {invoices.map((inv) => {
                  const meta = INVOICE_META[inv.status] ?? { label: { en: inv.status, az: inv.status }, tone: "neutral" as const };
                  return (
                    <li key={inv.id}>
                      <Link to={invoiceHref(inv.id)}>
                        <span className="k-mono">{inv.ref}</span>
                        <span className="muted small">{d(inv.date, false)}</span>
                        <Badge tone={meta.tone}>{x(meta.label)}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="k-panel-body muted small">{t("No invoice from {v} yet. The three-way match runs when it arrives.", { v: vendorName(s, g.vendorId) })}</p>
            )}
          </Panel>
          </div>
        </div>
      )}

      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        kicker={g.ref}
        title={t("Reject this delivery?")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setRejecting(false)}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!rejectWhy.trim()}
              onClick={() => {
                s.rejectReceipt(g.id, rejectWhy.trim());
                setRejecting(false);
                toast(t("{grn} rejected. Nothing went into stock.", { grn: g.ref }), "bad");
              }}
            >
              {t("Reject delivery")}
            </button>
          </>
        }
      >
        <p className="po-dialog-lead">{t("The whole load goes back. The order stays open for a new delivery.")}</p>
        <Field label={t("Reason")}>
          <textarea className="input" value={rejectWhy} onChange={(e) => setRejectWhy(e.target.value)} placeholder={t("e.g. wrong grade, no delivery note")} />
        </Field>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, Inbox, Sparkles, Trash2, XCircle } from "lucide-react";
import { Badge, Dropzone, Empty, FilterChips, fmtBytes, PageHero, Panel, ReadSteps, toast, useFakeRead, useL, type ReadStep } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { matchInvoice } from "../../../ops/store-phase2";
import { addDays, nowStamp, TODAY } from "../../../ops/dates";
import { round } from "../../../ops/seed/util";
import { fmtMoney, unitLabel } from "../../../lib/format";
import { invTotal, MONEY } from "../../../ops/ext/money-p2";
import type { InvoiceLine, OpsData, PurchaseOrder } from "../../../ops/types";
import { InvBadge, InvoicePaper, vendorName, type FieldConf } from "./parts";

type Draft = {
  id: string;
  file: string;
  size: number;
  at: string;
  vendorId: string;
  poId: string;
  ref: string;
  date: string;
  lines: InvoiceLine[];
  conf: FieldConf;
  lineConf: number[];
  state: "check" | "failed";
  reason?: string;
};
type Stage = "check" | "saved" | "failed";

const STEPS: ReadStep[] = [
  { label: "Opening the file", ms: 500 },
  { label: "Reading the supplier and invoice number", ms: 750 },
  { label: "Reading the lines and totals", ms: 900 },
  { label: "Finding the purchase order", ms: 700 },
];
const READABLE = /\.(pdf|png|jpe?g|tiff?|heic|webp)$/i;
const SAMPLES = [
  { name: "Qafqaz_Armatur_invoice_PO-0006.pdf", size: 184_320 },
  { name: "Absheron_Beton_INV_PO-0004.pdf", size: 212_992 },
];

// Drafts survive moving between pages in this session (they are not saved data yet).
let cache: Draft[] = [];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const prefix = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => !/^(MMC|ASC|QSC)$/i.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 3);

function linesFor(po: PurchaseOrder, draftId: string): InvoiceLine[] {
  return po.lines.map((l, i) => ({ key: `${draftId}-${i}`, description: l.description, unit: l.unit, qty: l.received > 0 ? l.received : l.qty, rate: l.rate, poLineKey: l.key }));
}

/** Fake AI reading: deterministic from the file name, using the project's real orders. */
function readFile(s: OpsData, file: { name: string; size: number }, n: number): Draft {
  const id = `UP-${n}`;
  const h = hash(file.name);
  if (!READABLE.test(file.name))
    return { id, file: file.name, size: file.size, at: nowStamp(), vendorId: "", poId: "", ref: "", date: TODAY, lines: [], conf: {}, lineConf: [], state: "failed", reason: "Not a PDF or an image of an invoice" };
  const named = file.name.match(/PO-\d{4}/i)?.[0]?.toUpperCase();
  const pool = s.pos.filter((p) => p.status !== "CANCELLED" && p.status !== "DRAFT");
  const po = (named && pool.find((p) => p.id === named)) || pool[h % Math.max(1, pool.length)];
  if (!po) return { id, file: file.name, size: file.size, at: nowStamp(), vendorId: "", poId: "", ref: "", date: TODAY, lines: [], conf: {}, lineConf: [], state: "failed", reason: "No purchase order to match against" };
  const vname = vendorName(s, po.vendorId);
  const lines = linesFor(po, id);
  return {
    id,
    file: file.name,
    size: file.size,
    at: nowStamp(),
    vendorId: po.vendorId,
    poId: po.id,
    ref: `${prefix(vname)}-${1000 + (h % 9000)}`,
    date: addDays(TODAY, -(h % 4)),
    lines,
    conf: { vendor: 0.98, ref: 0.95, date: 0.97, po: named ? 0.93 : 0.84, total: 0.94 },
    lineConf: lines.map((_, i) => (i === h % Math.max(1, lines.length) ? 0.86 : 0.96)),
    state: "check",
  };
}

/** Invoice inbox: drop supplier bills, AI reads them, the buyer checks the fields and saves them to bills. */
export function InvoiceInboxPage() {
  const { t, x, d, stamp, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [drafts, setDrafts] = useState<Draft[]>(cache);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Stage | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const reader = useFakeRead(STEPS);

  useEffect(() => {
    cache = drafts;
  }, [drafts]);

  const draft = drafts.find((x2) => x2.id === openId) ?? null;
  const po = draft ? s.pos.find((p) => p.id === draft.poId) : undefined;
  const patch = (p: Partial<Draft>) => draft && setDrafts((ds) => ds.map((x2) => (x2.id === draft.id ? { ...x2, ...p } : x2)));

  const onFile = async (file: { name: string; size: number }) => {
    const n = drafts.reduce((m, x2) => Math.max(m, Number(x2.id.slice(3))), 0) + 1;
    const dr = readFile(s, file, n);
    setDrafts((ds) => [dr, ...ds]);
    setOpenId(dr.id);
    setReadingId(dr.id);
    await reader.start();
    setReadingId(null);
    if (dr.state === "failed") toast(t("Could not read {file}", { file: dr.file }), "bad");
    else toast(t("{file} read. Check the amber fields.", { file: dr.file }), "info");
  };

  const save = () => {
    if (!draft || !po) return;
    const conf = Object.values(draft.conf);
    const id = s.submitInvoice({ vendorId: draft.vendorId, poId: draft.poId, ref: draft.ref.trim() || draft.id, lines: draft.lines, source: "UPLOAD", confidence: round(conf.reduce((a, b) => a + (b ?? 1), 0) / Math.max(1, conf.length), 2) });
    setDrafts((ds) => ds.filter((x2) => x2.id !== draft.id));
    setOpenId(null);
    reader.reset();
    const inv = useOps.getState().invoices.find((i) => i.id === id);
    toast(inv?.status === "SIGN_OFF" ? t("{id} saved. It matches and is ready for sign-off.", { id }) : t("{id} saved to bills. The match found a difference.", { id }), inv?.status === "SIGN_OFF" ? "ok" : "warn");
    navigate(MONEY.invoice(id));
  };
  const discard = (id: string) => {
    setDrafts((ds) => ds.filter((x2) => x2.id !== id));
    if (openId === id) {
      setOpenId(null);
      reader.reset();
    }
  };

  // Recent uploads: drafts in this session plus saved bills that came from a file.
  const saved = useMemo(() => s.invoices.filter((i) => i.source !== "PORTAL"), [s.invoices]);
  const rows = useMemo(
    () => [
      ...drafts.map((dr) => ({ key: dr.id, stage: dr.state as Stage, title: dr.file, sub: dr.state === "failed" ? t(dr.reason ?? "Could not read") : `${vendorName(s, dr.vendorId)} · ${dr.poId}`, at: dr.at, draft: dr, inv: null })),
      ...saved.map((i) => ({ key: i.id, stage: "saved" as Stage, title: `${i.ref} · ${i.id}`, sub: `${vendorName(s, i.vendorId)} · ${i.poId}`, at: i.history[0]?.at ?? i.date, draft: null, inv: i })),
    ],
    [drafts, saved, s, t],
  );
  const counts = { check: rows.filter((r) => r.stage === "check").length, saved: rows.filter((r) => r.stage === "saved").length, failed: rows.filter((r) => r.stage === "failed").length };
  const shown = rows.filter((r) => !filter || r.stage === filter);

  const m = draft && po ? matchInvoice({ lines: draft.lines }, po) : null;
  const dup = draft ? s.invoices.find((i) => i.vendorId === draft.vendorId && i.ref === draft.ref.trim()) : undefined;
  const amber = (k: keyof FieldConf) => (draft && (draft.conf[k] ?? 1) < 0.9 ? " pmn-amber" : "");
  const total = draft ? invTotal({ lines: draft.lines, vatRate: po?.vatRate ?? 0.18 }) : 0;
  const reading = !!draft && readingId === draft.id;

  return (
    <div className="k-page pmn-page">
      <PageHero
        eyebrow={t("Procurement · Invoice inbox")}
        title={t("Invoice inbox")}
        subtitle={t("Drop supplier bills here. AI reads the supplier, number, order and lines; you check the amber fields and save.")}
        flow={["Drop", "AI reads", "You check", "Saved to bills"]}
        art="pay"
        back={{ to: MONEY.invoices, label: "Supplier invoices" }}
      />

      <div className="k-grid-main pmn-inbox">
        <div className="k-stack">
          {!draft ? (
            <Dropzone accept=".pdf,image/*" title={t("Drop invoices here and AI reads them")} hint={t("PDF, scan or phone photo. Nothing leaves this browser in the demo.")} onFile={(f) => void onFile(f)}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onFile(SAMPLES[drafts.length % SAMPLES.length]!)}>
                <Sparkles size={14} />
                {t("Try a sample invoice")}
              </button>
            </Dropzone>
          ) : reading ? (
            <section className="pmn-reading k-rise" aria-live="polite">
              <div className="pmn-reading-paper">
                {draft.state === "check" && po ? <InvoicePaper vendor={vendorName(s, draft.vendorId)} refNo={draft.ref} date={draft.date} poRef={draft.poId} lines={draft.lines} vatRate={po.vatRate} scanned /> : <div className="pmn-paper scanned pmn-paper-blank"><span className="pmn-scanline" /></div>}
              </div>
              <div className="pmn-reading-steps">
                <span className="k-ai-tag">
                  <Sparkles size={12} /> {t("AI is reading")}
                </span>
                <strong className="truncate">{draft.file}</strong>
                <small className="muted">{fmtBytes(draft.size)}</small>
                <ReadSteps steps={STEPS} step={reader.step} />
              </div>
            </section>
          ) : draft.state === "failed" ? (
            <section className="pmn-failed k-rise">
              <XCircle size={22} />
              <div>
                <strong>{t("Could not read {file}", { file: draft.file })}</strong>
                <p>{t(draft.reason ?? "Could not read")}. {t("Send a PDF or a clear photo of the invoice.")}</p>
              </div>
              <div className="k-row">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpenId(null)}>
                  {t("Drop another file")}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => discard(draft.id)}>
                  <Trash2 size={14} />
                  {t("Remove")}
                </button>
              </div>
            </section>
          ) : (
            <section className="pmn-review k-rise" aria-label={t("Check what AI read")}>
              <header className="pmn-review-head">
                <div>
                  <span className="k-ai-tag">
                    <Sparkles size={12} /> {t("Read by AI")}
                  </span>
                  <h2>{t("Check what AI read")}</h2>
                  <p className="muted small">{t("Amber fields were read with less than 90% confidence. Confirm or correct them.")}</p>
                </div>
                <span className="pmn-review-file">
                  <FileText size={14} /> <span className="truncate">{draft.file}</span>
                </span>
              </header>
              <div className="pmn-review-body">
                <div className="pmn-review-orig">
                  <span className="pmn-review-label">{t("Original")}</span>
                  {po ? <InvoicePaper vendor={vendorName(s, draft.vendorId)} vendorCity={s.vendors.find((v) => v.id === draft.vendorId)?.city} refNo={draft.ref} date={draft.date} poRef={draft.poId} lines={draft.lines} vatRate={po.vatRate} conf={draft.conf} lineConf={draft.lineConf} /> : null}
                </div>
                <div className="pmn-review-fields">
                  <span className="pmn-review-label">{t("What AI read")}</span>
                  <div className="pmn-fields">
                    <label className={`pmn-field${amber("vendor")}`}>
                      <span>{t("Vendor")}</span>
                      <select className="input select" value={draft.vendorId} onChange={(e) => patch({ vendorId: e.target.value, conf: { ...draft.conf, vendor: 1 } })}>
                        {s.vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={`pmn-field${amber("ref")}`}>
                      <span>{t("Invoice no")}</span>
                      <input className="input" value={draft.ref} onChange={(e) => patch({ ref: e.target.value, conf: { ...draft.conf, ref: 1 } })} />
                    </label>
                    <label className={`pmn-field${amber("date")}`}>
                      <span>{t("Date")}</span>
                      <input className="input" type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value || TODAY, conf: { ...draft.conf, date: 1 } })} />
                    </label>
                    <label className={`pmn-field${amber("po")}`}>
                      <span>
                        {t("Purchase order")}
                        {(draft.conf.po ?? 1) < 0.9 ? <em>{t("{p}% sure", { p: Math.round((draft.conf.po ?? 0) * 100) })}</em> : null}
                      </span>
                      <span className="pmn-field-row">
                        <select
                          className="input select"
                          value={draft.poId}
                          onChange={(e) => {
                            const np = s.pos.find((p) => p.id === e.target.value);
                            if (!np) return;
                            const lines = linesFor(np, draft.id);
                            patch({ poId: np.id, vendorId: np.vendorId, lines, lineConf: lines.map(() => 0.96), conf: { ...draft.conf, po: 1, vendor: 1 } });
                          }}
                        >
                          {s.pos
                            .filter((p) => p.status !== "CANCELLED")
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.ref} · {vendorName(s, p.vendorId)}
                              </option>
                            ))}
                        </select>
                        {(draft.conf.po ?? 1) < 0.9 ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch({ conf: { ...draft.conf, po: 1 } })}>
                            {t("Confirm")}
                          </button>
                        ) : null}
                      </span>
                    </label>
                  </div>

                  <table className="pmn-rlines">
                    <thead>
                      <tr>
                        <th>{t("Line")}</th>
                        <th>{t("Qty")}</th>
                        <th>{t("Rate")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.lines.map((l, i) => (
                        <tr key={l.key} className={(draft.lineConf[i] ?? 1) < 0.9 ? "pmn-amber" : undefined}>
                          <td>
                            <span className="pmn-rline-name">{x(l.description)}</span>
                          </td>
                          <td>
                            <span className="pmn-qty">
                              <input
                                className="input"
                                type="number"
                                min={0}
                                step="any"
                                value={l.qty}
                                aria-label={t("Quantity")}
                                onChange={(e) => patch({ lines: draft.lines.map((y, j) => (j === i ? { ...y, qty: Math.max(0, Number(e.target.value) || 0) } : y)), lineConf: draft.lineConf.map((c, j) => (j === i ? 1 : c)) })}
                              />
                              <small>{unitLabel(l.unit, lang)}</small>
                            </span>
                          </td>
                          <td>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              step="any"
                              value={l.rate}
                              aria-label={t("Rate")}
                              onChange={(e) => patch({ lines: draft.lines.map((y, j) => (j === i ? { ...y, rate: Math.max(0, Number(e.target.value) || 0) } : y)), lineConf: draft.lineConf.map((c, j) => (j === i ? 1 : c)) })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="pmn-review-total">
                    <span>{t("Total with VAT")}</span>
                    <b className={`num-inline${amber("total")}`}>{fmtMoney(total)} AZN</b>
                  </div>

                  {m ? (
                    <div className={`k-callout k-tone-${m.ok ? "ok" : "warn"}`}>
                      {m.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                      <span>{m.ok ? t("Matches {po} and what was received. It goes straight to sign-off.", { po: draft.poId }) : t("Differs from what was received on {po} by {a} AZN before VAT. It will land in Fix the match.", { po: draft.poId, a: fmtMoney(m.over) })}</span>
                    </div>
                  ) : null}
                  {dup ? (
                    <div className="k-callout k-tone-bad">
                      <AlertTriangle size={15} />
                      <span>{t("Same supplier and number as {id}. It will be flagged as a duplicate.", { id: dup.id })}</span>
                    </div>
                  ) : null}

                  <div className="k-row pmn-review-actions">
                    <button type="button" className="btn btn-primary" onClick={save} disabled={!po || !draft.lines.length}>
                      {t("Save to bills")}
                      <ArrowRight size={15} />
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setOpenId(null)}>
                      {t("Later")}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => discard(draft.id)}>
                      <Trash2 size={14} />
                      {t("Discard")}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="k-stack">
          <Panel title={t("Recent uploads")} icon={<Inbox size={15} />} count={rows.length || undefined} pad={false}>
            <div className="pmn-chips">
              <FilterChips<Stage>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "check", label: t("To check"), count: counts.check },
                  { value: "saved", label: t("Saved"), count: counts.saved },
                  { value: "failed", label: t("Failed"), count: counts.failed },
                ]}
              />
            </div>
            {shown.length ? (
              <ul className="pmn-uploads">
                {shown.map((r) => (
                  <li key={r.key} className={`u-${r.stage}${r.draft && r.draft.id === openId ? " on" : ""}`}>
                    <span className="pmn-upload-icon">{r.stage === "failed" ? <XCircle size={15} /> : r.stage === "saved" ? <CheckCircle2 size={15} /> : <FileText size={15} />}</span>
                    {r.inv ? (
                      <Link to={MONEY.invoice(r.inv.id)} className="pmn-upload-text">
                        <b className="truncate">{r.title}</b>
                        <small className="truncate">{r.sub}</small>
                      </Link>
                    ) : (
                      <button type="button" className="pmn-upload-text" onClick={() => setOpenId(r.key)}>
                        <b className="truncate">{r.title}</b>
                        <small className="truncate">{r.sub}</small>
                      </button>
                    )}
                    <span className="pmn-upload-side">
                      {r.inv ? <InvBadge status={r.inv.status} /> : <Badge tone={r.stage === "failed" ? "bad" : "warn"}>{r.stage === "failed" ? t("Failed") : t("To check")}</Badge>}
                      <small>{r.inv ? d(r.inv.date, false) : stamp(r.at)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title={t("Nothing here")}>{t("Bills you drop appear here until they are saved.")}</Empty>
            )}
          </Panel>
          <div className="k-note">{t("Bills sent by suppliers through the vendor portal skip this inbox: they arrive already matched.")}</div>
        </div>
      </div>
    </div>
  );
}

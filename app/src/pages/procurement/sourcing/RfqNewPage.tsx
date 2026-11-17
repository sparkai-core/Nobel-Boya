import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarClock, Check, ClipboardList, Mail, Send, Users } from "lucide-react";
import { Badge, Field, LineItemsEditor, PageHero, Panel, StatusBadge, toast, useL, type DraftLine } from "../../../components/kit";
import { ME, useOps } from "../../../ops/store";
import { addDays, TODAY } from "../../../ops/dates";
import { budgetOf, R, statusMeta, TRADES, tradeName } from "../../../ops/select";
import { fmtMoneyShort, fmtQty, unitLabel } from "../../../lib/format";
import type { Trade } from "../../../ops/types";
import { vendorsFor } from "./shared";

type Filter = "trade" | "all" | "picked";

export function RfqNewPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mrs = useOps((s) => s.mrs);
  const vendors = useOps((s) => s.vendors);
  const materials = useOps((s) => s.materials);
  const seq = useOps((s) => s.seq);
  const createRfq = useOps((s) => s.createRfq);

  const mrId = params.get("mr");
  const mr = mrId ? mrs.find((m) => m.id === mrId) : undefined;

  const [title, setTitle] = useState("");
  const [trade, setTrade] = useState<Trade>("Concrete");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState("");
  const [due, setDue] = useState(addDays(TODAY, 14));
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("trade");
  const [q, setQ] = useState("");

  const defaultsFor = (tr: Trade) =>
    vendorsFor(vendors, tr)
      .filter((v) => v.status === "APPROVED")
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 3)
      .map((v) => v.id);

  useEffect(() => {
    if (mr) {
      setTitle(x(mr.title));
      setTrade(mr.trade);
      setLines(mr.lines.map((l) => ({ id: l.key, material: l.material, description: l.description, spec: l.spec, qty: l.qty, unit: l.unit })));
      setNote(mr.notes ? x(mr.notes) : "");
      setPicked(defaultsFor(mr.trade));
    } else setPicked(defaultsFor("Concrete"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrId]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return vendors
      .filter((v) => (filter === "trade" ? v.trade === trade || v.trades.includes(trade) : filter === "picked" ? picked.includes(v.id) : true))
      .filter((v) => !s || v.name.toLowerCase().includes(s) || v.city.toLowerCase().includes(s))
      .sort((a, b) => Number(b.trade === trade) - Number(a.trade === trade) || b.overall - a.overall);
  }, [vendors, filter, trade, picked, q]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x2) => x2 !== id) : [...p, id]));
  const nextRef = `RFQ-${String((seq.RFQ ?? 0) + 1).padStart(4, "0")}`;
  const value = budgetOf({ materials }, lines);

  const missing: string[] = [];
  if (!title.trim()) missing.push(t("A title"));
  if (!lines.length || lines.some((l) => !(l.qty > 0))) missing.push(t("A quantity on every line"));
  if (!picked.length) missing.push(t("At least one vendor"));
  if (due < TODAY) missing.push(t("A closing date in the future"));

  const send = () => {
    if (missing.length) {
      toast(t("Still missing: {list}", { list: missing.join(", ").toLowerCase() }), "warn");
      return;
    }
    const id = createRfq({
      mrId: mr?.id ?? null,
      title: title.trim(),
      trade,
      dueDate: due,
      note: note.trim(),
      lines: lines.map(({ id: key, ...l }) => ({ key, ...l })),
      vendorIds: picked,
    });
    toast(t("{ref} sent to {n} vendors", { ref: id, n: picked.length }));
    navigate(R.rfq(id));
  };

  const pickedVendors = picked.map((id) => vendors.find((v) => v.id === id)).filter((v): v is NonNullable<typeof v> => !!v);

  return (
    <div className="k-page ps-page">
      <PageHero
        eyebrow={t("Procurement · New RFQ")}
        title={t("Ask vendors for prices")}
        subtitle={mr ? t("From {ref}: the lines, trade and title come from the request. Pick who quotes and when quotes are due.", { ref: mr.ref }) : t("Describe what you are buying, pick who quotes and when quotes are due.")}
        flow={["What you are asking for", "When quotes are due", "Who quotes", "Send"]}
        art="rfq"
        back={mr ? { to: R.request(mr.id), label: "Back to the request" } : { to: R.rfqs, label: "RFQ marketplace" }}
      />

      <div className="k-grid-main ps-new">
        <div className="k-stack">
          <Panel title={t("What you are asking for")} icon={<ClipboardList size={15} />} count={lines.length || undefined}>
            <div className="k-form">
              <Field label={t("Title")} wide>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Ready-mix B25 for the admin frame")} />
              </Field>
              <Field label={t("Trade")}>
                <select
                  className="input select"
                  value={trade}
                  onChange={(e) => {
                    const tr = e.target.value as Trade;
                    setTrade(tr);
                    if (!mr) setPicked(defaultsFor(tr));
                  }}
                >
                  {TRADES.map((tr) => (
                    <option key={tr} value={tr}>
                      {tradeName(tr, lang)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("From request")}>
                <input className="input" value={mr ? `${mr.ref} · ${x(mr.title)}` : t("None (direct RFQ)")} readOnly />
              </Field>
              <Field label={t("Lines")} wide>
                <div className="ps-lines-scroll">
                  <LineItemsEditor lines={lines} onChange={setLines} trade={trade} />
                </div>
              </Field>
              <Field label={t("Note for vendors")} wide hint={t("Vendors see this in the portal next to the lines.")}>
                <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Delivery address, grades, what to include in the price")} />
              </Field>
            </div>
          </Panel>

          <Panel title={t("When quotes are due")} icon={<CalendarClock size={15} />}>
            <div className="k-row">
              <input className="input" type="date" value={due} min={TODAY} onChange={(e) => setDue(e.target.value)} style={{ width: 180 }} />
              <div className="k-quick">
                {[1, 2, 3].map((w) => {
                  const v = addDays(TODAY, w * 7);
                  return (
                    <button key={w} type="button" className={due === v ? "on" : undefined} onClick={() => setDue(v)}>
                      {t(w === 1 ? "1 week" : "{n} weeks", { n: w })}
                    </button>
                  );
                })}
              </div>
              {mr ? (
                <small className={due > mr.neededBy ? "k-text-bad" : "muted"}>
                  {due > mr.neededBy ? t("Closes after the site needs it ({date}).", { date: d(mr.neededBy) }) : t("Site needs it by {date}.", { date: d(mr.neededBy) })}
                </small>
              ) : null}
            </div>
          </Panel>

          <Panel title={t("Who quotes")} icon={<Users size={15} />} count={picked.length} pad={false}>
            <div className="ps-picker-bar">
              <label className="search k-search">
                <input className="input" type="search" value={q} placeholder={t("Search vendors")} onChange={(e) => setQ(e.target.value)} aria-label={t("Search vendors")} />
              </label>
              <div className="ps-seg" role="group" aria-label={t("Show")}>
                {(
                  [
                    ["trade", t("This trade")],
                    ["all", t("All")],
                    ["picked", t("Picked ({n})", { n: picked.length })],
                  ] as [Filter, string][]
                ).map(([k, label]) => (
                  <button key={k} type="button" className={`ps-seg-btn${filter === k ? " on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="ps-vpick">
              {list.length === 0 ? <li className="ps-col-empty">{t("No vendors match.")}</li> : null}
              {list.map((v) => {
                const on = picked.includes(v.id);
                const off = v.status === "DISQUALIFIED";
                const risk = statusMeta("risk", v.risk);
                return (
                  <li key={v.id}>
                    <button type="button" className={`ps-vrow${on ? " on" : ""}`} disabled={off} aria-pressed={on} onClick={() => toggle(v.id)}>
                      <span className="ps-vcheck" aria-hidden="true">
                        {on ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <span className="ps-vname">
                        <strong className="truncate">{v.name}</strong>
                        <small>
                          {tradeName(v.trade, lang)} · {v.city}
                          {v.portal ? ` · ${t("on the portal")}` : ""}
                        </small>
                      </span>
                      {v.status !== "APPROVED" ? <StatusBadge kind="vendor" status={v.status} /> : null}
                      <span className="ps-vstat" title={t("Vendor score out of 10")}>
                        <b>{v.overall.toFixed(1)}</b>
                        <small>/10</small>
                      </span>
                      <span className="ps-vstat hide-900">
                        <b>{v.avgDeliveryDays}</b>
                        <small>{t("days")}</small>
                      </span>
                      <Badge tone={risk.tone}>{x(risk.label)}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="ps-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={send}>
              <Send size={15} />
              {picked.length === 1 ? t("Send to 1 vendor") : t("Send to {n} vendors", { n: picked.length })}
            </button>
          </div>
        </div>

        <aside className="ps-ticket-wrap">
          <div className="ps-letter" aria-label={t("Invitation preview")}>
            <header className="ps-letter-head">
              <span className="ps-letter-logo">N</span>
              <span>
                <strong>Nobel</strong>
                <small>{t("Qobu warehouse and administration building")}</small>
              </span>
              <Mail size={16} className="muted" />
            </header>
            <div className="ps-letter-meta">
              <span className="k-ref">{nextRef}</span>
              <span>{d(TODAY)}</span>
            </div>
            <h3>{t("Invitation to quote")}</h3>
            <p className="ps-letter-to">
              <span className="muted">{t("To")}:</span>{" "}
              {pickedVendors.length ? pickedVendors.map((v) => v.name).join(", ") : <span className="ps-ph">{t("pick vendors")}</span>}
            </p>
            <p>{t("Please quote for the items below, delivered to the Qobu site, by {date}.", { date: d(due) })}</p>
            <p className={title.trim() ? "ps-letter-subject" : "ps-letter-subject ps-ph"}>{title.trim() || t("Untitled RFQ")}</p>
            <ol className="ps-ticket-lines">
              {lines.length ? (
                lines.map((l) => (
                  <li key={l.id}>
                    <span className="truncate">
                      {x(l.description) || t("Unnamed line")}
                      {l.spec ? <small> · {l.spec}</small> : null}
                    </span>
                    <b className="num-inline">
                      {l.qty > 0 ? fmtQty(l.qty, l.unit) : "?"} {unitLabel(l.unit, lang)}
                    </b>
                  </li>
                ))
              ) : (
                <li className="ps-ph">{t("No lines yet")}</li>
              )}
            </ol>
            {note.trim() ? <p className="ps-letter-note">{note}</p> : null}
            <p className="muted small">{t("Prices in AZN, VAT shown separately. Say how long the price holds and your delivery time.")}</p>
            <footer className="ps-letter-sign">
              <span>{ME}</span>
              <small>{t("Project manager, Nobel")}</small>
            </footer>
            <div className="ps-letter-foot">
              <span>
                {t("BOQ value")} ≈ <b className="num-inline">{fmtMoneyShort(value)} AZN</b>
              </span>
              {missing.length ? <span className="k-text-warn">{t("{n} things missing", { n: missing.length })}</span> : <span className="k-text-ok">{t("Ready to send")}</span>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

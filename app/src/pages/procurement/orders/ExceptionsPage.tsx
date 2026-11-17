import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, FileSearch, Hand, RotateCcw, ScanLine, ShieldCheck, X } from "lucide-react";
import { Badge, Dialog, Empty, Field, FilterChips, Money, PageHero, StatusBadge, TabBar, Timeline, toast, useL } from "../../../components/kit";
import { Drawer } from "../../../components/ui";
import { useOps, ME } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { quoteTotal, R } from "../../../ops/select";
import type { ExceptionReason, ProcException, Quotation } from "../../../ops/types";
import { quoteBudget, short, vendorName, VisualHead } from "./shared";

const STAGES = [
  { key: "IN", label: "Quotes in" },
  { key: "READ", label: "Read" },
  { key: "CHECK", label: "Check" },
  { key: "RISK", label: "Risk screen" },
  { key: "READY", label: "Ready to compare" },
] as const;
type StageKey = "READ" | "CHECK" | "RISK";

const REASON_LABEL: Record<ExceptionReason, string> = {
  DUPLICATE: "Possible duplicate",
  OVER_BUDGET: "Over the BOQ budget",
  LOW_CONFIDENCE: "Hard to read",
  EXPIRING: "Price about to expire",
  RISK: "Risk flag",
  MISSING_TRN: "Vendor papers",
};

type Tab = "todo" | "done" | "mine";
type Sort = "worst" | "longest" | "largest";

/** Exceptions: the hold line where automatic checks stop quotes, the work queue, and a side panel to clear each one. */
export function ExceptionsPage() {
  const { t, x, rel } = useL();
  const s = useOps();
  const [tab, setTab] = useState<Tab>("todo");
  const [sort, setSort] = useState<Sort>("worst");
  const [stage, setStage] = useState<StageKey | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const live = (e: ProcException) => e.status === "open" || e.status === "assigned";
  const quoteOf = (e: ProcException) => s.quotes.find((q) => q.id === e.quoteId);
  const amount = (e: ProcException) => {
    const q = quoteOf(e);
    return q ? quoteTotal(q) : 0;
  };

  const held = s.exceptions.filter(live);
  const heldQuotes = new Set(held.map((e) => e.quoteId));
  const liveQuotes = s.quotes.filter((q) => !q.outcome);
  const maxAmt = Math.max(1, ...held.map(amount));

  const list = (() => {
    const base = s.exceptions.filter((e) => (tab === "todo" ? live(e) : tab === "done" ? !live(e) : e.assignee === ME)).filter((e) => !stage || e.stage === stage);
    const sev = (e: ProcException) => (e.severity === "critical" ? 0 : 1);
    return [...base].sort((a, b) => (sort === "worst" ? sev(a) - sev(b) || a.raisedAt.localeCompare(b.raisedAt) : sort === "longest" ? a.raisedAt.localeCompare(b.raisedAt) : amount(b) - amount(a)));
  })();

  const sel_ = sel ? s.exceptions.find((e) => e.id === sel) : undefined;

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Exceptions")}
        title={t("Exceptions")}
        subtitle={t("Quotes the automatic checks stopped before comparison. Clear each one so the buyer compares clean offers.")}
        flow={["Quote read", "Checks run", "Held here", "Cleared", "Compared"]}
        art="exception"
      />

      <section className="po-visual" aria-label={t("Hold line")}>
        <VisualHead
          title={t("Hold line")}
          sentence={held.length ? t("{n} quotes held, {v} at stake. Click a check to see what it stopped.", { n: heldQuotes.size, v: short(held.reduce((a, e) => a + amount(e), 0)) }) : t("Nothing is held. Every quote passed its checks.")}
        />
        <div className="po-holdline-scroll">
          <ol className="po-holdline">
            {STAGES.map((st, i) => {
              const at = st.key === "READ" || st.key === "CHECK" || st.key === "RISK" ? held.filter((e) => e.stage === st.key) : [];
              const count = st.key === "IN" ? liveQuotes.length : st.key === "READY" ? liveQuotes.filter((q) => !heldQuotes.has(q.id)).length : at.length;
              const clickable = st.key === "READ" || st.key === "CHECK" || st.key === "RISK";
              const on = stage === st.key;
              return (
                <li key={st.key} className={`po-hold-stage${clickable ? " check" : ""}${on ? " on" : ""}${stage && !on && clickable ? " dim" : ""}`}>
                  <div className="po-hold-cols">
                    {at.map((e, k) => (
                      <button key={e.id} type="button" className={`po-hold-col ${e.severity}`} style={{ height: `${36 + (amount(e) / maxAmt) * 64}%`, animationDelay: `${(i * 3 + k) * 50}ms` }} onClick={() => setSel(e.id)} title={`${e.quoteId} · ${t(REASON_LABEL[e.reason])}`}>
                        <span className="num-inline">{short(amount(e))}</span>
                      </button>
                    ))}
                    {st.key === "READY" ? <span className="po-hold-pass num-inline">{count}</span> : null}
                    {st.key === "IN" ? <span className="po-hold-in num-inline">{count}</span> : null}
                  </div>
                  <button type="button" className="po-hold-node" disabled={!clickable} onClick={() => setStage(on ? null : (st.key as StageKey))} aria-pressed={clickable ? on : undefined}>
                    <i aria-hidden="true">{i + 1}</i>
                    <span>{t(st.label)}</span>
                    {clickable ? <b className="num-inline">{count}</b> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="po-legend-line">
          <i className="po-sw bad" /> {t("Critical")} <i className="po-sw amber" /> {t("Warning")} <span className="muted">· {t("column height is the value at stake")}</span>
        </p>
      </section>

      <section className="k-register">
        <div className="k-register-toolbar">
          <div className="k-toolbar">
            <div className="k-toolbar-main">
              <TabBar<Tab>
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "todo", label: t("To do"), count: s.exceptions.filter(live).length },
                  { value: "done", label: t("Handled"), count: s.exceptions.filter((e) => !live(e)).length },
                  { value: "mine", label: t("Yours"), count: s.exceptions.filter((e) => e.assignee === ME).length },
                ]}
              />
            </div>
            <div className="k-toolbar-end">
              <FilterChips<Sort>
                value={sort}
                onChange={(v) => setSort(v ?? "worst")}
                options={[
                  { value: "worst", label: t("Worst first") },
                  { value: "longest", label: t("Held longest") },
                  { value: "largest", label: t("Largest value") },
                ]}
              />
            </div>
          </div>
          {stage ? (
            <p className="po-filter-note">
              {t("Showing what the {c} check stopped.", { c: t(STAGES.find((x2) => x2.key === stage)!.label) })}{" "}
              <button type="button" className="k-link-btn" onClick={() => setStage(null)}>
                {t("Show all")}
              </button>
            </p>
          ) : null}
        </div>
        {list.length ? (
          <ul className="po-exq">
            {list.map((e) => {
              const q = quoteOf(e);
              return (
                <li key={e.id}>
                  <button type="button" className={sel === e.id ? "on" : undefined} onClick={() => setSel(e.id)}>
                    <span className={`po-exq-sev ${e.severity}`} aria-hidden="true" />
                    <span className="po-exq-main">
                      <span className="k-row" style={{ gap: 6 }}>
                        <strong>{t(REASON_LABEL[e.reason])}</strong>
                        <span className="k-mono muted">{e.id}</span>
                      </span>
                      <span className="po-exq-detail">{x(e.detail)}</span>
                      <small>
                        {q ? `${q.id} · ${vendorName(s, q.vendorId)}` : e.quoteId} · {t("held {when}", { when: rel(e.raisedAt) })}
                        {e.assignee ? ` · ${e.assignee}` : ""}
                      </small>
                    </span>
                    <span className="po-exq-end">
                      <Money value={amount(e)} short />
                      <StatusBadge kind="exception" status={e.status} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="k-register-empty">
            <Empty icon={<ShieldCheck size={20} />} title={tab === "mine" ? t("Nothing assigned to you") : tab === "done" ? t("Nothing handled yet") : t("Queue is clear")} />
          </div>
        )}
      </section>

      <Drawer open={!!sel_} onClose={() => setSel(null)} kicker={sel_ ? `${sel_.id} · ${sel_.quoteId}` : undefined} title={sel_ ? t(REASON_LABEL[sel_.reason]) : ""}>
        {sel_ ? <ExceptionPanel key={sel_.id} e={sel_} q={quoteOf(sel_)} /> : null}
      </Drawer>
    </div>
  );
}

function ExceptionPanel({ e, q }: { e: ProcException; q: Quotation | undefined }) {
  const { t, x, d } = useL();
  const s = useOps();
  const [noteFor, setNoteFor] = useState<"resolve" | "dismiss" | null>(null);
  const [note, setNote] = useState("");
  const vendor = q ? s.vendors.find((v) => v.id === q.vendorId) : undefined;
  const rfq = q?.rfqId ? s.rfqs.find((r) => r.id === q.rfqId) : undefined;
  const failing = q?.checks.filter((c) => c.result !== "PASSED") ?? [];
  const live = e.status === "open" || e.status === "assigned";
  const total = q ? quoteTotal(q) : 0;

  const says = (() => {
    if (!q) return "—";
    switch (e.reason) {
      case "DUPLICATE":
        return t("Reference {r}, total {v}", { r: q.ref, v: short(total) });
      case "OVER_BUDGET": {
        const b = quoteBudget(s, q) * (1 + q.vatRate);
        return b > 0 ? t("{v} against a BOQ budget of {b}", { v: short(total), b: short(b) }) : short(total);
      }
      case "LOW_CONFIDENCE":
        return t("Read with {p}% confidence", { p: Math.round(q.confidence * 100) });
      case "EXPIRING":
        return t("Price holds until {d} ({n} days)", { d: d(q.validUntil), n: diffDays(TODAY, q.validUntil) });
      case "MISSING_TRN":
        return vendor ? t("TRN {trn} · licence {l}", { trn: vendor.trn, l: vendor.licence ?? t("missing") }) : "—";
      default:
        return t("Risk {r}", { r: q.risk });
    }
  })();

  const finish = () => {
    if (!noteFor || !note.trim()) return;
    if (noteFor === "resolve") {
      s.resolveException(e.id, note.trim());
      toast(t("{id} resolved", { id: e.id }));
    } else {
      s.dismissException(e.id, note.trim());
      toast(t("{id} dismissed", { id: e.id }), "neutral");
    }
    setNoteFor(null);
    setNote("");
  };

  const ways = [
    { key: "review", icon: <FileSearch size={15} />, label: t("Review the quote"), sub: t("Open the reading and fix it line by line."), to: q ? R.quote(q.id) : null, run: null },
    {
      key: "re_extract",
      icon: <ScanLine size={15} />,
      label: t("Re-read"),
      sub: t("Read the document again and confirm the lines."),
      to: null,
      run: q
        ? () => {
            s.confirmQuote(q.id);
            toast(t("{q} read again and confirmed", { q: q.id }), "brand");
          }
        : null,
    },
    { key: "validate", icon: <ShieldCheck size={15} />, label: t("Validate vendor"), sub: t("Check TRN, licence and status on the vendor record."), to: vendor ? R.vendor(vendor.id) : null, run: null },
  ];

  return (
    <div className="po-drawer">
      <div className="k-row" style={{ gap: 6 }}>
        <Badge tone={e.severity === "critical" ? "bad" : "warn"}>{e.severity === "critical" ? t("Critical") : t("Warning")}</Badge>
        <StatusBadge kind="exception" status={e.status} />
        {e.assignee ? <span className="muted small">{e.assignee}</span> : null}
      </div>

      <section>
        <h3 className="po-drawer-h">{t("What is wrong")}</h3>
        <p className="po-ex-what">{x(e.detail)}</p>
        <div className="po-ex-compare">
          <div>
            <span>{t("The check")}</span>
            {failing.length ? (
              failing.map((c, i) => (
                <p key={i} className={c.result === "FAILED" ? "k-text-bad" : "k-text-warn"}>
                  <b>{x(c.label)}</b> {x(c.detail)}
                </p>
              ))
            ) : (
              <p>{t(REASON_LABEL[e.reason])}</p>
            )}
          </div>
          <div>
            <span>{t("The quote says")}</span>
            <p>{says}</p>
          </div>
        </div>
      </section>

      <section className="po-ex-risk">
        <span>{t("At risk")}</span>
        <Money value={total} />
      </section>

      <section>
        <h3 className="po-drawer-h">{t("Records")}</h3>
        <div className="po-ex-records">
          {rfq?.mrId ? <Link to={R.request(rfq.mrId)} className="po-chip-link">{t("Request")} {rfq.mrId}</Link> : null}
          {rfq ? <Link to={R.rfq(rfq.id)} className="po-chip-link">{rfq.ref}</Link> : null}
          {q ? <Link to={R.quote(q.id)} className="po-chip-link">{t("Quote")} {q.id}</Link> : null}
          {vendor ? <Link to={R.vendor(vendor.id)} className="po-chip-link">{vendor.name}</Link> : null}
        </div>
      </section>

      <section>
        <h3 className="po-drawer-h">{t("Ways out")}</h3>
        <ul className="po-ways">
          {ways.map((w) => {
            const inner = (
              <>
                <span className="po-ways-icon">{w.icon}</span>
                <span>
                  <b>
                    {w.label}
                    {e.action === w.key ? <em>{t("suggested")}</em> : null}
                  </b>
                  <small>{w.sub}</small>
                </span>
              </>
            );
            return (
              <li key={w.key} className={e.action === w.key ? "best" : undefined}>
                {w.to ? <Link to={w.to}>{inner}</Link> : <button type="button" onClick={w.run ?? undefined} disabled={!w.run}>{inner}</button>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="po-ex-actions">
        {live ? (
          <>
            {e.status === "open" || e.assignee !== ME ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  s.takeException(e.id);
                  toast(t("{id} is yours now", { id: e.id }), "brand");
                }}
              >
                <Hand size={15} />
                {t("Take it")}
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => setNoteFor("resolve")}>
              <Check size={15} />
              {t("Mark resolved…")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setNoteFor("dismiss")}>
              <X size={15} />
              {t("Dismiss…")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              s.reopenException(e.id);
              toast(t("{id} reopened", { id: e.id }), "warn");
            }}
          >
            <RotateCcw size={15} />
            {t("Reopen")}
          </button>
        )}
      </div>

      <section>
        <h3 className="po-drawer-h">{t("History")}</h3>
        <Timeline events={e.history} />
      </section>

      <Dialog
        open={noteFor != null}
        onClose={() => setNoteFor(null)}
        kicker={e.id}
        title={noteFor === "resolve" ? t("Mark as resolved") : t("Dismiss this exception")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setNoteFor(null)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" disabled={!note.trim()} onClick={finish}>
              {noteFor === "resolve" ? t("Resolve") : t("Dismiss")}
            </button>
          </>
        }
      >
        <Field label={t("Note for the record")}>
          <textarea className="input" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder={noteFor === "resolve" ? t("What was done") : t("Why this is not a problem")} />
        </Field>
      </Dialog>
    </div>
  );
}

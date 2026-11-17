import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, CheckCheck, Clock3, Hand, Plus, Scale, Send } from "lucide-react";
import {
  FilterChips,
  FlowRail,
  PageHero,
  Register,
  SearchBox,
  StagePath,
  StatusBadge,
  toast,
  Toolbar,
  useL,
  useSearch,
  type Column,
} from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import { budgetOf, PATHS, quoteTotal, R, tradeName } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { Invitation, MaterialRequest, Rfq, Trade } from "../../../ops/types";
import { AnswerChip, approvalFor, closing, liveQuotes } from "./shared";

type Card =
  | { kind: "rfq"; rfq: Rfq; col: "ready" | "waiting" | "needs"; quotes: number; low: number | null; high: number | null; pending: Invitation[] }
  | { kind: "mr"; mr: MaterialRequest; col: "needs" };

const COLS = [
  { key: "ready", label: "Ready to compare", hint: "Two or more quotes are in.", icon: Scale },
  { key: "waiting", label: "Waiting for vendors", hint: "Out with vendors, still open.", icon: Clock3 },
  { key: "needs", label: "Needs you", hint: "No RFQ yet, or past due with nothing in.", icon: Hand },
] as const;

/** RFQ marketplace: one board of where every open RFQ stands, then the full register. */
export function RfqBoardPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [stage, setStage] = useState<string | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [q, setQ] = useState("");

  const cards = useMemo(() => {
    const out: Card[] = [];
    for (const r of s.rfqs) {
      if (r.status !== "OPEN" && r.status !== "CLOSED") continue;
      const lq = liveQuotes(s.quotes, r.id);
      const appr = approvalFor(s.approvals, lq.map((qq) => qq.id));
      if (appr && appr.status !== "REJECTED") continue;
      const totals = lq.map(quoteTotal);
      const pending = r.invitations.filter((i) => i.status === "INVITED" || i.status === "ACKNOWLEDGED");
      const base = { kind: "rfq" as const, rfq: r, quotes: lq.length, low: totals.length ? Math.min(...totals) : null, high: totals.length ? Math.max(...totals) : null, pending };
      if (lq.length >= 2) out.push({ ...base, col: "ready" });
      else if (r.status === "OPEN" && !(r.dueDate < TODAY && lq.length === 0)) out.push({ ...base, col: "waiting" });
      else out.push({ ...base, col: "needs" });
    }
    for (const m of s.mrs) if (m.status === "SUBMITTED" && !s.rfqs.some((r) => r.mrId === m.id)) out.push({ kind: "mr", mr: m, col: "needs" });
    return out;
  }, [s.rfqs, s.quotes, s.approvals, s.mrs]);

  const ready = cards.filter((c) => c.col === "ready");
  const waiting = cards.filter((c) => c.col === "waiting");
  const needs = cards.filter((c) => c.col === "needs");
  const waitingVendors = new Set(waiting.flatMap((c) => (c.kind === "rfq" ? c.pending.map((p) => p.vendorId) : []))).size;
  const finding = [
    ready.length ? t(ready.length === 1 ? "1 is ready to compare." : "{n} are ready to compare.", { n: ready.length }) : t("Nothing is ready to compare yet."),
    waiting.length ? t(waiting.length === 1 ? "1 is waiting on {v} vendors." : "{n} are waiting on {v} vendors.", { n: waiting.length, v: waitingVendors }) : "",
    needs.length ? t(needs.length === 1 ? "1 needs you." : "{n} need you.", { n: needs.length }) : t("Nothing needs you."),
  ]
    .filter(Boolean)
    .join(" ");

  const remind = (r: Rfq, pending: Invitation[]) => {
    for (const p of pending) s.remindVendor(r.id, p.vendorId);
    toast(pending.length === 1 ? t("Reminder sent to {vendor}", { vendor: s.vendors.find((v) => v.id === pending[0]!.vendorId)?.name ?? "" }) : t("Reminder sent to {n} vendors on {ref}", { n: pending.length, ref: r.ref }));
  };

  const counts = useMemo(() => s.rfqs.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}), [s.rfqs]);
  const filtered = useMemo(() => s.rfqs.filter((r) => (!stage || r.status === stage) && (!trade || r.trade === trade)), [s.rfqs, stage, trade]);
  const rows = useSearch(filtered, q, (r) => [r.ref, r.title, r.mrId, r.trade, ...r.invitations.map((i) => s.vendors.find((v) => v.id === i.vendorId)?.name)]);
  const trades = [...new Set(s.rfqs.map((r) => r.trade))];

  const columns: Column<Rfq>[] = [
    {
      key: "rfq",
      header: t("RFQ"),
      sort: (r) => r.ref,
      render: (r) => (
        <div className="k-cell-title">
          <span className="k-ref">{r.ref}</span>
          <strong>{x(r.title)}</strong>
          <small>
            {tradeName(r.trade, lang)}
            {r.mrId ? ` · ${r.mrId}` : ""}
          </small>
        </div>
      ),
    },
    {
      key: "vendors",
      header: t("Vendors"),
      sort: (r) => r.invitations.filter((i) => i.status === "SUBMITTED").length,
      render: (r) => (
        <span className="ps-chips">
          {r.invitations.map((inv) => (
            <AnswerChip key={inv.vendorId} vendor={s.vendors.find((v) => v.id === inv.vendorId)} inv={inv} compact />
          ))}
        </span>
      ),
    },
    {
      key: "quotes",
      header: t("Lowest quote"),
      align: "right",
      hideBelow: 1100,
      sort: (r) => Math.min(Infinity, ...liveQuotes(s.quotes, r.id).map(quoteTotal)),
      render: (r) => {
        const lq = liveQuotes(s.quotes, r.id);
        return lq.length ? (
          <div className="k-cell-title" style={{ justifyItems: "end" }}>
            <strong className="num-inline">{fmtMoneyShort(Math.min(...lq.map(quoteTotal)))}</strong>
            <small>{lq.length === 1 ? t("1 quote") : t("{n} quotes", { n: lq.length })}</small>
          </div>
        ) : (
          <span className="muted">—</span>
        );
      },
    },
    {
      key: "closing",
      header: t("Closing"),
      sort: (r) => r.dueDate,
      render: (r) => {
        const c = closing(t, r.dueDate, r.status === "OPEN");
        return (
          <span className="ps-need">
            <b className="num-inline">{d(r.dueDate)}</b>
            <small className={`k-text-${c.tone === "brand" ? "muted" : c.tone}`}>{c.text}</small>
          </span>
        );
      },
    },
    {
      key: "stage",
      header: t("Stage"),
      sort: (r) => PATHS.rfq.indexOf(r.status as (typeof PATHS.rfq)[number]),
      render: (r) => <StatusBadge kind="rfq" status={r.status} />,
    },
  ];

  return (
    <div className="k-page ps-page">
      <PageHero
        eyebrow={t("Procurement · RFQs")}
        title={t("RFQ marketplace")}
        subtitle={t("Every request for quotation out with vendors: who answered, what is ready to compare and what is stuck.")}
        flow={["Send RFQ", "Vendors answer", "Quotes come in", "Compare"]}
        art="rfq"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate(R.newRfq())}>
            <Plus size={15} />
            {t("New RFQ")}
          </button>
        }
      />

      <FlowRail current="rfq" />

      <section className="ps-board" aria-label={t("Where open RFQs stand")}>
        <p className="ps-finding">{finding}</p>
        <div className="ps-board-cols">
          {COLS.map((col) => {
            const list = cards.filter((c) => c.col === col.key);
            const Icon = col.icon;
            return (
              <div key={col.key} className={`ps-col ps-col-${col.key}`}>
                <header className="ps-col-head">
                  <span className="ps-col-icon">
                    <Icon size={14} />
                  </span>
                  <span>
                    <strong>{t(col.label)}</strong>
                    <small>{t(col.hint)}</small>
                  </span>
                  <b className="num-inline">{list.length}</b>
                </header>
                <div className="ps-col-body">
                  {list.length === 0 ? <p className="ps-col-empty">{t("Nothing here.")}</p> : null}
                  {list.map((c, i) =>
                    c.kind === "mr" ? (
                      <article key={c.mr.id} className="ps-card ps-card-mr" style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="ps-card-top">
                          <span className="k-ref">{c.mr.ref}</span>
                          <span className="ps-card-when k-text-warn">{t("no RFQ yet")}</span>
                        </div>
                        <strong className="ps-card-title">{x(c.mr.title)}</strong>
                        <small className="muted">
                          {tradeName(c.mr.trade, lang)} · {t("{n} lines", { n: c.mr.lines.length })} · ≈ {fmtMoneyShort(budgetOf(s, c.mr.lines))} AZN
                        </small>
                        <small className="muted">
                          {t("Needed by")} {d(c.mr.neededBy)}
                        </small>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.newRfq(c.mr.id))}>
                          <Send size={13} />
                          {t("Create RFQ")}
                        </button>
                      </article>
                    ) : (
                      <RfqCard key={c.rfq.id} c={c} index={i} onRemind={() => remind(c.rfq, c.pending)} />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <StagePath kind="rfq" path={PATHS.rfq} counts={counts} value={stage} onChange={setStage} extras={["CANCELLED"]} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(R.rfq(r.id))}
        initialSort={{ key: "closing", dir: "desc" }}
        toolbar={
          <Toolbar end={<FilterChips value={trade} onChange={setTrade} options={trades.map((tr) => ({ value: tr, label: tradeName(tr, lang), count: s.rfqs.filter((r) => r.trade === tr).length }))} />}>
            <SearchBox value={q} onChange={setQ} placeholder="Search RFQs, vendors, requests" />
          </Toolbar>
        }
        empty={
          <>
            {t("No RFQs match.")}{" "}
            <button type="button" className="k-link-btn" onClick={() => { setStage(null); setTrade(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </>
        }
      />
    </div>
  );
}

function RfqCard({ c, index, onRemind }: { c: Extract<Card, { kind: "rfq" }>; index: number; onRemind: () => void }) {
  const { t, x } = useL();
  const navigate = useNavigate();
  const vendors = useOps((s) => s.vendors);
  const r = c.rfq;
  const cl = closing(t, r.dueDate, r.status === "OPEN");
  return (
    <article className={`ps-card ps-card-${c.col}`} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="ps-card-top">
        <span className="k-ref">{r.ref}</span>
        <span className={`ps-card-when k-text-${cl.tone === "brand" ? "muted" : cl.tone}`}>{cl.text}</span>
      </div>
      <strong className="ps-card-title">{x(r.title)}</strong>
      <span className="ps-chips">
        {r.invitations.map((inv) => (
          <AnswerChip key={inv.vendorId} vendor={vendors.find((v) => v.id === inv.vendorId)} inv={inv} compact />
        ))}
      </span>
      <small className="muted">
        {c.quotes ? (c.low === c.high ? t("1 quote · {a} AZN", { a: fmtMoneyShort(c.low!) }) : t("{n} quotes · {a} to {b} AZN", { n: c.quotes, a: fmtMoneyShort(c.low!), b: fmtMoneyShort(c.high!) })) : t("No quotes yet")}
      </small>
      {c.col === "ready" ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.compare(r.id))}>
          <CheckCheck size={13} />
          {t("Compare")}
        </button>
      ) : c.col === "waiting" && c.pending.length ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRemind}>
          <BellRing size={13} />
          {c.pending.length === 1 ? t("Remind {vendor}", { vendor: vendors.find((v) => v.id === c.pending[0]!.vendorId)?.name.split(" ")[0] ?? "" }) : t("Remind {n} vendors", { n: c.pending.length })}
        </button>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.rfq(r.id))}>
          {t("Open")}
        </button>
      )}
    </article>
  );
}

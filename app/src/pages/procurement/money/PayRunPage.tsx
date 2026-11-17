import { useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Ban, CalendarClock, CheckCircle2, Download, FileSpreadsheet, GripVertical, History, Landmark, PauseCircle, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { ApprovalPath, Badge, Empty, FlowRail, Money, PageHero, Panel, StatTiles, toast, useL, type PathStep } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { paymentGate, R, type Tone } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort } from "../../../lib/format";
import { downloadCsv, INV_STATUS, MONEY } from "../../../ops/ext/money-p2";
import type { Payment, PayRun } from "../../../ops/types";
import { DueTag, vendorName } from "./parts";

type Bucket = "now" | "due" | "hold";
const BUCKETS: { key: Bucket; title: string; sub: string; tone: Tone; icon: LucideIcon }[] = [
  { key: "now", title: "Pay now", sub: "Cleared and due within 7 days", tone: "brand", icon: Zap },
  { key: "due", title: "Pay on due date", sub: "Pay later, on the day it falls due", tone: "neutral", icon: CalendarClock },
  { key: "hold", title: "Hold", sub: "In dispute or waiting on the supplier", tone: "bad", icon: PauseCircle },
];

/** Cash figures used for the pay run (the same the store writes on a new run). */
const CASH_TODAY = 386_000;
const BUFFER = 120_000;

const RUN_PATH: { key: PayRun["status"]; label: string }[] = [
  { key: "PROPOSED", label: "Proposed" },
  { key: "APPROVED", label: "Approved" },
  { key: "EXPORTED", label: "Bank file exported" },
];

const fakeIban = (vendorId: string) => {
  const n = Number(vendorId.replace(/\D/g, "")) || 1;
  return `AZ${String(10 + ((n * 37) % 89)).padStart(2, "0")}NABZ${String(1_370_100_000_000 + n * 7_919_311).padStart(20, "0")}`;
};

/** Pay run: cash today against the buffer, three buckets (pay now / on due date / hold), the run itself and past runs. */
export function PayRunPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [moved, setMoved] = useState<Record<string, Bucket>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Bucket | null>(null);

  const active = s.payRuns.find((r) => r.status === "PROPOSED" || r.status === "APPROVED") ?? null;
  const past = s.payRuns.filter((r) => r !== active);
  const inRun = new Set(active?.paymentIds ?? []);

  const open = s.payments.filter((p) => (p.status === "READY" || p.status === "SCHEDULED" || p.status === "ON_HOLD") && !inRun.has(p.id)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const auto = (p: Payment): Bucket => (p.status === "ON_HOLD" ? "hold" : p.status === "READY" && diffDays(TODAY, p.dueDate) <= 7 ? "now" : "due");
  const bucketOf = (p: Payment): Bucket => {
    const b = moved[p.id] ?? auto(p);
    return b === "now" && p.status !== "READY" ? auto(p) : b;
  };
  const by: Record<Bucket, Payment[]> = { now: [], due: [], hold: [] };
  for (const p of open) by[bucketOf(p)].push(p);
  const sum = (ps: Payment[]) => ps.reduce((a, p) => a + p.amount, 0);
  const nowTotal = sum(by.now);
  const room = CASH_TODAY - BUFFER;
  const left = room - nowTotal;
  const dueWeek = s.payments.filter((p) => p.status !== "PAID" && p.dueDate <= addDays(TODAY, 7));
  const runTotal = active ? sum(s.payments.filter((p) => active.paymentIds.includes(p.id))) : 0;

  const invOf = (p: Payment) => s.invoices.find((i) => i.paymentId === p.id && i.status !== "REJECTED") ?? null;

  const move = (p: Payment, to: Bucket) => {
    if (bucketOf(p) === to) return;
    if (to === "now" && p.status !== "READY") {
      toast(t("{ref} is not cleared to pay yet: {why}", { ref: p.ref, why: x(paymentGate(s, p).label).toLowerCase() }), "warn");
      return;
    }
    setMoved((mv) => ({ ...mv, [p.id]: to }));
    toast(t("{ref} moved to {bucket}", { ref: p.ref, bucket: t(BUCKETS.find((b) => b.key === to)!.title) }), "info");
  };
  const onDrop = (e: DragEvent, to: Bucket) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    const p = open.find((y) => y.id === id);
    if (p) move(p, to);
    setDragId(null);
    setOver(null);
  };

  const plan = () => {
    if (!by.now.length) return;
    const id = s.createPayRun(by.now.map((p) => p.id));
    setMoved({});
    toast(t("Pay run {id} proposed: {n} payments, {a} AZN", { id, n: by.now.length, a: fmtMoney(nowTotal) }), "brand");
  };
  const approve = (run: PayRun) => {
    s.setPayRunStatus(run.id, "APPROVED");
    toast(t("{ref} approved. Export the bank file to pay.", { ref: run.ref }), "ok");
  };
  const cancel = (run: PayRun) => {
    s.setPayRunStatus(run.id, "CANCELLED");
    toast(t("{ref} cancelled. The payments are back in the buckets.", { ref: run.ref }), "warn");
  };
  const exportBank = (run: PayRun) => {
    const pays = s.payments.filter((p) => run.paymentIds.includes(p.id));
    const head = ["Payment", "Beneficiary", "TRN", "IBAN", "Amount", "Currency", "Value date", "Reference"];
    const rows = pays.map((p) => {
      const v = s.vendors.find((y) => y.id === p.vendorId);
      const inv = invOf(p);
      return [p.ref, v?.name ?? p.vendorId, v?.trn ?? "", fakeIban(p.vendorId), Math.round(p.amount * 100) / 100, "AZN", TODAY, `${run.ref} ${p.ref} ${p.poId}${inv ? ` ${inv.ref}` : ""}`];
    });
    downloadCsv(`${run.ref}-bank-file.csv`, [head, ...rows]);
    s.setPayRunStatus(run.id, "EXPORTED");
    toast(t("Bank file for {ref} downloaded. {n} payments marked paid.", { ref: run.ref, n: pays.length }), "ok");
  };

  const runSteps = (run: PayRun): PathStep[] =>
    RUN_PATH.map((st, i) => {
      const idx = RUN_PATH.findIndex((y) => y.key === run.status);
      return { label: t(st.label), state: run.status === "CANCELLED" ? (i === 0 ? "rejected" : "todo") : i < idx || (i === idx && i === RUN_PATH.length - 1) ? "done" : i === idx ? "current" : "todo", at: i === 0 ? d(run.date) : undefined, who: i === 0 ? run.by : undefined };
    });

  const W = (v: number) => `${Math.max(0, (v / CASH_TODAY) * 100)}%`;

  return (
    <div className="k-page pmn-page">
      <PageHero
        eyebrow={t("Procurement · Pay run")}
        title={t("Pay run")}
        subtitle={t("Choose what to pay today against the cash in the bank, keep the buffer, and export one bank file.")}
        flow={["Pick", "Propose", "Approve", "Bank file", "Paid"]}
        art="pay"
        actions={
          <Link to={MONEY.invoices} className="btn btn-ghost">
            {t("Supplier invoices")}
            <ArrowRight size={14} />
          </Link>
        }
      />
      <FlowRail current="pay" />

      <StatTiles
        items={[
          { label: t("Cash today"), value: <Money value={CASH_TODAY} short />, sub: t("Kapital Bank, main account"), icon: <Landmark size={14} /> },
          { label: t("Buffer to keep"), value: <Money value={BUFFER} short />, sub: t("never paid out"), tone: "muted", icon: <ShieldCheck size={14} /> },
          { label: t("Room to pay"), value: <Money value={left} short />, sub: nowTotal ? t("after {a} AZN in Pay now", { a: fmtMoneyShort(nowTotal) }) : t("nothing picked yet"), tone: left < 0 ? "bad" : "ok" },
          { label: t("Due this week"), value: <Money value={sum(dueWeek)} short />, sub: t("{n} payments, {m} overdue", { n: dueWeek.length, m: dueWeek.filter((p) => p.dueDate < TODAY).length }), tone: dueWeek.some((p) => p.dueDate < TODAY) ? "warn" : undefined },
        ]}
      />

      <section className="pmn-cash" aria-label={t("Cash today")}>
        <header>
          <h2>{t("Where today's cash goes")}</h2>
          <p>{left < 0 ? t("Pay now is {a} AZN over the room. Move something to its due date.", { a: fmtMoney(-left) }) : t("{a} AZN stays free after this run and the buffer.", { a: fmtMoney(left) })}</p>
        </header>
        <div className="pmn-cash-bar">
          <i className="now k-grow-x" style={{ width: W(Math.min(nowTotal, room)) }} title={t("Pay now")} />
          {left < 0 ? <i className="over k-grow-x" style={{ width: W(Math.min(-left, BUFFER)) }} title={t("Over the room")} /> : <i className="free k-grow-x" style={{ width: W(left) }} title={t("Room left")} />}
          <i className="buffer" style={{ width: W(left < 0 ? Math.max(0, BUFFER + left) : BUFFER) }} title={t("Buffer to keep")} />
          <span className="pmn-cash-line" style={{ left: W(room) }}>
            <small>{t("buffer")}</small>
          </span>
        </div>
        <ul className="pmn-cash-key">
          <li className="now">
            <i /> {t("Pay now")} <b className="num-inline">{fmtMoneyShort(nowTotal)}</b>
          </li>
          <li className={left < 0 ? "over" : "free"}>
            <i /> {left < 0 ? t("Over the room") : t("Room left")} <b className="num-inline">{fmtMoneyShort(Math.abs(left))}</b>
          </li>
          <li className="buffer">
            <i /> {t("Buffer to keep")} <b className="num-inline">{fmtMoneyShort(BUFFER)}</b>
          </li>
        </ul>
      </section>

      {active ? (
        <section className={`pmn-run k-rise s-${active.status.toLowerCase()}`} aria-label={t("This pay run")}>
          <header className="pmn-run-head">
            <div>
              <span className="k-ref">{active.ref}</span>
              <h2>{active.status === "PROPOSED" ? t("Proposed, waiting for approval") : t("Approved, ready for the bank")}</h2>
              <p className="muted small">{t("{n} payments · {a} AZN", { n: active.paymentIds.length, a: fmtMoney(runTotal) })}</p>
            </div>
            <div className="k-row">
              {active.status === "PROPOSED" ? (
                <button type="button" className="btn btn-primary" onClick={() => approve(active)}>
                  <CheckCircle2 size={15} />
                  {t("Approve run")}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => exportBank(active)}>
                  <Download size={15} />
                  {t("Export bank file")}
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => cancel(active)}>
                <Ban size={14} />
                {t("Cancel run")}
              </button>
            </div>
          </header>
          <ApprovalPath steps={runSteps(active)} />
          <ul className="pmn-run-list">
            {s.payments
              .filter((p) => active.paymentIds.includes(p.id))
              .map((p) => (
                <li key={p.id}>
                  <span className="k-mono">{p.ref}</span>
                  <span className="truncate">{vendorName(s, p.vendorId)}</span>
                  <Money value={p.amount} />
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="pmn-buckets" aria-label={t("Buckets")}>
        {BUCKETS.map((b) => (
          <div
            key={b.key}
            className={`pmn-bucket k-tone-${b.tone}${over === b.key ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(b.key);
            }}
            onDragLeave={() => setOver((o) => (o === b.key ? null : o))}
            onDrop={(e) => onDrop(e, b.key)}
          >
            <header>
              <span className="pmn-lane-icon">
                <b.icon size={14} />
              </span>
              <h3>
                {t(b.title)}
                <small>{t(b.sub)}</small>
              </h3>
              <b className="num-inline">{by[b.key].length}</b>
            </header>
            {by[b.key].length ? (
              <ul>
                {by[b.key].map((p) => {
                  const inv = invOf(p);
                  const gate = paymentGate(s, p);
                  return (
                    <li
                      key={p.id}
                      className={`pmn-pay${dragId === p.id ? " dragging" : ""}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", p.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(p.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                    >
                      <GripVertical size={14} className="pmn-grip" aria-hidden="true" />
                      <div className="pmn-pay-main">
                        <span className="pmn-card-top">
                          <strong className="truncate">{vendorName(s, p.vendorId)}</strong>
                          <Money value={p.amount} short />
                        </span>
                        <small>
                          <Link to={R.payment(p.id)} className="k-mono">
                            {p.ref}
                          </Link>{" "}
                          · {p.poId}
                          {inv ? (
                            <>
                              {" "}
                              · <Link to={MONEY.invoice(inv.id)}>{inv.ref}</Link>
                            </>
                          ) : null}
                        </small>
                        <span className="pmn-pay-tags">
                          <DueTag due={p.dueDate} />
                          {p.status !== "READY" ? <Badge tone={gate.tone}>{x(gate.label)}</Badge> : null}
                          {inv && inv.status !== "BOOKED" && inv.status !== "PAID" ? <Badge tone={INV_STATUS[inv.status].tone}>{t("Bill: {s}", { s: x(INV_STATUS[inv.status].label) })}</Badge> : null}
                        </span>
                        {p.holdReason && p.status === "ON_HOLD" ? <small className="k-text-bad">{p.holdReason}</small> : null}
                      </div>
                      <span className="pmn-pay-move" role="group" aria-label={t("Move to")}>
                        {BUCKETS.filter((o) => o.key !== b.key).map((o) => (
                          <button key={o.key} type="button" className="icon-btn" title={t("Move to {bucket}", { bucket: t(o.title) })} aria-label={t("Move to {bucket}", { bucket: t(o.title) })} onClick={() => move(p, o.key)} disabled={o.key === "now" && p.status !== "READY"}>
                            <o.icon size={14} />
                          </button>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="pmn-lane-empty">{b.key === "now" ? t("Drag a cleared payment here.") : b.key === "hold" ? t("Nothing held.") : t("Nothing waiting.")}</p>
            )}
            <footer className="pmn-lane-foot">
              <span>{t("Total")}</span>
              <b className="num-inline">{fmtMoney(sum(by[b.key]))} AZN</b>
            </footer>
          </div>
        ))}
      </section>

      <div className="pmn-plan">
        <p>
          {active
            ? t("Finish {ref} before planning another run.", { ref: active.ref })
            : by.now.length
              ? left < 0
                ? t("Pay now is over the room to pay. Move something out first.")
                : t("{n} payments, {a} AZN, go into the run.", { n: by.now.length, a: fmtMoney(nowTotal) })
              : t("Nothing in Pay now. Book a matched bill to clear its payment.")}
        </p>
        <button type="button" className="btn btn-primary btn-lg" onClick={plan} disabled={!!active || !by.now.length || left < 0}>
          <FileSpreadsheet size={16} />
          {t("Plan pay run")}
        </button>
      </div>

      <Panel title={t("Past runs")} icon={<History size={15} />} pad={false}>
        {past.length ? (
          <ul className="pmn-past">
            {past.map((r) => {
              const pays = s.payments.filter((p) => r.paymentIds.includes(p.id));
              return (
                <li key={r.id}>
                  <span className="pmn-past-ref">
                    <b className="k-mono">{r.ref}</b>
                    <small>
                      {d(r.date)} · {r.by}
                    </small>
                  </span>
                  <span className="pmn-past-pays">
                    {pays.map((p) => (
                      <Link key={p.id} to={R.payment(p.id)} className="k-mono">
                        {p.ref}
                      </Link>
                    ))}
                    {!pays.length ? <span className="muted">—</span> : null}
                  </span>
                  <Money value={sum(pays)} />
                  <Badge tone={r.status === "EXPORTED" ? "ok" : "muted"}>{r.status === "EXPORTED" ? t("Exported") : t("Cancelled")}</Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title={t("No runs yet")} />
        )}
      </Panel>

      {!open.length && !active ? (
        <Empty icon={<CheckCircle2 size={20} />} title={t("Nothing to pay")} action={<button type="button" className="btn btn-ghost" onClick={() => navigate(MONEY.invoices)}>{t("Supplier invoices")}</button>}>
          {t("Every payment is paid.")}
        </Empty>
      ) : null}
    </div>
  );
}

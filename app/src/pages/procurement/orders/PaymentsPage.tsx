import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, Wallet } from "lucide-react";
import { Avatar, Badge, FlowRail, Money, PageHero, Register, SearchBox, StagePath, StatusBadge, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, toDate, TODAY } from "../../../ops/dates";
import { paymentGate, PATHS, R } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { Payment } from "../../../ops/types";
import { MarkPaidDialog } from "./MarkPaidDialog";
import { short, vendorName, VisualHead } from "./shared";
import { INV_STATUS, MONEY } from "../../../ops/ext/money-p2";

const weekStart = (iso: string) => addDays(iso, -((toDate(iso).getUTCDay() + 6) % 7));

/** The payment run: three lanes (pay now, stuck, coming up), the cash outlook by week and the register. */
export function PaymentsPage() {
  const { t, x, d, rel } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [stage, setStage] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [paying, setPaying] = useState<Payment | null>(null);

  const lanes = useMemo(() => {
    const unpaid = s.payments.filter((p) => p.status !== "PAID");
    const now = unpaid.filter((p) => p.status === "READY").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const stuck = unpaid.filter((p) => p.status === "ON_HOLD" || (p.status === "SCHEDULED" && p.dueDate < TODAY)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const later = unpaid.filter((p) => p.status === "SCHEDULED" && p.dueDate >= TODAY).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { now, stuck, later };
  }, [s.payments]);

  const outlook = useMemo(() => {
    const first = addDays(weekStart(TODAY), -28);
    const thisWeek = weekStart(TODAY);
    const weeks = Array.from({ length: 11 }, (_, i) => ({ start: addDays(first, i * 7), paid: 0, now: 0, later: 0 }));
    const idx = (iso: string) => Math.floor(diffDays(first, iso) / 7);
    for (const p of s.payments) {
      if (p.status === "PAID" && p.paidAt) {
        const i = idx(p.paidAt);
        if (weeks[i]) weeks[i].paid += p.amount;
        continue;
      }
      const due = p.dueDate < thisWeek ? thisWeek : p.dueDate;
      const i = idx(due);
      const w = weeks[Math.min(weeks.length - 1, Math.max(0, i))]!;
      if (weekStart(due) === thisWeek) w.now += p.amount;
      else w.later += p.amount;
    }
    const max = Math.max(1, ...weeks.map((w) => w.paid + w.now + w.later));
    const totals = {
      paid: s.payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0),
      now: s.payments.filter((p) => p.status !== "PAID" && p.dueDate < addDays(thisWeek, 7)).reduce((a, p) => a + p.amount, 0),
      later: s.payments.filter((p) => p.status !== "PAID" && p.dueDate >= addDays(thisWeek, 7)).reduce((a, p) => a + p.amount, 0),
    };
    return { weeks, max, thisWeek, totals };
  }, [s.payments]);

  const release = (p: Payment) => {
    s.releasePayment(p.id);
    const after = useOps.getState().payments.find((x2) => x2.id === p.id);
    toast(after?.status === "READY" ? t("{ref} released and clear to pay", { ref: p.ref }) : t("{ref} released. It waits for the goods.", { ref: p.ref }), "brand");
  };

  const laneDefs: { key: string; title: string; hint: string; tone: "brand" | "bad" | "neutral"; icon: ReactNode; items: Payment[]; action: (p: Payment) => ReactNode }[] = [
    {
      key: "now",
      title: t("Pay now"),
      hint: t("clear to pay"),
      tone: "brand",
      icon: <Wallet size={14} />,
      items: lanes.now,
      action: (p) => (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPaying(p)}>
          {t("Mark paid")}
        </button>
      ),
    },
    {
      key: "stuck",
      title: t("Stuck"),
      hint: t("someone has to act"),
      tone: "bad",
      icon: <AlertTriangle size={14} />,
      items: lanes.stuck,
      action: (p) =>
        p.status === "ON_HOLD" ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => release(p)}>
            {t("Release")}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.payment(p.id))}>
            {t("Open")}
          </button>
        ),
    },
    {
      key: "later",
      title: t("Coming up"),
      hint: t("waiting for goods"),
      tone: "neutral",
      icon: <CalendarClock size={14} />,
      items: lanes.later,
      action: (p) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.payment(p.id))}>
          {t("Open")}
        </button>
      ),
    },
  ];

  const counts = useMemo(() => s.payments.reduce<Record<string, number>>((a, p) => ((a[p.status] = (a[p.status] ?? 0) + 1), a), {}), [s.payments]);
  const filtered = useMemo(() => s.payments.filter((p) => !stage || p.status === stage), [s.payments, stage]);
  const rows = useSearch(filtered, q, (p) => [p.ref, p.poId, vendorName(s, p.vendorId), p.bankRef]);

  const billOf = (paymentId: string) => s.invoices.find((i) => i.paymentId === paymentId && i.status !== "REJECTED") ?? null;
  const columns: Column<Payment>[] = [
    {
      key: "to",
      header: t("Pay to"),
      sort: (p) => vendorName(s, p.vendorId),
      render: (p) => (
        <span className="k-row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <Avatar name={vendorName(s, p.vendorId)} size={26} />
          <span className="k-cell-title">
            <strong className="truncate">{vendorName(s, p.vendorId)}</strong>
            <small>
              {p.ref} · {t(p.kind === "ADVANCE" ? "Advance" : p.kind === "RETENTION" ? "Retention" : "On delivery")}
            </small>
          </span>
        </span>
      ),
    },
    { key: "po", header: t("Order"), sort: (p) => p.poId, hideBelow: 900, render: (p) => <Link to={R.order(p.poId)} className="k-mono" onClick={(e) => e.stopPropagation()}>{p.poId}</Link> },
    {
      key: "bill",
      header: t("Bill"),
      hideBelow: 700,
      render: (p) => {
        const inv = billOf(p.id);
        return inv ? (
          <span className="pmn-billcell">
            <Link to={MONEY.invoice(inv.id)} className="k-mono" onClick={(e) => e.stopPropagation()}>
              {inv.ref}
            </Link>
            <Badge tone={INV_STATUS[inv.status].tone}>{x(INV_STATUS[inv.status].label)}</Badge>
          </span>
        ) : (
          <span className="muted small">{t("No bill yet")}</span>
        );
      },
    },
    { key: "amt", header: t("Amount"), align: "right", sort: (p) => p.amount, render: (p) => <Money value={p.amount} /> },
    {
      key: "due",
      header: t("Due"),
      sort: (p) => p.dueDate,
      render: (p) => (
        <span className={`po-when${p.status !== "PAID" && p.dueDate < TODAY ? " late" : ""}`}>
          <b>{d(p.dueDate)}</b>
          <small>{p.status === "PAID" ? t("paid {d}", { d: d(p.paidAt, false) }) : rel(p.dueDate)}</small>
        </span>
      ),
    },
    {
      key: "gate",
      header: t("Gate"),
      hideBelow: 1100,
      render: (p) => {
        const g = paymentGate(s, p);
        return <Badge tone={g.tone}>{x(g.label)}</Badge>;
      },
    },
    { key: "stage", header: t("Stage"), sort: (p) => p.status, render: (p) => <StatusBadge kind="payment" status={p.status} /> },
  ];

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Payments")}
        title={t("Payment run")}
        subtitle={t("A payment becomes clear to pay once the goods are in. Hold anything in dispute; release it when settled.")}
        flow={["Scheduled", "Goods in", "Clear to pay", "Paid"]}
        art="pay"
      />
      <FlowRail current="pay" />

      <section className="po-visual" aria-label={t("This payment run")}>
        <VisualHead
          title={t("This payment run")}
          sentence={t("{a} clear to pay · {b} stuck · {c} coming up", { a: short(lanes.now.reduce((a, p) => a + p.amount, 0)), b: short(lanes.stuck.reduce((a, p) => a + p.amount, 0)), c: short(lanes.later.reduce((a, p) => a + p.amount, 0)) })}
        />
        <div className="po-paylanes">
          {laneDefs.map((l) => (
            <div key={l.key} className={`po-lane k-tone-${l.tone}`}>
              <header>
                <span className="po-lane-icon">{l.icon}</span>
                <h3>
                  {l.title} <small>{l.hint}</small>
                </h3>
                <b className="num-inline">{l.items.length}</b>
              </header>
              {l.items.length ? (
                <ul>
                  {l.items.map((p, i) => {
                    const g = paymentGate(s, p);
                    const overdue = p.dueDate < TODAY;
                    return (
                      <li key={p.id} className="po-card k-rise" style={{ animationDelay: `${i * 50}ms` }}>
                        <Link to={R.payment(p.id)} className="po-card-main">
                          <span className="po-card-top">
                            <span className="k-ref">{p.ref}</span>
                            <Money value={p.amount} short />
                          </span>
                          <strong className="truncate">{vendorName(s, p.vendorId)}</strong>
                          <small>
                            {p.status === "ON_HOLD" && p.holdReason ? p.holdReason : x(g.label)} · <span className={overdue ? "k-text-bad" : undefined}>{overdue ? t("{n} days overdue", { n: diffDays(p.dueDate, TODAY) }) : t("due {when}", { when: rel(p.dueDate) })}</span>
                          </small>
                        </Link>
                        {l.action(p)}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="po-lane-empty">{t("None")}</p>
              )}
            </div>
          ))}
        </div>

        <div className="po-outlook">
          <div className="po-outlook-head">
            <h3>{t("Cash outlook")}</h3>
            <span>
              <i className="po-sw paid" /> {t("Paid")} <b className="num-inline">{fmtMoneyShort(outlook.totals.paid)}</b>
            </span>
            <span>
              <i className="po-sw violet" /> {t("Due this week")} <b className="num-inline">{fmtMoneyShort(outlook.totals.now)}</b>
            </span>
            <span>
              <i className="po-sw later" /> {t("Due later")} <b className="num-inline">{fmtMoneyShort(outlook.totals.later)}</b>
            </span>
          </div>
          <div className="po-weeks">
            {outlook.weeks.map((w, i) => {
              const total = w.paid + w.now + w.later;
              const cur = w.start === outlook.thisWeek;
              return (
                <div key={w.start} className={`po-week${cur ? " cur" : ""}`} title={`${d(w.start, false)} · ${short(total)}`}>
                  <span className="po-week-stack" style={{ height: `${(total / outlook.max) * 100}%`, animationDelay: `${i * 40}ms` }}>
                    {w.later ? <i className="later" style={{ flexGrow: w.later }} /> : null}
                    {w.now ? <i className="now" style={{ flexGrow: w.now }} /> : null}
                    {w.paid ? <i className="paid" style={{ flexGrow: w.paid }} /> : null}
                  </span>
                  <small>{cur ? t("This week") : d(w.start, false)}</small>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <StagePath kind="payment" path={PATHS.payment} counts={counts} value={stage} onChange={setStage} extras={["ON_HOLD"]} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        empty={s.payments.length ? t("Nothing matches these filters.") : t("No payments yet. A payment is scheduled when a purchase order is issued.")}
        onRowClick={(p) => navigate(R.payment(p.id))}
        initialSort={{ key: "due", dir: "asc" }}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search payments, vendors, references" />
          </Toolbar>
        }
      />

      <MarkPaidDialog payment={paying} onClose={() => setPaying(null)} />
    </div>
  );
}

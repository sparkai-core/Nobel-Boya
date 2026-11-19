import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleCheck, Hourglass, PackageCheck, Plus, Truck, Wallet } from "lucide-react";
import { Avatar, Badge, FilterChips, FlowRail, Money, PageHero, Register, SearchBox, StagePath, StatusBadge, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { PATHS, poLate, poTotal, R, to } from "../../../ops/select";
import type { Payment, PurchaseOrder } from "../../../ops/types";
import { orderShares, short, TwoBars, vendorName, VisualHead } from "./shared";

type GroupKey = "late" | "gate" | "pay" | "ack";
type Card = { po: PurchaseOrder; fact: string; action: { label: string; onClick: () => void; primary?: boolean }; pay?: Payment };

/** Purchase orders: a board of what needs a hand now (late, at the gate, due for payment, unaccepted), then the register. */
export function OrdersPage() {
  const { t, x, d, rel, stamp } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [stage, setStage] = useState<string | null>(null);
  const [flag, setFlag] = useState<"late" | "ack" | null>(null);
  const [q, setQ] = useState("");

  const receive = (po: PurchaseOrder) => {
    const grnId = s.startReceipt(po.id);
    toast(t("{grn} opened for {po}. Count what arrived.", { grn: grnId, po: po.ref }), "brand");
    navigate(R.receipt(grnId));
  };

  const board = useMemo(() => {
    const open = s.pos.filter((p) => p.status === "ISSUED" || p.status === "PART_RECEIVED");
    const used = new Set<string>();
    const take = (list: PurchaseOrder[]) => list.filter((p) => !used.has(p.id) && (used.add(p.id), true));
    const late = take(open.filter(poLate)).sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
    const gate = take(open.filter((p) => p.dispatchedAt));
    const ack = take(open.filter((p) => p.vendorAck === "PENDING"));
    const onTrack = take(open);
    const unpaid = s.payments.filter((p) => p.status !== "PAID");
    const payDue = s.pos
      .filter((p) => (p.status === "CLOSED" || orderShares(s, p).goods >= 0.999) && p.status !== "CANCELLED")
      .map((po) => ({ po, pay: unpaid.filter((x2) => x2.poId === po.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] }))
      .filter((r): r is { po: PurchaseOrder; pay: Payment } => !!r.pay);
    return { late, gate, ack, onTrack, payDue, open };
  }, [s]);

  const groups: { key: GroupKey; title: string; tone: "bad" | "brand" | "ok" | "warn"; icon: ReactNode; cards: Card[] }[] = [
    {
      key: "late",
      title: t("Late deliveries"),
      tone: "bad",
      icon: <Hourglass size={14} />,
      cards: board.late.map((po) => {
        const sh = orderShares(s, po);
        return {
          po,
          fact: sh.goods > 0 ? t("{n} days late · {p}% of the goods are in", { n: diffDays(po.expectedAt, TODAY), p: Math.round(sh.goods * 100) }) : t("{n} days late · nothing has arrived", { n: diffDays(po.expectedAt, TODAY) }),
          action: { label: t("Receive"), onClick: () => receive(po), primary: true },
        };
      }),
    },
    {
      key: "gate",
      title: t("At the gate / on the way"),
      tone: "brand",
      icon: <Truck size={14} />,
      cards: board.gate.map((po) => ({
        po,
        fact: t("Dispatched {when}{note}", { when: stamp(po.dispatchedAt), note: po.dispatchNote ? ` · ${po.dispatchNote}` : "" }),
        action: { label: t("Receive"), onClick: () => receive(po), primary: true },
      })),
    },
    {
      key: "pay",
      title: t("Goods in, payment due"),
      tone: "ok",
      icon: <Wallet size={14} />,
      cards: board.payDue.map(({ po, pay }) => ({
        po,
        pay,
        fact: pay.status === "ON_HOLD" ? t("All goods in · {ref} on hold", { ref: pay.ref }) : t("All goods in · {amt} due {when}", { amt: short(pay.amount), when: rel(pay.dueDate) }),
        action: { label: pay.status === "READY" ? t("Pay") : t("Open payment"), onClick: () => navigate(R.payment(pay.id)), primary: pay.status === "READY" },
      })),
    },
    {
      key: "ack",
      title: t("Waiting for the vendor to accept"),
      tone: "warn",
      icon: <PackageCheck size={14} />,
      cards: board.ack.map((po) => ({
        po,
        fact: t("Issued {when}, not yet accepted in the vendor portal", { when: rel(po.issuedAt) }),
        action: { label: t("Open"), onClick: () => navigate(R.order(po.id)) },
      })),
    },
  ];

  const lateValue = board.late.reduce((a, p) => a + poTotal(p) * (1 - orderShares(s, p).goods), 0);
  const dueValue = board.payDue.reduce((a, r) => a + r.pay.amount, 0);
  const finding = board.open.length
    ? [
        board.late.length ? t("{n} late with {v} of goods still out", { n: board.late.length, v: short(lateValue) }) : t("Nothing late"),
        board.gate.length ? t("{n} on the way", { n: board.gate.length }) : null,
        board.payDue.length ? t("{v} owed on delivered goods", { v: short(dueValue) }) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : t("No open orders.");

  const counts = useMemo(() => s.pos.reduce<Record<string, number>>((a, p) => ((a[p.status] = (a[p.status] ?? 0) + 1), a), {}), [s.pos]);
  const filtered = useMemo(() => s.pos.filter((p) => (!stage || p.status === stage) && (!flag || (flag === "late" ? poLate(p) : p.vendorAck === "PENDING" && p.status !== "CANCELLED" && p.status !== "CLOSED"))), [s.pos, stage, flag]);
  const rows = useSearch(filtered, q, (p) => [p.ref, vendorName(s, p.vendorId), ...p.lines.map((l) => l.description)]);

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "order",
      header: t("Order"),
      sort: (p) => p.ref,
      render: (p) => (
        <div className="k-cell-title">
          <span className="k-row" style={{ gap: 6 }}>
            <span className="k-ref">{p.ref}</span>
            {p.vendorAck === "PENDING" && p.status === "ISSUED" ? <Badge tone="warn">{t("Not accepted")}</Badge> : null}
          </span>
          <strong className="truncate">{x(p.lines[0]?.description)}{p.lines.length > 1 ? ` +${p.lines.length - 1}` : ""}</strong>
          <small>{t("Issued {d}", { d: d(p.issuedAt) })}</small>
        </div>
      ),
    },
    { key: "vendor", header: t("Vendor"), sort: (p) => vendorName(s, p.vendorId), hideBelow: 900, render: (p) => <span className="k-row" style={{ gap: 8, flexWrap: "nowrap" }}><Avatar name={vendorName(s, p.vendorId)} size={24} /><span className="truncate">{vendorName(s, p.vendorId)}</span></span> },
    { key: "amount", header: t("Amount"), align: "right", sort: (p) => poTotal(p), render: (p) => <Money value={poTotal(p)} /> },
    {
      key: "delivery",
      header: t("Delivery"),
      sort: (p) => p.expectedAt,
      render: (p) => {
        const late = poLate(p);
        return (
          <span className={`po-when${late ? " late" : ""}`}>
            <b>{d(p.expectedAt)}</b>
            <small>{late ? t("{n} days late", { n: diffDays(p.expectedAt, TODAY) }) : p.status === "CLOSED" ? t("delivered") : p.status === "CANCELLED" ? "—" : rel(p.expectedAt)}</small>
          </span>
        );
      },
    },
    {
      key: "gp",
      header: t("Goods in · paid"),
      hideBelow: 1100,
      sort: (p) => orderShares(s, p).goods,
      render: (p) => {
        const sh = orderShares(s, p);
        return (
          <span className="po-gp">
            <TwoBars goods={sh.goods} paid={sh.paid} labels={[t("Goods in"), t("Paid")]} />
            <small className="num-inline">
              {Math.round(sh.goods * 100)}% · {Math.round(sh.paid * 100)}%
            </small>
          </span>
        );
      },
    },
    { key: "stage", header: t("Stage"), sort: (p) => PATHS.po.indexOf(p.status as (typeof PATHS.po)[number]), render: (p) => <StatusBadge kind="po" status={p.status} /> },
  ];

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Orders")}
        title={t("LPOs & purchase orders")}
        subtitle={t("Every order issued to a vendor: what has arrived, what is late and what is owed.")}
        flow={["Issued", "Vendor accepts", "Dispatched", "Received", "Paid"]}
        art="order"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate(to("procurement/orders/new"))}>
            <Plus size={15} />
            {t("New purchase order")}
          </button>
        }
      />
      <FlowRail current="order" />

      <section className="po-visual" aria-label={t("Orders that need a hand")}>
        <VisualHead title={t("Orders that need a hand")} sentence={finding} />
        <div className="po-board">
          {groups.map((g) => (
            <div key={g.key} className={`po-lane k-tone-${g.tone}`}>
              <header>
                <span className="po-lane-icon">{g.icon}</span>
                <h3>{g.title}</h3>
                <b className="num-inline">{g.cards.length}</b>
              </header>
              {g.cards.length ? (
                <ul>
                  {g.cards.map((c, i) => (
                    <li key={c.po.id} className="po-card k-rise" style={{ animationDelay: `${i * 50}ms` }}>
                      <Link to={R.order(c.po.id)} className="po-card-main">
                        <span className="po-card-top">
                          <span className="k-ref">{c.po.ref}</span>
                          <Money value={c.pay ? c.pay.amount : poTotal(c.po)} short />
                        </span>
                        <strong className="truncate">{vendorName(s, c.po.vendorId)}</strong>
                        <small>{c.fact}</small>
                      </Link>
                      <button type="button" className={`btn btn-sm ${c.action.primary ? "btn-primary" : "btn-ghost"}`} onClick={c.action.onClick}>
                        {c.action.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="po-lane-empty">{t("None")}</p>
              )}
            </div>
          ))}
        </div>
        <p className="po-ontrack">
          <CircleCheck size={14} />
          <span>{t("On track")}</span>
          {board.onTrack.length ? (
            board.onTrack.map((p) => (
              <Link key={p.id} to={R.order(p.id)} className="po-chip-link">
                {p.ref} · {d(p.expectedAt, false)}
              </Link>
            ))
          ) : (
            <span className="muted">{t("None")}</span>
          )}
        </p>
      </section>

      <StagePath kind="po" path={PATHS.po} counts={counts} value={stage} onChange={setStage} extras={["CANCELLED"]} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(p) => p.id}
        onRowClick={(p) => navigate(R.order(p.id))}
        initialSort={{ key: "order", dir: "desc" }}
        rowClass={(p) => (poLate(p) ? "po-row-late" : undefined)}
        empty={s.pos.length ? t("Nothing matches these filters.") : t("No purchase orders yet. Place one directly, or approve a quote to issue one.")}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search orders, vendors, materials" />
            <FilterChips
              value={flag}
              onChange={setFlag}
              options={[
                { value: "late", label: t("Late"), count: s.pos.filter(poLate).length },
                { value: "ack", label: t("Not accepted"), count: s.pos.filter((p) => p.vendorAck === "PENDING" && (p.status === "ISSUED" || p.status === "PART_RECEIVED")).length },
              ]}
            />
          </Toolbar>
        }
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Download, FileSearch, FileUp, PenLine, Wallet, type LucideIcon } from "lucide-react";
import { Badge, CountUp, FlowRail, Money, PageHero, Register, SearchBox, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import { R, type Tone } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort } from "../../../lib/format";
import { downloadCsv, dueIn, INV_STATUS, invFlags, invTotal, isSettled, MONEY, OWED } from "../../../ops/ext/money-p2";
import type { Invoice } from "../../../ops/types";
import { DueTag, InvBadge, InvStagePath, vendorName } from "./parts";

type LaneKey = "fix" | "sign" | "pay";
const LANES: { key: LaneKey; title: string; sub: string; tone: Tone; icon: LucideIcon }[] = [
  { key: "fix", title: "Fix the match", sub: "Bill, order and delivery disagree", tone: "bad", icon: FileSearch },
  { key: "sign", title: "Waiting for sign-off", sub: "Matched, needs a signature", tone: "warn", icon: PenLine },
  { key: "pay", title: "Ready to pay", sub: "Signed off and booked", tone: "brand", icon: Wallet },
];

const laneOf = (inv: Invoice): LaneKey | null =>
  inv.status === "MISMATCH" || inv.status === "TO_MATCH" || inv.status === "CREDIT_REQUESTED" || (inv.duplicate && !["PAID", "REJECTED"].includes(inv.status)) ? "fix" : inv.status === "SIGN_OFF" ? "sign" : inv.status === "BOOKED" ? "pay" : null;

/** Supplier invoices: what we owe, a three-lane board (fix the match, sign-off, ready to pay) and the bills register. */
export function InvoicesPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [stage, setStage] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [settled, setSettled] = useState(false);

  const owe = useMemo(() => s.invoices.filter((i) => OWED.includes(i.status)).reduce((a, i) => a + invTotal(i), 0), [s.invoices]);
  const lanes = useMemo(() => {
    const out: Record<LaneKey, Invoice[]> = { fix: [], sign: [], pay: [] };
    for (const inv of s.invoices) {
      const k = laneOf(inv);
      if (k) out[k].push(inv);
    }
    for (const k of Object.keys(out) as LaneKey[]) out[k].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return out;
  }, [s.invoices]);
  const laneSum = (k: LaneKey) => lanes[k].filter((i) => !i.duplicate).reduce((a, i) => a + invTotal(i), 0);
  const overdue = s.invoices.filter((i) => OWED.includes(i.status) && dueIn(i) < 0);

  const counts = useMemo(() => s.invoices.reduce<Record<string, number>>((a, i) => ((a[i.status] = (a[i.status] ?? 0) + 1), a), {}), [s.invoices]);
  const filtered = useMemo(() => s.invoices.filter((i) => (stage ? i.status === stage : settled || !isSettled(i))), [s.invoices, stage, settled]);
  const rows = useSearch(filtered, q, (i) => [i.ref, i.id, i.poId, vendorName(s, i.vendorId), ...i.lines.map((l) => l.description)]);

  const act = (inv: Invoice) => {
    if (inv.status === "SIGN_OFF") {
      s.setInvoiceStatus(inv.id, "BOOKED");
      const pay = s.payments.find((p) => p.id === inv.paymentId);
      toast(pay ? t("{ref} signed off and booked. {pay} is released for payment.", { ref: inv.ref, pay: pay.ref }) : t("{ref} signed off and booked.", { ref: inv.ref }), "ok", { label: t("Open"), onClick: () => navigate(MONEY.invoice(inv.id)) });
      return;
    }
    if (inv.status === "TO_MATCH" && !inv.duplicate) {
      s.rematchInvoice(inv.id);
      toast(t("Match run again for {ref}", { ref: inv.ref }), "info");
      return;
    }
    if (inv.status === "BOOKED") {
      navigate(MONEY.payRun);
      return;
    }
    navigate(MONEY.invoice(inv.id));
  };
  const actLabel = (inv: Invoice) =>
    inv.duplicate ? t("Compare with the original") : inv.status === "SIGN_OFF" ? t("Sign off and book") : inv.status === "TO_MATCH" ? t("Run the match") : inv.status === "BOOKED" ? t("Plan the payment") : inv.status === "CREDIT_REQUESTED" ? t("Follow the credit note") : t("Review the difference");

  const exportBills = () => {
    const head = ["Invoice", "Vendor ref", "Vendor", "Order", "Date", "Due", "Status", "Net AZN", "VAT AZN", "Total AZN"];
    const body = s.invoices.map((i) => {
      const total = invTotal(i);
      const net = Math.round((total / (1 + i.vatRate)) * 100) / 100;
      return [i.id, i.ref, vendorName(s, i.vendorId), i.poId, i.date, i.dueDate, INV_STATUS[i.status].label.en, net, Math.round((total - net) * 100) / 100, total];
    });
    downloadCsv(`qobu-supplier-bills-${TODAY}.csv`, [head, ...body]);
    toast(t("{n} bills exported", { n: body.length }));
  };

  const columns: Column<Invoice>[] = [
    {
      key: "bill",
      header: t("Bill"),
      sort: (i) => i.id,
      render: (i) => (
        <div className="k-cell-title">
          <span className="k-row" style={{ gap: 6 }}>
            <span className="k-ref">{i.ref}</span>
            {i.duplicate ? <Badge tone="bad">{t("Duplicate")}</Badge> : null}
          </span>
          <small className="k-mono">{i.id}</small>
        </div>
      ),
    },
    { key: "vendor", header: t("Vendor"), sort: (i) => vendorName(s, i.vendorId), hideBelow: 900, render: (i) => <span className="truncate">{vendorName(s, i.vendorId)}</span> },
    { key: "po", header: t("Order"), sort: (i) => i.poId, render: (i) => <Link to={R.order(i.poId)} className="k-mono" onClick={(e) => e.stopPropagation()}>{i.poId}</Link> },
    { key: "due", header: t("Due"), sort: (i) => i.dueDate, render: (i) => <span className="pmn-when"><b>{d(i.dueDate)}</b><DueTag due={i.dueDate} settled={isSettled(i)} /></span> },
    { key: "where", header: t("Where it is"), sort: (i) => i.status, render: (i) => <InvBadge status={i.status} /> },
    { key: "amt", header: t("Amount"), align: "right", sort: (i) => invTotal(i), render: (i) => <Money value={invTotal(i)} /> },
  ];

  const total = laneSum("fix") + laneSum("sign") + laneSum("pay") || 1;

  return (
    <div className="k-page pmn-page">
      <PageHero
        eyebrow={t("Procurement · Supplier invoices")}
        title={t("Supplier invoices")}
        subtitle={t("Every bill checked three ways against the order and the delivery before it reaches the bank.")}
        flow={["Received", "Match", "Sign-off", "Booked", "Paid"]}
        art="pay"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => navigate(MONEY.inbox)}>
              <FileUp size={15} />
              {t("Enter an invoice")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={exportBills}>
              <Download size={15} />
              {t("Export bills")}
            </button>
          </>
        }
      />
      <FlowRail current="pay" />

      <section className="pmn-owe" aria-label={t("What we owe")}>
        <div className="pmn-owe-copy">
          {owe > 0 ? (
            <h2>
              {t("We owe suppliers")}{" "}
              <span className="pmn-owe-figure">
                <small>AZN</small> <CountUp value={owe} format={(v) => fmtMoney(v)} />
              </span>
            </h2>
          ) : (
            <h2 className="pmn-owe-clear">
              <CheckCircle2 size={20} /> {t("We owe suppliers nothing: every bill is paid or closed.")}
            </h2>
          )}
          <p>{t("A bill is paid only when bill vs order vs delivery agree, the right people have signed, and it is booked.")}</p>
          {overdue.length ? <p className="pmn-owe-late">{t("{n} past their due date: {a} AZN", { n: overdue.length, a: fmtMoneyShort(overdue.reduce((a, i) => a + invTotal(i), 0)) })}</p> : null}
        </div>
        <div className="pmn-owe-bar" aria-hidden="true">
          {LANES.map((l) => (
            <i key={l.key} className={`k-tone-${l.tone} k-grow-x`} style={{ flexGrow: laneSum(l.key) / total, display: laneSum(l.key) ? undefined : "none" }} />
          ))}
        </div>
        <ul className="pmn-owe-key">
          {LANES.map((l) => (
            <li key={l.key} className={`k-tone-${l.tone}`}>
              <i />
              <span>{t(l.title)}</span>
              <b className="num-inline">{fmtMoneyShort(laneSum(l.key))}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="pmn-board" aria-label={t("Bills by what they need")}>
        {LANES.map((l) => (
          <div key={l.key} className={`pmn-lane k-tone-${l.tone}`}>
            <header>
              <span className="pmn-lane-icon">
                <l.icon size={14} />
              </span>
              <h3>
                {t(l.title)}
                <small>{t(l.sub)}</small>
              </h3>
              <b className="num-inline">{lanes[l.key].length}</b>
            </header>
            {lanes[l.key].length ? (
              <ul>
                {lanes[l.key].map((inv, i) => {
                  const f = invFlags(s, inv);
                  return (
                    <li key={inv.id} className="pmn-card" style={{ animationDelay: `${i * 50}ms` }}>
                      <Link to={MONEY.invoice(inv.id)} className="pmn-card-main">
                        <span className="pmn-card-top">
                          <span className="k-ref">{inv.ref}</span>
                          <Money value={invTotal(inv)} short />
                        </span>
                        <strong className="truncate">{vendorName(s, inv.vendorId)}</strong>
                        <small>
                          <span className="k-mono">{inv.poId}</span> · {inv.id} · <DueTag due={inv.dueDate} />
                        </small>
                      </Link>
                      {f.dup || f.noGrn || f.overBilled || inv.status === "CREDIT_REQUESTED" ? (
                        <span className="pmn-card-flags">
                          {f.dup ? <Badge tone="bad">{t("Duplicate")}</Badge> : null}
                          {f.noGrn ? <Badge tone="warn">{t("No GRN")}</Badge> : null}
                          {f.overBilled ? <Badge tone="bad">{t("Over-billed {a}", { a: fmtMoneyShort(f.over) })}</Badge> : null}
                          {inv.status === "CREDIT_REQUESTED" ? <Badge tone="warn">{x(INV_STATUS.CREDIT_REQUESTED.label)}</Badge> : null}
                        </span>
                      ) : null}
                      <button type="button" className={`btn btn-sm ${l.key === "sign" ? "btn-primary" : "btn-ghost"}`} onClick={() => act(inv)}>
                        {actLabel(inv)}
                        <ArrowRight size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="pmn-lane-empty">{!s.invoices.length ? t("No bills yet.") : l.key === "fix" ? t("Every bill matches.") : l.key === "sign" ? t("Nothing waiting for a signature.") : t("Nothing booked and unpaid.")}</p>
            )}
            <footer className="pmn-lane-foot">
              <span>{t("Total")}</span>
              <b className="num-inline">{fmtMoney(laneSum(l.key))} AZN</b>
            </footer>
          </div>
        ))}
      </section>

      <InvStagePath counts={counts} value={stage} onChange={setStage} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(i) => i.id}
        onRowClick={(i) => navigate(MONEY.invoice(i.id))}
        initialSort={{ key: "due", dir: "asc" }}
        rowClass={(i) => (i.status === "MISMATCH" || i.duplicate ? "pmn-row-alert" : undefined)}
        empty={t("No bills match these filters.")}
        toolbar={
          <Toolbar
            end={
              <label className="pmn-toggle">
                <input type="checkbox" checked={settled} onChange={(e) => setSettled(e.target.checked)} />
                <span>{t("Include settled")}</span>
              </label>
            }
          >
            <SearchBox value={q} onChange={setQ} placeholder="Invoice, supplier or PO" />
          </Toolbar>
        }
      />
    </div>
  );
}

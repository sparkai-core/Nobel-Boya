import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, Ban, CheckCheck, CopyX, FileSearch, History, MailQuestion, PenLine, RefreshCw, Scale, Wallet } from "lucide-react";
import { Badge, Breadcrumbs, DetailHeader, Dialog, Empty, Field, Kebab, KeyFigure, LifecycleStrip, Money, NextBar, Panel, StatusBadge, Timeline, toast, Trail, useL, type LifeStep } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { R, poTotal, trailOf, type Tone } from "../../../ops/select";
import { fmtMoney, fmtQty, unitLabel } from "../../../lib/format";
import { acceptCorrectAmount, dueIn, fairAmount, invDates, invFlags, invTotal, matchOf, MONEY, rejectDuplicate, SOURCE_LABEL } from "../../../ops/ext/money-p2";
import { DueTag, InvBadge, InvoicePaper, vendorName } from "./parts";

type Ask = "credit" | "reject" | null;

/** One supplier bill: its road to the bank, bill vs order vs delivery side by side, the line match and the actions. */
export function InvoiceDetailPage() {
  const { id } = useParams();
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [ask, setAsk] = useState<Ask>(null);
  const [note, setNote] = useState("");

  const inv = s.invoices.find((i) => i.id === id);
  if (!inv) {
    return (
      <div className="k-page pmn-page">
        <Breadcrumbs items={[{ label: t("Supplier invoices"), to: MONEY.invoices }, { label: id ?? "" }]} />
        <Empty icon={<FileSearch size={20} />} title={t("This invoice does not exist.")} action={<Link to={MONEY.invoices} className="btn btn-ghost">{t("All supplier invoices")}</Link>} />
      </div>
    );
  }

  const { po, m } = matchOf(s, inv);
  const f = invFlags(s, inv);
  const vendor = s.vendors.find((v) => v.id === inv.vendorId);
  const vName = vendorName(s, inv.vendorId);
  const pay = s.payments.find((p) => p.id === inv.paymentId) ?? null;
  const grns = s.grns.filter((g) => g.poId === inv.poId && g.status !== "DRAFT");
  const total = invTotal(inv);
  const fair = fairAmount(inv, po);
  const dates = invDates(inv, pay?.paidAt ?? null);
  const twin = s.invoices.find((o) => o.id !== inv.id && o.ref === inv.ref && o.vendorId === inv.vendorId && o.status !== "REJECTED") ?? null;
  const original = inv.duplicate ? twin : null;
  const open = inv.status !== "PAID" && inv.status !== "REJECTED";
  const inMatch = inv.status === "TO_MATCH" || inv.status === "MISMATCH" || inv.status === "CREDIT_REQUESTED";

  // ---------------------------------------------------------------- actions
  const after = () => useOps.getState().invoices.find((i) => i.id === inv.id);
  const rematch = () => {
    s.rematchInvoice(inv.id);
    toast(after()?.status === "SIGN_OFF" ? t("Match passed. {ref} is ready for sign-off.", { ref: inv.ref }) : t("Still different. {ref} stays in Fix the match.", { ref: inv.ref }), after()?.status === "SIGN_OFF" ? "ok" : "warn");
  };
  const accept = () => {
    acceptCorrectAmount(inv.id);
    toast(t("{ref} adjusted to {a} AZN and matched again.", { ref: inv.ref, a: fmtMoney(fair) }), after()?.status === "SIGN_OFF" ? "ok" : "warn");
  };
  const sendSignOff = () => {
    s.setInvoiceStatus(inv.id, "SIGN_OFF");
    toast(t("{ref} sent for sign-off", { ref: inv.ref }), "brand");
  };
  const book = () => {
    s.setInvoiceStatus(inv.id, "BOOKED");
    const p = useOps.getState().payments.find((x2) => x2.id === inv.paymentId);
    toast(p?.status === "READY" ? t("Signed off and booked. {pay} is ready to pay.", { pay: p.ref }) : t("Signed off and booked. The payment is released when the rest of the goods arrive."), "ok", { label: t("Pay run"), onClick: () => navigate(MONEY.payRun) });
  };
  const markPaid = () => {
    s.setInvoiceStatus(inv.id, "PAID");
    toast(t("{ref} recorded as paid", { ref: inv.ref }));
  };
  const notDuplicate = () => {
    s.patchItem("invoices", inv.id, { duplicate: false });
    s.rematchInvoice(inv.id);
    toast(t("Marked as a separate bill and matched."), "info");
  };
  const submitAsk = () => {
    if (ask === "credit") {
      s.setInvoiceStatus(inv.id, "CREDIT_REQUESTED", note.trim() || undefined);
      toast(t("Credit note requested from {v}. The payment is on hold until it arrives.", { v: vName }), "warn");
    } else if (ask === "reject") {
      if (inv.duplicate && original) rejectDuplicate(inv.id, original.id);
      else s.setInvoiceStatus(inv.id, "REJECTED", note.trim() || undefined);
      toast(t("{ref} rejected", { ref: inv.ref }), "warn");
    }
    setAsk(null);
    setNote("");
  };
  const openAsk = (k: Exclude<Ask, null>) => {
    setNote(
      k === "credit"
        ? t("Please send a credit note for {a} AZN: the bill is more than what was delivered at the order rate.", { a: fmtMoney(Math.max(0, total - fair)) })
        : inv.duplicate && original
          ? t("Duplicate of {id}", { id: original.id })
          : "",
    );
    setAsk(k);
  };

  // ---------------------------------------------------------------- what to do
  const overLines = m.lines.filter((l) => l.qtyDiff > 1e-6);
  const underLines = m.lines.filter((l) => l.qtyDiff < -1e-6);
  const rateLines = m.lines.filter((l) => l.rateDiff > 0.005 && l.poRate);
  const lineOf = (key: string) => inv.lines.find((l) => l.key === key);
  const advice: { tone: Tone; text: ReactNode } = (() => {
    if (!po) return { tone: "bad", text: t("No order {po} on file. Check the order number with the supplier.", { po: inv.poId }) };
    if (inv.duplicate && original) return { tone: "bad", text: t("Same supplier and invoice number as {id}. Paying both would pay twice. Reject this copy unless the supplier confirms it is a separate bill.", { id: original.id }) };
    if (inv.status === "REJECTED") return { tone: "muted", text: t("Rejected. Nothing will be paid on this bill.") };
    if (inv.status === "PAID") return { tone: "ok", text: t("Paid {date}. Bill, order and delivery were agreed before payment.", { date: d(pay?.paidAt ?? dates.paid) }) };
    if (!m.ok) {
      const parts: string[] = [];
      for (const l of overLines) {
        const ln = lineOf(l.key);
        parts.push(t("Billed {q} {u} more than received on {item}.", { q: fmtQty(l.qtyDiff, ln?.unit ?? ""), u: unitLabel(ln?.unit ?? "", lang), item: x(ln?.description) }));
      }
      for (const l of rateLines) {
        const ln = lineOf(l.key);
        parts.push(t("Rate {p}% above the order on {item}.", { p: (Math.round((l.rateDiff / (l.poRate ?? 1)) * 1000) / 10).toString(), item: x(ln?.description) }));
      }
      if (overLines.length || rateLines.length) {
        if (inv.status === "CREDIT_REQUESTED") return { tone: "warn", text: <>{parts.join(" ")} {t("A credit note has been asked for. When it arrives, accept the correct amount of {a} AZN.", { a: fmtMoney(fair) })}</> };
        return { tone: "bad", text: <>{parts.join(" ")} <b>{t("Pay {a} AZN now or ask for a credit note.", { a: fmtMoney(fair) })}</b></> };
      }
      if (underLines.length) return { tone: "warn", text: t("Billed less than was received. Check with the supplier, or accept the received quantity.") };
    }
    if (f.noGrn) return { tone: "warn", text: t("Nothing has been received on {po} yet. Wait for the delivery before signing off.", { po: inv.poId }) };
    if (inv.status === "SIGN_OFF") return { tone: "brand", text: t("Bill, order and delivery agree. Sign it off and book it so the payment is released.") };
    if (inv.status === "BOOKED") return { tone: "brand", text: pay?.status === "READY" ? t("Booked. {pay} is ready to pay in the next pay run.", { pay: pay.ref }) : t("Booked. The payment is released when the rest of the goods arrive.") };
    return { tone: "ok", text: t("Bill, order and delivery agree. Send it for sign-off.") };
  })();

  // ---------------------------------------------------------------- next bar
  const primary: ReactNode = (() => {
    if (inv.duplicate && original && open)
      return (
        <button type="button" className="btn btn-primary" onClick={() => openAsk("reject")}>
          <CopyX size={15} />
          {t("Reject as duplicate")}
        </button>
      );
    if (inMatch && !m.ok)
      return (
        <>
          <button type="button" className="btn btn-primary" onClick={accept}>
            <Scale size={15} />
            {t("Accept the correct amount")}
          </button>
          {inv.status !== "CREDIT_REQUESTED" ? (
            <button type="button" className="btn btn-ghost" onClick={() => openAsk("credit")}>
              <MailQuestion size={15} />
              {t("Ask for a credit note")}
            </button>
          ) : null}
        </>
      );
    if (inMatch && m.ok)
      return (
        <button type="button" className="btn btn-primary" onClick={sendSignOff}>
          <PenLine size={15} />
          {t("Send for sign-off")}
        </button>
      );
    if (inv.status === "SIGN_OFF")
      return (
        <button type="button" className="btn btn-primary" onClick={book}>
          <CheckCheck size={15} />
          {t("Sign off and book")}
        </button>
      );
    if (inv.status === "BOOKED")
      return (
        <>
          <button type="button" className="btn btn-primary" onClick={() => navigate(MONEY.payRun)}>
            <Wallet size={15} />
            {t("Plan the payment")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={markPaid}>
            {t("Record as paid")}
          </button>
        </>
      );
    if (pay)
      return (
        <Link to={R.payment(pay.id)} className="btn btn-ghost">
          {t("Open payment {ref}", { ref: pay.ref })}
          <ArrowRight size={14} />
        </Link>
      );
    return null;
  })();

  // ---------------------------------------------------------------- lifecycle
  const idx = inv.status === "PAID" ? 5 : inv.status === "BOOKED" ? 4 : inv.status === "SIGN_OFF" ? 2 : 1;
  const rejected = inv.status === "REJECTED";
  const stepState = (i: number): LifeStep["state"] => (rejected ? (i === 0 ? "done" : "skipped") : i < idx ? "done" : i === idx ? (i === 1 && (inv.status === "MISMATCH" || inv.status === "CREDIT_REQUESTED")) || (i === 4 && dueIn(inv) < 0) ? "late" : "current" : "todo");
  const life: LifeStep[] = [
    { label: t("Received"), date: d(dates.received), state: stepState(0), note: x(SOURCE_LABEL[inv.source]) },
    { label: t("Match"), date: dates.matched && idx > 1 ? d(dates.matched) : undefined, state: stepState(1), note: rejected ? t("Rejected") : idx > 1 ? t("3-way match passed") : inv.status === "CREDIT_REQUESTED" ? t("Credit note asked") : !m.ok ? t("Billed ≠ received") : t("To match") },
    { label: t("Sign-off"), date: idx > 2 && dates.booked ? d(dates.booked) : undefined, state: stepState(2), note: inv.status === "SIGN_OFF" ? t("Waiting for a signature") : undefined },
    { label: t("Booked"), date: dates.booked ? d(dates.booked) : undefined, state: stepState(3), note: pay && idx >= 4 ? pay.ref : undefined },
    { label: t("Paid"), date: dates.paid && inv.status === "PAID" ? d(dates.paid) : undefined, state: stepState(4), note: inv.status === "PAID" ? pay?.bankRef ?? undefined : t("due {date}", { date: d(inv.dueDate, false) }), href: pay ? R.payment(pay.id) : undefined },
  ];

  // ---------------------------------------------------------------- side by side
  const vat = po?.vatRate ?? inv.vatRate;
  const received = po ? po.lines.reduce((a, l) => a + l.received * l.rate, 0) * (1 + vat) : 0;
  const allIn = po ? po.lines.every((l) => l.received >= l.qty - 1e-6) : false;
  const anyIn = po ? po.lines.some((l) => l.received > 0) : false;
  const qtyList = (rows: { q: number; u: string }[]) => (
    <ul className="pmn-side-qty">
      {rows.slice(0, 3).map((r, i) => (
        <li key={i} className="num-inline">
          {fmtQty(r.q, r.u)} {unitLabel(r.u, lang)}
        </li>
      ))}
      {rows.length > 3 ? <li className="muted">{t("+{n} more", { n: rows.length - 3 })}</li> : null}
    </ul>
  );

  const kebab = [
    { label: t("Run the match again"), icon: <RefreshCw size={14} />, disabled: !inMatch, onClick: rematch },
    { label: t("Ask for a credit note"), icon: <MailQuestion size={14} />, disabled: !inMatch || m.ok || inv.status === "CREDIT_REQUESTED", onClick: () => openAsk("credit") },
    { label: t("Accept the correct amount"), icon: <Scale size={14} />, disabled: !inMatch || m.ok || !po, onClick: accept },
    { label: t("Send for sign-off"), icon: <PenLine size={14} />, disabled: !inMatch || !m.ok || inv.duplicate, onClick: sendSignOff },
    { label: t("Sign off and book"), icon: <CheckCheck size={14} />, disabled: inv.status !== "SIGN_OFF", onClick: book },
    { label: t("Record as paid"), icon: <Wallet size={14} />, disabled: inv.status !== "BOOKED", onClick: markPaid },
    { label: t("Reject"), icon: <Ban size={14} />, danger: true, disabled: !open, onClick: () => openAsk("reject") },
  ];

  return (
    <div className="k-page pmn-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Supplier invoices"), to: MONEY.invoices }, { label: inv.id }]} />
      <DetailHeader
        refCode={inv.id}
        badges={
          <>
            <InvBadge status={inv.status} />
            {inv.duplicate ? <Badge tone="bad">{t("Duplicate")}</Badge> : null}
            {f.noGrn ? <Badge tone="warn">{t("No GRN")}</Badge> : null}
            {f.overBilled && open ? <Badge tone="bad">{t("Over-billed")}</Badge> : null}
          </>
        }
        title={
          <>
            {inv.ref} <span className="pmn-title-sub">· {vName}</span>
          </>
        }
        meta={
          <>
            <span>
              {t("For")} <Link to={R.order(inv.poId)}>{inv.poId}</Link>
            </span>
            <span>{t("Dated {d}", { d: d(inv.date) })}</span>
            <span>
              {t("Due {d}", { d: d(inv.dueDate) })} {open ? <DueTag due={inv.dueDate} /> : null}
            </span>
            <span>
              {x(SOURCE_LABEL[inv.source])}
              {inv.source !== "PORTAL" ? ` · ${t("read at {p}%", { p: Math.round(inv.confidence * 100) })}` : ""}
            </span>
          </>
        }
        aside={<KeyFigure label={t("Billed")} value={<Money value={total} />} sub={Math.abs(total - fair) > 0.01 && open ? t("Correct amount {a} AZN", { a: fmtMoney(fair) }) : t("incl. VAT {p}%", { p: Math.round(inv.vatRate * 100) })} tone={inv.status === "PAID" ? "ok" : !m.ok && open ? "bad" : undefined} />}
      >
        <div className="pmn-life">
          <span className="pmn-life-label">{t("Steps from invoice to bank")}</span>
          <LifecycleStrip steps={life} />
        </div>
      </DetailHeader>

      <NextBar text={advice.text} tone={advice.tone === "neutral" || advice.tone === "info" ? "muted" : advice.tone}>
        {primary}
        <Kebab items={kebab} />
      </NextBar>

      <Trail steps={trailOf(s, "PO", inv.poId)} />

      {original ? (
        <section className="pmn-dup k-rise" aria-label={t("Possible duplicate")}>
          <header>
            <CopyX size={16} />
            <div>
              <strong>{t("This looks like a duplicate of {id}", { id: original.id })}</strong>
              <p>{t("Same supplier, same invoice number {ref}. Compare before anything is paid.", { ref: inv.ref })}</p>
            </div>
          </header>
          <div className="pmn-dup-pair">
            {[original, inv].map((o, i) => (
              <Link key={o.id} to={MONEY.invoice(o.id)} className={`pmn-dup-card${o.id === inv.id ? " this" : ""}`}>
                <small>{i === 0 ? t("First received") : t("This copy")}</small>
                <b className="k-mono">{o.id}</b>
                <span>
                  {d(o.date)} · {x(SOURCE_LABEL[o.source])}
                </span>
                <span className="num-inline">{fmtMoney(invTotal(o))} AZN</span>
                <InvBadge status={o.status} />
              </Link>
            ))}
          </div>
          <div className="k-row">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openAsk("reject")}>
              {t("Reject as duplicate")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={notDuplicate}>
              {t("It is a separate bill")}
            </button>
          </div>
        </section>
      ) : twin && !inv.duplicate && twin.duplicate ? (
        <div className="k-callout k-tone-warn">
          <AlertTriangle size={15} />
          <span>
            {t("A second copy of this bill arrived as {id}.", { id: twin.id })} <Link to={MONEY.invoice(twin.id)}>{t("Open it")}</Link>
          </span>
        </div>
      ) : null}

      <div className="k-grid-main">
        <div className="k-stack">
          <Panel title={t("Bill vs order vs delivery: side by side")} icon={<Scale size={15} />} sub={t("The three papers must agree before the bill is paid.")}>
            <div className="pmn-side">
              <article className={`pmn-side-card k-tone-${po ? "brand" : "bad"}`}>
                <span className="pmn-side-kind">{t("Purchase order")}</span>
                {po ? (
                  <>
                    <Link to={R.order(po.id)} className="k-ref">
                      {po.ref}
                    </Link>
                    {qtyList(po.lines.map((l) => ({ q: l.qty, u: l.unit })))}
                    <b className="pmn-side-amt num-inline">{fmtMoney(poTotal(po))} AZN</b>
                    <StatusBadge kind="po" status={po.status} />
                  </>
                ) : (
                  <p className="muted small">{t("Not found")}</p>
                )}
              </article>
              <span className={`pmn-side-eq ${allIn ? "ok" : "bad"}`} aria-label={allIn ? t("agrees") : t("differs")}>
                {allIn ? "=" : "≠"}
              </span>
              <article className={`pmn-side-card k-tone-${allIn ? "ok" : anyIn ? "warn" : "bad"}`}>
                <span className="pmn-side-kind">{grns.length > 1 ? t("Goods receipts") : t("Goods receipt")}</span>
                {grns.length ? (
                  <span className="k-row" style={{ gap: 4 }}>
                    {grns.map((g) => (
                      <Link key={g.id} to={R.receipt(g.id)} className="k-ref">
                        {g.ref}
                      </Link>
                    ))}
                  </span>
                ) : (
                  <span className="k-ref muted">{t("None yet")}</span>
                )}
                {po ? qtyList(po.lines.map((l) => ({ q: l.received, u: l.unit }))) : null}
                <b className="pmn-side-amt num-inline">{fmtMoney(received)} AZN</b>
                <Badge tone={allIn ? "ok" : anyIn ? "warn" : "bad"}>{allIn ? t("All received") : anyIn ? t("Part received") : t("Nothing received")}</Badge>
              </article>
              <span className={`pmn-side-eq ${m.ok ? "ok" : "bad"}`} aria-label={m.ok ? t("agrees") : t("differs")}>
                {m.ok ? "=" : "≠"}
              </span>
              <article className={`pmn-side-card k-tone-${m.ok ? "ok" : "bad"}`}>
                <span className="pmn-side-kind">{t("Invoice")}</span>
                <span className="k-ref">{inv.ref}</span>
                {qtyList(inv.lines.map((l) => ({ q: l.qty, u: l.unit })))}
                <b className="pmn-side-amt num-inline">{fmtMoney(total)} AZN</b>
                <Badge tone={m.ok ? "ok" : "bad"}>{m.ok ? t("Matches") : t("Differs by {a} AZN", { a: fmtMoney(Math.abs(total - fair)) })}</Badge>
              </article>
            </div>
          </Panel>

          <Panel title={t("Line by line")} icon={<FileSearch size={15} />} pad={false} actions={inMatch ? <button type="button" className="k-link-btn" onClick={rematch}><RefreshCw size={13} /> {t("Run the match again")}</button> : undefined}>
            <div className="pmn-match-wrap">
              <table className="pmn-match">
                <thead>
                  <tr>
                    <th>{t("Item")}</th>
                    <th>{t("Ordered")}</th>
                    <th>{t("Received")}</th>
                    <th>{t("Billed")}</th>
                    <th>{t("Difference")}</th>
                    <th>{t("Money")}</th>
                  </tr>
                </thead>
                <tbody>
                  {m.lines.map((l) => {
                    const ln = lineOf(l.key);
                    const u = ln?.unit ?? "";
                    return (
                      <tr key={l.key} className={l.ok ? undefined : "bad"}>
                        <td>
                          <span className="pmn-match-item">
                            <b>{x(ln?.description)}</b>
                            <small className="num-inline">
                              {t("rate {r}", { r: fmtMoney(l.rate) })}
                              {l.poRate != null && Math.abs(l.rateDiff) > 0.005 ? ` · ${t("order {r}", { r: fmtMoney(l.poRate) })}` : ""}
                            </small>
                          </span>
                        </td>
                        <td className="num-inline">{fmtQty(l.ordered, u)}</td>
                        <td className="num-inline">{fmtQty(l.received, u)}</td>
                        <td className="num-inline">
                          <b>{fmtQty(l.billed, u)}</b> <small className="muted">{unitLabel(u, lang)}</small>
                        </td>
                        <td className="num-inline">{Math.abs(l.qtyDiff) > 1e-6 ? `${l.qtyDiff > 0 ? "+" : ""}${fmtQty(l.qtyDiff, u)}` : Math.abs(l.rateDiff) > 0.005 ? t("rate {r}", { r: `${l.rateDiff > 0 ? "+" : ""}${fmtMoney(l.rateDiff)}` }) : "—"}</td>
                        <td className="num-inline pmn-match-money">{Math.abs(l.money) > 0.005 ? `${l.money > 0 ? "+" : ""}${fmtMoney(l.money)}` : <span className="k-text-ok">✓</span>}</td>
                      </tr>
                    );
                  })}
                  {!m.lines.length ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        {t("No lines to match.")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                {m.lines.length ? (
                  <tfoot>
                    <tr>
                      <td colSpan={5}>{m.ok ? t("Everything matches") : t("Over-billed, before VAT")}</td>
                      <td className="num-inline pmn-match-money">{m.ok ? "0.00" : `+${fmtMoney(m.over)}`}</td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            <div className={`k-callout k-tone-${advice.tone} pmn-advice`}>
              <Scale size={15} />
              <span>
                <b>{t("What to do")}</b> {advice.text}
              </span>
            </div>
          </Panel>

          <Panel title={t("The original invoice")} icon={<FileSearch size={15} />} sub={inv.source === "PORTAL" ? t("Sent by the supplier through the vendor portal.") : t("Read by AI from the supplier's file.")}>
            <InvoicePaper vendor={vName} vendorCity={vendor?.city} refNo={inv.ref} date={inv.date} due={inv.dueDate} poRef={inv.poId} lines={inv.lines} vatRate={inv.vatRate} status={inv.status} />
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("Payment behind this bill")} icon={<Wallet size={15} />}>
            {pay ? (
              <Link to={R.payment(pay.id)} className="pmn-paylink">
                <span>
                  <b className="k-mono">{pay.ref}</b>
                  <small>{pay.status === "PAID" ? t("paid {d}", { d: d(pay.paidAt) }) : t("due {d}", { d: d(pay.dueDate) })}</small>
                </span>
                <Money value={pay.amount} />
                <StatusBadge kind="payment" status={pay.status} />
                {pay.holdReason && pay.status === "ON_HOLD" ? <small className="k-text-bad pmn-paylink-why">{pay.holdReason}</small> : null}
              </Link>
            ) : (
              <p className="muted small">{inv.duplicate ? t("A duplicate is not linked to a payment.") : t("No payment linked yet.")}</p>
            )}
          </Panel>

          <Panel title={t("History")} icon={<History size={15} />}>
            <Timeline events={inv.history} />
          </Panel>
        </div>
      </div>

      <Dialog
        open={ask !== null}
        onClose={() => setAsk(null)}
        kicker={`${inv.id} · ${inv.ref}`}
        title={ask === "credit" ? t("Ask {v} for a credit note", { v: vName }) : t("Reject this bill?")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={submitAsk}>
              {ask === "credit" ? t("Send the request") : t("Reject")}
            </button>
          </>
        }
      >
        <div className="k-stack">
          <p className="muted">{ask === "credit" ? t("The supplier sees this note in the vendor portal. The payment is held until the credit note arrives.") : t("Nothing is paid on a rejected bill. The supplier sees the reason.")}</p>
          <Field label={ask === "credit" ? t("Note to the supplier") : t("Reason")}>
            <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}


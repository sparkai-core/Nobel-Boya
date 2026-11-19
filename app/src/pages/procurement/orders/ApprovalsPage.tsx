import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Check, Clock, Signature } from "lucide-react";
import { Avatar, Empty, FilterChips, FlowRail, Money, PageHero, Register, SearchBox, StatusBadge, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { decideApprovalAt } from "../../../ops/ext/proc-client";
import { APPROVAL_LIMIT, diffDays, TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { Approval, ApprovalStatus } from "../../../ops/types";
import { Pips, short, vendorName, VisualHead } from "./shared";

type F = "ALL" | ApprovalStatus;

/** Approvals: the signature queue against the two-signature limit, the cards waiting on you, and the register. */
export function ApprovalsPage() {
  const { t, x, d, rel } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const approvals = s.approvals;
  const [filter, setFilter] = useState<F>("ALL");
  const [q, setQ] = useState("");

  const pending = useMemo(() => approvals.filter((a) => a.status === "PENDING").sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)), [approvals]);
  const max = Math.max(APPROVAL_LIMIT, ...pending.map((a) => a.amount)) * 1.12;
  const waitingValue = pending.reduce((a, p) => a + p.amount, 0);
  const twoSig = pending.filter((a) => a.requiredLevels === 2).length;

  const approve = (a: Approval) => {
    const poId = decideApprovalAt(a.id, "APPROVE");
    if (poId) toast(t("{po} issued", { po: poId }), "ok", { label: t("Open order"), onClick: () => navigate(R.order(poId)) });
    else toast(t("First approval given on {ref}. It now needs the final signature.", { ref: a.ref }), "brand");
  };

  const counts = useMemo(() => approvals.reduce<Record<string, number>>((acc, a) => ((acc[a.status] = (acc[a.status] ?? 0) + 1), acc), {}), [approvals]);
  const filtered = useMemo(() => approvals.filter((a) => filter === "ALL" || a.status === filter), [approvals, filter]);
  const rows = useSearch(filtered, q, (a) => [a.ref, a.title, vendorName(s, a.vendorId), a.requestedBy]);

  const columns: Column<Approval>[] = [
    {
      key: "req",
      header: t("Request"),
      sort: (a) => a.ref,
      render: (a) => (
        <div className="k-cell-title">
          <span className="k-ref">{a.ref}</span>
          <strong>{x(a.title)}</strong>
          <small>{a.requestedBy}</small>
        </div>
      ),
    },
    { key: "vendor", header: t("Vendor"), sort: (a) => vendorName(s, a.vendorId), hideBelow: 900, render: (a) => <span className="k-row" style={{ gap: 8, flexWrap: "nowrap" }}><Avatar name={vendorName(s, a.vendorId)} size={24} /><span className="truncate">{vendorName(s, a.vendorId)}</span></span> },
    { key: "amount", header: t("Amount"), align: "right", sort: (a) => a.amount, render: (a) => <Money value={a.amount} /> },
    {
      key: "levels",
      header: t("Levels"),
      sort: (a) => a.requiredLevels,
      render: (a) => (
        <span className="po-levels">
          <Pips level={a.level} required={a.requiredLevels} />
          <small>{a.requiredLevels === 2 ? t("two signatures") : t("one signature")}</small>
        </span>
      ),
    },
    {
      key: "standing",
      header: t("Standing"),
      sort: (a) => a.status,
      render: (a) => (
        <span className="po-standing">
          <StatusBadge kind="approval" status={a.status} />
          {a.status === "PENDING" ? <small>{t("{a} of {b} signed", { a: a.level, b: a.requiredLevels })}</small> : a.poId ? <small className="k-mono">{a.poId}</small> : null}
        </span>
      ),
    },
    { key: "when", header: t("Requested"), sort: (a) => a.requestedAt, render: (a) => <span className="po-when"><b>{d(a.requestedAt)}</b><small>{rel(a.requestedAt)}</small></span> },
  ];

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Approvals")}
        title={t("Approvals")}
        subtitle={t("Quotes sent for a signature. Company rule: above {v} AZN an order needs two approvals; the final one issues the purchase order.", { v: fmtMoneyShort(APPROVAL_LIMIT) })}
        flow={["Quote chosen", "First approval", "Final approval", "Order issued"]}
        art="approve"
      />
      <FlowRail current="approve" />

      <div className="po-appr-top">
        <section className="po-visual" aria-label={t("Signature queue")}>
          <VisualHead
            title={t("Signature queue")}
            sentence={pending.length ? t("{n} waiting, {v} in total. {k} need two signatures.", { n: pending.length, v: short(waitingValue), k: twoSig }) : t("Nothing is waiting for a signature.")}
          />
          {pending.length ? (
            <div className="po-queue">
              <div className="po-queue-plot">
                <div className="po-queue-limit" style={{ bottom: `${(APPROVAL_LIMIT / max) * 100}%` }}>
                  <span>
                    {t("Company rule: above this, two approvals are needed")} · {fmtMoneyShort(APPROVAL_LIMIT)} AZN
                  </span>
                </div>
                {pending.map((a, i) => (
                  <button key={a.id} type="button" className="po-qcol can" style={{ animationDelay: `${i * 60}ms` }} onClick={() => navigate(R.approval(a.id))} title={`${a.ref} · ${x(a.title)}`}>
                    <span className="po-qcol-amt num-inline">{fmtMoneyShort(a.amount)}</span>
                    <i className="k-grow-y" style={{ height: `${(a.amount / max) * 100}%` }}>
                      <Pips level={a.level} required={a.requiredLevels} />
                    </i>
                  </button>
                ))}
              </div>
              <div className="po-queue-axis">
                {pending.map((a) => (
                  <span key={a.id}>
                    <b>{a.ref}</b>
                    <small>{t("{n} d waiting", { n: Math.max(0, diffDays(a.requestedAt, TODAY)) })}</small>
                  </span>
                ))}
              </div>
              <p className="po-legend-line">
                <i className="po-sw violet" /> {t("You can decide now")} <i className="po-sw pip" /> {t("Signatures given")} <span className="muted">· {t("oldest on the left")}</span>
              </p>
            </div>
          ) : (
            <Empty icon={<BadgeCheck size={20} />} title={approvals.length ? t("All signed") : t("No approvals yet")}>
              {t("New approvals appear here when you send a chosen quote for approval from the quote comparison.")}
            </Empty>
          )}
        </section>

        <section className="po-visual" aria-label={t("Waiting on you")}>
          <VisualHead title={t("Waiting on you")} sentence={t("Approve in one step, or open the request to see the quotes behind it.")} />
          {pending.length ? (
            <ul className="po-wait">
              {pending.map((a, i) => {
                const last = a.level + 1 >= a.requiredLevels;
                return (
                  <li key={a.id} className="k-rise" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="po-wait-top">
                      <span className="k-ref">{a.ref}</span>
                      <span className="po-wait-sig">
                        <Signature size={13} />
                        {t("Signature {a} of {b}", { a: a.level + 1, b: a.requiredLevels })}
                      </span>
                    </div>
                    <strong className="po-wait-title">{x(a.title)}</strong>
                    <div className="po-wait-meta">
                      <Money value={a.amount} />
                      <span>{vendorName(s, a.vendorId)}</span>
                      <span className={diffDays(a.requestedAt, TODAY) > 3 ? "k-text-warn" : undefined}>
                        <Clock size={12} /> {t("waiting {n} days", { n: Math.max(0, diffDays(a.requestedAt, TODAY)) })}
                      </span>
                    </div>
                    <div className="po-wait-actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => approve(a)}>
                        <Check size={14} />
                        {last ? t("Approve and issue the order") : t("Approve")}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.approval(a.id))}>
                        {t("Open")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted small">{t("Nothing is waiting on you.")}</p>
          )}
        </section>
      </div>

      <Register
        rows={rows}
        columns={columns}
        rowKey={(a) => a.id}
        empty={s.approvals.length ? t("Nothing matches these filters.") : t("No approvals yet. Send a chosen quote for approval from the comparison.")}
        onRowClick={(a) => navigate(R.approval(a.id))}
        initialSort={{ key: "when", dir: "desc" }}
        rowClass={(a) => (a.status === "PENDING" ? "po-row-hot" : undefined)}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search requests, vendors" />
            <FilterChips<F>
              value={filter}
              onChange={(v) => setFilter(v ?? "ALL")}
              options={[
                { value: "ALL", label: t("All"), count: approvals.length },
                { value: "PENDING", label: t("Waiting"), count: counts.PENDING ?? 0 },
                { value: "APPROVED", label: t("Approved"), count: counts.APPROVED ?? 0 },
                { value: "REJECTED", label: t("Rejected"), count: counts.REJECTED ?? 0 },
              ]}
            />
          </Toolbar>
        }
      />
    </div>
  );
}

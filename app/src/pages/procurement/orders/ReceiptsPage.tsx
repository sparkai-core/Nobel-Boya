import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, PackageCheck, Truck, Warehouse } from "lucide-react";
import { Badge, FlowRail, PageHero, Register, SearchBox, StagePath, StatusBadge, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { grnShort, PATHS, poLate, R } from "../../../ops/select";
import type { GoodsReceipt, PurchaseOrder } from "../../../ops/types";
import { vendorName, VisualHead } from "./shared";

type Picked = { kind: "truck"; po: PurchaseOrder } | { kind: "gate"; grn: GoodsReceipt } | { kind: "crate"; grn: GoodsReceipt };

/** Goods receipt: the site dock (trucks on the way, receipts at the gate, crates in the store) and the GRN register. */
export function ReceiptsPage() {
  const { t, x, d, rel } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [stage, setStage] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Picked | null>(null);

  const dock = useMemo(() => {
    const atGate = s.grns.filter((g) => g.status === "DRAFT");
    const gatePo = new Set(atGate.map((g) => g.poId));
    const onWay = s.pos
      .filter((p) => (p.status === "ISSUED" || p.status === "PART_RECEIVED") && !gatePo.has(p.id))
      .sort((a, b) => Number(!!b.dispatchedAt) - Number(!!a.dispatchedAt) || a.expectedAt.localeCompare(b.expectedAt));
    const stored = s.grns
      .filter((g) => g.status === "RECEIVED" || g.status === "PART_RECEIVED")
      .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""))
      .slice(0, 8);
    return { atGate, onWay, stored };
  }, [s.grns, s.pos]);

  const receive = (po: PurchaseOrder) => {
    const grnId = s.startReceipt(po.id);
    toast(t("{grn} opened for {po}. Count what arrived.", { grn: grnId, po: po.ref }), "brand");
    navigate(R.receipt(grnId));
  };

  const counts = useMemo(() => s.grns.reduce<Record<string, number>>((a, g) => ((a[g.status] = (a[g.status] ?? 0) + 1), a), {}), [s.grns]);
  const filtered = useMemo(() => s.grns.filter((g) => !stage || g.status === stage), [s.grns, stage]);
  const rows = useSearch(filtered, q, (g) => [g.ref, g.poId, vendorName(s, g.vendorId), g.receivedBy, ...g.lines.map((l) => l.description)]);

  const strip = (() => {
    if (!pick) return null;
    if (pick.kind === "truck") {
      const po = pick.po;
      const late = poLate(po);
      return {
        title: `${po.ref} · ${vendorName(s, po.vendorId)}`,
        text: po.dispatchedAt
          ? t("Dispatched{note}. Count it at the gate when it arrives.", { note: po.dispatchNote ? `: ${po.dispatchNote}` : "" })
          : late
            ? t("Expected {d}, now {n} days late. Nothing dispatched yet.", { d: d(po.expectedAt), n: diffDays(po.expectedAt, TODAY) })
            : t("Expected {when}. Not dispatched yet.", { when: rel(po.expectedAt) }),
        actions: (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => receive(po)}>
              <PackageCheck size={14} />
              {t("Receive at the gate")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.order(po.id))}>
              {t("Open order")}
            </button>
          </>
        ),
      };
    }
    const g = pick.grn;
    const shortLines = g.lines.filter((l) => l.prior + l.accepted < l.ordered - 1e-6).length;
    return {
      title: `${g.ref} · ${vendorName(s, g.vendorId)}`,
      text:
        pick.kind === "gate"
          ? t("Being counted at the gate against {po}. {n} lines to check.", { po: g.poId, n: g.lines.length })
          : shortLines
            ? t("Posted {d} with {n} lines short.", { d: d(g.receivedAt), n: shortLines })
            : t("Posted {d}. Every line in full.", { d: d(g.receivedAt) }),
      actions: (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.receipt(g.id))}>
          {pick.kind === "gate" ? t("Continue counting") : t("Open the record")}
          <ArrowRight size={14} />
        </button>
      ),
    };
  })();

  const columns: Column<GoodsReceipt>[] = [
    {
      key: "grn",
      header: t("Receipt"),
      sort: (g) => g.ref,
      render: (g) => (
        <span className="k-row" style={{ gap: 6 }}>
          <span className="k-ref">{g.ref}</span>
          {grnShort(g) ? <Badge tone="warn">{t("Posted short")}</Badge> : null}
        </span>
      ),
    },
    { key: "po", header: t("Order"), sort: (g) => g.poId, render: (g) => <span className="k-mono">{g.poId}</span> },
    { key: "vendor", header: t("Vendor"), hideBelow: 900, sort: (g) => vendorName(s, g.vendorId), render: (g) => <span className="truncate">{vendorName(s, g.vendorId)}</span> },
    { key: "on", header: t("Received on"), sort: (g) => g.receivedAt ?? "9", render: (g) => (g.receivedAt ? <span className="po-when"><b>{d(g.receivedAt)}</b><small>{g.receivedBy}</small></span> : <span className="muted">{t("at the gate")}</span>) },
    {
      key: "lines",
      header: t("Lines"),
      render: (g) => (
        <span className="po-tally" aria-label={t("{n} lines", { n: g.lines.length })}>
          {g.lines.map((l) => {
            const done = l.prior + l.accepted >= l.ordered - 1e-6;
            return <i key={l.key} className={g.status === "DRAFT" ? "todo" : l.accepted > 0 ? (done ? "full" : "short") : l.shortReason ? "miss" : "todo"} title={x(l.description)} />;
          })}
        </span>
      ),
    },
    { key: "stage", header: t("Stage"), sort: (g) => g.status, render: (g) => <StatusBadge kind="grn" status={g.status} /> },
  ];

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Goods receipt")}
        title={t("Goods receipt")}
        subtitle={t("Count deliveries at the gate against the order. Posting puts the goods into stock and frees the payment.")}
        flow={["On the way", "At the gate", "Counted", "In the store"]}
        art="receipt"
      />
      <FlowRail current="receive" />

      <section className="po-visual" aria-label={t("Site dock")}>
        <VisualHead
          title={t("Site dock")}
          sentence={t("{a} on the way · {b} at the gate · {c} recently stored", { a: dock.onWay.length, b: dock.atGate.length, c: dock.stored.length })}
        />
        <div className="po-dock">
          <div className="po-bay road">
            <h3>
              <Truck size={14} /> {t("On the way")}
            </h3>
            <div className="po-trucks">
              {dock.onWay.length ? (
                dock.onWay.map((p, i) => {
                  const late = poLate(p);
                  const on = pick?.kind === "truck" && pick.po.id === p.id;
                  return (
                    <button key={p.id} type="button" className={`po-truck${late ? " late" : ""}${p.dispatchedAt ? " moving" : ""}${on ? " on" : ""}`} style={{ animationDelay: `${i * 70}ms` }} onClick={() => setPick(on ? null : { kind: "truck", po: p })}>
                      <svg viewBox="0 0 64 30" aria-hidden="true">
                        <rect x="1" y="3" width="40" height="19" rx="3" className="body" />
                        <path d="M41 9h11l8 7v6H41z" className="cab" />
                        <rect x="47" y="11" width="6" height="4" rx="1" className="win" />
                        <circle cx="12" cy="24" r="4" className="wheel" />
                        <circle cx="50" cy="24" r="4" className="wheel" />
                      </svg>
                      <b>{p.ref}</b>
                      <small>{late ? t("{n} d late", { n: diffDays(p.expectedAt, TODAY) }) : p.dispatchedAt ? t("dispatched") : d(p.expectedAt, false)}</small>
                    </button>
                  );
                })
              ) : (
                <p className="po-bay-empty">{t("No deliveries expected.")}</p>
              )}
            </div>
          </div>
          <div className="po-bay gate">
            <h3>
              <PackageCheck size={14} /> {t("At the gate")}
            </h3>
            <div className="po-gatebox">
              <span className="po-barrier" aria-hidden="true" />
              {dock.atGate.length ? (
                dock.atGate.map((g) => {
                  const on = pick?.kind === "gate" && pick.grn.id === g.id;
                  return (
                    <button key={g.id} type="button" className={`po-gatecard${on ? " on" : ""}`} onClick={() => setPick(on ? null : { kind: "gate", grn: g })}>
                      <b>{g.ref}</b>
                      <small>
                        {g.poId} · {t("{n} lines", { n: g.lines.length })}
                      </small>
                      <span className="po-counting">{t("counting")}</span>
                    </button>
                  );
                })
              ) : (
                <p className="po-bay-empty">{t("Gate is clear.")}</p>
              )}
            </div>
          </div>
          <div className="po-bay store">
            <h3>
              <Warehouse size={14} /> {t("In the store")}
            </h3>
            <div className="po-crates">
              {dock.stored.map((g, i) => {
                const on = pick?.kind === "crate" && pick.grn.id === g.id;
                return (
                  <button key={g.id} type="button" className={`po-crate${grnShort(g) ? " short" : ""}${on ? " on" : ""}`} style={{ animationDelay: `${i * 50}ms` }} onClick={() => setPick(on ? null : { kind: "crate", grn: g })} title={`${g.ref} · ${d(g.receivedAt)}`}>
                    <span className="po-crate-grid">
                      {g.lines.map((l) => {
                        const full = l.prior + l.accepted >= l.ordered - 1e-6;
                        return <i key={l.key} className={l.accepted > 0 ? (full ? "full" : "part") : full ? "done" : "none"} />;
                      })}
                    </span>
                    <b>{g.ref}</b>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {strip ? (
          <div className="po-strip k-rise" role="status">
            <div>
              <strong>{strip.title}</strong>
              <p>{strip.text}</p>
            </div>
            <div className="po-strip-actions">{strip.actions}</div>
          </div>
        ) : (
          <p className="po-legend-line">
            <i className="po-sw late" /> {t("Late")} <i className="po-sw violet" /> {t("Dispatched")} <i className="po-sw full" /> {t("Line accepted in full")} <i className="po-sw short" /> {t("Short")} <span className="muted">· {t("Click a truck or crate")}</span>
          </p>
        )}
      </section>

      <StagePath kind="grn" path={PATHS.grn} counts={counts} value={stage} onChange={setStage} extras={["REJECTED"]} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(g) => g.id}
        empty={s.grns.length ? t("Nothing matches these filters.") : t("No goods receipts yet. Receive goods from an open purchase order.")}
        onRowClick={(g) => navigate(R.receipt(g.id))}
        initialSort={{ key: "grn", dir: "desc" }}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search receipts, orders, vendors" />
          </Toolbar>
        }
      />
    </div>
  );
}

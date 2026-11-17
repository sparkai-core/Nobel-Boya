import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Badge,
  FilterChips,
  PageHero,
  Register,
  SearchBox,
  StagePath,
  StatusBadge,
  Toolbar,
  useL,
  useSearch,
  type Column,
} from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { PATHS, R } from "../../../ops/select";
import { fmtMoney, fmtMoneyShort } from "../../../lib/format";
import type { ChangeOrder } from "../../../ops/types";
import { changeCost, signed, WORKS_VALUE } from "./shared";
import { ChangeDialog, REASONS, reasonLabel } from "./ChangeDialog";

const PENDING = ["DRAFT", "SUBMITTED", "UNDER_REVIEW"];

/**
 * Change orders and variations. Signature visual: the contract-value waterfall, from the original
 * BOQ works value through approved and pending changes to the forecast final value.
 */
export function ChangesPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const changes = useOps((s) => s.changes);
  const rfis = useOps((s) => s.rfis);
  const [stage, setStage] = useState<string | null>(null);
  const [reason, setReason] = useState<ChangeOrder["reason"] | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => changes.reduce<Record<string, number>>((a, c) => ((a[c.status] = (a[c.status] ?? 0) + 1), a), {}), [changes]);
  const filtered = useMemo(() => changes.filter((c) => (!stage || c.status === stage) && (!reason || c.reason === reason)), [changes, stage, reason]);
  const rows = useSearch(filtered, q, (c) => [c.ref, c.title, c.description, c.rfiId, ...c.lines.map((l) => l.description)]);

  const columns: Column<ChangeOrder>[] = [
    {
      key: "vo",
      header: t("Change"),
      sort: (c) => c.ref,
      render: (c) => (
        <div className="k-cell-title">
          <span className="k-ref" style={{ width: "fit-content" }}>{c.ref}</span>
          <strong>{x(c.title)}</strong>
          <small>{t("raised {date}", { date: d(c.raisedAt) })} · {t("{n} lines", { n: c.lines.length })}</small>
        </div>
      ),
    },
    { key: "reason", header: t("Reason"), sort: (c) => c.reason, hideBelow: 900, render: (c) => <Badge tone={c.reason === "CLIENT" ? "brand" : c.reason === "RFI" ? "info" : c.reason === "SITE" ? "warn" : "neutral"}>{t(reasonLabel(c.reason))}</Badge> },
    {
      key: "cost",
      header: t("Cost change"),
      align: "right",
      sort: (c) => changeCost(c),
      render: (c) => {
        const v = changeCost(c);
        return <b className={`num-inline ${v > 0 ? "k-text-bad" : v < 0 ? "k-text-ok" : ""}`}>{signed(v, fmtMoney)}</b>;
      },
    },
    { key: "days", header: t("Days"), align: "right", sort: (c) => c.daysDelta, render: (c) => <span className={`num-inline ${c.daysDelta > 0 ? "k-text-warn" : c.daysDelta < 0 ? "k-text-ok" : "muted"}`}>{signed(c.daysDelta, String)}</span> },
    {
      key: "rfi",
      header: t("RFI"),
      hideBelow: 1100,
      render: (c) =>
        c.rfiId ? (
          <Link className="k-ref" to={R.rfi(c.rfiId)} onClick={(e) => e.stopPropagation()} title={x(rfis.find((r) => r.id === c.rfiId)?.subject)}>
            {c.rfiId}
          </Link>
        ) : (
          <span className="muted">—</span>
        ),
    },
    { key: "status", header: t("Status"), sort: (c) => PATHS.change.indexOf(c.status as (typeof PATHS.change)[number]), render: (c) => <StatusBadge kind="change" status={c.status} /> },
  ];

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · Changes")}
        title={t("Changes and variations")}
        subtitle={t("Every change to the contract, priced from BOQ rates, with its effect on the contract value and the programme.")}
        flow={["Draft", "Submit", "Review", "Approve or reject"]}
        art="change"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            {t("New change")}
          </button>
        }
      />

      <Waterfall changes={changes} onOpen={(id) => navigate(R.change(id))} />

      <StagePath kind="change" path={PATHS.change} counts={counts} value={stage} onChange={setStage} extras={["REJECTED"]} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(R.change(c.id))}
        initialSort={{ key: "vo", dir: "desc" }}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search changes, lines, RFIs" />
            <FilterChips value={reason} onChange={setReason} options={REASONS.map((r) => ({ value: r.value, label: t(r.label), count: changes.filter((c) => c.reason === r.value).length }))} />
          </Toolbar>
        }
        empty={
          <>
            {t("No changes match.")}{" "}
            <button type="button" className="k-link-btn" onClick={() => { setStage(null); setReason(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </>
        }
      />

      <ChangeDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          navigate(R.change(id));
        }}
      />
    </div>
  );
}

type Col = { key: string; label: string; sub?: string; kind: "total" | "step"; from: number; to: number; pending?: boolean; id?: string };

function Waterfall({ changes, onOpen }: { changes: ChangeOrder[]; onOpen: (id: string) => void }) {
  const { t, x } = useL();
  const approved = changes.filter((c) => c.status === "APPROVED").sort((a, b) => (a.decidedAt ?? a.raisedAt).localeCompare(b.decidedAt ?? b.raisedAt));
  const pending = changes.filter((c) => PENDING.includes(c.status)).sort((a, b) => a.raisedAt.localeCompare(b.raisedAt));

  const cols: Col[] = [];
  let run = WORKS_VALUE;
  cols.push({ key: "orig", label: t("Original works"), sub: t("BOQ at sample rates"), kind: "total", from: 0, to: run });
  for (const c of approved) {
    const v = changeCost(c);
    cols.push({ key: c.id, id: c.id, label: c.ref, sub: x(c.title), kind: "step", from: run, to: run + v });
    run += v;
  }
  const current = run;
  cols.push({ key: "cur", label: t("Current contract"), sub: t("with approved changes"), kind: "total", from: 0, to: run });
  for (const c of pending) {
    const v = changeCost(c);
    cols.push({ key: c.id, id: c.id, label: c.ref, sub: x(c.title), kind: "step", from: run, to: run + v, pending: true });
    run += v;
  }
  cols.push({ key: "final", label: t("Forecast final"), sub: t("if every pending change is approved"), kind: "total", from: 0, to: run });

  const vals = cols.flatMap((c) => (c.kind === "total" ? [c.to] : [c.from, c.to]));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.35, 1500);
  const min = lo - pad;
  const max = hi + pad * 0.35;
  const P = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  const grid = [0, 0.25, 0.5, 0.75, 1].map((g) => min + (max - min) * g);

  const approvedSum = current - WORKS_VALUE;
  const pendingSum = run - current;
  const dayCh = changes.filter((c) => c.daysDelta !== 0 && c.status !== "REJECTED");
  const daysApproved = dayCh.filter((c) => c.status === "APPROVED").reduce((a, c) => a + c.daysDelta, 0);
  const daysPending = dayCh.filter((c) => c.status !== "APPROVED").reduce((a, c) => a + c.daysDelta, 0);
  const daysScale = Math.max(1, dayCh.reduce((a, c) => a + Math.abs(c.daysDelta), 0));

  return (
    <section className="pmr-fall" aria-label={t("Contract value waterfall")}>
      <header className="pmr-fall-head">
        <div>
          <h2>{t("Contract value, from the BOQ to the forecast final")}</h2>
          <p>{t("The axis starts near the original value so the changes are readable. Hatched steps are not approved yet.")}</p>
        </div>
        <dl className="pmr-fall-figs">
          <div>
            <dt>{t("Approved")}</dt>
            <dd className={approvedSum > 0 ? "k-text-bad" : "k-text-ok"}>{signed(approvedSum, fmtMoneyShort)}</dd>
          </div>
          <div>
            <dt>{t("Pending")}</dt>
            <dd className="k-text-warn">{signed(pendingSum, fmtMoneyShort)}</dd>
          </div>
          <div>
            <dt>{t("Forecast final")}</dt>
            <dd>
              {fmtMoneyShort(run)} <small className="k-cur">AZN</small>
            </dd>
          </div>
          <div>
            <dt>{t("Growth")}</dt>
            <dd>{(((run - WORKS_VALUE) / WORKS_VALUE) * 100).toFixed(2)}%</dd>
          </div>
        </dl>
      </header>

      <div className="pmr-fall-scroll">
        <div className="pmr-fall-chart" style={{ minWidth: cols.length * 86 + 60 }}>
          <div className="pmr-fall-plot">
            <div className="pmr-fall-grid" aria-hidden="true">
              {grid.map((g, i) => (
                <span key={i} style={{ bottom: `${P(g)}%` }}>
                  <em>{fmtMoneyShort(g)}</em>
                </span>
              ))}
            </div>
            <div className="pmr-fall-cols">
              {cols.map((c, i) => {
                const top = c.kind === "total" ? c.to : Math.max(c.from, c.to);
                const bot = c.kind === "total" ? min : Math.min(c.from, c.to);
                const up = c.to >= c.from;
                const cls = c.kind === "total" ? "total" : `step ${up ? "up" : "down"}${c.pending ? " pending" : ""}`;
                const inner = (
                  <>
                    <i className={`pmr-fall-bar ${cls}`} style={{ bottom: `${P(bot)}%`, height: `${Math.max(0.8, P(top) - P(bot))}%`, animationDelay: `${i * 70}ms` }}>
                      {c.kind === "total" ? <b className="pmr-fall-break" aria-hidden="true" /> : null}
                    </i>
                    <span className="pmr-fall-val" style={{ bottom: `calc(${P(top)}% + 4px)` }}>
                      {c.kind === "total" ? fmtMoneyShort(c.to) : signed(c.to - c.from, fmtMoneyShort)}
                    </span>
                    {i < cols.length - 1 ? <i className="pmr-fall-link" style={{ bottom: `${P(c.to)}%` }} aria-hidden="true" /> : null}
                  </>
                );
                return c.id ? (
                  <button key={c.key} type="button" className="pmr-fall-col" title={`${c.label} · ${c.sub ?? ""}`} onClick={() => onOpen(c.id!)}>
                    {inner}
                  </button>
                ) : (
                  <div key={c.key} className="pmr-fall-col" title={c.sub}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pmr-fall-labels">
            {cols.map((c) => (
              <span key={c.key} className={c.kind === "total" ? "total" : undefined}>
                <b>{c.label}</b>
                {c.sub ? <small>{c.sub}</small> : null}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="pmr-days">
        <div className="pmr-days-head">
          <b>{t("Days claimed")}</b>
          <span>
            {t("Approved {a} · pending {p}", { a: signed(daysApproved, String), p: signed(daysPending, String) })}
          </span>
        </div>
        {dayCh.length ? (
          <div className="pmr-days-strip">
            {dayCh.map((c) => (
              <button key={c.id} type="button" className={`pmr-days-seg${c.daysDelta < 0 ? " save" : ""}${c.status !== "APPROVED" ? " pending" : ""}`} style={{ flexGrow: Math.abs(c.daysDelta) / daysScale }} onClick={() => onOpen(c.id)} title={x(c.title)}>
                <b>{signed(c.daysDelta, String)}</b>
                <span>{c.ref}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted small">{t("No change claims extra time.")}</p>
        )}
      </div>
    </section>
  );
}

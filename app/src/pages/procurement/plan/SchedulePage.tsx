import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, PackageCheck, Plus, Send, ShoppingCart, Timer } from "lucide-react";
import { Badge, FilterChips, KeyVals, Money, PageHero, Panel, Register, SearchBox, StatTiles, Toolbar, toast, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays } from "../../../ops/dates";
import { R, tradeName } from "../../../ops/select";
import { APPROVAL_DAYS, BUFFER_DAYS, buildPackages, PKG_PATH, PKG_STATUS, RFQ_DAYS, type Pkg } from "./shared";
import { ScheduleTimeline } from "./ScheduleTimeline";

type Filter = "late" | "due" | "open" | "ordered" | "delivered";

/** The next step for a package and where it goes. */
function nextStep(p: Pkg): { label: string; to: string; icon: typeof Plus } {
  const mr = p.mrs[0];
  const rfq = p.rfqs[0];
  const po = [...p.pos].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
  if (po) return { label: "Open PO", to: R.order(po.id), icon: ShoppingCart };
  if (p.status === "QUOTED" && rfq) return { label: p.approvalPending ? "Open approval" : "Compare quotes", to: p.approvalId ? R.approval(p.approvalId) : R.compare(rfq.id), icon: CheckCircle2 };
  if (rfq) return { label: "Open RFQ", to: R.rfq(rfq.id), icon: Send };
  if (mr) return { label: "Start RFQ", to: R.newRfq(mr.id), icon: Send };
  return { label: "Raise MR", to: `${R.newRequest}?activity=${p.act.id}`, icon: Plus };
}

/** Procurement schedule: the bridge from the programme to buying. Every package back-scheduled from the day the site needs it. */
export function SchedulePage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const pkgs = useMemo(() => buildPackages(s), [s]);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const kpi = useMemo(
    () => ({
      late: pkgs.filter((p) => p.late),
      due: pkgs.filter((p) => p.dueSoon).sort((a, b) => a.latestPo.localeCompare(b.latestPo)),
      ordered: pkgs.filter((p) => p.status === "ORDERED"),
      delivered: pkgs.filter((p) => p.status === "DELIVERED"),
      open: pkgs.filter((p) => p.status !== "ORDERED" && p.status !== "DELIVERED"),
    }),
    [pkgs],
  );

  const filtered = useMemo(() => (filter ? kpi[filter] : pkgs), [filter, kpi, pkgs]);
  const rows = useSearch(filtered, q, (p) => [p.name, p.act.code, p.act.name, p.trade, ...p.mrs.map((m) => m.ref), ...p.rfqs.map((r) => r.ref), ...p.pos.map((o) => o.ref)]);
  const sel = pkgs.find((p) => p.key === picked) ?? kpi.late[0] ?? kpi.due[0] ?? pkgs[0] ?? null;

  const go = (p: Pkg) => {
    const n = nextStep(p);
    if (n.label === "Raise MR") toast(t("New request for {code}: lines come from the BOQ.", { code: p.act.code }), "brand");
    navigate(n.to);
  };

  const floatCell = (p: Pkg) => {
    if (p.status === "ORDERED" || p.status === "DELIVERED") return <span className="muted">{t("ordered")}</span>;
    return <b className={`num-inline ${p.late ? "k-text-bad" : p.dueSoon ? "k-text-warn" : "k-text-ok"}`}>{p.float > 0 ? `+${p.float}` : p.float} {t("d")}</b>;
  };

  const columns: Column<Pkg>[] = [
    {
      key: "pkg",
      header: t("Package"),
      sort: (p) => x(p.name),
      render: (p) => (
        <span className="k-cell-title">
          <strong>{x(p.name)}</strong>
          <small>
            {tradeName(p.trade, lang)} · <Money value={p.value} short />
          </small>
        </span>
      ),
    },
    {
      key: "act",
      header: t("Activity"),
      sort: (p) => p.act.code,
      render: (p) => (
        <button
          type="button"
          className="k-link-btn k-mono"
          onClick={(e) => {
            e.stopPropagation();
            navigate(R.programme(p.act.id));
          }}
        >
          {p.act.code}
        </button>
      ),
    },
    { key: "req", header: t("Required on site"), sort: (p) => p.required, render: (p) => <b className="num-inline">{d(p.required)}</b> },
    { key: "lead", header: t("Lead time"), hideBelow: 1280, sort: (p) => p.lead, render: (p) => <span className="num-inline">{t("{n} days", { n: p.lead })}</span> },
    {
      key: "po",
      header: t("Latest PO"),
      sort: (p) => p.latestPo,
      render: (p) => (
        <span className="k-cell-title">
          <b className={`num-inline${p.late ? " k-text-bad" : ""}`}>{d(p.latestPo)}</b>
          <small className="num-inline">{t("RFQ by {d}", { d: d(p.latestRfq, false) })}</small>
        </span>
      ),
    },
    { key: "float", header: t("Float to PO"), sort: (p) => (p.status === "ORDERED" || p.status === "DELIVERED" ? 999 : p.float), align: "right", render: floatCell },
    { key: "status", header: t("Status"), sort: (p) => PKG_PATH.indexOf(p.status), render: (p) => <Badge tone={p.late ? "bad" : PKG_STATUS[p.status].tone}>{t(PKG_STATUS[p.status].label)}</Badge> },
  ];

  return (
    <div className="k-page ppl-page">
      <PageHero
        eyebrow={t("Procurement · Plan")}
        title={t("Procurement schedule")}
        subtitle={t("Every package back-scheduled from the day the site needs it: when the PO must go out, when the RFQ must start, and how much float is left.")}
        flow={["Programme", "Required on site", "Lead time", "Latest PO", "Latest RFQ"]}
        art="calendar"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => navigate(R.newRequest)}>
              <Plus size={15} />
              {t("New request")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(R.programme())}>
              <CalendarClock size={15} />
              {t("Open the programme")}
            </button>
          </>
        }
      />

      <StatTiles
        items={[
          { label: t("Late to order"), value: kpi.late.length, sub: t("latest PO date has passed"), tone: kpi.late.length ? "bad" : "ok", icon: <AlertTriangle size={14} />, onClick: () => setFilter(filter === "late" ? null : "late") },
          { label: t("Due to order in 14 days"), value: kpi.due.length, sub: kpi.due[0] ? t("first PO must go out by {d}", { d: d(kpi.due[0].latestPo) }) : t("nothing due in the next two weeks"), tone: kpi.due.length ? "warn" : "neutral", icon: <Timer size={14} />, onClick: () => setFilter(filter === "due" ? null : "due") },
          { label: t("On order"), value: kpi.ordered.length, sub: t("{n} packages in total", { n: pkgs.length }), tone: "brand", icon: <ShoppingCart size={14} />, onClick: () => setFilter(filter === "ordered" ? null : "ordered") },
          { label: t("Delivered"), value: kpi.delivered.length, sub: t("in full on site"), tone: "ok", icon: <PackageCheck size={14} />, onClick: () => setFilter(filter === "delivered" ? null : "delivered") },
        ]}
      />

      <Panel
        title={t("Back-scheduled from the programme")}
        icon={<CalendarClock size={16} />}
        count={filtered.length}
        sub={t("Latest PO = required on site − lead time − {b} days buffer. Latest RFQ = latest PO − {r} days for quotes and approval.", { b: BUFFER_DAYS, r: RFQ_DAYS + APPROVAL_DAYS })}
        pad={false}
      >
        {filtered.length ? <ScheduleTimeline pkgs={filtered} picked={sel?.key ?? null} onPick={setPicked} /> : <p className="ppl-empty">{t("No packages in this view.")}</p>}
      </Panel>

      <div className="k-grid-main">
        <Register
          rows={rows}
          columns={columns}
          rowKey={(p) => p.key}
          onRowClick={(p) => setPicked(p.key)}
          rowClass={(p) => (p.key === sel?.key ? "ppl-row-on" : p.late ? "ppl-row-late" : undefined)}
          pageSize={15}
          toolbar={
            <Toolbar end={<SearchBox value={q} onChange={setQ} placeholder="Search packages, activities, refs" />}>
              <FilterChips<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "late", label: t("Late to order"), count: kpi.late.length },
                  { value: "due", label: t("Due in 14 days"), count: kpi.due.length },
                  { value: "open", label: t("Not ordered"), count: kpi.open.length },
                  { value: "ordered", label: t("On order"), count: kpi.ordered.length },
                  { value: "delivered", label: t("Delivered"), count: kpi.delivered.length },
                ]}
              />
            </Toolbar>
          }
          empty={t("No packages match.")}
        />
        {sel ? <PackageCard p={sel} onGo={() => go(sel)} /> : null}
      </div>
    </div>
  );
}

function PackageCard({ p, onGo }: { p: Pkg; onGo: () => void }) {
  const { t, x, d, rel, lang } = useL();
  const navigate = useNavigate();
  const n = nextStep(p);
  const Icon = n.icon;
  const ordered = p.status === "ORDERED" || p.status === "DELIVERED";
  const idx = PKG_PATH.indexOf(p.status);
  const ghostSlip = Math.max(0, diffDays(p.required, p.ifToday));
  const leadFrom = { submittal: "from the approved submittal", index: "from the price index", vendors: "vendor average for the trade" }[p.leadSource];
  const records = [...p.mrs.map((m) => ({ ref: m.ref, to: R.request(m.id) })), ...p.rfqs.map((r) => ({ ref: r.ref, to: R.rfq(r.id) })), ...p.pos.map((o) => ({ ref: o.ref, to: R.order(o.id) }))];

  return (
    <Panel
      className="ppl-card k-rise"
      title={x(p.name)}
      icon={<ClipboardList size={16} />}
      actions={p.cpm?.critical ? <Badge tone="bad">{t("Critical path")}</Badge> : null}
    >
      <div className="ppl-card-act">
        <span className="k-mono">{p.act.code}</span>
        <span className="truncate">{x(p.act.name)}</span>
      </div>
      <ol className="ppl-chain" aria-label={t("Package status")}>
        {PKG_PATH.slice(1).map((st, i) => (
          <li key={st} className={i + 1 < idx || (i + 1 === idx && st === "DELIVERED") ? "done" : i + 1 === idx ? "now" : undefined}>
            <i />
            <span>{t(PKG_STATUS[st].label)}</span>
          </li>
        ))}
      </ol>

      {p.late ? (
        <div className="k-callout k-tone-bad">
          <AlertTriangle size={16} />
          <span>{t("The latest PO date passed {n} days ago. Ordered today it is on site {d}, {m} days after the activity starts.", { n: -p.float, d: d(p.ifToday), m: ghostSlip })}</span>
        </div>
      ) : p.dueSoon ? (
        <div className="k-callout k-tone-warn">
          <Timer size={16} />
          <span>{t("Place the PO by {d} ({when}) to have it on site for {code}.", { d: d(p.latestPo), when: rel(p.latestPo), code: p.act.code })}</span>
        </div>
      ) : ordered && p.expectedAt ? (
        <div className={`k-callout k-tone-${p.expectedAt > p.required ? "bad" : "ok"}`}>
          <PackageCheck size={16} />
          <span>
            {p.status === "DELIVERED"
              ? t("Delivered. The site had it before {code} started.", { code: p.act.code })
              : p.expectedAt > p.required
                ? t("On order, but due {d}: after the activity starts.", { d: d(p.expectedAt) })
                : t("On order, due {d}: {n} days before the start.", { d: d(p.expectedAt), n: diffDays(p.expectedAt, p.required) })}
          </span>
        </div>
      ) : (
        <div className="k-callout k-tone-brand">
          <CalendarClock size={16} />
          <span>{t("{n} days of float before the PO must go out on {d}.", { n: p.float, d: d(p.latestPo) })}</span>
        </div>
      )}

      <KeyVals
        items={[
          { k: t("Required on site"), v: d(p.required) },
          { k: t("Latest PO"), v: <span className={p.late ? "k-text-bad" : undefined}>{d(p.latestPo)}</span> },
          { k: t("Latest RFQ"), v: d(p.latestRfq) },
          { k: t("Lead time"), v: `${t("{n} days", { n: p.lead })}` },
          { k: t("Lead from"), v: t(leadFrom) },
          { k: t("Allowances"), v: t("RFQ {r} d · approval {a} d", { r: RFQ_DAYS, a: APPROVAL_DAYS }) },
          { k: t("BOQ value"), v: <Money value={p.value} short /> },
          { k: t("Trade"), v: tradeName(p.trade, lang) },
          { k: t("If ordered today"), v: d(p.ifToday) },
        ]}
      />

      {records.length ? (
        <div className="ppl-records">
          <span className="muted small">{t("Records")}</span>
          {records.map((r) => (
            <button key={r.ref} type="button" className="k-ref ppl-ref-btn" onClick={() => navigate(r.to)}>
              {r.ref}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small">{t("Nothing raised for this package yet.")}</p>
      )}

      <div className="k-row ppl-card-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onGo}>
          <Icon size={14} />
          {t(n.label)}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.programme(p.act.id))}>
          {t("Open activity")}
          <ArrowRight size={14} />
        </button>
      </div>
    </Panel>
  );
}

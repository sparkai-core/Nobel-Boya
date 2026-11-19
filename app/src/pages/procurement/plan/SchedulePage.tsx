import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, CalendarPlus, CheckCircle2, ClipboardList, PackageCheck, Plus, Send, ShoppingCart, Timer } from "lucide-react";
import { Badge, Dialog, Empty, Field, FilterChips, KeyVals, Money, PageHero, Panel, Register, SearchBox, StatTiles, Toolbar, toast, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { R, tradeName } from "../../../ops/select";
import { pkgOverrides, usePkgPlan } from "../../../ops/ext/proc-client";
import { APPROVAL_DAYS, BUFFER_DAYS, buildPackages, isDated, PKG_PATH, PKG_STATUS, RFQ_DAYS, type Pkg } from "./shared";
import { ScheduleTimeline } from "./ScheduleTimeline";

type Filter = "late" | "due" | "open" | "ordered" | "delivered" | "undated";

/** The next step for a package and where it goes. */
function nextStep(p: Pkg): { label: string; to: string; icon: typeof Plus } {
  const mr = p.mrs[0];
  const rfq = p.rfqs[0];
  const po = [...p.pos].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
  if (po) return { label: "Open PO", to: R.order(po.id), icon: ShoppingCart };
  if (p.status === "QUOTED" && rfq) return { label: p.approvalPending ? "Open approval" : "Compare quotes", to: p.approvalId ? R.approval(p.approvalId) : R.compare(rfq.id), icon: CheckCircle2 };
  if (rfq) return { label: "Open RFQ", to: R.rfq(rfq.id), icon: Send };
  if (mr) return { label: "Start RFQ", to: R.newRfq(mr.id), icon: Send };
  return { label: "Raise MR", to: p.act ? `${R.newRequest}?activity=${p.act.id}` : R.newRequest, icon: Plus };
}

/**
 * Procurement schedule: the bridge from the programme to buying. One package per BOQ trade, back-scheduled
 * from the day the site needs it (the earliest activity that uses the materials, a request's needed-by date,
 * or a date the user sets).
 */
export function SchedulePage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const plan = usePkgPlan((p) => p.plan);
  const pkgs = useMemo(() => buildPackages(s, pkgOverrides(plan)), [s, plan]);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [dating, setDating] = useState<Pkg | null>(null);

  const kpi = useMemo(
    () => ({
      late: pkgs.filter((p) => p.late),
      due: pkgs.filter((p) => p.dueSoon).sort((a, b) => (a.latestPo ?? "").localeCompare(b.latestPo ?? "")),
      ordered: pkgs.filter((p) => p.status === "ORDERED"),
      delivered: pkgs.filter((p) => p.status === "DELIVERED"),
      open: pkgs.filter((p) => p.status !== "ORDERED" && p.status !== "DELIVERED"),
      undated: pkgs.filter((p) => !isDated(p)),
    }),
    [pkgs],
  );

  const filtered = useMemo(() => (filter ? kpi[filter] : pkgs), [filter, kpi, pkgs]);
  const rows = useSearch(filtered, q, (p) => [p.name, p.act?.code, p.act?.name, p.trade, ...p.mrs.map((m) => m.ref), ...p.rfqs.map((r) => r.ref), ...p.pos.map((o) => o.ref)]);
  const sel = pkgs.find((p) => p.key === picked) ?? kpi.late[0] ?? kpi.due[0] ?? pkgs[0] ?? null;
  const dated = filtered.filter(isDated);

  const go = (p: Pkg) => {
    const n = nextStep(p);
    if (n.label === "Raise MR" && p.act) toast(t("New request for {code}: lines come from the BOQ.", { code: p.act.code }), "brand");
    navigate(n.to);
  };

  const floatCell = (p: Pkg) => {
    if (p.status === "ORDERED" || p.status === "DELIVERED") return <span className="muted">{t("ordered")}</span>;
    if (p.float == null) return <span className="muted">—</span>;
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
            {t("{n} BOQ materials", { n: p.materials.length })} · <Money value={p.value} short />
          </small>
        </span>
      ),
    },
    {
      key: "act",
      header: t("Activity"),
      sort: (p) => p.act?.code ?? "",
      render: (p) =>
        p.act ? (
          <button
            type="button"
            className="k-link-btn k-mono"
            onClick={(e) => {
              e.stopPropagation();
              navigate(R.programme(p.act!.id));
            }}
          >
            {p.act.code}
          </button>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: "req",
      header: t("Required on site"),
      sort: (p) => p.required ?? "9999",
      render: (p) =>
        p.required ? (
          <b className="num-inline">{d(p.required)}</b>
        ) : (
          <button
            type="button"
            className="k-link-btn"
            onClick={(e) => {
              e.stopPropagation();
              setDating(p);
            }}
          >
            {t("Set date")}
          </button>
        ),
    },
    { key: "lead", header: t("Lead time"), hideBelow: 1280, sort: (p) => p.lead ?? -1, render: (p) => <span className="num-inline">{p.lead != null ? t("{n} days", { n: p.lead }) : "—"}</span> },
    {
      key: "po",
      header: t("Latest PO"),
      sort: (p) => p.latestPo ?? "9999",
      render: (p) =>
        p.latestPo && p.latestRfq ? (
          <span className="k-cell-title">
            <b className={`num-inline${p.late ? " k-text-bad" : ""}`}>{d(p.latestPo)}</b>
            <small className="num-inline">{t("RFQ by {d}", { d: d(p.latestRfq, false) })}</small>
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    { key: "float", header: t("Float to PO"), sort: (p) => (p.status === "ORDERED" || p.status === "DELIVERED" ? 999 : (p.float ?? 998)), align: "right", render: floatCell },
    { key: "status", header: t("Status"), sort: (p) => PKG_PATH.indexOf(p.status), render: (p) => <Badge tone={p.late ? "bad" : PKG_STATUS[p.status].tone}>{t(PKG_STATUS[p.status].label)}</Badge> },
  ];

  const hero = (
    <PageHero
      eyebrow={t("Procurement · Plan")}
      title={t("Procurement schedule")}
      subtitle={t("One package per BOQ trade, back-scheduled from the day the site needs it: when the PO must go out, when the RFQ must start, and how much float is left.")}
      flow={["Need date", "Lead time", "Latest PO", "Latest RFQ"]}
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
  );

  if (!pkgs.length) {
    return (
      <div className="k-page ppl-page">
        {hero}
        <Empty icon={<ClipboardList size={22} />} title={t("No packages to plan")}>
          {t("Packages come from the priced materials of the open project's BOQ. This project has none yet.")}
        </Empty>
      </div>
    );
  }

  return (
    <div className="k-page ppl-page">
      {hero}

      <StatTiles
        items={[
          { label: t("Late to order"), value: kpi.late.length, sub: t("latest PO date has passed"), tone: kpi.late.length ? "bad" : "ok", icon: <AlertTriangle size={14} />, onClick: () => setFilter(filter === "late" ? null : "late") },
          { label: t("Due to order in 14 days"), value: kpi.due.length, sub: kpi.due[0]?.latestPo ? t("first PO must go out by {d}", { d: d(kpi.due[0].latestPo) }) : t("nothing due in the next two weeks"), tone: kpi.due.length ? "warn" : "neutral", icon: <Timer size={14} />, onClick: () => setFilter(filter === "due" ? null : "due") },
          { label: t("On order"), value: kpi.ordered.length, sub: t("{n} packages in total", { n: pkgs.length }), tone: "brand", icon: <ShoppingCart size={14} />, onClick: () => setFilter(filter === "ordered" ? null : "ordered") },
          { label: t("Without dates"), value: kpi.undated.length, sub: t("need date or lead time not known"), tone: kpi.undated.length ? "warn" : "ok", icon: <CalendarPlus size={14} />, onClick: () => setFilter(filter === "undated" ? null : "undated") },
        ]}
      />

      <Panel
        title={t("Back-scheduled from the need date")}
        icon={<CalendarClock size={16} />}
        count={dated.length}
        sub={t("Latest PO = required on site − lead time − {b} days buffer. Latest RFQ = latest PO − {r} days for quotes and approval.", { b: BUFFER_DAYS, r: RFQ_DAYS + APPROVAL_DAYS })}
        pad={false}
      >
        {dated.length ? <ScheduleTimeline pkgs={dated} picked={sel?.key ?? null} onPick={setPicked} /> : <p className="ppl-empty">{t("No package in this view has both a need date and a lead time yet. Set them on a package to see it here.")}</p>}
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
                  { value: "undated", label: t("Without dates"), count: kpi.undated.length },
                ]}
              />
            </Toolbar>
          }
          empty={t("No packages match.")}
        />
        {sel ? <PackageCard p={sel} onGo={() => go(sel)} onDates={() => setDating(sel)} /> : null}
      </div>

      <DatesDialog p={dating} onClose={() => setDating(null)} />
    </div>
  );
}

function PackageCard({ p, onGo, onDates }: { p: Pkg; onGo: () => void; onDates: () => void }) {
  const { t, x, d, rel, lang } = useL();
  const navigate = useNavigate();
  const n = nextStep(p);
  const Icon = n.icon;
  const ordered = p.status === "ORDERED" || p.status === "DELIVERED";
  const idx = PKG_PATH.indexOf(p.status);
  const ghostSlip = p.required && p.ifToday ? Math.max(0, diffDays(p.required, p.ifToday)) : 0;
  const leadFrom = p.leadSource ? { submittal: "from the approved submittal", index: "from the price index", vendors: "delivery days recorded on the trade's vendors", user: "set by you" }[p.leadSource] : null;
  const needFrom = p.requiredFrom ? { user: "set by you", activity: "start of the earliest activity using these materials", request: "earliest needed-by date on a request" }[p.requiredFrom] : null;
  const records = [...p.mrs.map((m) => ({ ref: m.ref, to: R.request(m.id) })), ...p.rfqs.map((r) => ({ ref: r.ref, to: R.rfq(r.id) })), ...p.pos.map((o) => ({ ref: o.ref, to: R.order(o.id) }))];
  const what = p.act ? p.act.code : x(p.name);

  return (
    <Panel className="ppl-card k-rise" title={x(p.name)} icon={<ClipboardList size={16} />} actions={p.cpm?.critical ? <Badge tone="bad">{t("Critical path")}</Badge> : null}>
      {p.act ? (
        <div className="ppl-card-act">
          <span className="k-mono">{p.act.code}</span>
          <span className="truncate">{x(p.act.name)}</span>
        </div>
      ) : (
        <p className="muted small">{t("No programme activity uses these materials yet.")}</p>
      )}
      <ol className="ppl-chain" aria-label={t("Package status")}>
        {PKG_PATH.slice(1).map((st, i) => (
          <li key={st} className={i + 1 < idx || (i + 1 === idx && st === "DELIVERED") ? "done" : i + 1 === idx ? "now" : undefined}>
            <i />
            <span>{t(PKG_STATUS[st].label)}</span>
          </li>
        ))}
      </ol>

      {!p.required || p.lead == null ? (
        <div className="k-callout k-tone-brand">
          <CalendarPlus size={16} />
          <span>{!p.required ? t("Set the date the site needs these materials to plan when to order.") : t("Set the supplier lead time to plan when to order.")}</span>
        </div>
      ) : p.late && p.float != null && p.ifToday ? (
        <div className="k-callout k-tone-bad">
          <AlertTriangle size={16} />
          <span>{t("The latest PO date passed {n} days ago. Ordered today it is on site {d}, {m} days after it is needed.", { n: -p.float, d: d(p.ifToday), m: ghostSlip })}</span>
        </div>
      ) : p.dueSoon && p.latestPo ? (
        <div className="k-callout k-tone-warn">
          <Timer size={16} />
          <span>{t("Place the PO by {d} ({when}) to have it on site for {code}.", { d: d(p.latestPo), when: rel(p.latestPo), code: what })}</span>
        </div>
      ) : ordered && p.expectedAt ? (
        <div className={`k-callout k-tone-${p.expectedAt > p.required ? "bad" : "ok"}`}>
          <PackageCheck size={16} />
          <span>
            {p.status === "DELIVERED"
              ? t("Delivered in full.")
              : p.expectedAt > p.required
                ? t("On order, but due {d}: after it is needed.", { d: d(p.expectedAt) })
                : t("On order, due {d}: {n} days before it is needed.", { d: d(p.expectedAt), n: diffDays(p.expectedAt, p.required) })}
          </span>
        </div>
      ) : p.float != null && p.latestPo ? (
        <div className="k-callout k-tone-brand">
          <CalendarClock size={16} />
          <span>{t("{n} days of float before the PO must go out on {d}.", { n: p.float, d: d(p.latestPo) })}</span>
        </div>
      ) : null}

      <KeyVals
        items={[
          { k: t("Required on site"), v: p.required ? d(p.required) : "—" },
          { k: t("Need date from"), v: needFrom ? t(needFrom) : "—" },
          { k: t("Latest PO"), v: p.latestPo ? <span className={p.late ? "k-text-bad" : undefined}>{d(p.latestPo)}</span> : "—" },
          { k: t("Latest RFQ"), v: p.latestRfq ? d(p.latestRfq) : "—" },
          { k: t("Lead time"), v: p.lead != null ? t("{n} days", { n: p.lead }) : "—" },
          { k: t("Lead from"), v: leadFrom ? t(leadFrom) : "—" },
          { k: t("Allowances"), v: t("RFQ {r} d · approval {a} d", { r: RFQ_DAYS, a: APPROVAL_DAYS }) },
          { k: t("BOQ value"), v: <Money value={p.value} short /> },
          { k: t("Trade"), v: tradeName(p.trade, lang) },
          { k: t("If ordered today"), v: p.ifToday ? d(p.ifToday) : "—" },
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
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDates}>
          <CalendarPlus size={14} />
          {t("Set dates")}
        </button>
        {p.act ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.programme(p.act!.id))}>
            {t("Open activity")}
            <ArrowRight size={14} />
          </button>
        ) : null}
      </div>
    </Panel>
  );
}

/** The user sets (or clears) the need date and the lead time of a package. */
function DatesDialog({ p, onClose }: { p: Pkg | null; onClose: () => void }) {
  const { t, x } = useL();
  const plan = usePkgPlan((s) => s.plan);
  const setPlan = usePkgPlan((s) => s.setPlan);
  const [f, setF] = useState({ needBy: "", lead: "" });
  const [seen, setSeen] = useState<string | null>(null);
  if (p && seen !== p.key) {
    const cur = pkgOverrides(plan)(p.key);
    setSeen(p.key);
    setF({ needBy: cur.needBy ?? "", lead: cur.leadDays != null ? String(cur.leadDays) : "" });
  }
  if (!p && seen) setSeen(null);
  if (!p) return null;
  const lead = f.lead.trim() === "" ? null : Math.round(Number(f.lead));
  const badLead = lead != null && !(Number.isFinite(lead) && lead >= 0 && lead <= 730);
  const save = () => {
    if (badLead) return;
    setPlan(p.key, { needBy: f.needBy || null, leadDays: lead });
    toast(t("Dates saved for {p}.", { p: x(p.name) }));
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      kicker={x(p.name)}
      title={t("Set dates")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={badLead}>
            {t("Save")}
          </button>
        </>
      }
    >
      <p className="muted small">{t("Leave a field empty to use what the programme, requests or vendors say.")}</p>
      <div className="k-form">
        <Field label={t("Needed on site by")} hint={f.needBy && f.needBy < TODAY ? t("This date has passed.") : undefined}>
          <input className="input" type="date" value={f.needBy} onChange={(e) => setF((o) => ({ ...o, needBy: e.target.value }))} />
        </Field>
        <Field label={t("Supplier lead time, days")} error={badLead ? t("Enter a number of days.") : undefined}>
          <input className="input num" inputMode="numeric" value={f.lead} onChange={(e) => setF((o) => ({ ...o, lead: e.target.value }))} />
        </Field>
      </div>
    </Dialog>
  );
}

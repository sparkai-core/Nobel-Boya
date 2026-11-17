import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Eye, Pencil, Plus, Send } from "lucide-react";
import {
  Badge,
  FilterChips,
  FlowRail,
  Kebab,
  Money,
  PageHero,
  Register,
  SearchBox,
  StagePath,
  StatusBadge,
  toast,
  Toolbar,
  useL,
  useSearch,
  type Column,
} from "../../components/kit";
import { useOps } from "../../ops/store";
import { diffDays, TODAY } from "../../ops/dates";
import { budgetOf, PATHS, R, statusMeta, tradeName } from "../../ops/select";
import { buildingShort } from "../../lib/loc";
import type { MaterialRequest, Priority } from "../../ops/types";

const WEEKS = [
  { key: "late", label: "Overdue", from: -Infinity, to: -1 },
  { key: "w0", label: "This week", from: 0, to: 6 },
  { key: "w1", label: "In 1 week", from: 7, to: 13 },
  { key: "w2", label: "In 2 weeks", from: 14, to: 20 },
  { key: "w3", label: "In 3 weeks", from: 21, to: 27 },
  { key: "w4", label: "4 weeks or more", from: 28, to: Infinity },
];

/**
 * Material requests register. Reference list page for the ops modules:
 * hero → flow rail → signature visual (needed-by band) → stage path → register with toolbar.
 */
export function RequestsPage() {
  const { t, x, d, rel, lang } = useL();
  const navigate = useNavigate();
  const mrs = useOps((s) => s.mrs);
  const rfqs = useOps((s) => s.rfqs);
  const activities = useOps((s) => s.activities);
  const materials = useOps((s) => s.materials);
  const [stage, setStage] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const counts = useMemo(() => mrs.reduce<Record<string, number>>((a, m) => ((a[m.status] = (a[m.status] ?? 0) + 1), a), {}), [mrs]);
  const open = mrs.filter((m) => m.status === "SUBMITTED" || m.status === "SOURCING" || m.status === "DRAFT");
  const late = open.filter((m) => m.neededBy < TODAY);

  const filtered = useMemo(
    () => mrs.filter((m) => (!stage || m.status === stage) && (!priority || m.priority === priority) && (!building || m.building === building)),
    [mrs, stage, priority, building],
  );
  const rows = useSearch(filtered, q, (m) => [m.ref, m.title, m.requestedBy, m.trade, ...m.lines.map((l) => l.description)]);

  const rfqCount = (id: string) => rfqs.filter((r) => r.mrId === id).length;
  const act = (id: string | null) => (id ? activities.find((a) => a.id === id) : undefined);

  const columns: Column<MaterialRequest>[] = [
    {
      key: "req",
      header: t("Request"),
      sort: (m) => m.ref,
      render: (m) => (
        <div className="k-cell-title">
          <span className="k-row" style={{ gap: 8 }}>
            <span className="k-ref">{m.ref}</span>
            {m.priority === "URGENT" || m.priority === "HIGH" ? <Badge tone={statusMeta("priority", m.priority).tone}>{x(statusMeta("priority", m.priority).label)}</Badge> : null}
          </span>
          <strong>{x(m.title)}</strong>
          <small>
            {buildingShort(m.building, lang)} · {tradeName(m.trade, lang)} · {m.requestedBy}
          </small>
        </div>
      ),
    },
    {
      key: "items",
      header: t("Items"),
      align: "right",
      sort: (m) => budgetOf({ materials }, m.lines),
      hideBelow: 900,
      render: (m) => (
        <div className="k-cell-title" style={{ justifyItems: "end" }}>
          <strong className="num-inline">{t("{n} lines", { n: m.lines.length })}</strong>
          <small>
            ≈ <Money value={budgetOf({ materials }, m.lines)} short />
          </small>
        </div>
      ),
    },
    {
      key: "need",
      header: t("Needed by"),
      sort: (m) => m.neededBy,
      render: (m) => {
        const isLate = m.neededBy < TODAY && m.status !== "FULFILLED" && m.status !== "CANCELLED";
        return (
          <span className={`mr-need${isLate ? " late" : ""}`}>
            <b className="num-inline">{d(m.neededBy)}</b>
            <small>{m.status === "FULFILLED" ? t("fulfilled") : rel(m.neededBy)}</small>
          </span>
        );
      },
    },
    {
      key: "activity",
      header: t("For activity"),
      hideBelow: 1100,
      render: (m) => {
        const a = act(m.activityId);
        return a ? (
          <Link className="mr-activity" to={R.programme(a.id)} onClick={(e) => e.stopPropagation()} title={x(a.name)}>
            {a.code}
          </Link>
        ) : (
          <span className="muted">—</span>
        );
      },
    },
    {
      key: "stage",
      header: t("Stage"),
      sort: (m) => PATHS.mr.indexOf(m.status as (typeof PATHS.mr)[number]),
      render: (m) => (
        <span className="mr-row-stage">
          <StatusBadge kind="mr" status={m.status} />
          {rfqCount(m.id) ? <span className="mr-rfqs">{t("{n} RFQ", { n: rfqCount(m.id) })}</span> : null}
        </span>
      ),
    },
    {
      key: "act",
      header: "",
      align: "right",
      render: (m) => (
        <span className="mr-actions" onClick={(e) => e.stopPropagation()}>
          {m.status === "SUBMITTED" ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(R.newRfq(m.id))}>
              <Send size={13} />
              {t("Create RFQ")}
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.request(m.id))}>
              {t("Open")}
            </button>
          )}
          <Kebab
            items={[
              { label: t("Open"), icon: <Eye size={14} />, onClick: () => navigate(R.request(m.id)) },
              { label: t("Edit"), icon: <Pencil size={14} />, disabled: m.status !== "DRAFT" && m.status !== "SUBMITTED", onClick: () => navigate(`${R.request(m.id)}?edit=1`) },
              { label: t("Create another RFQ"), icon: <Send size={14} />, disabled: m.status === "DRAFT" || m.status === "CANCELLED", onClick: () => navigate(R.newRfq(m.id)) },
              {
                label: t("Copy reference"),
                icon: <Copy size={14} />,
                onClick: () => {
                  void navigator.clipboard?.writeText(m.ref);
                  toast(t("Reference copied"));
                },
              },
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Procurement · Material requests")}
        title={t("Material requests")}
        subtitle={t("What the site needs, by when, priced against the BOQ. Submitted requests go to sourcing as RFQs.")}
        flow={["Raise request", "Submit", "Send RFQ", "Fulfilled on delivery"]}
        art="request"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate(R.newRequest)}>
            <Plus size={15} />
            {t("New request")}
          </button>
        }
      />

      <FlowRail current="request" />

      <section className="mr-band" aria-label={t("When open requests are needed")}>
        <header className="mr-band-head">
          <h2>{t("When open requests are needed on site")}</h2>
          <p>
            {late.length ? (
              <>
                <b>{t("{n} overdue", { n: late.length })}</b> · {t("{n} open in total", { n: open.length })}
              </>
            ) : (
              t("{n} open, none overdue", { n: open.length })
            )}
          </p>
        </header>
        <div className="mr-weeks">
          {WEEKS.map((w) => {
            const inWeek = open.filter((m) => {
              const n = diffDays(TODAY, m.neededBy);
              return n >= w.from && n <= w.to;
            });
            return (
              <div key={w.key} className="mr-week">
                <div className="mr-week-label">
                  <span>{t(w.label)}</span>
                  <b>{inWeek.length}</b>
                </div>
                <div className="mr-marks">
                  {inWeek.map((m, i) => (
                    <button key={m.id} type="button" className={`mr-mark p-${m.priority}`} style={{ animationDelay: `${i * 40}ms` }} title={`${x(m.title)} · ${d(m.neededBy)}`} onClick={() => navigate(R.request(m.id))}>
                      <i aria-hidden="true" />
                      {m.ref}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mr-key">
          <span>
            <i style={{ background: "var(--redline)" }} />
            {t("Urgent")}
          </span>
          <span>
            <i style={{ background: "var(--amber)" }} />
            {t("High")}
          </span>
          <span>
            <i style={{ background: "var(--stamp)" }} />
            {t("Medium or low")}
          </span>
        </div>
      </section>

      <StagePath kind="mr" path={PATHS.mr} counts={counts} value={stage} onChange={setStage} extras={["CANCELLED"]} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(m) => m.id}
        onRowClick={(m) => navigate(R.request(m.id))}
        initialSort={{ key: "need", dir: "asc" }}
        toolbar={
          <Toolbar
            end={
              <FilterChips
                value={building}
                onChange={setBuilding}
                options={["WH", "AD", "PS", "SITE"].map((b) => ({ value: b, label: buildingShort(b, lang), count: mrs.filter((m) => m.building === b).length }))}
              />
            }
          >
            <SearchBox value={q} onChange={setQ} placeholder="Search requests, materials, people" />
            <FilterChips
              value={priority}
              onChange={setPriority}
              options={(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((p) => ({ value: p, label: x(statusMeta("priority", p).label), count: mrs.filter((m) => m.priority === p).length }))}
            />
          </Toolbar>
        }
        empty={
          <>
            {t("No requests match.")}{" "}
            <button type="button" className="k-link-btn" onClick={() => { setStage(null); setPriority(null); setBuilding(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </>
        }
      />
    </div>
  );
}

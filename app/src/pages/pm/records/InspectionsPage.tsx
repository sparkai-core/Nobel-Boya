import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardCheck, Plus, ShieldAlert } from "lucide-react";
import {
  Avatar,
  Empty,
  FilterChips,
  PageHero,
  Register,
  RingGauge,
  SearchBox,
  StatusBadge,
  TabBar,
  Toolbar,
  useL,
  useSearch,
  type Column,
} from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, toDate, TODAY } from "../../../ops/dates";
import { R, statusMeta } from "../../../ops/select";
import type { Inspection, InspectionKind, InspectionStatus } from "../../../ops/types";
import { InspectionDialog, KIND_LABEL } from "./InspectionDialog";

type Tab = "ALL" | InspectionKind;
const BACK = 27;
const AHEAD = 7;
const passed = (i: Inspection) => i.status === "PASSED" || i.status === "PASSED_WITH_COMMENTS";

/**
 * Inspections and quality: work (WIR) and material (MIR) inspections and non-conformances (NCR).
 * Signature: pass-rate ring, a four-week inspection calendar and the open NCRs in red.
 */
export function InspectionsPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const inspections = useOps((s) => s.inspections);
  const activities = useOps((s) => s.activities);
  const [tab, setTab] = useState<Tab>("ALL");
  const [status, setStatus] = useState<InspectionStatus | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const inTab = useMemo(() => inspections.filter((i) => tab === "ALL" || i.kind === tab), [inspections, tab]);
  const filtered = useMemo(() => inTab.filter((i) => !status || i.status === status), [inTab, status]);
  const rows = useSearch(filtered, q, (i) => [i.ref, i.title, i.location, i.inspector, i.notes]);
  const statuses = [...new Set(inTab.map((i) => i.status))];

  const checked = inspections.filter((i) => i.kind !== "NCR" && i.inspectedAt);
  const rate = checked.length ? Math.round((checked.filter(passed).length / checked.length) * 100) : null;
  const openNcrs = inspections.filter((i) => i.kind === "NCR" && i.status === "OPEN");
  const act = (id: string | null) => (id ? activities.find((a) => a.id === id) : undefined);

  const columns: Column<Inspection>[] = [
    {
      key: "ref",
      header: t("Inspection"),
      sort: (i) => i.ref,
      render: (i) => (
        <div className="k-cell-title">
          <span className="k-row" style={{ gap: 6 }}>
            <span className="k-ref">{i.ref}</span>
            <span className={`pmr-kind pmr-kind-${i.kind}`}>{i.kind}</span>
          </span>
          <strong>{x(i.title)}</strong>
          <small>{x(i.location)}</small>
        </div>
      ),
    },
    {
      key: "link",
      header: t("Activity / order"),
      hideBelow: 1100,
      render: (i) => {
        const a = act(i.activityId);
        return (
          <span className="pmr-links" onClick={(e) => e.stopPropagation()}>
            {a ? (
              <Link to={R.programme(a.id)} title={x(a.name)}>
                {a.code}
              </Link>
            ) : null}
            {i.poId ? <Link to={R.order(i.poId)}>{i.poId}</Link> : null}
            {!a && !i.poId ? <span className="muted">—</span> : null}
          </span>
        );
      },
    },
    { key: "req", header: t("Date"), sort: (i) => i.inspectedAt ?? i.requestedAt, render: (i) => (
      <span className="pmr-due">
        <b className="num-inline">{d(i.inspectedAt ?? i.requestedAt)}</b>
        <small>{i.inspectedAt ? t("inspected") : i.requestedAt > TODAY ? t("booked") : t("requested")}</small>
      </span>
    ) },
    {
      key: "insp",
      header: t("Inspector"),
      sort: (i) => i.inspector,
      hideBelow: 900,
      render: (i) => (
        <span className="pmr-person">
          <Avatar name={i.inspector} size={24} />
          <span className="truncate">{i.inspector}</span>
        </span>
      ),
    },
    { key: "status", header: t("Result"), sort: (i) => i.status, render: (i) => <StatusBadge kind="inspection" status={i.status} /> },
  ];

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · Inspections")}
        title={t("Inspections and quality")}
        subtitle={t("Work and material inspections with their checklists, and the non-conformances raised when something fails.")}
        flow={["Request", "Inspect", "Pass, or raise an NCR", "Close the NCR"]}
        art="inspection"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            {t("Request inspection")}
          </button>
        }
      />

      {!inspections.length ? (
        <Empty
          icon={<ClipboardCheck size={22} />}
          title={t("No inspections yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              {t("Request inspection")}
            </button>
          }
        >
          {t("Request work (WIR) and material (MIR) inspections with a checklist, record the result, and raise a non-conformance (NCR) when something fails.")}
        </Empty>
      ) : (
        <>
      <section className="pmr-qa" aria-label={t("Quality at a glance")}>
        <div className="pmr-qa-ring">
          {rate == null ? (
            <div className="k-ring" style={{ width: 124, height: 124, display: "grid", placeItems: "center", textAlign: "center" }}>
              <span className="muted small">
                <b style={{ fontSize: 28, display: "block" }}>—</b>
                {t("no results yet")}
              </span>
            </div>
          ) : (
            <RingGauge value={rate} size={124} stroke={11} tone={rate >= 85 ? "ok" : rate >= 70 ? "warn" : "bad"} label={t("pass rate")} />
          )}
          <ul>
            <li>
              <i className="ok" />
              {t("Passed")} <b className="num-inline">{checked.filter((i) => i.status === "PASSED").length}</b>
            </li>
            <li>
              <i className="warn" />
              {t("With comments")} <b className="num-inline">{checked.filter((i) => i.status === "PASSED_WITH_COMMENTS").length}</b>
            </li>
            <li>
              <i className="bad" />
              {t("Failed")} <b className="num-inline">{checked.filter((i) => i.status === "FAILED").length}</b>
            </li>
          </ul>
        </div>
        <InspectionCalendar inspections={inspections} onOpen={(id) => navigate(R.inspection(id))} />
        <div className="pmr-ncrs">
          <h3>
            <ShieldAlert size={15} />
            {t("Open NCRs")}
            <span className="k-count">{openNcrs.length}</span>
          </h3>
          {openNcrs.length ? (
            openNcrs.map((n, i) => (
              <Link key={n.id} to={R.inspection(n.id)} className="pmr-ncr" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="pmr-ncr-top">
                  <span className="k-ref">{n.ref}</span>
                  <b>{t("{n} days open", { n: diffDays(n.requestedAt, TODAY) })}</b>
                </span>
                <strong>{x(n.title)}</strong>
                <small>{x(n.location)}</small>
                <span className="pmr-ncr-go">
                  {t("Fix and close")} <ArrowRight size={12} />
                </span>
              </Link>
            ))
          ) : (
            <p className="pmr-ncr-none">{t("No open non-conformances.")}</p>
          )}
        </div>
      </section>

      <TabBar<Tab>
        value={tab}
        onChange={(v) => {
          setTab(v);
          setStatus(null);
        }}
        tabs={[
          { value: "ALL", label: t("All"), count: inspections.length },
          ...(["WIR", "MIR", "NCR"] as InspectionKind[]).map((k) => ({ value: k as Tab, label: `${k} · ${t(KIND_LABEL[k])}`, count: inspections.filter((i) => i.kind === k).length })),
        ]}
      />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(i) => i.id}
        onRowClick={(i) => navigate(R.inspection(i.id))}
        initialSort={{ key: "req", dir: "desc" }}
        rowClass={(i) => (i.status === "FAILED" || (i.kind === "NCR" && i.status === "OPEN") ? "pmr-row-late" : undefined)}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search inspections, places, people" />
            <FilterChips value={status} onChange={setStatus} options={statuses.map((s) => ({ value: s, label: x(statusMeta("inspection", s).label), count: inTab.filter((i) => i.status === s).length }))} />
          </Toolbar>
        }
        empty={
          <>
            {t("No inspections match.")}{" "}
            <button type="button" className="k-link-btn" onClick={() => { setStatus(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </>
        }
      />
        </>
      )}

      <InspectionDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          navigate(R.inspection(id));
        }}
      />
    </div>
  );
}

/** Four weeks back and one ahead: one column per day, a dot per inspection coloured by its result. */
function InspectionCalendar({ inspections, onOpen }: { inspections: Inspection[]; onOpen: (id: string) => void }) {
  const { t, x, d } = useL();
  const from = addDays(TODAY, -BACK);
  const days = Array.from({ length: BACK + AHEAD + 1 }, (_, i) => addDays(from, i));
  const byDay = new Map<string, Inspection[]>();
  for (const i of inspections) {
    const day = i.inspectedAt ?? i.requestedAt;
    if (day < from || day > days[days.length - 1]!) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), i]);
  }
  const tone = (i: Inspection) => (i.status === "REQUESTED" ? "req" : i.status === "OPEN" || i.status === "FAILED" ? "bad" : i.status === "PASSED_WITH_COMMENTS" ? "warn" : "ok");
  return (
    <div className="pmr-cal">
      <div className="pmr-cal-head">
        <h3>{t("Inspection calendar")}</h3>
        <div className="pmr-cal-key">
          <span>
            <i className="ok" />
            {t("Passed")}
          </span>
          <span>
            <i className="warn" />
            {t("Comments")}
          </span>
          <span>
            <i className="bad" />
            {t("Failed / NCR")}
          </span>
          <span>
            <i className="req" />
            {t("Booked")}
          </span>
        </div>
      </div>
      <div className="pmr-cal-scroll">
        <div className="pmr-cal-grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(14px, 1fr))` }}>
          {days.map((day) => {
            const list = byDay.get(day) ?? [];
            const dow = toDate(day).getUTCDay();
            return (
              <div key={day} className={`pmr-cal-day${day === TODAY ? " today" : ""}${day > TODAY ? " ahead" : ""}${dow === 1 ? " mon" : ""}${dow === 0 ? " sun" : ""}`} title={d(day)}>
                <div className="pmr-cal-stack">
                  {list.map((i) => (
                    <button key={i.id} type="button" className={`pmr-cal-dot ${tone(i)}${i.kind === "NCR" ? " ncr" : ""}`} title={`${i.ref} · ${x(i.title)} · ${x(statusMeta("inspection", i.status).label)}`} onClick={() => onOpen(i.id)} aria-label={i.ref} />
                  ))}
                </div>
                <span className="pmr-cal-lbl">{dow === 1 || day === TODAY ? (day === TODAY ? t("Today") : d(day, false)) : ""}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="muted small">
        {t("{n} inspections in the last four weeks. Squares are NCRs; the shaded week is still to come.", { n: [...byDay.entries()].filter(([k]) => k <= TODAY).reduce((a, [, v]) => a + v.length, 0) })}
      </p>
    </div>
  );
}

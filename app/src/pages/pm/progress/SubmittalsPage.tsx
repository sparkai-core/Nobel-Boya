import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileCheck2, Plane, Plus } from "lucide-react";
import { Avatar, CountUp, FilterChips, PageHero, Panel, Register, SearchBox, StatTiles, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import type { Submittal } from "../../../ops/types";
import { Runway } from "./Runway";
import { SubmittalDialog } from "./SubmittalDialog";
import { RP, SubBadge, SubStagePath, subApproved, subDates } from "./shared";

type Chip = "late" | "soon" | "ready";

/** Submittal register: what has to be approved before it can be ordered, and how much runway is left. */
export function SubmittalsPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const submittals = useOps((s) => s.submittals);
  const activities = useOps((s) => s.activities);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [chip, setChip] = useState<Chip | null>(null);
  const [creating, setCreating] = useState(false);

  const withDates = useMemo(() => submittals.map((s) => ({ s, ...subDates(s, activities) })), [submittals, activities]);
  const dateOf = (s: Submittal) => withDates.find((r) => r.s.id === s.id)!;
  const counts = useMemo(() => submittals.reduce<Record<string, number>>((m, s) => ({ ...m, [s.status]: (m[s.status] ?? 0) + 1 }), {}), [submittals]);
  const late = withDates.filter((r) => r.late);
  const soon = withDates.filter((r) => !subApproved(r.s) && !r.late && r.daysToDue <= 21);
  const ready = withDates.filter((r) => subApproved(r.s) && !r.s.mrId);
  const inReview = submittals.filter((s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW").length;

  const filtered = useMemo(() => {
    let rows = submittals;
    if (stage) rows = rows.filter((s) => s.status === stage);
    if (chip === "late") rows = rows.filter((s) => late.some((r) => r.s.id === s.id));
    if (chip === "soon") rows = rows.filter((s) => soon.some((r) => r.s.id === s.id));
    if (chip === "ready") rows = rows.filter((s) => ready.some((r) => r.s.id === s.id));
    return rows;
  }, [submittals, stage, chip, late, soon, ready]);
  const rows = useSearch(filtered, q, (s) => [s.ref, s.title, s.spec, s.manufacturer, s.reviewer, activities.find((a) => a.id === s.activityId)?.code]);
  const runwayRows = useMemo(() => {
    const due = new Map(withDates.map((r) => [r.s.id, r.finalDue]));
    return [...rows].sort((a, b) => (due.get(a.id) ?? "").localeCompare(due.get(b.id) ?? ""));
  }, [rows, withDates]);

  const columns: Column<Submittal>[] = [
    { key: "ref", header: t("Ref"), render: (s) => <span className="k-ref">{s.ref}</span>, sort: (s) => s.ref, width: "96px" },
    {
      key: "title",
      header: t("Title"),
      render: (s) => (
        <span className="k-cell-title">
          <strong>{x(s.title)}</strong>
          <small className="muted">{dateOf(s).act?.code ?? "—"}</small>
        </span>
      ),
      sort: (s) => x(s.title),
    },
    { key: "spec", header: t("Spec section"), render: (s) => <span className="k-mono small">{s.spec}</span>, sort: (s) => s.spec, hideBelow: 1100 },
    { key: "maker", header: t("Manufacturer"), render: (s) => <span className="small">{s.manufacturer}</span>, sort: (s) => s.manufacturer, hideBelow: 1100 },
    { key: "rev", header: t("Rev"), render: (s) => <span className="num-inline">{s.rev}</span>, sort: (s) => s.rev, align: "center", width: "52px" },
    { key: "submit", header: t("Submit by"), render: (s) => <span className="num-inline">{d(s.submitBy, false)}</span>, sort: (s) => s.submitBy, hideBelow: 900 },
    { key: "site", header: t("Required on site"), render: (s) => <span className="num-inline">{d(dateOf(s).required, false)}</span>, sort: (s) => dateOf(s).required, hideBelow: 900 },
    { key: "lead", header: t("Lead"), render: (s) => <span className="num-inline">{t("{n} d", { n: s.leadDays })}</span>, sort: (s) => s.leadDays, align: "right", hideBelow: 1100 },
    {
      key: "due",
      header: t("Final due"),
      render: (s) => {
        const r = dateOf(s);
        return (
          <span className={`pg-due num-inline${r.late ? " late" : !subApproved(s) && r.daysToDue <= 14 ? " soon" : ""}`}>
            <b>{d(r.finalDue, false)}</b>
            <small>{subApproved(s) ? t("approved") : r.late ? t("{n} d late", { n: -r.daysToDue }) : t("{n} d left", { n: r.daysToDue })}</small>
          </span>
        );
      },
      sort: (s) => dateOf(s).finalDue,
    },
    { key: "status", header: t("Status"), render: (s) => <SubBadge status={s.status} />, sort: (s) => s.status },
    {
      key: "reviewer",
      header: t("Reviewer"),
      render: (s) => (
        <span className="pg-person">
          <Avatar name={s.reviewer} size={20} />
          <span className="truncate">{s.reviewer}</span>
        </span>
      ),
      sort: (s) => s.reviewer,
      hideBelow: 1100,
    },
  ];

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · Submittals")}
        title={t("Submittals")}
        subtitle={t("Shop drawings, samples and data sheets that must be approved before the material can be ordered in time.")}
        flow={["Prepare", "Submit", "Review", "Approve", "Order"]}
        art="approve"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            {t("New submittal")}
          </button>
        }
      />

      <StatTiles
        items={[
          { label: t("Open"), value: <CountUp value={submittals.filter((s) => !subApproved(s)).length} />, sub: t("not approved yet") },
          { label: t("With the reviewer"), value: <CountUp value={inReview} />, sub: t("submitted or under review"), tone: "warn", onClick: () => setStage("UNDER_REVIEW") },
          { label: t("Past final due"), value: <CountUp value={late.length} />, sub: t("the material will arrive late"), tone: late.length ? "bad" : "ok", onClick: () => setChip("late") },
          { label: t("Ready for procurement"), value: <CountUp value={ready.length} />, sub: t("approved, no request raised"), tone: ready.length ? "brand" : "neutral", onClick: () => setChip("ready") },
        ]}
      />

      <Panel title={t("Submittal runway")} icon={<Plane size={15} />} sub={t("Each bar runs from the submit-by date to the final due date (approve by then) and on to the day the material is needed on site.")} pad={false}>
        {runwayRows.length ? <Runway items={runwayRows} activities={activities} /> : <p className="pg-empty">{t("No submittals match these filters.")}</p>}
      </Panel>

      <SubStagePath counts={counts} value={stage} onChange={setStage} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        onRowClick={(s) => navigate(RP.submittal(s.id))}
        rowClass={(s) => (dateOf(s).late ? "pg-row-late" : undefined)}
        initialSort={{ key: "due", dir: "asc" }}
        toolbar={
          <Toolbar end={<SearchBox value={q} onChange={setQ} placeholder="Search submittals" />}>
            <FilterChips<Chip>
              value={chip}
              onChange={setChip}
              options={[
                { value: "late", label: t("Past final due"), count: late.length },
                { value: "soon", label: t("Due in 3 weeks"), count: soon.length },
                { value: "ready", label: t("Ready for procurement"), count: ready.length },
              ]}
            />
          </Toolbar>
        }
        empty={
          <span className="pg-empty-inline">
            <FileCheck2 size={16} /> {t("No submittals match these filters.")}
          </span>
        }
      />

      <SubmittalDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          navigate(RP.submittal(id));
        }}
      />
    </div>
  );
}

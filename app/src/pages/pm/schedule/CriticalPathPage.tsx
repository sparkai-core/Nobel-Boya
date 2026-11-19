import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, GitBranch, Plus, Route, Upload } from "lucide-react";
import { Badge, Empty, GanttCore, PageHero, Register, useL, type Column, type GanttBar, type GanttRow } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useMedia } from "../../../lib/useMedia";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, maxDate, PROJECT_START, TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import type { Activity } from "../../../ops/types";
import { dateOf, useSchedule } from "./model";
import { ProjectRunStrip } from "./ProjectRunStrip";

type Mode = "critical" | "near" | "all";

/**
 * Critical path: the chain of activities that decides the finish, drawn on a CPM Gantt with float
 * tails, the calculated vs contract finish, the full early/late table and the chain in words.
 */
export function CriticalPathPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const { activities, links, cp, outlook, byId } = useSchedule();
  const rfis = useOps((s) => s.rfis);
  const delays = useOps((s) => s.delays);
  const wide = useMedia("(min-width: 760px)");
  const [mode, setMode] = useState<Mode>("critical");

  const live = activities.filter((a) => a.status !== "COMPLETED");
  const crit = (a: Activity) => !!cp.get(a.id)?.critical && a.status !== "COMPLETED";
  const near = (a: Activity) => !!cp.get(a.id)?.near && a.status !== "COMPLETED";
  const list = useMemo(
    () =>
      activities
        .filter((a) => (mode === "critical" ? cp.get(a.id)?.critical : mode === "near" ? cp.get(a.id)?.critical || cp.get(a.id)?.near : true))
        .sort((a, b) => (cp.get(a.id)?.es ?? 0) - (cp.get(b.id)?.es ?? 0) || a.code.localeCompare(b.code)),
    [activities, cp, mode],
  );

  // The chain in order: start from the earliest critical activity and follow critical links.
  const chain = useMemo(() => {
    const critIds = new Set(activities.filter((a) => cp.get(a.id)?.critical).map((a) => a.id));
    const hasCritPred = new Set(links.filter((l) => critIds.has(l.from) && critIds.has(l.to)).map((l) => l.to));
    const starts = [...critIds].filter((id) => !hasCritPred.has(id));
    const head = starts.map((id) => byId.get(id)!).sort((a, b) => (cp.get(a.id)?.es ?? 0) - (cp.get(b.id)?.es ?? 0))[0];
    const out: Activity[] = [];
    const seen = new Set<string>();
    let cur: Activity | undefined = head;
    while (cur && !seen.has(cur.id)) {
      out.push(cur);
      seen.add(cur.id);
      const next = links
        .filter((l) => l.from === cur!.id && critIds.has(l.to))
        .map((l) => byId.get(l.to)!)
        .sort((a, b) => (cp.get(a.id)?.es ?? 0) - (cp.get(b.id)?.es ?? 0))[0];
      cur = next;
    }
    return out;
  }, [activities, links, cp, byId]);

  const driver = chain.find((a) => a.status === "BLOCKED") ?? chain.find((a) => a.status !== "COMPLETED" && delays.some((dl) => dl.activityId === a.id && (dl.status === "OPEN" || dl.status === "CONFIRMED"))) ?? chain.find((a) => a.status !== "COMPLETED");
  const driverRfi = driver ? rfis.find((r) => r.activityId === driver.id && r.status === "OPEN") : undefined;

  const rows: GanttRow[] = useMemo(() => {
    const out: GanttRow[] = list.map((a) => {
      const c = cp.get(a.id)!;
      const tone = a.status === "COMPLETED" ? "ok" : c.critical ? "bad" : c.near ? "warn" : "brand";
      const bars: GanttBar[] = [{ kind: "baseline", start: a.bStart, end: a.bEnd }];
      if (c.tf > 0 && a.status !== "COMPLETED") bars.push({ kind: "ghost", start: a.end, end: dateOf(c.ef + c.tf), label: t("{n} days float", { n: c.tf }) });
      bars.push({ kind: "current", start: a.start, end: a.end, pct: a.pct, tone, label: `${a.code} · ${d(a.start)} – ${d(a.end)}` });
      return {
        id: a.id,
        critical: c.critical && a.status !== "COMPLETED",
        label: (
          <>
            <span className="pms-code">{a.code}</span> {x(a.name)}
          </>
        ),
        bars,
        cells: wide ? [<span key="f" className={c.tf <= 0 ? "k-text-bad" : c.tf <= 10 ? "k-text-warn" : undefined}>{c.tf}d</span>] : undefined,
      };
    });
    out.push({ id: "f:calc", group: true, label: t("Calculated finish"), bars: [], milestones: [{ date: outlook.calculated, filled: true, tone: outlook.contractKnown ? (outlook.calculated > outlook.contract ? "bad" : "ok") : "brand", title: d(outlook.calculated) }], cells: wide ? [<span key="c">{d(outlook.calculated, false)}</span>] : undefined });
    if (outlook.contractKnown) out.push({ id: "f:contract", group: true, label: t("Contract finish"), bars: [], milestones: [{ date: outlook.contract, filled: false, tone: "neutral", title: d(outlook.contract) }], cells: wide ? [<span key="c">{d(outlook.contract, false)}</span>] : undefined });
    return out;
  }, [list, cp, outlook, wide, t, x, d]);

  const glinks = useMemo(() => {
    const shown = new Set(list.map((a) => a.id));
    return links.filter((l) => shown.has(l.from) && shown.has(l.to)).map((l) => ({ from: l.from, to: l.to, critical: !!cp.get(l.from)?.critical && !!cp.get(l.to)?.critical }));
  }, [list, links, cp]);

  const columns: Column<Activity>[] = [
    {
      key: "act",
      header: t("Activity"),
      sort: (a) => a.code,
      render: (a) => (
        <div className="k-cell-title">
          <span className="pms-code">{a.code}</span>
          <strong>{x(a.name)}</strong>
        </div>
      ),
    },
    {
      key: "state",
      header: t("State"),
      sort: (a) => cp.get(a.id)?.tf ?? 0,
      render: (a) => {
        const c = cp.get(a.id);
        if (a.status === "COMPLETED") return <Badge tone="ok">{t("Done")}</Badge>;
        return c?.critical ? <Badge tone="bad">{t("Critical")}</Badge> : c?.near ? <Badge tone="warn">{t("Near-critical")}</Badge> : <Badge tone="neutral">{t("Has float")}</Badge>;
      },
    },
    { key: "es", header: t("Earliest start"), sort: (a) => cp.get(a.id)?.es ?? 0, hideBelow: 900, render: (a) => <span className="num-inline">{d(dateOf(cp.get(a.id)?.es ?? 0), false)}</span> },
    { key: "ef", header: t("Earliest finish"), sort: (a) => cp.get(a.id)?.ef ?? 0, render: (a) => <span className="num-inline">{d(dateOf(cp.get(a.id)?.ef ?? 0), false)}</span> },
    { key: "ls", header: t("Latest start"), sort: (a) => cp.get(a.id)?.ls ?? 0, hideBelow: 1100, render: (a) => <span className="num-inline">{d(dateOf(cp.get(a.id)?.ls ?? 0), false)}</span> },
    { key: "lf", header: t("Latest finish"), sort: (a) => cp.get(a.id)?.lf ?? 0, hideBelow: 900, render: (a) => <span className="num-inline">{d(dateOf(cp.get(a.id)?.lf ?? 0), false)}</span> },
    {
      key: "tf",
      header: t("Total float"),
      align: "right",
      sort: (a) => cp.get(a.id)?.tf ?? 0,
      render: (a) => {
        const v = cp.get(a.id)?.tf ?? 0;
        return <b className={`num-inline ${v <= 0 ? "k-text-bad" : v <= 10 ? "k-text-warn" : ""}`}>{t("{n} d", { n: v })}</b>;
      },
    },
    { key: "ff", header: t("Free float"), align: "right", sort: (a) => cp.get(a.id)?.ff ?? 0, hideBelow: 900, render: (a) => <span className="num-inline">{t("{n} d", { n: cp.get(a.id)?.ff ?? 0 })}</span> },
  ];

  const from = addDays(PROJECT_START, -5);
  const to = addDays(maxDate(outlook.calculated, outlook.contract), 20);
  const late = outlook.contractKnown && outlook.calculated > outlook.contract;

  return (
    <div className="k-page pms">
      <PageHero
        eyebrow={t("Project management · Critical path")}
        title={t("Critical path")}
        subtitle={t("The chain of activities with no float. Any day lost on it moves the handover date.")}
        flow={["Forward pass", "Backward pass", "Float", "Driving chain"]}
        art="critical"
        actions={
          <Link to={R.recovery} className="btn btn-ghost">
            <Route size={15} />
            {t("Recovery options")}
          </Link>
        }
      />

      <ProjectRunStrip />

      {!activities.length ? (
        <div className="k-panel">
          <Empty
            icon={<GitBranch size={20} />}
            title={t("No programme yet")}
            action={
              <div className="pms-empty-actions">
                <button type="button" className="btn btn-primary" onClick={() => navigate(`${R.planning("activities")}?import=1`)}>
                  <Upload size={15} /> {t("Import a P6 / MS Project file")}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate(`${R.planning("activities")}?add=1`)}>
                  <Plus size={15} /> {t("Add an activity")}
                </button>
              </div>
            }
          >
            {t("The critical path is worked out from the activities and their links once there is a programme.")}
          </Empty>
        </div>
      ) : (
      <>
      {driver ? (
        <div className={`pms-chain k-callout ${late ? "k-tone-bad" : "k-tone-brand"}`}>
          <GitBranch size={17} />
          <div>
            <p className="pms-chain-lead">
              {t("The finish is driven by {name} ({code})", { name: x(driver.name).toLowerCase(), code: driver.code })}
              {driverRfi ? t(", held up by {ref}", { ref: driverRfi.ref }) : driver.status === "BLOCKED" ? t(", which is blocked") : ""}.{" "}
              {late ? t("The chain finishes {date}, {n} days after the contract date.", { date: d(outlook.calculated), n: diffDays(outlook.contract, outlook.calculated) }) : outlook.contractKnown ? t("The chain finishes {date}, within the contract date.", { date: d(outlook.calculated) }) : t("The chain finishes {date}.", { date: d(outlook.calculated) })}
            </p>
            <ol className="pms-chain-steps">
              {chain.map((a, i) => (
                <li key={a.id}>
                  {i ? <ArrowRight size={12} aria-hidden="true" /> : null}
                  <button type="button" className={a.id === driver.id ? "drv" : a.status === "COMPLETED" ? "done" : undefined} onClick={() => navigate(R.programme(a.id))} title={x(a.name)}>
                    {a.code}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      <section className="pms-gantt-wrap">
        <div className="pms-toolbar">
          <div className="pms-toolbar-row">
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              label={t("Show")}
              options={[
                { value: "critical", label: t("Critical"), count: live.filter(crit).length },
                { value: "near", label: t("Near-critical"), count: live.filter((a) => crit(a) || near(a)).length },
                { value: "all", label: t("All"), count: activities.length },
              ]}
            />
            <p className="muted small">{t("Thin dashed tails show how far each activity can slip before it moves the finish.")}</p>
          </div>
        </div>
        <div className="pms-gantt pms-cpm">
          <GanttCore rows={rows} from={from} to={to} zoom={wide ? "month" : "quarter"} today={TODAY} links={glinks} onRowClick={(id) => !id.startsWith("f:") && navigate(R.programme(id))} labelWidth={wide ? 380 : 190} rowHeight={34} height={560} cellHeaders={wide ? [t("Float")] : []} markers={outlook.contractKnown ? [{ date: outlook.contract, label: t("Contract finish"), tone: "bad" }] : []} />
        </div>
        <div className="pms-legend">
          <span className="lg-crit">{t("Critical")}</span>
          <span className="lg-near">{t("Near-critical (10 days or less)")}</span>
          <span className="lg-cur">{t("Has float")}</span>
          <span className="lg-float">{t("Float tail")}</span>
          <span className="lg-base">{t("Baseline")}</span>
        </div>
      </section>

      <Register
        rows={list}
        columns={columns}
        rowKey={(a) => a.id}
        onRowClick={(a) => navigate(R.programme(a.id))}
        initialSort={{ key: "es", dir: "asc" }}
        pageSize={15}
        rowClass={(a) => (cp.get(a.id)?.critical && a.status !== "COMPLETED" ? "pms-row-crit" : undefined)}
        toolbar={
          <div className="pms-reg-head">
            <strong>{t("Early and late dates")}</strong>
            <span className="muted small">{t("{n} on the chain · {m} near-critical · sorted by earliest start", { n: live.filter(crit).length, m: live.filter(near).length })}</span>
          </div>
        }
      />
      </>
      )}
    </div>
  );
}

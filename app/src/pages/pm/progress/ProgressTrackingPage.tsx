import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, LineChart, NotebookPen } from "lucide-react";
import { CountUp, PageHero, Panel, SCurve, StatTiles, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { programmeStats, R, sCurve } from "../../../ops/select";
import { buildingShort } from "../../../lib/loc";
import { UpdateGrid } from "./UpdateGrid";
import { Quantities } from "./Quantities";
import { EarnedValue, evOf } from "./EarnedValue";
import { SnapshotHistory } from "./SnapshotHistory";
import { BUILDINGS } from "./shared";

/**
 * The weekly progress update (P6-style): set % complete and remaining days per activity at the data
 * date, check installed quantities and earned value, then submit the week as a snapshot.
 */
export function ProgressTrackingPage() {
  const { t, d, lang } = useL();
  const activities = useOps((s) => s.activities);
  const snapshots = useOps((s) => s.snapshots);
  const dataDate = useOps((s) => s.dataDate);
  const [bld, setBld] = useState<string>("ALL");

  const st = useMemo(() => programmeStats(activities), [activities]);
  const total = useMemo(() => evOf("ALL", "", activities), [activities]);
  const last = useMemo(() => [...snapshots].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).slice(-1)[0], [snapshots]);
  const curveActs = useMemo(() => (bld === "ALL" ? activities : activities.filter((a) => a.building === bld)), [activities, bld]);
  const curve = useMemo(() => sCurve(curveActs), [curveActs]);
  const curveSt = useMemo(() => programmeStats(curveActs), [curveActs]);
  const sinceLast = last ? diffDays(last.dataDate, TODAY) : null;
  const gapPts = Math.round((st.actualPct - st.plannedPct) * 1000) / 10;

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · Progress tracking")}
        title={t("Weekly progress update")}
        subtitle={t("Record where every live activity stands at the data date, check it against quantities and earned value, then submit the week.")}
        flow={["Collect site data", "Update activities", "Check earned value", "Submit the week"]}
        art="progress"
        actions={
          <>
            <Link to={R.reports} className="btn btn-ghost">
              <NotebookPen size={15} />
              {t("Daily reports")}
            </Link>
            <Link to={R.programme()} className="btn btn-ghost">
              <CalendarCheck size={15} />
              {t("Open the programme")}
            </Link>
          </>
        }
      />

      <StatTiles
        items={[
          { label: t("Data date"), value: d(dataDate), sub: dataDate === TODAY ? t("today") : undefined, tone: "brand" },
          { label: t("Last update"), value: last ? last.id : "—", sub: last ? t("data date {date} · {n} days ago", { date: d(last.dataDate, false), n: sinceLast ?? 0 }) : t("none yet"), tone: sinceLast != null && sinceLast > 7 ? "warn" : "neutral" },
          {
            label: t("Planned vs actual"),
            value: (
              <span className="pg-pva">
                <CountUp value={st.plannedPct * 100} format={(v) => `${v.toFixed(1)}%`} />
                <small>/</small>
                <CountUp value={st.actualPct * 100} format={(v) => `${v.toFixed(1)}%`} />
              </span>
            ),
            sub: t("{n} points against plan", { n: gapPts > 0 ? `+${gapPts}` : gapPts }),
            tone: gapPts >= -1 ? "ok" : gapPts >= -4 ? "warn" : "bad",
          },
          { label: t("SPI"), value: <CountUp value={st.spi} format={(v) => v.toFixed(2)} />, sub: t("earned ÷ planned value"), tone: st.spi >= 0.98 ? "ok" : st.spi >= 0.9 ? "warn" : "bad" },
          { label: t("CPI"), value: <CountUp value={total.cpi ?? 1} format={(v) => v.toFixed(2)} />, sub: t("earned value ÷ actual cost"), tone: (total.cpi ?? 1) >= 0.98 ? "ok" : "warn" },
        ]}
      />

      <UpdateGrid />

      <div className="k-grid-2">
        <Quantities activities={activities} />
        <Panel
          title={t("S-curve by building")}
          icon={<LineChart size={15} />}
          sub={`${bld === "ALL" ? t("Whole project") : buildingShort(bld, lang)}: ${t("Planned {p}% · actual {a}% at the data date.", { p: (curveSt.plannedPct * 100).toFixed(1), a: (curveSt.actualPct * 100).toFixed(1) })}`}
        >
          <div className="pg-seg-scroll">
            <Segmented value={bld} onChange={setBld} label={t("Building")} options={[{ value: "ALL", label: t("All") }, ...BUILDINGS.map((b) => ({ value: b, label: <span title={buildingShort(b, lang)}>{b}</span> }))]} />
          </div>
          <SCurve points={curve} today={TODAY} height={230} />
        </Panel>
      </div>

      <EarnedValue activities={activities} />
      <SnapshotHistory />
    </div>
  );
}

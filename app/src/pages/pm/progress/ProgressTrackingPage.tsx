import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarRange, LineChart, NotebookPen } from "lucide-react";
import { CountUp, Empty, PageHero, Panel, SCurve, StatTiles, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import { buildingShort } from "../../../lib/loc";
import { UpdateGrid } from "./UpdateGrid";
import { Quantities } from "./Quantities";
import { EarnedValue, evOf } from "./EarnedValue";
import { SnapshotHistory } from "./SnapshotHistory";
import { buildingsOf, curveOf, paidCost, progressOf } from "./shared";

/**
 * The weekly progress update (P6-style): set % complete and remaining days per activity at the data
 * date, check installed quantities and earned value, then submit the week as a snapshot.
 */
export function ProgressTrackingPage() {
  const { t, d, lang } = useL();
  const activities = useOps((s) => s.activities);
  const snapshots = useOps((s) => s.snapshots);
  const dataDate = useOps((s) => s.dataDate);
  const payments = useOps((s) => s.payments);
  const pos = useOps((s) => s.pos);
  const mrs = useOps((s) => s.mrs);
  const [bld, setBld] = useState<string>("ALL");

  const st = useMemo(() => progressOf(activities), [activities]);
  const total = useMemo(() => evOf("ALL", "", activities, paidCost({ payments, pos, mrs })), [activities, payments, pos, mrs]);
  const last = useMemo(() => [...snapshots].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).slice(-1)[0], [snapshots]);
  const buildings = useMemo(() => buildingsOf(activities), [activities]);
  const pickBld = bld !== "ALL" && !buildings.includes(bld) ? "ALL" : bld;
  const curveActs = useMemo(() => (pickBld === "ALL" ? activities : activities.filter((a) => a.building === pickBld)), [activities, pickBld]);
  const curve = useMemo(() => curveOf(curveActs, snapshots), [curveActs, snapshots]);
  const curveSt = useMemo(() => progressOf(curveActs), [curveActs]);
  const sinceLast = last ? diffDays(last.dataDate, TODAY) : null;
  const gapPts = Math.round((st.actual - st.planned) * 1000) / 10;
  const cpi = total.cpi;

  const hero = (
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
  );

  if (!activities.length)
    return (
      <div className="k-page">
        {hero}
        <Panel>
          <Empty
            icon={<CalendarRange size={20} />}
            title={t("No activities to update yet")}
            action={
              <Link to={R.programme()} className="btn btn-primary">
                {t("Open the programme")}
              </Link>
            }
          >
            {t("The weekly update records the % complete of the programme activities. Add activities or import a P6 / MS Project file first.")}
          </Empty>
        </Panel>
        <SnapshotHistory />
      </div>
    );

  return (
    <div className="k-page">
      {hero}

      <StatTiles
        items={[
          { label: t("Data date"), value: d(dataDate), sub: dataDate === TODAY ? t("today") : undefined, tone: "brand" },
          { label: t("Last update"), value: last ? last.id : "—", sub: last ? t("data date {date} · {n} days ago", { date: d(last.dataDate, false), n: sinceLast ?? 0 }) : t("none yet"), tone: sinceLast != null && sinceLast > 7 ? "warn" : "neutral" },
          {
            label: t("Planned vs actual"),
            value: (
              <span className="pg-pva">
                <CountUp value={st.planned * 100} format={(v) => `${v.toFixed(1)}%`} />
                <small>/</small>
                <CountUp value={st.actual * 100} format={(v) => `${v.toFixed(1)}%`} />
              </span>
            ),
            sub: t("{n} points against plan", { n: gapPts > 0 ? `+${gapPts}` : gapPts }),
            tone: gapPts >= -1 ? "ok" : gapPts >= -4 ? "warn" : "bad",
          },
          st.spi != null
            ? { label: t("SPI"), value: <CountUp value={st.spi} format={(v) => v.toFixed(2)} />, sub: t("earned ÷ planned value"), tone: st.spi >= 0.98 ? "ok" : st.spi >= 0.9 ? "warn" : "bad" }
            : { label: t("SPI"), value: "—", sub: t("nothing planned by today yet"), tone: "muted" },
          cpi != null
            ? { label: t("CPI"), value: <CountUp value={cpi} format={(v) => v.toFixed(2)} />, sub: t("earned value ÷ actual cost"), tone: cpi >= 0.98 ? "ok" : "warn" }
            : { label: t("CPI"), value: "—", sub: t("no cost paid or no earned value yet"), tone: "muted" },
        ]}
      />

      <UpdateGrid />

      <div className="k-grid-2">
        <Quantities activities={activities} />
        <Panel
          title={t("S-curve by building")}
          icon={<LineChart size={15} />}
          sub={`${pickBld === "ALL" ? t("Whole project") : buildingShort(pickBld, lang)}: ${t("Planned {p}% · actual {a}% at the data date.", { p: (curveSt.planned * 100).toFixed(1), a: (curveSt.actual * 100).toFixed(1) })} ${t("Actual is drawn from the submitted weekly updates.")}`}
        >
          {buildings.length > 1 ? (
            <div className="pg-seg-scroll">
              <Segmented value={pickBld} onChange={setBld} label={t("Building")} options={[{ value: "ALL", label: t("All") }, ...buildings.map((b) => ({ value: b, label: <span title={buildingShort(b, lang)}>{b}</span> }))]} />
            </div>
          ) : null}
          {curve.length ? <SCurve points={curve} today={TODAY} height={230} /> : <p className="muted small">{t("No activities in this building.")}</p>}
        </Panel>
      </div>

      <EarnedValue activities={activities} />
      <SnapshotHistory />
    </div>
  );
}

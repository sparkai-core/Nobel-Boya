import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarCheck2, Check, ChevronDown, Download, Flag, Info, Save, Upload, X } from "lucide-react";
import { Badge, Dialog, Field, Kebab, PageHero, TabBar, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays } from "../../../ops/dates";
import { cpm, programmeStats, to } from "../../../ops/select";
import { setCurrentProgramme } from "../../../ops/ext/planning-p2";
import type { Programme } from "../../../ops/types";
import { ActivitiesTab } from "./ActivitiesTab";
import { ChangesTab } from "./ChangesTab";
import { ImportDialog, ToolBadge, type Imported } from "./ImportDialog";
import { ProgrammesTab } from "./ProgrammesTab";
import { ResourcesTab } from "./ResourcesTab";
import { baselineFinish, buildMspXml, buildP6Xml, buildXer, download, TABS, TOOL_NAME, type Tab } from "./model";

/**
 * Planning and programme: the P6 / MS Project side of the project. Programme files, the activity table
 * (P6 look), the resource histogram and what changed between saved points, with a live status footer.
 */
export function PlanningPage() {
  const { t, d } = useL();
  const navigate = useNavigate();
  const params = useParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as Tab) : "activities";
  const go = (k: Tab) => navigate(to(`pm/planning/${k}`));

  const programmes = useOps((s) => s.programmes);
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const wbs = useOps((s) => s.wbs);
  const dataDate = useOps((s) => s.dataDate);
  const saveRevision = useOps((s) => s.saveRevision);
  const setBaseline = useOps((s) => s.setBaseline);
  const current = programmes.find((p) => p.current) ?? programmes[programmes.length - 1];

  const stats = useMemo(() => programmeStats(activities), [activities]);
  const cp = useMemo(() => cpm(activities, links), [activities, links]);
  const critical = activities.filter((a) => cp.get(a.id)?.critical && a.status !== "COMPLETED").length;
  const contract = current?.contractFinish ?? stats.forecastFinish;
  const late = diffDays(contract, stats.forecastFinish);
  const slip = diffDays(baselineFinish(activities), stats.forecastFinish);

  const [importing, setImporting] = useState(false);
  const [banner, setBanner] = useState<Imported | null>(null);
  const [savePoint, setSavePoint] = useState(false);
  const [label, setLabel] = useState("");
  const [baseline, setBaselineOpen] = useState(false);

  const base = (current?.file ?? "QOBU").replace(/\.[^.]+$/, "");
  const doExport = (kind: "xer" | "p6xml" | "msp") => {
    const name = current?.name ?? "Qobu";
    if (kind === "xer") download(`${base}.xer`, buildXer(name, activities, links, wbs, dataDate));
    if (kind === "p6xml") download(`${base}_P6.xml`, buildP6Xml(name, activities, links, wbs, dataDate), "application/xml");
    if (kind === "msp") download(`${base}_MSProject.xml`, buildMspXml(name, activities, links, wbs, dataDate), "application/xml");
    toast(t("Programme exported: {n} activities, {l} links", { n: activities.length, l: links.length }));
  };

  const follow = (p: Programme) => {
    if (!p.current) {
      setCurrentProgramme(p.id);
      toast(t("The project now follows {name}", { name: p.name }));
    }
    go("activities");
  };

  return (
    <div className="k-page pp-page pp-planning">
      <PageHero
        eyebrow={t("Project management · Planning")}
        title={t("Planning and programme")}
        subtitle={t("The programme as it is in Primavera P6 or MS Project: bring a file in, check it, follow it and see what moved.")}
        flow={["Import the file", "Check what was read", "Follow it", "Compare saved points"]}
        art="programme"
      />

      <div className="pp-strip">
        <TabBar
          value={tab}
          onChange={go}
          tabs={[
            { value: "programmes", label: t("Programmes"), count: programmes.length },
            { value: "activities", label: t("Activities") },
            { value: "resources", label: t("Resources") },
            { value: "changes", label: t("Changes") },
          ]}
        />
        <div className="pp-strip-end">
          {current ? (
            <Kebab
              label="Choose a programme"
              items={programmes.map((p) => ({
                label: (
                  <span className="pp-pick-item">
                    <ToolBadge tool={p.tool} small />
                    <span className="truncate">{p.name}</span>
                    {p.current ? <Check size={14} /> : null}
                  </span>
                ),
                onClick: () => follow(p),
              }))}
            >
              <span className="pp-picker">
                <ToolBadge tool={current.tool} small />
                <span className="truncate">{current.name}</span>
                <ChevronDown size={14} />
              </span>
            </Kebab>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={() => setImporting(true)}>
            <Upload size={15} /> {t("Import file")}
          </button>
          <Kebab
            label="Export"
            items={[
              { label: t("Primavera P6 (.xer)"), icon: <Download size={14} />, onClick: () => doExport("xer") },
              { label: t("Primavera P6 XML"), icon: <Download size={14} />, onClick: () => doExport("p6xml") },
              { label: t("MS Project XML"), icon: <Download size={14} />, onClick: () => doExport("msp") },
            ]}
          >
            <Download size={15} /> <span className="pp-hide-sm">{t("Export")}</span>
          </Kebab>
          <Kebab
            items={[
              { label: t("Save a point"), icon: <Save size={14} />, onClick: () => { setLabel(""); setSavePoint(true); } },
              { label: t("Set baseline to these dates"), icon: <Flag size={14} />, onClick: () => setBaselineOpen(true) },
            ]}
          />
        </div>
      </div>

      {banner ? (
        <div className="pp-banner k-rise" role="status">
          <span className="pp-banner-icon">
            <Check size={16} strokeWidth={3} />
          </span>
          <div>
            <strong>{banner.mode === "REVISION" ? t("New revision imported.") : t("New programme imported.")}</strong>{" "}
            <span>
              {banner.tool === "P6" ? "P6" : "MSP"} · {t("{n} activities", { n: banner.activities })} · {t("from {file}", { file: banner.file })}
              {banner.mode === "REVISION" && diffDays(banner.result.finishBefore, banner.result.finishAfter) !== 0
                ? ` · ${t("finish {a} → {b}", { a: d(banner.result.finishBefore), b: d(banner.result.finishAfter) })}`
                : ""}
            </span>
          </div>
          <button type="button" className="k-link-btn" onClick={() => go(banner.mode === "REVISION" ? "changes" : "programmes")}>
            {banner.mode === "REVISION" ? t("See what changed") : t("See the programme")}
          </button>
          <button type="button" className="icon-btn" aria-label={t("Close")} onClick={() => setBanner(null)}>
            <X size={15} />
          </button>
        </div>
      ) : null}

      <div className="pp-body" key={tab}>
        {tab === "programmes" ? <ProgrammesTab programmes={programmes} fresh={banner?.mode === "NEW" ? banner.result.programmeId : null} onOpen={follow} /> : null}
        {tab === "activities" ? <ActivitiesTab /> : null}
        {tab === "resources" ? <ResourcesTab /> : null}
        {tab === "changes" ? <ChangesTab /> : null}
      </div>

      <footer className="pp-foot" aria-label={t("Programme status")}>
        <div className="pp-foot-item">
          <small>{t("Data date")}</small>
          <b className="num-inline">{d(dataDate)}</b>
        </div>
        <div className="pp-foot-item">
          <small>{t("Contract finish")}</small>
          <b className="num-inline">{d(contract)}</b>
        </div>
        <div className="pp-foot-item">
          <small>{t("Forecast finish")}</small>
          <b className="num-inline">
            {d(stats.forecastFinish)} {late > 0 ? <Badge tone="bad">{t("{n}d late", { n: late })}</Badge> : <Badge tone="ok">{t("On time")}</Badge>}
          </b>
        </div>
        <div className="pp-foot-item">
          <small>{t("Progress")}</small>
          <b className="num-inline">
            {(stats.actualPct * 100).toFixed(1)}% <span className="muted">/ {(stats.plannedPct * 100).toFixed(1)}% {t("planned")}</span>
          </b>
        </div>
        <div className="pp-foot-item">
          <small>{t("Critical")}</small>
          <b className="num-inline k-text-bad">{t("{n} activities", { n: critical })}</b>
        </div>
        <div className="pp-foot-item">
          <small>{t("Baseline slip")}</small>
          <b className={`num-inline ${slip > 0 ? "k-text-bad" : "k-text-ok"}`}>{slip > 0 ? t("+{n} days", { n: slip }) : t("None")}</b>
        </div>
        <div className="pp-foot-info">
          <Info size={13} />
          {current ? t("Dates as in the {tool} file {file}", { tool: TOOL_NAME[current.tool], file: current.file }) : t("Dates as in the P6 file")}
        </div>
      </footer>

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImported={(x) => {
          setBanner(x);
          toast(x.mode === "REVISION" ? t("New revision imported from {file}", { file: x.file }) : t("Programme imported from {file}", { file: x.file }));
          if (x.mode === "NEW") go("programmes");
        }}
      />

      <Dialog
        open={savePoint}
        onClose={() => setSavePoint(false)}
        kicker={t("Planning · Saved points")}
        title={t("Save a point")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setSavePoint(false)}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                saveRevision(label.trim() || "Saved by hand");
                toast(t("Point saved: you can compare with it or go back to it later"));
                setSavePoint(false);
              }}
            >
              <Save size={15} /> {t("Save point")}
            </button>
          </>
        }
      >
        <div className="k-stack">
          <p className="muted">{t("Keeps today's dates and progress of all {n} activities so you can compare with them later.", { n: activities.length })}</p>
          <Field label={t("Label")}>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("e.g. Before the steel re-plan")} autoFocus />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={baseline}
        onClose={() => setBaselineOpen(false)}
        kicker={t("Planning · Baseline")}
        title={t("Set baseline to these dates?")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setBaselineOpen(false)}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                saveRevision("Kept before the new baseline");
                setBaseline();
                toast(t("Baseline set to the current dates"));
                setBaselineOpen(false);
              }}
            >
              <CalendarCheck2 size={15} /> {t("Set baseline")}
            </button>
          </>
        }
      >
        <div className="k-stack">
          <p>{t("Every activity's baseline start and finish become today's programme dates. The {n}-day slip against the old baseline will read as zero.", { n: Math.max(0, slip) })}</p>
          <p className="k-note">{t("The old dates are kept as a saved point first.")}</p>
        </div>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, FileWarning, GitCompareArrows } from "lucide-react";
import { Dialog, Dropzone, Field, fmtBytes, ReadSteps, useFakeRead, useL, type ReadStep } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { diffDays } from "../../../ops/dates";
import type { ImportResult } from "../../../ops/store-phase2";
import type { Tool } from "../../../ops/types";
import { detectTool, TOOL_NAME } from "./model";

const STEPS: ReadStep[] = [
  { label: "Reading activities, links and calendars…", ms: 900 },
  { label: "Mapping WBS to the BOQ sections", ms: 750 },
  { label: "Checking logic and dates", ms: 700 },
];

export type Imported = { result: ImportResult; file: string; tool: Tool; mode: "NEW" | "REVISION"; activities: number };

export function ToolBadge({ tool, small }: { tool: Tool; small?: boolean }) {
  return <span className={`pp-tool pp-tool-${tool.toLowerCase()}${small ? " sm" : ""}`}>{tool === "P6" ? "P6" : "MSP"}</span>;
}

/** Bring in a P6 / MS Project file: drop → read → check → import (new programme or new revision). */
export function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (x: Imported) => void }) {
  const { t, d, x } = useL();
  const previewImport = useOps((s) => s.previewImport);
  const importProgramme = useOps((s) => s.importProgramme);
  const programmes = useOps((s) => s.programmes);
  const current = programmes.find((p) => p.current);
  const reader = useFakeRead(STEPS);
  const [file, setFile] = useState<{ name: string; size: number; tool: Tool } | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [mode, setMode] = useState<"NEW" | "REVISION">("REVISION");
  const [name, setName] = useState("");
  const [project, setProject] = useState("QOBU");

  useEffect(() => {
    if (!open) {
      reader.reset();
      setFile(null);
      setBad(null);
      setMode("REVISION");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const take = (f: { name: string; size: number }) => {
    const tool = detectTool(f.name);
    if (!tool) {
      setBad(f.name);
      setFile(null);
      return;
    }
    setBad(null);
    setFile({ ...f, tool });
    setName(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    void reader.start();
  };

  const pv = useMemo(() => (file && reader.done ? previewImport(file.name, file.tool) : null), [file, reader.done, previewImport]);
  const moveDays = pv ? diffDays(pv.finishBefore, pv.finishAfter) : 0;
  const lateDays = pv && current ? diffDays(current.contractFinish, mode === "REVISION" ? pv.finishAfter : pv.finishBefore) : 0;

  const confirm = () => {
    if (!file || !pv) return;
    const result = importProgramme({ file: file.name, tool: file.tool, mode, name: mode === "NEW" ? name.trim() : (current?.name ?? name) });
    onImported({ result, file: file.name, tool: file.tool, mode, activities: pv.activities });
    onClose();
  };

  const stage = !file ? "drop" : !reader.done ? "reading" : "check";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={stage === "check" ? 720 : 560}
      kicker={t("Planning · Import")}
      title={stage === "check" ? t("Check before importing") : t("Bring in a programme")}
      footer={
        stage === "check" ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => { reader.reset(); setFile(null); }}>
              {t("Choose another file")}
            </button>
            <button type="button" className="btn btn-primary" onClick={confirm} disabled={mode === "NEW" && !name.trim()}>
              {mode === "NEW" ? t("Import programme") : t("Import as new revision")}
              <ArrowRight size={15} />
            </button>
          </>
        ) : null
      }
    >
      {stage === "drop" ? (
        <div className="k-stack">
          <Dropzone
            accept=".xer,.xml,.mpp"
            title={t("Drop a Primavera P6 or MS Project file here")}
            hint={
              <>
                {t("You check what was read before anything is saved.")}
                <br />
                <span className="k-mono">.xer · .xml (P6) · .mpp · .xml (MS Project)</span>
              </>
            }
            onFile={take}
          />
          <div className="pp-samples">
            <span className="muted small">{t("No file at hand? Try a sample:")}</span>
            <button type="button" className="k-link-btn" onClick={() => take({ name: "QOBU_UPDATE_R3.xer", size: 1_482_311 })}>
              <ToolBadge tool="P6" small /> {t("Primavera P6 sample")}
            </button>
            <button type="button" className="k-link-btn" onClick={() => take({ name: "Qobu_update_Nov26.mpp", size: 626_688 })}>
              <ToolBadge tool="MSP" small /> {t("MS Project sample")}
            </button>
          </div>
          {bad ? (
            <div className="k-callout k-tone-bad" role="alert">
              <FileWarning size={16} />
              <div>
                <strong>{t("This file cannot be used")}</strong>
                <p className="small">{t("{name} is not a P6 or MS Project file. Use .xer, .xml or .mpp.", { name: bad })}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {stage === "reading" && file ? (
        <div className="k-stack">
          <FilePill name={file.name} size={file.size} tool={file.tool} />
          <ReadSteps steps={STEPS} step={reader.step} />
        </div>
      ) : null}

      {stage === "check" && file && pv ? (
        <div className="k-stack pp-check">
          <FilePill name={file.name} size={file.size} tool={file.tool} />
          <p className="pp-found">
            <strong>{TOOL_NAME[file.tool]}</strong>
            {" · "}
            {t("{n} activities", { n: pv.activities })} · {t("{n} links", { n: pv.links })} · {t("{n} WBS levels", { n: pv.wbsLevels })} · {t("{n} calendars", { n: pv.calendars })}
          </p>
          <div className="pp-facts">
            <Fact label={t("Data date")} value={d(pv.dataDate)} />
            <Fact label={t("Forecast finish")} value={d(mode === "REVISION" ? pv.finishAfter : pv.finishBefore)} />
            <Fact label={t("Contract finish")} value={d(current?.contractFinish)} />
            <Fact label={t("Against contract")} value={lateDays > 0 ? t("{n}d late", { n: lateDays }) : lateDays < 0 ? t("{n}d early", { n: -lateDays }) : t("On time")} tone={lateDays > 0 ? "bad" : "ok"} />
            <Fact label={t("Done")} value={String(pv.done)} />
            <Fact label={t("In progress")} value={String(pv.inProgress)} />
            <Fact label={t("Not started")} value={String(pv.notStarted)} />
            <Fact label={t("Progress")} value={`${pv.progress.toFixed(1)}%`} tone="brand" />
          </div>
          {pv.warnings.length ? (
            <div className="k-callout k-tone-warn">
              <AlertTriangle size={16} />
              <div>
                <strong>{t("{n} things to know", { n: pv.warnings.length })}</strong>
                <ul className="pp-warn-list">
                  {pv.warnings.map((w, i) => (
                    <li key={i}>{x(w)}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <div className="pp-mode">
            <span className="k-field-label">{t("Bring it in as")}</span>
            <Segmented
              label={t("Bring it in as")}
              value={mode}
              onChange={setMode}
              options={[
                { value: "NEW", label: t("New programme") },
                { value: "REVISION", label: t("New revision of the open one") },
              ]}
            />
          </div>
          {mode === "REVISION" ? (
            <div className="pp-diff k-rise">
              <GitCompareArrows size={18} />
              <div>
                <strong className={moveDays > 0 ? "k-text-bad" : moveDays < 0 ? "k-text-ok" : undefined}>
                  {moveDays > 0
                    ? t("Finish moves {n} days later ({a} → {b}).", { n: moveDays, a: d(pv.finishBefore), b: d(pv.finishAfter) })
                    : moveDays < 0
                      ? t("Finish moves {n} days earlier ({a} → {b}).", { n: -moveDays, a: d(pv.finishBefore), b: d(pv.finishAfter) })
                      : t("Finish does not move ({a}).", { a: d(pv.finishBefore) })}
                </strong>
                <p className="small">
                  {t("{x} changed · {y} added · {z} removed.", { x: pv.changed, y: pv.added, z: pv.removed })} {t("The working copy is kept as a revision first.")}
                </p>
                <p className="small muted">{t("Updates: {name}", { name: current?.name ?? "—" })}</p>
              </div>
            </div>
          ) : (
            <div className="k-form k-rise">
              <Field label={t("Programme name")}>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={t("Project")}>
                <select className="input select" value={project} onChange={(e) => setProject(e.target.value)}>
                  <option value="QOBU">QOBU · Qobu</option>
                </select>
              </Field>
            </div>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}

export function FilePill({ name, size, tool }: { name: string; size: number; tool: Tool }) {
  return (
    <div className="pp-filepill">
      <ToolBadge tool={tool} />
      <strong className="truncate">{name}</strong>
      <span className="muted num-inline">{fmtBytes(size)}</span>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="pp-fact">
      <span>{label}</span>
      <strong className={tone ? `k-text-${tone}` : undefined}>{value}</strong>
    </div>
  );
}

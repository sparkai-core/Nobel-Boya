import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, FileUp, FileWarning, GitCompareArrows, Loader2 } from "lucide-react";
import { Dialog, Field, fmtBytes, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { diffDays } from "../../../ops/dates";
import { ACCEPT, importProgramme, lateAgainst, previewImport, readProgrammeFile, type ImportMode, type ImportResult, type ParsedProgramme } from "../../../ops/ext/programme-import";
import type { Tool, Txt } from "../../../ops/types";
import { TOOL_NAME } from "./model";

export type Imported = { result: ImportResult; file: string; tool: Tool; mode: ImportMode; activities: number };

export function ToolBadge({ tool, small }: { tool: Tool; small?: boolean }) {
  return <span className={`pp-tool pp-tool-${tool.toLowerCase()}${small ? " sm" : ""}`}>{tool === "P6" ? "P6" : "MSP"}</span>;
}

const FORMAT: Record<ParsedProgramme["format"], string> = { XER: "XER", P6XML: "P6 XML", MSPDI: "MS Project XML" };

/**
 * Bring in a P6 / MS Project file: choose → read (really parsed in the browser) → check what was read →
 * import as a new programme or as a revision of the followed one. Nothing is saved before the user confirms.
 */
export function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (x: Imported) => void }) {
  const { t, d, x } = useL();
  const programmes = useOps((s) => s.programmes);
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const milestones = useOps((s) => s.milestones);
  const contractSet = useOps((s) => s.setup.contractFinish);
  const current = programmes.find((p) => p.current);
  const [reading, setReading] = useState<{ name: string; size: number } | null>(null);
  const [parsed, setParsed] = useState<ParsedProgramme | null>(null);
  const [error, setError] = useState<{ name: string; text: Txt } | null>(null);
  const [mode, setMode] = useState<ImportMode>("NEW");
  const [name, setName] = useState("");
  const [removeMissing, setRemoveMissing] = useState(true);
  const [allWarnings, setAllWarnings] = useState(false);
  const token = useRef(0);

  useEffect(() => {
    if (!open) {
      token.current++;
      setReading(null);
      setParsed(null);
      setError(null);
      setAllWarnings(false);
    }
  }, [open]);

  const take = async (file: File) => {
    const my = ++token.current;
    setError(null);
    setParsed(null);
    setReading({ name: file.name, size: file.size });
    // Let the "reading" state paint before a large file is parsed.
    await new Promise((r) => setTimeout(r, 30));
    const res = await readProgrammeFile(file);
    if (my !== token.current) return;
    setReading(null);
    if (!res.ok) {
      setError({ name: file.name, text: res.error });
      return;
    }
    if (!res.programme.tasks.length) {
      setError({ name: file.name, text: { en: "No activity in this file has dates, so there is nothing to import.", az: "Bu faylda tarixi olan iş yoxdur, idxal ediləcək bir şey yoxdur." } });
      return;
    }
    setParsed(res.programme);
    setName(res.programme.projectName || file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    setMode(activities.length ? "REVISION" : "NEW");
    setRemoveMissing(true);
    setAllWarnings(false);
  };

  const pv = useMemo(() => (parsed ? previewImport(parsed, mode) : null), [parsed, mode, activities]); // eslint-disable-line react-hooks/exhaustive-deps
  const finishAfter = pv ? (mode === "REVISION" && !removeMissing ? [pv.finishFile, ...activities.map((a) => a.end)].reduce<string | null>((m, v) => (v && (!m || v > m) ? v : m), null) : pv.finishFile) : null;
  const contract = contractSet ?? parsed?.mustFinish ?? null;
  const late = lateAgainst(contract, finishAfter);
  const moveDays = pv?.finishBefore && finishAfter ? diffDays(pv.finishBefore, finishAfter) : 0;

  const confirm = () => {
    if (!parsed || !pv) return;
    const result = importProgramme(parsed, { mode, name: mode === "NEW" ? name : (current?.name ?? name), removeMissing });
    onImported({ result, file: parsed.file, tool: parsed.tool, mode, activities: parsed.tasks.length });
    onClose();
  };

  const stage = reading ? "reading" : parsed && pv ? "check" : "drop";
  const warnings = parsed?.warnings ?? [];
  const shownWarnings = allWarnings ? warnings : warnings.slice(0, 5);

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
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setParsed(null);
                setError(null);
              }}
            >
              {t("Choose another file")}
            </button>
            <button type="button" className="btn btn-primary" onClick={confirm} disabled={mode === "NEW" && !name.trim()}>
              {mode === "NEW" ? t("Import as new programme") : t("Import as new revision")}
              <ArrowRight size={15} />
            </button>
          </>
        ) : null
      }
    >
      {stage === "drop" ? (
        <div className="k-stack">
          <FileDrop onFile={(f) => void take(f)} />
          {error ? (
            <div className="k-callout k-tone-bad" role="alert">
              <FileWarning size={16} />
              <div>
                <strong>{t("This file cannot be used")}</strong>
                <p className="small">
                  <span className="k-mono">{error.name}</span> · {x(error.text)}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {stage === "reading" && reading ? (
        <div className="k-stack">
          <div className="pp-filepill">
            <Loader2 size={16} className="pms-spin" />
            <strong className="truncate">{reading.name}</strong>
            <span className="muted num-inline">{fmtBytes(reading.size)}</span>
          </div>
          <p className="muted small">{t("Reading activities, links, WBS and calendars from the file…")}</p>
        </div>
      ) : null}

      {stage === "check" && parsed && pv ? (
        <div className="k-stack pp-check">
          <FilePill name={parsed.file} size={parsed.size} tool={parsed.tool} />
          <p className="pp-found">
            <strong>{TOOL_NAME[parsed.tool]}</strong> <span className="muted">({FORMAT[parsed.format]})</span>
            {" · "}
            {t("{n} activities", { n: parsed.tasks.length })} · {t("{n} links", { n: parsed.links.length })} · {t("{n} WBS levels", { n: parsed.wbsLevels })} · {t("{n} calendars", { n: parsed.calendars })} · {t("{n} milestones", { n: pv.milestones })}
          </p>
          <div className="pp-facts">
            <Fact label={t("Data date")} value={d(parsed.dataDate)} />
            <Fact label={t("Start")} value={d(pv.startFile)} />
            <Fact label={t("Finish in the file")} value={d(pv.finishFile)} />
            <Fact label={t("Contract finish")} value={contract ? d(contract) : t("Not set")} />
            {late != null ? <Fact label={t("Against contract")} value={late > 0 ? t("{n}d late", { n: late }) : late < 0 ? t("{n}d early", { n: -late }) : t("On the date")} tone={late > 0 ? "bad" : "ok"} /> : null}
            <Fact label={t("Done")} value={String(pv.done)} />
            <Fact label={t("In progress")} value={String(pv.inProgress)} />
            <Fact label={t("Not started")} value={String(pv.notStarted)} />
            <Fact label={t("Progress")} value={`${pv.progress.toFixed(1)}%`} tone="brand" />
          </div>
          <p className="muted small">{t("Progress is weighted by duration: the file carries no costs, and none are invented.")}</p>
          {warnings.length ? (
            <div className="k-callout k-tone-warn">
              <AlertTriangle size={16} />
              <div>
                <strong>{t("{n} things to know", { n: warnings.length })}</strong>
                <ul className="pp-warn-list">
                  {shownWarnings.map((w, i) => (
                    <li key={i}>{x(w)}</li>
                  ))}
                </ul>
                {warnings.length > shownWarnings.length ? (
                  <button type="button" className="k-link-btn" onClick={() => setAllWarnings(true)}>
                    {t("Show all {n}", { n: warnings.length })}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {activities.length ? (
            <div className="pp-mode">
              <span className="k-field-label">{t("Bring it in as")}</span>
              <Segmented
                label={t("Bring it in as")}
                value={mode}
                onChange={setMode}
                options={[
                  { value: "NEW", label: t("New programme") },
                  { value: "REVISION", label: t("Update of the current programme") },
                ]}
              />
            </div>
          ) : null}
          {mode === "REVISION" ? (
            <div className="pp-diff k-rise">
              <GitCompareArrows size={18} />
              <div>
                <strong className={moveDays > 0 ? "k-text-bad" : moveDays < 0 ? "k-text-ok" : undefined}>
                  {!pv.finishBefore || !finishAfter
                    ? t("Finish {d}.", { d: d(finishAfter) })
                    : moveDays > 0
                      ? t("Finish moves {n} days later ({a} → {b}).", { n: moveDays, a: d(pv.finishBefore), b: d(finishAfter) })
                      : moveDays < 0
                        ? t("Finish moves {n} days earlier ({a} → {b}).", { n: -moveDays, a: d(pv.finishBefore), b: d(finishAfter) })
                        : t("Finish does not move ({a}).", { a: d(pv.finishBefore) })}
                </strong>
                <p className="small">
                  {t("Matched by activity ID: {x} changed · {s} the same · {y} new in the file.", { x: pv.changed, s: pv.same, y: pv.added })} {t("Baseline dates, budgets, owners and buildings you set stay.")}
                </p>
                {pv.removed ? (
                  <label className="pp-check-row small">
                    <input type="checkbox" checked={removeMissing} onChange={(e) => setRemoveMissing(e.target.checked)} />
                    <span>{t("Remove the {n} activities that are not in the file (with their links)", { n: pv.removed })}</span>
                  </label>
                ) : null}
                <p className="small muted">
                  {t("The project's current dates are kept as a saved point first.")} {current ? t("Updates: {name}", { name: current.name }) : null}
                </p>
              </div>
            </div>
          ) : (
            <div className="k-stack k-rise">
              <div className="k-form">
                <Field label={t("Programme name")}>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              </div>
              {activities.length ? (
                <div className="k-callout k-tone-warn">
                  <AlertTriangle size={16} />
                  <span className="small">
                    {t("This replaces the project's {a} activities, {l} links and {m} milestones with the file's. They are kept as a saved point first, so you can compare. Records that pointed to old activities keep their text.", { a: activities.length, l: links.length, m: milestones.length })}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}

/** File picker / drop area that hands over the real File (the shared Dropzone only passes name and size). */
function FileDrop({ onFile }: { onFile: (f: File) => void }) {
  const { t } = useL();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`k-drop${over ? " over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <span className="k-drop-icon">
        <FileUp size={20} />
      </span>
      <strong>{t("Drop a Primavera P6 or MS Project file here")}</strong>
      <span className="k-drop-hint">
        {t("You check what was read before anything is saved.")}
        <br />
        <span className="k-mono">.xer · .xml (P6) · .xml (MS Project)</span>
        <br />
        {t("MS Project .mpp: save it as XML first (File → Save As → XML).")}
      </span>
      <div className="k-row" style={{ justifyContent: "center" }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => input.current?.click()}>
          {t("Choose a file")}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
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

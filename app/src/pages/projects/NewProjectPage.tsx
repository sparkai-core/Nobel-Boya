import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Copy, FileInput, FilePlus2, LayoutTemplate, RotateCcw } from "lucide-react";
import { Badge, Dropzone, Field, fmtBytes, PageHero, ReadSteps, toast, useFakeRead, useL, type ReadStep } from "../../components/kit";
import { useOps } from "../../ops/store";
import { addDays, diffDays, same, TODAY } from "../../ops/dates";
import type { DemoProject } from "../../ops/types";
import { fmtMoney } from "../../lib/format";
import { KIND_LABEL, LaneChart, readProgrammeFile, STATUS_META, type FileRead } from "./shared";

type Source = "BLANK" | "TEMPLATE" | "COPY" | "FILE";
type Step = 0 | 1 | 2;

const STEPS: ReadStep[] = [
  { label: "Reading activities, links and calendars…", ms: 850 },
  { label: "Building the WBS", ms: 650 },
  { label: "Checking logic and dates", ms: 650 },
];

/** Three-step wizard: the project, where its plan starts from, then check and create. */
export function NewProjectPage() {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const templates = useOps((s) => s.templates);
  const projects = useOps((s) => s.projects);
  const nextRef = useOps((s) => s.nextRef);
  const addItem = useOps((s) => s.addItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const live = templates.filter((tp) => tp.status === "IN_USE");
  const preTpl = templates.find((tp) => tp.id === params.get("template"));

  const [step, setStep] = useState<Step>(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState(addDays(TODAY, 14));
  const [target, setTarget] = useState(addDays(TODAY, 14 + 300));
  const [status, setStatus] = useState<DemoProject["status"]>("PLANNING");
  const [value, setValue] = useState(0);
  const [desc, setDesc] = useState("");
  const [source, setSource] = useState<Source>(preTpl ? "TEMPLATE" : "BLANK");
  const [tplId, setTplId] = useState(preTpl?.id ?? live[0]?.id ?? "");
  const [copyId, setCopyId] = useState(projects[0]?.id ?? "");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [badFile, setBadFile] = useState<string | null>(null);
  const reader = useFakeRead(STEPS);
  const read: FileRead | null = file && reader.done ? readProgrammeFile(file.name) : null;

  const tpl = templates.find((tp) => tp.id === tplId);
  const copy = projects.find((p) => p.id === copyId);

  const plan = useMemo(() => {
    if (source === "TEMPLATE" && tpl) return { wbs: tpl.wbs, tasks: tpl.tasks, milestones: tpl.milestones, links: tpl.links, finish: addDays(start, tpl.days), progress: 0 };
    if (source === "COPY" && copy) return { wbs: Math.max(4, Math.round(copy.tasks / 5)), tasks: copy.tasks, milestones: Math.max(3, Math.round(copy.tasks / 9)), links: Math.round(copy.tasks * 1.2), finish: addDays(start, diffDays(copy.start, copy.finish)), progress: 0 };
    if (source === "FILE" && read) return { wbs: read.wbs, tasks: read.activities, milestones: read.milestones, links: read.links, finish: addDays(start, read.days), progress: read.progress };
    return { wbs: 1, tasks: 0, milestones: 0, links: 0, finish: target, progress: 0 };
  }, [source, tpl, copy, read, start, target]);
  const late = diffDays(target, plan.finish);

  const step0ok = code.trim() && name.trim() && start && target && target > start;
  const step1ok = source === "BLANK" || (source === "TEMPLATE" && !!tpl) || (source === "COPY" && !!copy) || (source === "FILE" && !!read);

  const takeFile = (f: { name: string; size: number }) => {
    if (!readProgrammeFile(f.name)) {
      setBadFile(f.name);
      setFile(null);
      reader.reset();
      return;
    }
    setBadFile(null);
    setFile(f);
    void reader.start();
  };

  const create = () => {
    const id = nextRef("PRJ");
    const firstLane = source === "TEMPLATE" && tpl ? tpl.lanes[0] : null;
    const project: DemoProject = {
      id,
      code: code.trim().toUpperCase(),
      name: same(name.trim()),
      client: client.trim() || "—",
      location: same(location.trim() || "—"),
      start,
      finish: plan.finish,
      contractFinish: target,
      pct: plan.progress,
      plannedPct: 0,
      status,
      health: late > 0 ? "at_risk" : "on_track",
      tasks: plan.tasks,
      blocked: 0,
      overdue: 0,
      openMrs: 0,
      value,
      nextMilestone: firstLane ? { name: { en: `${firstLane.name.en} complete`, az: `${firstLane.name.az} tamamlandı` }, date: addDays(start, firstLane.start + firstLane.dur) } : { name: { en: "Site handover", az: "Meydançanın təhvili" }, date: start },
      source: "DEMO",
    };
    addItem("projects", project);
    pushFeed("PM", { en: `Project ${project.code} created`, az: `${project.code} layihəsi yaradıldı` }, null);
    toast(t("{code} created with {n} tasks", { code: project.code, n: plan.tasks }));
    navigate("/projects");
  };

  const steps = [t("Project"), t("Starting point"), t("Check and create")];
  const SOURCES: { key: Source; icon: typeof FilePlus2; title: string; sub: string }[] = [
    { key: "BLANK", icon: FilePlus2, title: t("Blank"), sub: t("Start with an empty plan and build it up.") },
    { key: "TEMPLATE", icon: LayoutTemplate, title: t("Company template"), sub: t("Phases, tasks and links from a template you trust.") },
    { key: "COPY", icon: Copy, title: t("Copy a project"), sub: t("Reuse the plan of a job you already run.") },
    { key: "FILE", icon: FileInput, title: t("Programme file (P6 or MS Project)"), sub: t("Read the plan straight from a .xer, .xml or .mpp file.") },
  ];

  return (
    <div className="k-page pp-page">
      <PageHero eyebrow={t("Projects · New")} title={t("New project")} subtitle={t("Three short steps. Nothing is saved until you press Create project.")} back={{ to: "/projects", label: "Projects" }} />

      <ol className="pp-wiz-steps">
        {steps.map((s, i) => (
          <li key={i} className={i < step ? "done" : i === step ? "on" : undefined}>
            <button type="button" onClick={() => (i < step || (i === 1 && step0ok) || (i === 2 && step0ok && step1ok) ? setStep(i as Step) : undefined)}>
              <span className="pp-wiz-dot">{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
              <span className="truncate">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="pp-wiz">
        <section className="k-panel pp-wiz-main">
          {step === 0 ? (
            <div className="k-form k-rise">
              <Field label={t("Project code")} hint={t("Short and unique, e.g. BAK-OFF2")}>
                <input className="input k-mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BAK-OFF2" maxLength={12} />
              </Field>
              <Field label={t("Project name")}>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Bakı office block")} />
              </Field>
              <Field label={t("Client")}>
                <input className="input" value={client} onChange={(e) => setClient(e.target.value)} />
              </Field>
              <Field label={t("Location")}>
                <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
              <Field label={t("Start")}>
                <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label={t("Target completion")} error={target && start && target <= start ? t("Must be after the start") : undefined}>
                <input className="input" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
              </Field>
              <Field label={t("Status")}>
                <select className="input select" value={status} onChange={(e) => setStatus(e.target.value as DemoProject["status"])}>
                  {(Object.keys(STATUS_META) as DemoProject["status"][]).map((k) => (
                    <option key={k} value={k}>
                      {t(STATUS_META[k].label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Contract value (AZN)")}>
                <input className="input" type="number" min={0} step={1000} value={value || ""} onChange={(e) => setValue(Number(e.target.value) || 0)} />
              </Field>
              <Field label={t("Description")} wide>
                <textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
              </Field>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="k-stack k-rise">
              <div className="pp-sources" role="radiogroup" aria-label={t("Starting point")}>
                {SOURCES.map((sr) => {
                  const Icon = sr.icon;
                  return (
                    <button key={sr.key} type="button" role="radio" aria-checked={source === sr.key} className={`pp-source${source === sr.key ? " on" : ""}`} onClick={() => setSource(sr.key)}>
                      <span className="pp-source-icon">
                        <Icon size={18} />
                      </span>
                      <strong>{sr.title}</strong>
                      <small>{sr.sub}</small>
                      {source === sr.key ? (
                        <span className="pp-source-tick">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {source === "TEMPLATE" ? (
                live.length ? (
                  <div className="k-stack">
                    <Field label={t("Template")}>
                      <select className="input select" value={tplId} onChange={(e) => setTplId(e.target.value)}>
                        {live.map((tp) => (
                          <option key={tp.id} value={tp.id}>
                            {x(tp.name)} · v{tp.version}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {tpl ? (
                      <div className="pp-src-box">
                        <span className="muted small">
                          {t(KIND_LABEL[tpl.kind])} · {t("{n} tasks", { n: tpl.tasks })} · {t("runs for {n} days", { n: tpl.days })}
                        </span>
                        <LaneChart lanes={tpl.lanes} days={tpl.days} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="k-note">{t("No templates in use. Bring one back on the Templates page.")}</p>
                )
              ) : null}

              {source === "COPY" ? (
                <Field label={t("Copy the plan of")}>
                  <select className="input select" value={copyId} onChange={(e) => setCopyId(e.target.value)}>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} · {x(p.name)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              {source === "FILE" ? (
                <div className="k-stack">
                  {!file ? (
                    <Dropzone accept=".xer,.xml,.mpp" title={t("Drop a Primavera P6 or MS Project file here")} hint={<span className="k-mono">.xer · .xml (P6) · .mpp · .xml (MS Project)</span>} onFile={takeFile}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => takeFile({ name: "BAKU_OFFICE_TENDER.xer", size: 912_384 })}>
                        {t("Use a sample")}
                      </button>
                    </Dropzone>
                  ) : (
                    <div className="pp-filepill">
                      <span className={`pp-tool pp-tool-${(readProgrammeFile(file.name)?.tool ?? "P6").toLowerCase()}`}>{readProgrammeFile(file.name)?.tool === "MSP" ? "MSP" : "P6"}</span>
                      <strong className="truncate">{file.name}</strong>
                      <span className="muted num-inline">{fmtBytes(file.size)}</span>
                      <button type="button" className="icon-btn" aria-label={t("Choose another file")} onClick={() => { setFile(null); reader.reset(); }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  )}
                  {badFile ? <p className="k-callout k-tone-bad small">{t("This file cannot be used")}: {badFile}</p> : null}
                  {file && !reader.done ? <ReadSteps steps={STEPS} step={reader.step} /> : null}
                  {read ? (
                    <>
                      <div className="pp-six">
                        <Six label={t("Activities")} value={read.activities} />
                        <Six label={t("Links")} value={read.links} />
                        <Six label={t("WBS")} value={read.wbs} />
                        <Six label={t("Progress")} value={`${read.progress}%`} />
                        <Six label={t("Data date")} value={d(start)} />
                        <Six label={t("Finish")} value={d(addDays(start, read.days))} tone={addDays(start, read.days) > target ? "bad" : undefined} />
                      </div>
                      <div className="k-callout k-tone-warn">
                        <AlertTriangle size={16} />
                        <ul className="pp-warn-list">
                          {read.warnings.map((w, i) => (
                            <li key={i}>{x(w)}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {source === "BLANK" ? <p className="k-note">{t("You get one WBS root named after the project. Add phases and tasks from the programme page later.")}</p> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="k-stack k-rise">
              <div className="pp-six">
                <Six label={t("WBS")} value={plan.wbs} />
                <Six label={t("Tasks")} value={plan.tasks} />
                <Six label={t("Milestones")} value={plan.milestones} />
                <Six label={t("Links")} value={plan.links} />
                <Six label={t("Finish in the file")} value={d(plan.finish)} tone={late > 0 ? "bad" : "ok"} sub={late > 0 ? t("{n}d after the target", { n: late }) : t("Inside the target")} />
              </div>
              <ul className="pp-ticks">
                <li>
                  <Check size={14} strokeWidth={3} />
                  {source === "BLANK" ? t("An empty programme with one WBS root") : t("{w} WBS elements and {n} tasks with their {l} links", { w: plan.wbs, n: plan.tasks, l: plan.links })}
                </li>
                <li>
                  <Check size={14} strokeWidth={3} />
                  {t("Contract finish set to {d}; forecast finish {f}", { d: d(target), f: d(plan.finish) })}
                </li>
                <li>
                  <Check size={14} strokeWidth={3} />
                  {t("The project shows on the portfolio board straight away")}
                </li>
              </ul>
              {late > 0 ? (
                <div className="k-callout k-tone-bad">
                  <AlertTriangle size={16} />
                  <span>{t("The plan finishes {n} days after the target completion. You can still create it and re-plan.", { n: late })}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <footer className="pp-wiz-foot">
            {step > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
                <ArrowLeft size={15} /> {t("Back")}
              </button>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/projects")}>
                {t("Cancel")}
              </button>
            )}
            <span className="k-spacer" />
            {step < 2 ? (
              <button type="button" className="btn btn-primary" disabled={step === 0 ? !step0ok : !step1ok} onClick={() => setStep((s) => (s + 1) as Step)}>
                {t("Next")} <ArrowRight size={15} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={create}>
                <Check size={15} /> {t("Create project")}
              </button>
            )}
          </footer>
        </section>

        <aside className="k-panel pp-preview">
          <span className="k-eyebrow">{t("What will be created")}</span>
          <div className="pp-preview-head">
            <span className="k-ref">{code || "CODE"}</span>
            <Badge tone={STATUS_META[status].tone}>{t(STATUS_META[status].label)}</Badge>
          </div>
          <h3 className={name ? undefined : "faint"}>{name || t("Project name")}</h3>
          <p className="muted small">{[client, location].filter(Boolean).join(" · ") || t("Client · Location")}</p>
          <div className="pp-preview-span">
            <span>{d(start)}</span>
            <i>
              <b style={{ width: `${Math.min(100, (diffDays(start, plan.finish) / Math.max(1, diffDays(start, target), diffDays(start, plan.finish))) * 100)}%` }} className={late > 0 ? "late" : undefined} />
              <em style={{ left: `${Math.min(100, (diffDays(start, target) / Math.max(1, diffDays(start, target), diffDays(start, plan.finish))) * 100)}%` }} />
            </i>
            <span>{d(target)}</span>
          </div>
          <dl className="pp-preview-figs">
            <div>
              <dt>{t("Starting point")}</dt>
              <dd>{SOURCES.find((sr) => sr.key === source)?.title}</dd>
            </div>
            <div>
              <dt>{t("Tasks")}</dt>
              <dd className="num-inline">{plan.tasks}</dd>
            </div>
            <div>
              <dt>{t("Links")}</dt>
              <dd className="num-inline">{plan.links}</dd>
            </div>
            <div>
              <dt>{t("Runs for")}</dt>
              <dd className="num-inline">{t("{n} days", { n: Math.max(0, diffDays(start, plan.finish)) })}</dd>
            </div>
            <div>
              <dt>{t("Contract value")}</dt>
              <dd className="num-inline">{value ? `${fmtMoney(value)} AZN` : "—"}</dd>
            </div>
          </dl>
          {source === "TEMPLATE" && tpl ? <LaneChart lanes={tpl.lanes} days={tpl.days} compact /> : null}
          {desc ? <p className="k-note small">{desc}</p> : null}
        </aside>
      </div>
    </div>
  );
}

function Six({ label, value, tone, sub }: { label: string; value: string | number; tone?: string; sub?: string }) {
  return (
    <div className="pp-fact">
      <span>{label}</span>
      <strong className={`num-inline${tone ? ` k-text-${tone}` : ""}`}>{value}</strong>
      {sub ? <small className={tone ? `k-text-${tone}` : "muted"}>{sub}</small> : null}
    </div>
  );
}

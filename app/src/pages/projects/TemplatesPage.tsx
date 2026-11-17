import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowRight, Copy, LayoutTemplate } from "lucide-react";
import { Badge, Empty, FilterChips, PageHero, SearchBox, toast, useL } from "../../components/kit";
import { Segmented } from "../../components/ui";
import { useOps } from "../../ops/store";
import type { ProjectTemplate } from "../../ops/types";
import { KIND_LABEL, LaneChart } from "./shared";

type Kind = ProjectTemplate["kind"];

/** Company programme templates: a list on the left, the plan each one gives on the right. */
export function TemplatesPage() {
  const { t, x } = useL();
  const navigate = useNavigate();
  const templates = useOps((s) => s.templates);
  const nextRef = useOps((s) => s.nextRef);
  const addItem = useOps((s) => s.addItem);
  const patchItem = useOps((s) => s.patchItem);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [state, setState] = useState<"IN_USE" | "ARCHIVED">("IN_USE");
  const [selId, setSelId] = useState<string | null>(templates.find((tp) => tp.status === "IN_USE")?.id ?? null);

  const needle = q.trim().toLowerCase();
  const list = templates.filter((tp) => tp.status === state && (!kind || tp.kind === kind) && (!needle || `${tp.name.en} ${tp.name.az}`.toLowerCase().includes(needle)));
  const sel = templates.find((tp) => tp.id === selId && list.includes(tp)) ?? list[0];
  const kinds = [...new Set(templates.map((tp) => tp.kind))];

  const copy = (tp: ProjectTemplate) => {
    const id = nextRef("TPL");
    addItem("templates", { ...tp, id, name: { en: `${tp.name.en} (copy)`, az: `${tp.name.az} (surət)` }, version: 1, status: "IN_USE" }, false);
    setState("IN_USE");
    setSelId(id);
    toast(t("Copy made: {name}", { name: x(tp.name) }));
  };
  const toggleArchive = (tp: ProjectTemplate) => {
    const next = tp.status === "IN_USE" ? "ARCHIVED" : "IN_USE";
    patchItem("templates", tp.id, { status: next });
    toast(next === "ARCHIVED" ? t("{name} archived", { name: x(tp.name) }) : t("{name} is back in use", { name: x(tp.name) }), next === "ARCHIVED" ? "muted" : "ok");
  };

  return (
    <div className="k-page pp-page">
      <PageHero
        eyebrow={t("Projects · Templates")}
        title={t("Project templates")}
        subtitle={t("Programmes your company trusts: phases, tasks and links you can start a new project from.")}
        back={{ to: "/projects", label: "Projects" }}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate("/projects/new")}>
            {t("New project")}
          </button>
        }
      />

      <div className="pp-tpl">
        <aside className="k-panel pp-tpl-list">
          <div className="pp-tpl-tools">
            <SearchBox value={q} onChange={setQ} placeholder="Search templates" />
            <Segmented
              label={t("Templates")}
              value={state}
              onChange={setState}
              options={[
                { value: "IN_USE", label: t("In use"), count: templates.filter((tp) => tp.status === "IN_USE").length },
                { value: "ARCHIVED", label: t("Archived"), count: templates.filter((tp) => tp.status === "ARCHIVED").length },
              ]}
            />
            <FilterChips value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: t(KIND_LABEL[k]), count: templates.filter((tp) => tp.kind === k && tp.status === state).length }))} />
          </div>
          {list.length ? (
            <ul className="pp-tpl-items">
              {list.map((tp) => (
                <li key={tp.id}>
                  <button type="button" className={tp.id === sel?.id ? "on" : undefined} onClick={() => setSelId(tp.id)}>
                    <span className="pp-tpl-icon">
                      <LayoutTemplate size={16} />
                    </span>
                    <span className="pp-tpl-txt">
                      <strong className="truncate">{x(tp.name)}</strong>
                      <small className="muted">
                        {t(KIND_LABEL[tp.kind])} · v{tp.version} · {t("{n} tasks", { n: tp.tasks })}
                      </small>
                    </span>
                    <span className="pp-tpl-mini" aria-hidden="true">
                      {tp.lanes.map((l, i) => (
                        <i key={i} style={{ left: `${(l.start / tp.days) * 100}%`, width: `${(l.dur / tp.days) * 100}%`, top: `${(i / Math.max(1, tp.lanes.length)) * 100}%` }} />
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="k-note">{state === "ARCHIVED" ? t("Nothing archived.") : t("No template matches.")}</p>
          )}
        </aside>

        <section className="k-panel pp-tpl-detail">
          {sel ? (
            <div className="k-stack k-rise" key={sel.id}>
              <div className="pp-tpl-head">
                <div>
                  <div className="k-row">
                    <Badge tone="brand" dot={false}>
                      {t(KIND_LABEL[sel.kind])}
                    </Badge>
                    <Badge tone="neutral" dot={false}>
                      v{sel.version}
                    </Badge>
                    <Badge tone={sel.status === "IN_USE" ? "ok" : "muted"}>{sel.status === "IN_USE" ? t("In use") : t("Archived")}</Badge>
                  </div>
                  <h2>{x(sel.name)}</h2>
                </div>
                <div className="pp-tpl-actions">
                  <button type="button" className="btn btn-primary" disabled={sel.status !== "IN_USE"} onClick={() => navigate(`/projects/new?template=${sel.id}`)}>
                    {t("Start a project with it")} <ArrowRight size={15} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => copy(sel)}>
                    <Copy size={14} /> {t("Make a copy")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => toggleArchive(sel)}>
                    {sel.status === "IN_USE" ? <Archive size={14} /> : <ArchiveRestore size={14} />} {sel.status === "IN_USE" ? t("Archive") : t("Bring back")}
                  </button>
                </div>
              </div>
              <div className="pp-six">
                <Fig label={t("WBS")} value={sel.wbs} />
                <Fig label={t("Tasks")} value={sel.tasks} />
                <Fig label={t("Milestones")} value={sel.milestones} />
                <Fig label={t("Links")} value={sel.links} />
                <Fig label={t("Runs for")} value={t("{n} days", { n: sel.days })} />
              </div>
              <div>
                <h3 className="pp-sub-h">{t("The plan it gives")}</h3>
                <LaneChart lanes={sel.lanes} days={sel.days} />
                <p className="muted small">{t("Phases overlap the way the template links them. Day 0 is the project start you pick.")}</p>
              </div>
            </div>
          ) : (
            <Empty icon={<LayoutTemplate size={20} />} title={t("No template chosen")}>
              {t("Pick a template on the left.")}
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}

function Fig({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pp-fact">
      <span>{label}</span>
      <strong className="num-inline">{value}</strong>
    </div>
  );
}

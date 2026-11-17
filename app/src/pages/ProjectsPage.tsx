import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Ban, ChartGantt, ExternalLink, FileText, LayoutTemplate, PackageOpen, Plus, ShoppingCart, Table2, TimerOff } from "lucide-react";
import { COVER_SHEETS, data, P, sheetImage } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney, fmtMoneyShort } from "../lib/format";
import { useOps } from "../ops/store";
import { poLate, programmeStats, projectHealth, type Tone } from "../ops/select";
import { addDays, diffDays, maxDate, minDate, monthShort, TODAY } from "../ops/dates";
import type { DemoProject } from "../ops/types";
import { useApp } from "../lib/store";
import { projectName, projectPlace } from "../lib/loc";
import { Badge, CountUp, FilterChips, KeyVals, Meter, PageHero, SearchBox, StatTiles, useL } from "../components/kit";
import { Drawer } from "../components/ui";

const TEXT_LABEL = { true: "Text layer", false: "Image only", partial: "Partly text" } as const;

type Status = DemoProject["status"];
type Sort = "attention" | "behind" | "finish" | "name";

const HEALTH: Record<DemoProject["health"], { label: string; tone: Tone }> = {
  on_track: { label: "On track", tone: "ok" },
  at_risk: { label: "At risk", tone: "warn" },
  blocked: { label: "Blocked", tone: "bad" },
  complete: { label: "Complete", tone: "muted" },
};
const PROJECT_STATUS: Record<Status, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "brand" },
  PLANNING: { label: "Planning", tone: "info" },
  ON_HOLD: { label: "On hold", tone: "warn" },
  COMPLETED: { label: "Completed", tone: "ok" },
};

/** Portfolio board: every project on one month axis, Qobu live from the programme, plus the Qobu drawing package. */
export function ProjectsPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const generated = useApp((s) => s.generated);
  const s = useOps();
  const boq = useBoq();
  const p = data.project;
  const open = (path: string) => navigate(generated ? `${P}/${path}` : `${P}/generate`);

  const stats = useMemo(() => programmeStats(s.activities), [s.activities]);
  const health = useMemo(() => projectHealth(s), [s]);
  const openPos = s.pos.filter((z) => z.status === "ISSUED" || z.status === "PART_RECEIVED").length;

  // Qobu reads live from the programme; the dummies come from the seed as they are.
  const lanes: DemoProject[] = useMemo(
    () =>
      s.projects.map((pr) => {
        if (pr.source !== "QOBU") return pr;
        const blocked = s.activities.filter((a) => a.status === "BLOCKED").length;
        const overdue = s.rfis.filter((r) => r.status === "OPEN" && r.dueAt < TODAY).length + s.pos.filter(poLate).length + s.activities.filter((a) => a.status !== "COMPLETED" && a.end < TODAY).length;
        const openMrs = s.mrs.filter((m) => m.status === "DRAFT" || m.status === "SUBMITTED" || m.status === "SOURCING").length;
        return {
          ...pr,
          pct: Math.round(stats.actualPct * 1000) / 10,
          plannedPct: Math.round(stats.plannedPct * 1000) / 10,
          finish: stats.forecastFinish,
          tasks: s.activities.length,
          blocked,
          overdue,
          openMrs,
          health: health.score < 45 ? "blocked" : health.score < 72 || stats.forecastFinish > pr.contractFinish ? "at_risk" : "on_track",
          value: generated ? Math.round(boq.total) : pr.value,
        };
      }),
    [s.projects, s.activities, s.rfis, s.pos, s.mrs, stats, health.score, generated, boq.total],
  );

  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("attention");
  const [demo, setDemo] = useState<DemoProject | null>(null);

  const needle = q.trim().toLowerCase();
  const shown = lanes
    .filter((l) => status === "ALL" || l.status === status)
    .filter((l) => !needle || [l.code, l.name.en, l.name.az, l.client, l.location.en, l.location.az].some((f) => f.toLowerCase().includes(needle)))
    .sort((a, b) => {
      if (sort === "name") return x(a.name).localeCompare(x(b.name));
      if (sort === "finish") return a.finish.localeCompare(b.finish);
      if (sort === "behind") return a.pct - a.plannedPct - (b.pct - b.plannedPct);
      const w = (l: DemoProject) => l.blocked * 3 + l.overdue * 2 + l.openMrs * 0.5 + (l.health === "blocked" ? 8 : l.health === "at_risk" ? 4 : 0);
      return w(b) - w(a);
    });

  // Shared month axis across every lane.
  const from = lanes.length ? `${lanes.reduce((m, l) => minDate(m, l.start), lanes[0]!.start).slice(0, 7)}-01` : TODAY;
  const toD = lanes.length ? addDays(lanes.reduce((m, l) => maxDate(m, l.finish, l.contractFinish), lanes[0]!.finish), 20) : TODAY;
  const span = Math.max(1, diffDays(from, toD));
  const X = (iso: string) => Math.max(0, Math.min(100, (diffDays(from, iso) / span) * 100));
  const months = useMemo(() => {
    const out: { iso: string; label: string; year: boolean }[] = [];
    let y = Number(from.slice(0, 4));
    let m = Number(from.slice(5, 7)) - 1;
    for (;;) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      if (iso > toD) break;
      out.push({ iso, label: m === 0 ? String(y) : monthShort(m, lang), year: m === 0 });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    return out;
  }, [from, toD, lang]);

  const stride = months.length > 24 ? 3 : months.length > 12 ? 2 : 1;
  const count = (st: Status) => lanes.filter((l) => l.status === st).length;
  const value = lanes.reduce((a, l) => a + l.value, 0);
  const openLane = (l: DemoProject) => (l.source === "QOBU" ? navigate(generated ? `${P}/pm` : `${P}/generate`) : setDemo(l));

  return (
    <div className="k-page pp-page">
      <PageHero
        eyebrow={t("Projects · Portfolio")}
        title={t("Projects")}
        subtitle={t("Every job on one timeline: where each one stands against its plan, and what needs a hand today.")}
        flow={["Set up", "Plan", "Build", "Hand over"]}
        art="pm"
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => navigate("/projects/templates")}>
              <LayoutTemplate size={15} /> {t("Templates")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/projects/new")}>
              <Plus size={15} /> {t("New project")}
            </button>
          </>
        }
      />

      <StatTiles
        items={[
          { label: t("Projects"), value: <CountUp value={lanes.length} />, sub: t("in the portfolio") },
          { label: t("Active"), value: <CountUp value={count("ACTIVE")} />, tone: "brand", onClick: () => setStatus("ACTIVE") },
          { label: t("Planning"), value: <CountUp value={count("PLANNING")} />, tone: "info", onClick: () => setStatus("PLANNING") },
          { label: t("Completed"), value: <CountUp value={count("COMPLETED")} />, tone: "ok", onClick: () => setStatus("COMPLETED") },
          { label: t("Portfolio value"), value: <CountUp value={value} format={(v) => fmtMoneyShort(v)} />, sub: "AZN" },
        ]}
      />

      <section className="k-panel pp-board-panel">
        <div className="pp-board-bar">
          <FilterChips<Status | "ALL">
            value={status}
            onChange={(v) => setStatus(v ?? "ALL")}
            options={[
              { value: "ALL", label: t("All"), count: lanes.length },
              ...(Object.keys(PROJECT_STATUS) as Status[]).map((k) => ({ value: k, label: t(PROJECT_STATUS[k].label), count: count(k) })),
            ]}
          />
          <div className="pp-board-tools">
            <SearchBox value={q} onChange={setQ} placeholder="Search projects" />
            <select className="input select pp-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t("Sort")}>
              <option value="attention">{t("Needs attention")}</option>
              <option value="behind">{t("Most behind")}</option>
              <option value="finish">{t("Finishes first")}</option>
              <option value="name">{t("Name")}</option>
            </select>
          </div>
        </div>

        <div className="pp-board">
          <div className="pp-lane pp-axis" aria-hidden="true">
            <div className="pp-lane-info" />
            <div className="pp-track">
              {months.map((m, i) => (
                <span key={m.iso} className={`pp-ax-m${m.year ? " yr" : ""}${i % stride && !m.year ? " skip" : ""}`} style={{ left: `${X(m.iso)}%` }}>
                  {m.label}
                </span>
              ))}
              <b className="pp-ax-today" style={{ left: `${X(TODAY)}%` }}>
                {t("Today")}
              </b>
            </div>
          </div>
          {shown.length ? (
            shown.map((l, i) => {
              const gap = Math.round((l.pct - l.plannedPct) * 10) / 10;
              const word = l.status === "PLANNING" && l.pct === 0 ? { label: t("Not started"), tone: "muted" as Tone } : gap < -2 ? { label: t("Behind plan"), tone: "bad" as Tone } : gap > 2 ? { label: t("Ahead"), tone: "ok" as Tone } : { label: t("On plan"), tone: "ok" as Tone };
              const late = diffDays(l.contractFinish, l.finish);
              const h = HEALTH[l.health];
              const live = l.source === "QOBU";
              return (
                <button key={l.id} type="button" className={`pp-lane pp-lane-row${live ? " live" : ""}`} onClick={() => openLane(l)} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="pp-lane-info">
                    <div className="pp-lane-top">
                      <span className="k-ref">{l.code}</span>
                      <Badge tone={h.tone}>{t(h.label)}</Badge>
                      {live ? <Badge tone="brand" dot={false}>{t("Live")}</Badge> : null}
                    </div>
                    <strong className="pp-lane-name">{x(l.name)}</strong>
                    <span className="pp-lane-sub muted small">
                      {l.client} · {x(l.location)}
                    </span>
                    <span className="pp-lane-prog">
                      <b className="num-inline">{l.pct.toFixed(l.pct % 1 ? 1 : 0)}%</b>
                      <span className={`k-text-${word.tone}`}>
                        {word.label}
                        {l.status !== "PLANNING" && Math.abs(gap) >= 0.1 ? ` · ${gap > 0 ? "+" : ""}${gap.toFixed(1)} ${t("pts")}` : ""}
                      </span>
                    </span>
                    <span className="pp-attn">
                      {l.blocked ? (
                        <span className="pp-attn-chip bad">
                          <Ban size={12} /> {t("{n} blocked", { n: l.blocked })}
                        </span>
                      ) : null}
                      {l.overdue ? (
                        <span className="pp-attn-chip warn">
                          <TimerOff size={12} /> {t("{n} overdue", { n: l.overdue })}
                        </span>
                      ) : null}
                      {l.openMrs ? (
                        <span className="pp-attn-chip">
                          <PackageOpen size={12} /> {t("{n} open MRs", { n: l.openMrs })}
                        </span>
                      ) : null}
                      {!l.blocked && !l.overdue && !l.openMrs ? <span className="muted small">{t("Nothing waiting")}</span> : null}
                    </span>
                  </div>
                  <div className="pp-track">
                    <b className="pp-tr-today" style={{ left: `${X(TODAY)}%` }} />
                    <span className="pp-tr-bar k-grow-x" style={{ left: `${X(l.start)}%`, width: `${X(l.finish) - X(l.start)}%` }}>
                      <i className={`pp-tr-fill tone-${word.tone}`} style={{ width: `${l.pct}%` }} />
                      {l.plannedPct > 0 ? <em className="pp-tr-plan" style={{ left: `${Math.min(100, l.plannedPct)}%` }} title={t("Planned by now")} /> : null}
                    </span>
                    {late > 0 ? <span className="pp-tr-late" style={{ left: `${X(l.contractFinish)}%`, width: `${X(l.finish) - X(l.contractFinish)}%` }} /> : null}
                    <b className={`pp-tr-contract${late > 0 ? " late" : ""}`} style={{ left: `${X(l.contractFinish)}%` }} title={`${t("Contract finish")} ${d(l.contractFinish)}`} />
                    {l.nextMilestone ? (
                      <i className="pp-tr-ms" style={{ left: `${X(l.nextMilestone.date)}%` }} title={`${x(l.nextMilestone.name)} · ${d(l.nextMilestone.date)}`} />
                    ) : null}
                    <span className="pp-tr-cap num-inline">
                      {d(l.start, false)} → {d(l.finish)}
                      {late > 0 ? <b className="k-text-bad"> · {t("{n}d late", { n: late })}</b> : null}
                    </span>
                    {l.nextMilestone ? (
                      <span className="pp-tr-next small">
                        ◆ {x(l.nextMilestone.name)} · {d(l.nextMilestone.date, false)}
                      </span>
                    ) : null}
                  </div>
                  <span className="pp-lane-go" aria-hidden="true">
                    <ArrowRight size={15} />
                  </span>
                </button>
              );
            })
          ) : (
            <p className="k-note pp-board-empty">{t("No project matches these filters.")}</p>
          )}
        </div>
        <footer className="pp-legend">
          <span>
            <i className="pp-lg-fill" /> {t("Done")}
          </span>
          <span>
            <i className="pp-lg-plan" /> {t("Planned by now")}
          </span>
          <span>
            <i className="pp-lg-ms" /> {t("Next milestone")}
          </span>
          <span>
            <i className="pp-lg-ct" /> {t("Contract finish")}
          </span>
          <span>
            <i className="pp-lg-today" /> {t("Today")}
          </span>
        </footer>
      </section>

      <section className="pp-qobu">
        <header className="pp-qobu-head">
          <h2>{t("Qobu drawing package")}</h2>
          <p className="muted">{t("Each project is one drawing package. Open a project to see its bill, drawings and checks.")}</p>
        </header>
        <article className="pp-qobu-card">
          <button type="button" className="pp-qobu-cover" onClick={() => open("drawings")} aria-label={t("Open the drawings of this project")}>
            {COVER_SHEETS.map((id) => (
              <img key={id} src={sheetImage(id, true)} alt="" loading="lazy" />
            ))}
          </button>
          <div className="pp-qobu-body">
            <div className="pp-qobu-status">
              <span className={`pp-gen-dot${generated ? " on" : ""}`} aria-hidden="true" />
              {generated ? t("Bill generated") : t("Ready to generate")}
            </div>
            <h3>{projectName(lang)}</h3>
            <p className="muted">{projectPlace(lang)}</p>
            <KeyVals
              cols={2}
              items={[
                { k: t("Client"), v: p.client },
                { k: t("Designer"), v: p.designer },
                { k: t("Issue"), v: t("Working design, {d}", { d: p.issued }) },
                { k: t("Bill total incl. VAT"), v: <span className="num-inline">{generated ? `${fmtMoney(boq.total)} AZN` : t("Not generated")}</span> },
              ]}
            />
            <div className="pp-qobu-files">
              <div className="pp-qobu-files-head">
                <strong>{t("Drawing package")}</strong>
                <span className="muted small num-inline">{t("4 files, 205 sheets")}</span>
              </div>
              <ul>
                {data.documents.map((doc) => (
                  <li key={doc.code}>
                    <FileText size={15} aria-hidden="true" />
                    <span className="truncate">{doc.file}</span>
                    <span className="muted num-inline">{data.sheets.filter((sh) => sh.doc === doc.code).length}</span>
                    <span className={`layer layer-${String(doc.text)}`}>{t(TEXT_LABEL[String(doc.text) as "true" | "false" | "partial"])}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pp-qobu-actions">
              {generated ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => open("overview")}>
                    {t("Open project")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => open("drawings")}>
                    {t("Drawings")}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => navigate(`${P}/generate`)}>
                    {t("Generate again")}
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => navigate(`${P}/generate`)}>
                  {t("Generate the bill of quantities")}
                </button>
              )}
            </div>
          </div>
          <div className="pp-modules" aria-label={t("Modules")}>
            {[
              { key: "estimate", icon: Table2, label: t("Estimation"), fact: generated ? `${fmtMoneyShort(boq.total)} AZN` : t("Not generated"), go: () => open("overview") },
              { key: "pm", icon: ChartGantt, label: t("Project management"), fact: t("{p} done · finish {d}", { p: `${Math.round(stats.actualPct * 100)}%`, d: d(stats.forecastFinish) }), go: () => open("pm") },
              { key: "proc", icon: ShoppingCart, label: t("Procurement"), fact: t("{n} open orders", { n: openPos }), go: () => open("procurement") },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.key} type="button" className="pp-module" onClick={m.go}>
                  <span className="pp-module-icon">
                    <Icon size={17} />
                  </span>
                  <span>
                    <strong>{m.label}</strong>
                    <small>{m.fact}</small>
                  </span>
                  <ArrowRight size={14} className="pp-module-go" />
                </button>
              );
            })}
            <a className="pp-module portal" href="#/vendor" target="_blank" rel="noopener">
              <span className="pp-module-icon">
                <ExternalLink size={17} />
              </span>
              <span>
                <strong>{t("Vendor portal")}</strong>
                <small>{t("Opens without login")}</small>
              </span>
              <ArrowRight size={14} className="pp-module-go" />
            </a>
          </div>
        </article>
      </section>

      <Drawer open={!!demo} onClose={() => setDemo(null)} kicker={demo?.code} title={demo ? x(demo.name) : ""}>
        {demo ? (
          <div className="k-stack pp-demo">
            <div className="k-row">
              <Badge tone={PROJECT_STATUS[demo.status].tone}>{t(PROJECT_STATUS[demo.status].label)}</Badge>
              <Badge tone={HEALTH[demo.health].tone}>{t(HEALTH[demo.health].label)}</Badge>
            </div>
            <div className="pp-demo-prog">
              <div className="pp-slider-top">
                <span className="k-field-label">{t("Done")}</span>
                <strong className="num-inline">
                  {demo.pct}% <small className="muted">/ {demo.plannedPct}% {t("planned")}</small>
                </strong>
              </div>
              <Meter value={demo.pct / 100} marker={demo.plannedPct / 100} tone={demo.pct + 2 < demo.plannedPct ? "bad" : "ok"} />
            </div>
            <KeyVals
              items={[
                { k: t("Client"), v: demo.client },
                { k: t("Location"), v: x(demo.location) },
                { k: t("Start"), v: d(demo.start) },
                { k: t("Forecast finish"), v: d(demo.finish) },
                { k: t("Contract finish"), v: d(demo.contractFinish) },
                { k: t("Contract value"), v: <span className="num-inline">{fmtMoney(demo.value)} AZN</span> },
                { k: t("Tasks"), v: demo.tasks },
                { k: t("Next milestone"), v: demo.nextMilestone ? `${x(demo.nextMilestone.name)} · ${d(demo.nextMilestone.date)}` : "—" },
                { k: t("Blocked"), v: demo.blocked },
                { k: t("Overdue"), v: demo.overdue },
              ]}
            />
            <p className="k-note">{t("Demo project — data shown for the portfolio view")}</p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

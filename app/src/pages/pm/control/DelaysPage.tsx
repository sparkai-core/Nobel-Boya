import { Fragment, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Building2, CalendarRange, Check, CircleSlash, Flag, GitBranch, Link2, Plus, RotateCcw, ShieldCheck, Timer, TrendingDown } from "lucide-react";
import { Badge, Empty, FilterChips, Kebab, PageHero, Panel, Register, SearchBox, StatTiles, StatusBadge, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { diffDays, PROJECT_FINISH } from "../../../ops/dates";
import { milestoneForecast, programmeStats, R, statusMeta } from "../../../ops/select";
import { buildingShort } from "../../../lib/loc";
import type { DelayCause, DelayEvent } from "../../../ops/types";
import { CAUSE_LABEL, CAUSES, isOpenDelay, signed, useCpm, useFloat } from "./shared";
import { DelayDialog } from "./DelayDialog";

type StatusFilter = "all" | "open" | "closed";

const LINK_HREF: Record<DelayEvent["links"][number]["kind"], (id: string) => string> = {
  PO: R.order,
  RFI: R.rfi,
  CHANGE: R.change,
  REPORT: R.report,
};
const LINK_LABEL: Record<DelayEvent["links"][number]["kind"], string> = { PO: "Order", RFI: "RFI", CHANGE: "Change", REPORT: "Daily report" };

export function DelaysPage() {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const delays = useOps((s) => s.delays);
  const activities = useOps((s) => s.activities);
  const milestones = useOps((s) => s.milestones);
  const updateDelay = useOps((s) => s.updateDelay);
  const crit = useCpm();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [cause, setCause] = useState<DelayCause | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(params.get("delay"));
  const [formOpen, setFormOpen] = useState(params.get("new") === "1");
  const chainRef = useRef<HTMLDivElement>(null);

  const hasActs = activities.length > 0;
  const contractSet = useOps((s) => !!s.setup.contractFinish);
  const stats = programmeStats(activities);
  const floatLeft = diffDays(stats.forecastFinish, PROJECT_FINISH);
  const msLate = milestones.map((m) => ({ m, f: milestoneForecast(m, activities) })).filter((r) => !r.f.done && r.f.slip > 0);
  const open = delays.filter(isOpenDelay);
  const openLost = open.reduce((a, x2) => a + x2.daysLost, 0);
  const openHits = open.reduce((a, x2) => a + Math.max(0, x2.daysLost - x2.floatAbsorbed), 0);

  const act = (id: string) => activities.find((a) => a.id === id);

  // Cause chart: working days lost per cause, split into float-absorbed and programme-hitting.
  const byCause = useMemo(() => {
    const rows = CAUSES.map((c) => {
      const ds = delays.filter((x2) => x2.cause === c && x2.status !== "REJECTED");
      return { cause: c, n: ds.length, absorbed: ds.reduce((a, x2) => a + Math.min(x2.daysLost, x2.floatAbsorbed), 0), hits: ds.reduce((a, x2) => a + Math.max(0, x2.daysLost - x2.floatAbsorbed), 0) };
    }).filter((r) => r.n > 0);
    return rows.sort((a, b) => b.absorbed + b.hits - (a.absorbed + a.hits));
  }, [delays]);
  const maxCause = Math.max(4, ...byCause.map((r) => r.absorbed + r.hits));
  const yTicks = [0, 0.5, 1].map((k) => Math.round(maxCause * k));

  const filtered = useMemo(
    () => delays.filter((x2) => (status === "all" || (status === "open" ? isOpenDelay(x2) : !isOpenDelay(x2))) && (!cause || x2.cause === cause)),
    [delays, status, cause],
  );
  const rows = useSearch(filtered, q, (x2) => [x2.ref, x2.title, x2.party, act(x2.activityId)?.code, act(x2.activityId)?.name]);

  const selected = delays.find((x2) => x2.id === picked) ?? [...open].sort((a, b) => b.daysLost - b.floatAbsorbed - (a.daysLost - a.floatAbsorbed))[0] ?? delays[0];

  const pick = (id: string) => {
    setPicked(id);
    requestAnimationFrame(() => chainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const setDelayStatus = (dl: DelayEvent, st: DelayEvent["status"]) => {
    updateDelay(dl.id, { status: st });
    toast(t("{id} marked {status}", { id: dl.ref, status: x(statusMeta("delay", st).label).toLowerCase() }));
  };

  const byBuilding = useMemo(() => {
    const map = new Map<string, DelayEvent[]>();
    for (const dl of open) {
      const b = act(dl.activityId)?.building ?? "SITE";
      map.set(b, [...(map.get(b) ?? []), dl]);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activities]);
  const buildingRows = useMemo(
    () => [...byBuilding.entries()].map(([b, ds]) => ({ b, ds, days: ds.reduce((a, x2) => a + x2.daysLost, 0) })).sort((a, b) => b.days - a.days),
    [byBuilding],
  );
  const maxBuildingDays = Math.max(1, ...buildingRows.map((r) => r.days));

  const columns: Column<DelayEvent>[] = [
    { key: "ref", header: t("Ref"), sort: (r) => r.ref, width: "96px", render: (r) => <span className="k-ref">{r.ref}</span> },
    {
      key: "what",
      header: t("What happened"),
      sort: (r) => x(r.title),
      render: (r) => (
        <div className="k-cell-title">
          <strong>{x(r.title)}</strong>
          <small>{r.party}</small>
        </div>
      ),
    },
    { key: "cause", header: t("Cause"), sort: (r) => r.cause, hideBelow: 1100, render: (r) => <Badge tone="neutral" dot={false}>{t(CAUSE_LABEL[r.cause])}</Badge> },
    {
      key: "act",
      header: t("Activity"),
      sort: (r) => act(r.activityId)?.code ?? "",
      render: (r) => {
        const a = act(r.activityId);
        return a ? (
          <Link className="pmc-code" to={R.programme(a.id)} onClick={(e) => e.stopPropagation()} title={x(a.name)}>
            {a.code}
            {crit.get(a.id)?.critical ? <i className="pmc-crit-dot" title={t("On the critical path")} /> : null}
          </Link>
        ) : (
          "—"
        );
      },
    },
    { key: "started", header: t("Started"), sort: (r) => r.startedAt, hideBelow: 900, render: (r) => <span className="num-inline">{d(r.startedAt)}</span> },
    {
      key: "lost",
      header: t("Days lost"),
      align: "right",
      sort: (r) => r.daysLost,
      render: (r) => (
        <span className="pmc-lost">
          <span className="pmc-lost-bar" aria-hidden="true">
            <i className="ok" style={{ width: `${(Math.min(r.daysLost, r.floatAbsorbed) / Math.max(1, r.daysLost)) * 100}%` }} />
            <i className="bad" style={{ width: `${(Math.max(0, r.daysLost - r.floatAbsorbed) / Math.max(1, r.daysLost)) * 100}%` }} />
          </span>
          <b className="num-inline">{r.daysLost}</b>
        </span>
      ),
    },
    { key: "status", header: t("Status"), sort: (r) => r.status, render: (r) => <StatusBadge kind="delay" status={r.status} /> },
    { key: "sev", header: t("Severity"), sort: (r) => ["LOW", "MEDIUM", "HIGH", "CRITICAL"].indexOf(r.severity), hideBelow: 700, render: (r) => <Badge tone={statusMeta("priority", r.severity).tone}>{x(statusMeta("priority", r.severity).label)}</Badge> },
  ];

  return (
    <div className="k-page pmc">
      <PageHero
        eyebrow={t("Project management · Delays")}
        title={t("Delays")}
        subtitle={t("Every event that cost working days, how much float soaked up and what still pushes the milestones and the finish date.")}
        flow={["Log the event", "Preview the impact", "Confirm", "Mitigate", "Resolve"]}
        art="delay"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)} disabled={!hasActs} title={hasActs ? undefined : t("Add activities to the programme first.")}>
            <Plus size={15} />
            {t("New delay event")}
          </button>
        }
      />

      {!hasActs ? (
        <div className="k-callout k-tone-info">
          <CalendarRange size={18} />
          <span>
            {t("A delay is logged against an activity of the programme. The programme has no activities yet.")}{" "}
            <Link to={R.programme()} className="k-link-btn">
              {t("Open the programme")}
            </Link>
          </span>
        </div>
      ) : null}

      <StatTiles
        items={[
          hasActs
            ? { icon: <Timer size={14} />, label: t("Float left on the critical path"), value: t("{n} d", { n: signed(floatLeft) }), tone: floatLeft < 0 ? "bad" : floatLeft < 5 ? "warn" : "ok", sub: contractSet ? t("against the contract finish {date}", { date: d(PROJECT_FINISH) }) : t("no contract finish set: measured to the latest activity finish") }
            : { icon: <Timer size={14} />, label: t("Float left on the critical path"), value: "—", tone: "muted", sub: t("no programme yet") },
          hasActs
            ? { icon: <Flag size={14} />, label: t("Forecast finish"), value: d(stats.forecastFinish), tone: stats.varianceDays > 0 ? "bad" : "ok", sub: stats.varianceDays > 0 ? t("{n} days after the contract date", { n: stats.varianceDays }) : t("on or before the contract date") }
            : { icon: <Flag size={14} />, label: t("Forecast finish"), value: "—", tone: "muted", sub: t("no programme yet") },
          { icon: <TrendingDown size={14} />, label: t("Milestones forecast late"), value: milestones.length ? String(msLate.length) : "—", tone: !milestones.length ? "muted" : msLate.length ? "bad" : "ok", sub: !milestones.length ? t("no milestones yet") : msLate.length ? msLate.slice(0, 4).map((r) => r.m.code).join(" · ") : t("all on track"), onClick: () => navigate(R.milestones) },
          { icon: <CircleSlash size={14} />, label: t("Days lost to open delays"), value: String(openLost), tone: openHits ? "warn" : "neutral", sub: t("{n} of them still hit the programme", { n: openHits }) },
        ]}
      />

      <div className="k-grid-main">
        <Panel
          title={t("Working days lost, by cause")}
          icon={<TrendingDown size={15} />}
          sub={t("Each column splits into the days float absorbed and the days that still hit the programme. Click a column to filter the register.")}
          actions={cause ? <button type="button" className="k-link-btn" onClick={() => setCause(null)}>{t("Clear filter")}</button> : null}
        >
          {byCause.length ? (
            <div className="pmc-cause">
              <div className="pmc-cause-y" aria-hidden="true">
                {yTicks.map((v) => (
                  <span key={v} style={{ bottom: `${(v / maxCause) * 100}%` }}>{v}</span>
                ))}
              </div>
              <div className="pmc-cause-plot">
                {yTicks.map((v) => (
                  <i key={v} className="pmc-cause-grid" style={{ bottom: `${(v / maxCause) * 100}%` }} />
                ))}
                {byCause.map((r, i) => (
                  <button
                    key={r.cause}
                    type="button"
                    className={`pmc-cause-col${cause === r.cause ? " on" : ""}${cause && cause !== r.cause ? " dim" : ""}`}
                    onClick={() => setCause(cause === r.cause ? null : r.cause)}
                    aria-pressed={cause === r.cause}
                    title={`${t(CAUSE_LABEL[r.cause])}: ${t("{a} absorbed, {b} hit the programme", { a: r.absorbed, b: r.hits })}`}
                  >
                    <span className="pmc-cause-total num-inline">{r.absorbed + r.hits}</span>
                    <span className="pmc-cause-stack k-grow-y" style={{ height: `${((r.absorbed + r.hits) / maxCause) * 100}%`, animationDelay: `${i * 60}ms` }}>
                      <i className="hits" style={{ flexGrow: r.hits }} />
                      <i className="abs" style={{ flexGrow: r.absorbed }} />
                    </span>
                    <span className="pmc-cause-label">{t(CAUSE_LABEL[r.cause])}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Empty
              title={t("No delays logged")}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setFormOpen(true)} disabled={!hasActs}>
                  <Plus size={14} />
                  {t("New delay event")}
                </button>
              }
            >
              {t("Log the first event that cost working days on site.")}
            </Empty>
          )}
          <div className="k-legend">
            <span style={{ ["--lc" as string]: "var(--redline)" }}>{t("Still hits the programme")}</span>
            <span style={{ ["--lc" as string]: "color-mix(in srgb, var(--ok) 55%, white)" }}>{t("Absorbed by float")}</span>
          </div>
        </Panel>

        <Panel title={t("Open delays by building")} icon={<Building2 size={15} />} sub={t("Working days lost to open delays, by the building of the activity hit.")}>
          {buildingRows.length ? (
            <ul className="pmc-plan-list">
              {buildingRows.map(({ b, ds, days }) => (
                <li key={b}>
                  <span className="k-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                    <strong className="truncate" style={{ flex: 1 }}>{buildingShort(b, lang)}</strong>
                    <span className="pmc-tally-bar" style={{ width: 90 }}>
                      <i className="k-grow-x" style={{ width: `${(days / maxBuildingDays) * 100}%` }} />
                    </span>
                    <b className="num-inline">{t("{n} d", { n: days })}</b>
                  </span>
                  <span className="pmc-plan-chips">
                    {ds.map((dl) => (
                      <button key={dl.id} type="button" className={`pmc-chip${selected?.id === dl.id ? " on" : ""}`} onClick={() => pick(dl.id)}>
                        {dl.ref} · {t("{n} d", { n: dl.daysLost })}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t("No open delays.")}</p>
          )}
        </Panel>
      </div>

      <div ref={chainRef}>{selected ? <ImpactChain dl={selected} onStatus={setDelayStatus} /> : null}</div>

      <Register
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => pick(r.id)}
        rowClass={(r) => (r.id === selected?.id ? "pmc-row-on" : undefined)}
        initialSort={{ key: "started", dir: "desc" }}
        toolbar={
          <Toolbar
            end={
              <FilterChips
                value={cause}
                onChange={setCause}
                options={CAUSES.filter((c) => delays.some((x2) => x2.cause === c)).map((c) => ({ value: c, label: t(CAUSE_LABEL[c]), count: delays.filter((x2) => x2.cause === c).length }))}
              />
            }
          >
            <SearchBox value={q} onChange={setQ} placeholder="Search delays, activities, parties" />
            <Segmented
              label={t("Status")}
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: t("All"), count: delays.length },
                { value: "open", label: t("Open"), count: open.length },
                { value: "closed", label: t("Closed"), count: delays.length - open.length },
              ]}
            />
          </Toolbar>
        }
        empty={
          !delays.length ? (
            t("No delays logged yet.")
          ) : (
          <>
            {t("No delays match.")}{" "}
            <button type="button" className="k-link-btn" onClick={() => { setStatus("all"); setCause(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </>
          )
        }
      />

      <DelayDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          if (params.get("new")) setParams({}, { replace: true });
        }}
        initial={params.get("new") ? { title: params.get("title") ?? undefined, activityId: params.get("activity") ?? undefined } : undefined}
        onSaved={(id) => setPicked(id)}
      />
    </div>
  );
}

/** Six linked boxes: event → activity → float → programme → milestones → finish. */
function ImpactChain({ dl, onStatus }: { dl: DelayEvent; onStatus: (dl: DelayEvent, st: DelayEvent["status"]) => void }) {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const milestones = useOps((s) => s.milestones);
  const crit = useCpm();
  const floatOf = useFloat();
  const a = activities.find((v) => v.id === dl.activityId);
  const c = a ? crit.get(a.id) : undefined;
  const stats = programmeStats(activities);
  const hits = Math.max(0, dl.daysLost - dl.floatAbsorbed);
  const ms = dl.milestoneIds.map((id) => milestones.find((m) => m.id === id)).filter(Boolean).map((m) => ({ m: m!, f: milestoneForecast(m!, activities) }));
  const closed = !isOpenDelay(dl);

  const boxes = [
    {
      key: "event",
      label: t("Delay event"),
      value: t("{n} d lost", { n: dl.daysLost }),
      tone: "neutral",
      body: (
        <>
          <strong>{x(dl.title)}</strong>
          <small>
            {t(CAUSE_LABEL[dl.cause])} · {t("since {date}", { date: d(dl.startedAt, false) })}
          </small>
        </>
      ),
    },
    {
      key: "act",
      label: t("Activity hit"),
      value: a ? a.code : "—",
      tone: c?.critical ? "bad" : "brand",
      body: a ? (
        <>
          <Link to={R.programme(a.id)} className="pmc-chain-link">{x(a.name)}</Link>
          <small>{c?.critical ? t("On the critical path") : t("{n} days of float today", { n: floatOf(a.id) })}</small>
        </>
      ) : null,
    },
    { key: "abs", label: t("Absorbed by float"), value: t("{n} d", { n: Math.min(dl.daysLost, dl.floatAbsorbed) }), tone: "ok", body: <small>{dl.floatAbsorbed >= dl.daysLost ? t("Float covers the whole delay.") : t("Float ran out after {n} days.", { n: dl.floatAbsorbed })}</small> },
    { key: "hits", label: t("Still hits the programme"), value: t("{n} d", { n: hits }), tone: hits ? "bad" : "ok", body: <small>{hits ? t("Pushes {code} and everything after it.", { code: a?.code ?? "" }) : t("Nothing downstream moves.")}</small> },
    {
      key: "ms",
      label: t("Milestones moved"),
      value: String(ms.length),
      tone: ms.length ? "warn" : "ok",
      body: ms.length ? (
        <ul className="pmc-chain-ms">
          {ms.map((r) => (
            <li key={r.m.id}>
              <b>{r.m.code}</b> <span className="truncate">{x(r.m.name)}</span> <em className={r.f.slip > 0 ? "k-text-bad" : "k-text-ok"}>{t("{n} d", { n: signed(r.f.slip) })}</em>
            </li>
          ))}
        </ul>
      ) : (
        <small>{t("No milestone moves.")}</small>
      ),
    },
    { key: "finish", label: t("Project finish"), value: d(stats.forecastFinish, false), tone: stats.varianceDays > 0 && hits ? "bad" : "ok", body: <small>{stats.varianceDays > 0 ? t("{n} days after the contract date", { n: stats.varianceDays }) : t("on or before the contract date")}</small> },
  ] as const;

  return (
    <Panel
      className="pmc-chain-panel"
      title={
        <span className="k-row" style={{ gap: 8 }}>
          {t("Impact chain")} <span className="k-ref">{dl.ref}</span>
        </span>
      }
      icon={<GitBranch size={15} />}
      actions={
        <span className="k-row" style={{ gap: 6 }}>
          <StatusBadge kind="delay" status={dl.status} />
          <button type="button" className="btn btn-ghost btn-sm" disabled={dl.status === "CONFIRMED" || closed} onClick={() => onStatus(dl, "CONFIRMED")}>
            <Check size={14} />
            {t("Confirm")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={dl.status === "MITIGATED" || dl.status === "RESOLVED"} onClick={() => onStatus(dl, "MITIGATED")}>
            <ShieldCheck size={14} />
            {t("Mitigated")}
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={dl.status === "RESOLVED"} onClick={() => onStatus(dl, "RESOLVED")}>
            {t("Resolved")}
          </button>
          <Kebab
            items={[
              { label: t("Reject"), icon: <CircleSlash size={14} />, disabled: dl.status === "REJECTED", onClick: () => onStatus(dl, "REJECTED") },
              { label: t("Reopen"), icon: <RotateCcw size={14} />, disabled: dl.status === "OPEN", onClick: () => onStatus(dl, "OPEN") },
            ]}
          />
        </span>
      }
    >
      <div className="pmc-chain-meta">
        <Badge tone={statusMeta("priority", dl.severity).tone}>{x(statusMeta("priority", dl.severity).label)}</Badge>
        {dl.criticalPathChanged ? (
          <Badge tone="bad">
            <GitBranch size={12} /> {t("Changes the critical path")}
          </Badge>
        ) : (
          <Badge tone="ok" dot={false}>{t("Critical path unchanged")}</Badge>
        )}
        <span className="muted small">{dl.party}</span>
        {dl.links.map((l) => (
          <Link key={`${l.kind}-${l.id}`} to={LINK_HREF[l.kind](l.id)} className="pmc-chip link">
            <Link2 size={12} />
            {t(LINK_LABEL[l.kind])} {l.kind === "REPORT" ? l.id.slice(3) : l.id}
          </Link>
        ))}
      </div>
      <ol className="pmc-chain" key={dl.id}>
        {boxes.map((b, i) => (
          <Fragment key={b.key}>
            {i ? (
              <li className="pmc-chain-arrow" aria-hidden="true">
                <ArrowRight size={16} />
              </li>
            ) : null}
            <li className={`pmc-chain-box k-tone-${b.tone}`} style={{ animationDelay: `${i * 70}ms` }}>
              <span className="pmc-chain-label">{b.label}</span>
              <b className="pmc-chain-value num-inline">{b.value}</b>
              <div className="pmc-chain-body">{b.body}</div>
            </li>
          </Fragment>
        ))}
      </ol>
      {dl.notes ? <p className="k-note">{x(dl.notes)}</p> : null}
    </Panel>
  );
}

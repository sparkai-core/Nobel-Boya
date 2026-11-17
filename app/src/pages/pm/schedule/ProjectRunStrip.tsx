import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Ban, CircleCheck, Clock, Radio } from "lucide-react";
import { Badge, HeaderArt, useL } from "../../../components/kit";
import { data } from "../../../data";
import { projectName, projectPlace } from "../../../lib/loc";
import { diffDays, PROJECT_START, TODAY } from "../../../ops/dates";
import { R, type Tone } from "../../../ops/select";
import type { Txt } from "../../../ops/types";
import { lateness, programmeFilter, useSchedule } from "./model";

type Health = { score: number; status: Txt; tone: Tone };

/**
 * Project workspace header for the Schedule pages: who the project is, where it stands on its own
 * calendar (start → % done with a today line → forecast finish) and what is wrong right now.
 * `big` renders the full header used on the PM home; otherwise a slim strip under a PageHero.
 */
export function ProjectRunStrip({ big, health, actions }: { big?: boolean; health?: Health; actions?: ReactNode }) {
  const { t, x, d, lang } = useL();
  const { activities, milestones, stats, outlook } = useSchedule();
  const blocked = activities.filter((a) => a.status === "BLOCKED").length;
  const late = activities.filter((a) => lateness(a)).length;

  const chips = (
    <div className="pms-run-chips">
      {blocked ? (
        <Link to={programmeFilter("blocked")} className="pms-chip bad">
          <Ban size={13} />
          {t("{n} blocked", { n: blocked })}
        </Link>
      ) : null}
      {late ? (
        <Link to={programmeFilter("late")} className="pms-chip bad">
          <Clock size={13} />
          {t("{n} running late", { n: late })}
        </Link>
      ) : null}
      {outlook.pendingDays > 0 ? (
        <Link to={R.live} className="pms-chip warn">
          <Radio size={13} />
          {t("{n} site impacts pending", { n: outlook.pending.length })}
        </Link>
      ) : null}
      {!blocked && !late ? (
        <span className="pms-chip ok">
          <CircleCheck size={13} />
          {t("Nothing blocked or late")}
        </span>
      ) : null}
    </div>
  );

  if (!big)
    return (
      <section className="pms-strip" aria-label={t("Where the programme stands")}>
        {runBar(true)}
        {chips}
      </section>
    );

  return (
    <header className="k-hero has-art pms-ws">
      <div className="k-hero-copy">
        <span className="k-eyebrow">{t("Qobu · Programme")}</span>
        <div className="pms-ws-title">
          <h1>{projectName(lang)}</h1>
          <span className="pms-ws-badges">
            <Badge tone="ok">{t("Active")}</Badge>
            {health ? (
              <Badge tone={health.tone}>
                {t("Health {n}", { n: health.score })} · {x(health.status)}
              </Badge>
            ) : null}
            {outlook.lateDays > 0 ? (
              <Badge tone="bad">
                <AlertTriangle size={11} /> {t("Finish {n} days late", { n: outlook.lateDays })}
              </Badge>
            ) : (
              <Badge tone="ok">{t("Finish on time")}</Badge>
            )}
          </span>
        </div>
        <p className="pms-ws-meta">
          {data.project.client} · {projectPlace(lang)} · {t("{n} tasks", { n: activities.length })} · {t("{n} milestones", { n: milestones.length })}
        </p>
        {runBar(false)}
        {chips}
        {actions ? <div className="k-hero-actions">{actions}</div> : null}
      </div>
      <div className="k-hero-art" aria-hidden="true">
        <HeaderArt name="pm" />
      </div>
    </header>
  );

  function runBar(compact: boolean) {
    const end = outlook.forecast > outlook.contract ? outlook.forecast : outlook.contract;
    const span = Math.max(1, diffDays(PROJECT_START, end));
    const pos = (date: string) => `${Math.max(0, Math.min(1, diffDays(PROJECT_START, date) / span)) * 100}%`;
    const done = Math.round(stats.actualPct * 100);
    const plan = Math.round(stats.plannedPct * 100);
    const left = diffDays(TODAY, outlook.forecast);
    return (
      <div className={`pms-run${compact ? " compact" : ""}`}>
        <div className="pms-run-track" role="img" aria-label={t("{a}% done, plan says {b}%", { a: done, b: plan })}>
          <i className="pms-run-fill" style={{ width: `${done}%` }} />
          {outlook.forecast > outlook.contract ? <i className="pms-run-over" style={{ left: pos(outlook.contract), right: 0 }} title={t("Past the contract date")} /> : null}
          <i className="pms-run-plan" style={{ left: `${plan}%` }} title={t("Plan says {n}%", { n: plan })} />
          <b className="pms-run-today" style={{ left: pos(TODAY) }}>
            <span>{t("Today")}</span>
          </b>
          <b className="pms-run-contract" style={{ left: pos(outlook.contract) }}>
            <span>{t("Contract")}</span>
          </b>
        </div>
        <div className="pms-run-ends">
          <span>
            <small>{t("Started")}</small>
            <b className="num-inline">{d(PROJECT_START)}</b>
          </span>
          <span className="end">
            <small>{t("Forecast finish")}</small>
            <b className={`num-inline${outlook.lateDays > 0 ? " k-text-bad" : ""}`}>{d(outlook.forecast)}</b>
          </span>
        </div>
        <p className="pms-run-words">
          <b>{t("{n}% done", { n: done })}</b>
          <span>{t("plan says {n}%", { n: plan })}</span>
          <span>{t("{n} days left", { n: Math.max(0, left) })}</span>
          <span className={outlook.lateDays > 0 ? "k-text-bad" : "k-text-ok"}>
            {t("finish forecast {date}", { date: d(outlook.forecast, false) })} (
            {outlook.lateDays > 0 ? t("{n} days late", { n: outlook.lateDays }) : outlook.lateDays < 0 ? t("{n} days early", { n: -outlook.lateDays }) : t("on the contract date")})
          </span>
        </p>
      </div>
    );
  }
}

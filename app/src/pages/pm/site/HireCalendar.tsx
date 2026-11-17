import { useL } from "../../../components/kit";
import { diffDays, monthShort, TODAY } from "../../../ops/dates";
import type { Equipment, Vendor } from "../../../ops/types";
import { CATEGORY, isRestDay, siteMeta, WEEK } from "./shared";

const FROM = "2026-10-01";
const TO = "2027-04-30";
const SPAN = diffDays(FROM, TO);
const MONTHS = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"];
const pct = (iso: string) => Math.max(0, Math.min(100, (diffDays(FROM, iso) / SPAN) * 100));

/**
 * One row per hired machine: the hire period as a bar on an Oct 2026 – Apr 2027 axis (used part solid,
 * the rest still ahead), the last seven days of hours as a mini strip with idle days hatched, a today line
 * and an "off-hire soon" flag when the return date is within ten days.
 */
export function HireCalendar({ items, vendors, selected, onSelect }: { items: Equipment[]; vendors: Vendor[]; selected: string | null; onSelect: (id: string) => void }) {
  const { t, x, d, lang } = useL();
  const rows = items.filter((e) => e.ownership === "HIRED").sort((a, b) => (a.hireTo ?? "9").localeCompare(b.hireTo ?? "9"));
  if (!rows.length) return <p className="muted small">{t("No hired machines on this project.")}</p>;
  const now = pct(TODAY);

  return (
    <div className="st-hire-scroll">
      <div className="st-hire">
        <div className="st-hire-head">
          <span>{t("Machine")}</span>
          <span>{t("Last 7 days")}</span>
          <span className="st-hire-months">
            {MONTHS.map((mo) => (
              <i key={mo} style={{ left: `${pct(`${mo}-01`)}%` }}>
                {monthShort(Number(mo.slice(5)) - 1, lang)}
                {mo.endsWith("-01") || mo === MONTHS[0] ? ` ${mo.slice(2, 4)}` : ""}
              </i>
            ))}
            <b className="st-hire-today-label" style={{ left: `${now}%` }}>
              {t("Today")}
            </b>
          </span>
          <span>{t("Returns")}</span>
        </div>
        {rows.map((e, idx) => {
          const meta = siteMeta("equipment", e.status);
          const Icon = CATEGORY[e.category].icon;
          const start = e.hireFrom ?? FROM;
          const end = e.hireTo ?? TO;
          const left = pct(start);
          const right = pct(end);
          const used = Math.max(0, Math.min(right, now) - left);
          const ahead = Math.max(0, right - Math.max(left, now));
          const daysLeft = e.hireTo ? diffDays(TODAY, e.hireTo) : null;
          const soon = e.status !== "OFF_HIRE" && daysLeft != null && daysLeft >= 0 && daysLeft <= 10;
          const vendor = vendors.find((v) => v.id === e.vendorId)?.name ?? t("Local hire");
          const tone = e.status === "OFF_HIRE" ? "off" : e.status === "BROKEN_DOWN" ? "bad" : e.status === "IDLE" || e.status === "MAINTENANCE" ? "idle" : "work";
          return (
            <button key={e.id} type="button" className={`st-hire-row${selected === e.id ? " on" : ""}`} onClick={() => onSelect(e.id)} style={{ animationDelay: `${idx * 50}ms` }}>
              <span className="st-hire-name">
                <span className="st-hire-icon" style={{ ["--mc" as string]: `var(--${meta.tone === "bad" ? "redline" : meta.tone === "warn" ? "amber" : meta.tone === "ok" ? "ok" : "faint"})` }}>
                  <Icon size={14} />
                </span>
                <span className="k-cell-title">
                  <strong>{x(e.name)}</strong>
                  <small>
                    {e.code} · {vendor}
                  </small>
                </span>
              </span>
              <span className="st-hire-strip" aria-label={t("Hours, last 7 days")}>
                {e.hours.map((h, i) => (
                  <i key={i} className={h > 0 ? undefined : isRestDay(WEEK[i]!) || i === e.hours.length - 1 ? "rest" : "idle"} style={{ height: h === 0 ? "100%" : `${Math.max(14, Math.min(100, (h / 12) * 100))}%` }} title={`${d(WEEK[i]!, false)}: ${h} ${t("h")}`} />
                ))}
              </span>
              <span className="st-hire-track">
                {MONTHS.slice(1).map((mo) => (
                  <i key={mo} className="st-hire-gridline" style={{ left: `${pct(`${mo}-01`)}%` }} />
                ))}
                {used > 0 ? <span className={`st-hire-bar used ${tone} k-grow-x`} style={{ left: `${left}%`, width: `${used}%` }} /> : null}
                {ahead > 0 ? <span className={`st-hire-bar ahead ${tone}`} style={{ left: `${Math.max(left, now)}%`, width: `${ahead}%` }} /> : null}
                <span className="st-hire-rate num-inline" style={right < 82 ? { left: `${right + 1.5}%`, top: "8px" } : { left: `${Math.min(left + 1, 80)}%` }}>
                  {e.dayRate} {t("AZN/day")}
                </span>
                <i className="st-hire-today" style={{ left: `${now}%` }} />
              </span>
              <span className="st-hire-end">
                <strong className="num-inline">{e.hireTo ? d(e.hireTo, false) : "—"}</strong>
                {e.status === "OFF_HIRE" ? (
                  <small>{t("Off hire")}</small>
                ) : soon ? (
                  <small className="st-flag-soon">{daysLeft === 0 ? t("Off-hire today") : t("Off-hire in {n} d", { n: daysLeft ?? 0 })}</small>
                ) : daysLeft != null ? (
                  <small>{t("{n} days left", { n: daysLeft })}</small>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="k-legend st-hire-legend">
        <span className="lg-work">{t("Working")}</span>
        <span className="lg-idle">{t("Idle or in the workshop")}</span>
        <span className="lg-bad">{t("Broken down")}</span>
        <span className="lg-ahead">{t("Hire still ahead")}</span>
        <span className="lg-hatch">{t("Idle day")}</span>
      </div>
    </div>
  );
}

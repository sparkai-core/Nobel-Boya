import { useNavigate } from "react-router-dom";
import { useL } from "../../../components/kit";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import type { Activity, Submittal } from "../../../ops/types";
import { RP, SUB_META, subApproved, subDates } from "./shared";

const PX = 4.6;

/**
 * Submittal runway: for each submittal a bar from submit-by to final-due (the review window, in its
 * status colour) and on to required-on-site (the supplier lead time), with a today line.
 */
export function Runway({ items, activities, focus }: { items: Submittal[]; activities: Activity[]; focus?: string }) {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  if (!items.length) return null;
  const rows = items.map((s) => ({ s, ...subDates(s, activities) }));
  const from = addDays([TODAY, ...rows.map((r) => r.s.submitBy), ...rows.map((r) => r.finalDue)].reduce((a, b) => (a < b ? a : b)), -6);
  const to = addDays([TODAY, ...rows.map((r) => r.required)].reduce((a, b) => (a > b ? a : b)), 8);
  const days = diffDays(from, to);
  const W = Math.max(520, days * PX);
  const X = (date: string) => diffDays(from, date) * PX;
  const months: string[] = [];
  for (let m = `${from.slice(0, 7)}-01`; m <= to; m = addDays(m, 32).slice(0, 7) + "-01") if (m >= from) months.push(m);

  return (
    <div className="pg-runway">
      <div className="pg-runway-scroll">
        <div className="pg-runway-inner" style={{ ["--pg-w" as string]: `${W}px` }}>
          <div className="pg-runway-scale">
            <span className="pg-runway-lab" />
            <span className="pg-runway-track">
              {months.map((m) => (
                <i key={m} style={{ left: X(m) }}>
                  {d(m, false).replace(/^1 /, "")}
                </i>
              ))}
              <b className="pg-runway-today-tag" style={{ left: X(TODAY) }}>
                {t("Today")}
              </b>
            </span>
          </div>
          {rows.map(({ s, finalDue, required, late }) => {
            const tone = SUB_META[s.status].tone;
            const squeezed = finalDue < s.submitBy;
            const done = subApproved(s);
            return (
              <button key={s.id} type="button" className={`pg-runway-row${focus === s.id ? " focus" : ""}${late ? " late" : ""}`} onClick={() => navigate(RP.submittal(s.id))} title={`${s.ref} · ${x(s.title)}`}>
                <span className="pg-runway-lab">
                  <span className="k-ref">{s.ref}</span>
                  <span className="truncate">{x(s.title)}</span>
                </span>
                <span className="pg-runway-track">
                  {months.map((m) => (
                    <i key={m} className="pg-runway-grid" style={{ left: X(m) }} />
                  ))}
                  {squeezed ? (
                    <span className="pg-rw-squeeze" style={{ left: X(finalDue), width: Math.max(2, X(s.submitBy) - X(finalDue)) }} title={t("Submitted after the final due date")} />
                  ) : (
                    <span className={`pg-rw-review k-tone-${tone}${done ? " done" : ""}`} style={{ left: X(s.submitBy), width: Math.max(3, X(finalDue) - X(s.submitBy)) }} />
                  )}
                  <span className="pg-rw-lead" style={{ left: X(finalDue), width: Math.max(3, X(required) - X(finalDue)) }}>
                    <small>{t("{n} d lead", { n: s.leadDays })}</small>
                  </span>
                  <span className="pg-rw-submit" style={{ left: X(s.submitBy) }} />
                  <span className={`pg-rw-due${late ? " late" : ""}`} style={{ left: X(finalDue) }} />
                  <span className="pg-rw-site" style={{ left: X(required) }} />
                </span>
              </button>
            );
          })}
          <span className="pg-runway-today" style={{ left: `calc(var(--pg-lab) + ${X(TODAY)}px)` }} aria-hidden="true" />
        </div>
      </div>
      <div className="k-legend pg-runway-legend">
        <span className="pg-lg-submit">{t("Submit by")}</span>
        <span className="pg-lg-review">{t("Review window")}</span>
        <span className="pg-lg-due">{t("Final due")}</span>
        <span className="pg-lg-lead">{t("Supplier lead time")}</span>
        <span className="pg-lg-site">{t("Required on site")}</span>
      </div>
    </div>
  );
}

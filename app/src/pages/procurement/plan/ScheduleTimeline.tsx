import { useEffect, useMemo, useRef } from "react";
import { Badge, useL } from "../../../components/kit";
import { addDays, diffDays, maxDate, minDate, TODAY } from "../../../ops/dates";
import { APPROVAL_DAYS, monthLabel, monthsFrom, PKG_STATUS, RFQ_DAYS, type DatedPkg } from "./shared";

const PX = 4;

/**
 * Back-scheduled bars, one per package: RFQ window → approval → latest PO → lead time → on site.
 * Diamonds mark the latest PO date and the date the site needs the material. Red where a latest
 * date has passed without an order; a ghost bar shows where it lands if ordered today.
 */
export function ScheduleTimeline({ pkgs, picked, onPick }: { pkgs: DatedPkg[]; picked: string | null; onPick: (key: string) => void }) {
  const { t, x, d, lang } = useL();
  const scroller = useRef<HTMLDivElement>(null);

  const dom = useMemo(() => {
    const first = pkgs.length ? minDate(addDays(TODAY, -21), ...pkgs.map((p) => p.latestRfq)) : addDays(TODAY, -21);
    const last = pkgs.length ? maxDate(addDays(TODAY, 60), ...pkgs.map((p) => p.required), ...pkgs.map((p) => p.ifToday), ...pkgs.map((p) => p.expectedAt ?? p.required)) : addDays(TODAY, 90);
    const from = `${first.slice(0, 7)}-01`;
    const to = addDays(last, 12);
    return { from, to, days: diffDays(from, to), months: monthsFrom(from, to) };
  }, [pkgs]);

  const X = (date: string) => diffDays(dom.from, date) * PX;
  const W = (a: string, b: string) => Math.max(2, diffDays(a, b) * PX);
  const todayX = X(TODAY);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, todayX - 150);
  }, [todayX]);

  return (
    <div className="ppl-tl">
      <div className="ppl-tl-scroll" ref={scroller}>
        <div className="ppl-tl-inner" style={{ ["--tl-w" as string]: `${dom.days * PX}px` }}>
          <div className="ppl-tl-row ppl-tl-head">
            <div className="ppl-tl-label">{t("Package")}</div>
            <div className="ppl-tl-track">
              {dom.months.map((m) => (
                <span key={m} className="ppl-tl-month" style={{ left: Math.max(0, X(`${m}-01`)) }}>
                  {monthLabel(m, lang, m.endsWith("-01") || m === dom.months[0])}
                </span>
              ))}
              <span className="ppl-tl-todaytag" style={{ left: todayX }}>
                {t("Today")}
              </span>
            </div>
          </div>
          {pkgs.map((p, i) => {
            const ordered = p.status === "ORDERED" || p.status === "DELIVERED";
            const meta = PKG_STATUS[p.status];
            const apprAt = addDays(p.latestRfq, RFQ_DAYS);
            const onSite = addDays(p.latestPo, p.lead);
            const rfqLate = !ordered && (p.status === "NONE" || p.status === "MR") && p.latestRfq < TODAY;
            const ghostLate = p.ifToday > p.required;
            return (
              <button key={p.key} type="button" className={`ppl-tl-row ppl-tl-pkg${picked === p.key ? " on" : ""}${p.late ? " late" : ""}`} onClick={() => onPick(p.key)} style={{ animationDelay: `${i * 30}ms` }}>
                <span className="ppl-tl-label">
                  <strong>{x(p.name)}</strong>
                  <small>
                    {p.act ? <span className="k-mono">{p.act.code}</span> : null}
                    <Badge tone={p.late ? "bad" : p.dueSoon ? "warn" : meta.tone}>{p.late ? t("Late to order") : t(meta.label)}</Badge>
                  </small>
                </span>
                <span className="ppl-tl-track">
                  <span className={`ppl-tl-plan${ordered ? " done" : ""}`}>
                    <i className="ppl-seg ppl-seg-rfq k-grow-x" style={{ left: X(p.latestRfq), width: W(p.latestRfq, apprAt) }} title={t("RFQ window: {a} to {b}", { a: d(p.latestRfq, false), b: d(apprAt, false) })} />
                    <i className="ppl-seg ppl-seg-appr k-grow-x" style={{ left: X(apprAt), width: W(apprAt, p.latestPo) }} title={t("Approval: {n} days", { n: APPROVAL_DAYS })} />
                    <i className="ppl-seg ppl-seg-lead k-grow-x" style={{ left: X(p.latestPo), width: W(p.latestPo, onSite) }} title={t("Lead time: {n} days", { n: p.lead })} />
                    <i className="ppl-seg ppl-seg-buf" style={{ left: X(onSite), width: W(onSite, p.required) }} />
                  </span>
                  {p.late ? <i className="ppl-seg ppl-seg-overdue" style={{ left: X(p.latestRfq), width: W(p.latestRfq, TODAY) }} /> : rfqLate ? <i className="ppl-seg ppl-seg-rfqlate" style={{ left: X(p.latestRfq), width: W(p.latestRfq, TODAY) }} /> : null}
                  {p.late ? (
                    <>
                      <i className={`ppl-seg ppl-seg-ghost${ghostLate ? " bad" : ""}`} style={{ left: todayX, width: W(TODAY, p.ifToday) }} title={t("Ordered today: on site {d}", { d: d(p.ifToday) })} />
                      <i className={`ppl-dia ppl-dia-ghost${ghostLate ? " bad" : ""}`} style={{ left: X(p.ifToday) }} />
                    </>
                  ) : null}
                  {ordered && p.orderedAt && p.expectedAt ? (
                    <>
                      <i className={`ppl-seg ppl-seg-order${p.expectedAt > p.required ? " bad" : ""}`} style={{ left: X(p.orderedAt), width: W(p.orderedAt, p.expectedAt) }} title={t("On order: {a} to {b}", { a: d(p.orderedAt, false), b: d(p.expectedAt, false) })} />
                      <i className="ppl-dot-po" style={{ left: X(p.orderedAt) }} title={t("PO issued {d}", { d: d(p.orderedAt) })} />
                    </>
                  ) : null}
                  <i className={`ppl-dia ppl-dia-po${p.late ? " bad" : ordered ? " done" : ""}`} style={{ left: X(p.latestPo) }} title={t("Latest PO {d}", { d: d(p.latestPo) })} />
                  <i className={`ppl-dia ppl-dia-need${ordered && p.expectedAt && p.expectedAt > p.required ? " bad" : ""}`} style={{ left: X(p.required) }} title={t("Required on site {d}", { d: d(p.required) })} />
                </span>
              </button>
            );
          })}
          <span className="ppl-tl-today" style={{ ["--tx" as string]: `${todayX}px` }} aria-hidden="true" />
        </div>
      </div>
      <div className="k-legend ppl-tl-legend">
        <span className="ppl-lg ppl-lg-rfq">{t("RFQ window ({n} d)", { n: RFQ_DAYS })}</span>
        <span className="ppl-lg ppl-lg-appr">{t("Approval ({n} d)", { n: APPROVAL_DAYS })}</span>
        <span className="ppl-lg ppl-lg-lead">{t("Lead time")}</span>
        <span className="ppl-lg ppl-lg-order">{t("On order")}</span>
        <span className="ppl-lg ppl-lg-dia-po">{t("Latest PO")}</span>
        <span className="ppl-lg ppl-lg-dia-need">{t("Required on site")}</span>
        <span className="ppl-lg ppl-lg-late">{t("Passed without a PO")}</span>
      </div>
    </div>
  );
}

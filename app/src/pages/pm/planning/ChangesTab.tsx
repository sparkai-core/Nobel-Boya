import { useMemo, useState } from "react";
import { Download, GitCompareArrows, History, Undo2, Upload } from "lucide-react";
import { Badge, Dialog, Empty, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays } from "../../../ops/dates";
import type { ProgrammeRev } from "../../../ops/types";
import { actsFromRev, buildXer, compareWith, download } from "./model";

const KIND_LABEL: Record<ProgrammeRev["kind"], string> = { IMPORTED: "File imported", MANUAL: "Saved by hand", KEPT: "Kept before a new file" };
const KIND_TONE = { IMPORTED: "brand", MANUAL: "neutral", KEPT: "muted" } as const;

/** What changed since a saved point, and the list of saved points (compare / download / go back). */
export function ChangesTab({ onImport }: { onImport: () => void }) {
  const { t, x, d, stamp } = useL();
  const workweek = useOps((s) => s.workweek);
  const programmes = useOps((s) => s.programmes);
  const revisions = useOps((s) => s.revisions);
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const wbs = useOps((s) => s.wbs);
  const dataDate = useOps((s) => s.dataDate);
  const restoreRevision = useOps((s) => s.restoreRevision);
  const sorted = useMemo(() => [...revisions].sort((a, b) => a.rev - b.rev || a.at.localeCompare(b.at)), [revisions]);
  const [revId, setRevId] = useState<string | null>(sorted[0]?.id ?? null);
  const [goBack, setGoBack] = useState<ProgrammeRev | null>(null);
  const [all, setAll] = useState(false);
  const rev = sorted.find((r) => r.id === revId) ?? sorted[0];
  const cmp = useMemo(() => (rev ? compareWith(rev, activities) : null), [rev, activities]);

  if (!rev || !cmp)
    return (
      <div className="k-panel">
        <Empty
          icon={<History size={20} />}
          title={t("No saved points yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={onImport}>
              <Upload size={15} /> {t("Import a P6 / MS Project file")}
            </button>
          }
        >
          {t("Every import keeps a saved point, and you can save one by hand from the ⋯ menu. Then you can see what moved.")}
        </Empty>
      </div>
    );
  const move = cmp.finishOld && cmp.finishNew ? diffDays(cmp.finishOld, cmp.finishNew) : 0;
  const moved = cmp.rows.filter((r) => r.kind !== "SAME");
  const rows = all ? cmp.rows : moved.slice(0, 14);
  const maxAbs = Math.max(1, ...cmp.rows.map((r) => Math.abs(r.days)));

  return (
    <div className="k-stack">
      <section className="k-panel pp-chg">
        <div className="pp-chg-top">
          <label className="pp-chg-pick">
            <span className="k-field-label">{t("What changed since")}</span>
            <select className="input select" value={rev.id} onChange={(e) => setRevId(e.target.value)}>
              {sorted.map((r) => (
                <option key={r.id} value={r.id}>
                  {t("rev {n}", { n: r.rev })} · {x(r.label)}
                </option>
              ))}
            </select>
          </label>
          <div className="pp-chg-head">
            <GitCompareArrows size={20} className={move > 0 ? "k-text-bad" : "k-text-ok"} />
            <div>
              <h2>
                {move > 0
                  ? t("Finish {n} days later than rev {r}", { n: move, r: rev.rev })
                  : move < 0
                    ? t("Finish {n} days earlier than rev {r}", { n: -move, r: rev.rev })
                    : t("Finish the same as rev {r}", { r: rev.rev })}
                <span className="pp-chg-dates num-inline">
                  {" — "}
                  {d(cmp.finishOld)} → <b className={move > 0 ? "k-text-bad" : undefined}>{d(cmp.finishNew)}</b>
                </span>
              </h2>
              <p className="muted small">{t("{a} changed · {b} added · {c} removed · {s} the same", { a: cmp.changed, b: cmp.added, c: cmp.removed, s: cmp.same })}</p>
            </div>
          </div>
        </div>
        {moved.length ? (
          <div className="pp-scrollx">
            <table className="pp-table pp-chg-table">
              <thead>
                <tr>
                  <th>{t("ID")}</th>
                  <th>{t("Activity")}</th>
                  <th>{t("Finish")}</th>
                  <th className="pp-days-h">{t("Days")}</th>
                  <th>{t("Progress")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const act = activities.find((a) => a.code === r.code);
                  return (
                    <tr key={r.code} className={r.kind === "SAME" ? "pp-same" : undefined}>
                      <td className="k-mono">{r.code}</td>
                      <td>
                        <span className="pp-chg-name">
                          <span className="truncate">{act ? x(act.name) : r.name}</span>
                          {r.kind === "ADDED" ? <Badge tone="ok">{t("Added")}</Badge> : r.kind === "REMOVED" ? <Badge tone="bad">{t("Removed")}</Badge> : null}
                        </span>
                      </td>
                      <td className="num-inline nowrap">
                        {r.oldEnd ? d(r.oldEnd, false) : "—"} → <b>{r.newEnd ? d(r.newEnd, false) : "—"}</b>
                      </td>
                      <td className="pp-days">
                        <span className={`pp-days-bar ${r.days > 0 ? "late" : r.days < 0 ? "early" : ""}`}>
                          <i style={{ width: `${(Math.abs(r.days) / maxAbs) * 100}%` }} />
                        </span>
                        <b className={`num-inline ${r.days > 0 ? "k-text-bad" : r.days < 0 ? "k-text-ok" : "muted"}`}>{r.days > 0 ? `+${r.days}` : r.days}</b>
                      </td>
                      <td className="num-inline nowrap">
                        {r.oldPct ?? "—"} → <b>{r.newPct ?? "—"}%</b>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="k-note">{t("Nothing moved since this point.")}</p>
        )}
        {cmp.rows.length > 14 || (moved.length < cmp.rows.length && !all) ? (
          <button type="button" className="k-link-btn pp-more" onClick={() => setAll((v) => !v)}>
            {all ? t("Show only what moved") : t("Show all {n} activities", { n: cmp.rows.length })}
          </button>
        ) : null}
      </section>

      <section className="k-panel">
        <header className="k-panel-head">
          <div className="k-panel-title">
            <span className="k-panel-icon">
              <History size={16} />
            </span>
            <h2>{t("Saved points")}</h2>
            <span className="k-count">{revisions.length}</span>
          </div>
        </header>
        <ol className="pp-revs">
          {[...sorted].reverse().map((r) => (
            <li key={r.id} className={r.id === rev.id ? "on" : undefined}>
              <span className="pp-rev-no num-inline">{t("rev {n}", { n: r.rev })}</span>
              <div className="pp-rev-main">
                <strong>{x(r.label)}</strong>
                <span className="muted small">
                  <Badge tone={KIND_TONE[r.kind]} dot={false}>
                    {t(KIND_LABEL[r.kind])}
                  </Badge>{" "}
                  {stamp(r.at)} · {r.by}
                </span>
              </div>
              <div className="pp-rev-figs num-inline">
                <span>
                  <small>{t("Finish")}</small>
                  {d(r.finish)}
                </span>
                <span>
                  <small>{t("Activities")}</small>
                  {r.activities}
                </span>
              </div>
              <div className="pp-rev-acts">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevId(r.id)} disabled={r.id === rev.id}>
                  <GitCompareArrows size={14} /> {t("Compare")}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t("Download")}
                  title={t("Download")}
                  onClick={() => {
                    const prg = programmes.find((p) => p.id === r.programmeId);
                    const name = r.file ? r.file.replace(/\.[^.]+$/, `_rev${r.rev}.xer`) : `programme_rev${r.rev}.xer`;
                    download(name, buildXer({ name: x(r.label), code: prg?.projectCode ?? "", dataDate, workweek }, actsFromRev(r, activities), links, wbs));
                    toast(t("Downloaded rev {n}", { n: r.rev }));
                  }}
                >
                  <Download size={15} />
                </button>
                <button type="button" className="icon-btn" aria-label={t("Go back to this point")} title={t("Go back to this point")} onClick={() => setGoBack(r)}>
                  <Undo2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Dialog
        open={!!goBack}
        onClose={() => setGoBack(null)}
        title={goBack ? t("Go back to rev {n}?", { n: goBack.rev }) : ""}
        kicker={t("Planning · Saved points")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setGoBack(null)}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!goBack) return;
                restoreRevision(goBack.id);
                toast(t("Programme dates set back to rev {n}", { n: goBack.rev }));
                setGoBack(null);
              }}
            >
              <Undo2 size={15} /> {t("Go back")}
            </button>
          </>
        }
      >
        {goBack ? (
          <div className="k-stack">
            <p>{t("Dates of unfinished activities go back to how they were at \"{label}\" (finish {d}).", { label: x(goBack.label), d: d(goBack.finish) })}</p>
            <p className="k-note">{t("Progress and finished work stay as they are. Today's dates are kept as a saved point first, so you can come back.")}</p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

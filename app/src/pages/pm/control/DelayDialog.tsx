import { useEffect, useMemo, useState } from "react";
import { ArrowRight, GitBranch, Sparkles } from "lucide-react";
import { Badge, Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { diffDays, same, TODAY } from "../../../ops/dates";
import type { DelayCause } from "../../../ops/types";
import { CAUSE_LABEL, CAUSES, previewImpact, severityFor, signed, type ImpactPreview } from "./shared";

export type DelayDraft = { title?: string; cause?: DelayCause; activityId?: string; startedAt?: string; daysLost?: number; party?: string; notes?: string };

/** "New delay event" form with an impact preview (float absorbed, milestones moved) before saving. */
export function DelayDialog({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial?: DelayDraft; onSaved?: (id: string) => void }) {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const milestones = useOps((s) => s.milestones);
  const subs = useOps((s) => s.subs);
  const vendors = useOps((s) => s.vendors);
  const addDelay = useOps((s) => s.addDelay);

  const choices = useMemo(() => activities.filter((a) => a.status !== "COMPLETED").sort((a, b) => a.code.localeCompare(b.code)), [activities]);
  const [title, setTitle] = useState("");
  const [cause, setCause] = useState<DelayCause>("WEATHER");
  const [activityId, setActivityId] = useState("");
  const [startedAt, setStartedAt] = useState(TODAY);
  const [daysLost, setDaysLost] = useState(2);
  const [party, setParty] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<ImpactPreview | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setCause(initial?.cause ?? "WEATHER");
    setActivityId(initial?.activityId ?? choices.find((a) => a.status === "IN_PROGRESS")?.id ?? choices[0]?.id ?? "");
    setStartedAt(initial?.startedAt ?? TODAY);
    setDaysLost(initial?.daysLost ?? 2);
    setParty(initial?.party ?? "");
    setNotes(initial?.notes ?? "");
    setPreview(null);
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setPreview(null), [activityId, daysLost]);

  const run = () => previewImpact(activities, links, milestones, activityId, Math.max(0, daysLost));

  const save = () => {
    setTried(true);
    if (!title.trim() || !activityId || daysLost <= 0) return;
    const p = run();
    if (!p) return;
    const id = addDelay({
      title: same(title.trim()),
      cause,
      activityId,
      startedAt,
      daysLost,
      floatAbsorbed: p.absorbed,
      severity: severityFor(p.push, daysLost),
      party: party.trim() || "—",
      notes: notes.trim() ? same(notes.trim()) : null,
      milestoneIds: p.milestones.map((m) => m.m.id),
      criticalPathChanged: p.cpChanged,
    });
    toast(p.push > 0 ? t("{id} logged. The programme moves {n} days.", { id, n: p.push }) : t("{id} logged. Float absorbs it.", { id }), p.push > 0 ? "warn" : "ok");
    onSaved?.(id);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={640}
      kicker={t("Delays")}
      title={t("New delay event")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setPreview(run())} disabled={!activityId}>
            <Sparkles size={15} />
            {t("Preview impact")}
          </button>
          <span className="k-spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t("Save delay")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("What happened")} wide error={tried && !title.trim() ? t("Say what happened.") : undefined}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Concrete pump broke down mid-pour")} autoFocus />
        </Field>
        <Field label={t("Cause")}>
          <select className="input select" value={cause} onChange={(e) => setCause(e.target.value as DelayCause)}>
            {CAUSES.map((c) => (
              <option key={c} value={c}>
                {t(CAUSE_LABEL[c])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Activity hit")}>
          <select className="input select" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            {choices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {x(a.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Started")}>
          <input className="input" type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value || TODAY)} />
        </Field>
        <Field label={t("Working days lost")} error={tried && daysLost <= 0 ? t("At least one day.") : undefined}>
          <input className="input num-inline" type="number" min={1} max={120} value={daysLost} onChange={(e) => setDaysLost(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
        </Field>
        <Field label={t("Responsible party")}>
          <input className="input" list="pmc-parties" value={party} onChange={(e) => setParty(e.target.value)} placeholder={t("Who carries it")} />
          <datalist id="pmc-parties">
            <option value="Neutral" />
            {subs.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
            {vendors.map((v) => (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
        </Field>
        <Field label={t("Notes")} wide>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      {preview ? (
        <div className="pmc-preview k-rise" aria-live="polite">
          <div className="pmc-preview-flow">
            <span>
              <small>{t("Float on {code}", { code: preview.activity.code })}</small>
              <b className="num-inline">{t("{n} d", { n: preview.totalFloat })}</b>
            </span>
            <ArrowRight size={14} />
            <span className="ok">
              <small>{t("Absorbed by float")}</small>
              <b className="num-inline">{t("{n} d", { n: preview.absorbed })}</b>
            </span>
            <ArrowRight size={14} />
            <span className={preview.push > 0 ? "bad" : "ok"}>
              <small>{t("Still hits the programme")}</small>
              <b className="num-inline">{t("{n} d", { n: preview.push })}</b>
            </span>
          </div>
          {preview.push > 0 ? (
            <>
              <p className="pmc-preview-line">
                {preview.cpChanged ? (
                  <Badge tone="bad">
                    <GitBranch size={12} /> {t("Changes the critical path")}
                  </Badge>
                ) : null}
                {t("Project finish {a} → {b}", { a: d(preview.finishFrom), b: d(preview.finishTo) })}
              </p>
              {preview.milestones.length ? (
                <ul className="pmc-preview-ms">
                  {preview.milestones.map((r) => (
                    <li key={r.m.id}>
                      <span className="k-ref">{r.m.code}</span>
                      <span className="truncate">{x(r.m.name)}</span>
                      <span className="num-inline k-text-bad">
                        {d(r.from, false)} → {d(r.to, false)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">{t("No milestone moves.")}</p>
              )}
            </>
          ) : (
            <p className="pmc-preview-line k-text-ok">{t("Float covers it: no milestone moves and the finish date holds.")}</p>
          )}
          <p className="muted small">{t("Net effect on the finish: {n} days", { n: signed(diffDays(preview.finishFrom, preview.finishTo)) })}</p>
        </div>
      ) : null}
    </Dialog>
  );
}

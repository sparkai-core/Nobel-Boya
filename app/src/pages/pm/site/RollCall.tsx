import { useEffect, useState } from "react";
import { Avatar, Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import { setAttendance } from "../../../ops/ext/site-p2";
import type { AttendanceStatus } from "../../../ops/types";
import { siteMeta, WEEK, isRestDay } from "./shared";

export const ATT_ORDER: AttendanceStatus[] = ["PRESENT", "HALF", "ABSENT", "LEAVE", "INJURY"];
const SHORT: Record<AttendanceStatus, string> = { PRESENT: "P", HALF: "½", ABSENT: "A", LEAVE: "L", INJURY: "I" };

/** Roll call for today: every worker with a status toggle; saving calls the store's rollCall(). */
export function RollCallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, x, d } = useL();
  const workers = useOps((s) => s.workers);
  const subs = useOps((s) => s.subs);
  const rollCall = useOps((s) => s.rollCall);
  const [rows, setRows] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    if (!open) return;
    // Read the store directly so the toggles reset only when the dialog opens.
    const s = useOps.getState();
    const init: Record<string, AttendanceStatus> = {};
    for (const w of s.workers) init[w.id] = s.attendance.find((a) => a.date === TODAY && a.workerId === w.id)?.status ?? "PRESENT";
    setRows(init);
  }, [open]);

  const present = Object.values(rows).filter((s) => s === "PRESENT" || s === "HALF").length;
  const save = () => {
    rollCall(
      TODAY,
      workers.map((w) => ({ workerId: w.id, status: rows[w.id] ?? "PRESENT" })),
    );
    toast(t("Roll call saved: {p} of {n} on site", { p: present, n: workers.length }));
    onClose();
  };
  const byEmployer = [...new Set(workers.map((w) => w.employer))];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      kicker={d(TODAY)}
      title={t("Take roll call")}
      width={620}
      footer={
        <>
          <span className="small muted st-rc-sum">{t("{p} of {n} on site", { p: present, n: workers.length })}</span>
          <button type="button" className="btn btn-ghost" onClick={() => setRows(Object.fromEntries(workers.map((w) => [w.id, "PRESENT" as AttendanceStatus])))}>
            {t("Everyone present")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t("Save roll call")}
          </button>
        </>
      }
    >
      <div className="st-rc">
        {byEmployer.map((emp) => (
          <section key={emp}>
            <h4>{subs.find((s) => s.id === emp)?.name ?? emp}</h4>
            <ul>
              {workers
                .filter((w) => w.employer === emp)
                .map((w) => (
                  <li key={w.id}>
                    <Avatar name={w.name} size={26} />
                    <span className="k-cell-title">
                      <strong>{w.name}</strong>
                      <small>{x(w.trade)}</small>
                    </span>
                    <span className="st-rc-toggles" role="radiogroup" aria-label={w.name}>
                      {ATT_ORDER.map((st) => {
                        const meta = siteMeta("attendance", st);
                        const on = rows[w.id] === st;
                        return (
                          <button key={st} type="button" role="radio" aria-checked={on} title={x(meta.label)} className={`st-att-${st.toLowerCase()}${on ? " on" : ""}`} onClick={() => setRows({ ...rows, [w.id]: st })}>
                            {SHORT[st]}
                          </button>
                        );
                      })}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/** Log one worker's attendance on any day of the last week. */
export function LogAttendanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, x, d } = useL();
  const workers = useOps((s) => s.workers);
  const pushFeed = useOps((s) => s.pushFeed);
  const [date, setDate] = useState(TODAY);
  const [workerId, setWorkerId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  useEffect(() => {
    if (open) {
      setDate(TODAY);
      setWorkerId(workers[0]?.id ?? "");
      setStatus("PRESENT");
    }
  }, [open, workers]);
  const save = () => {
    const w = workers.find((y) => y.id === workerId);
    if (!w) return;
    setAttendance(date, w.id, status);
    const meta = siteMeta("attendance", status);
    pushFeed("PM", { en: `Attendance logged: ${w.name}, ${meta.label.en.toLowerCase()} on ${date}`, az: `Davamiyyət qeyd edildi: ${w.name}, ${date} — ${meta.label.az.toLowerCase()}` }, "pm/workforce");
    toast(t("{name}: {status} on {date}", { name: w.name, status: x(meta.label), date: d(date, false) }));
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Log attendance")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!workerId}>
            {t("Log attendance")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Worker")} wide>
          <select className="input select" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {x(w.trade)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Day")}>
          <select className="input select" value={date} onChange={(e) => setDate(e.target.value)}>
            {[...WEEK].reverse().map((day) => (
              <option key={day} value={day}>
                {d(day, false)}
                {isRestDay(day) ? ` · ${t("rest day")}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Status")}>
          <select className="input select" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
            {ATT_ORDER.map((st) => (
              <option key={st} value={st}>
                {x(siteMeta("attendance", st).label)}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Dialog>
  );
}

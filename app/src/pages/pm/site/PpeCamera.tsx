import { useMemo, useState } from "react";
import { Check, Cctv, ScanEye, X as XIcon } from "lucide-react";
import { Badge, Empty, FilterChips, Panel, toast, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { nowStamp } from "../../../ops/dates";
import type { PpeCheck } from "../../../ops/types";
import { freshRef, hash01, PPE_ITEM, SiteBadge } from "./shared";

type Gear = PpeCheck["missing"][number];
const ALL_GEAR: Gear[] = ["HELMET", "VEST", "BOOTS", "GLOVES", "HARNESS"];
const conf = (id: string) => Math.round((0.86 + hash01(id) * 0.12) * 100);

/** Where figures stand in each camera's scene (x, ground y, scale). */
const SLOTS: [number, number, number][] = [
  [150, 300, 1.05],
  [330, 286, 0.92],
  [470, 300, 1.0],
  [560, 270, 0.78],
];

function Figure({ x, y, s, missing, pose }: { x: number; y: number; s: number; missing: Gear[]; pose: number }) {
  const no = (g: Gear) => missing.includes(g);
  const arm = pose % 2 ? -18 : 14;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="st-fig">
      {/* legs */}
      <path d="M-9 -54 L-12 -4 M9 -54 L12 -4" className="st-fig-limb" />
      {!no("BOOTS") ? <path d="M-17 -4 h10 v4 h-12z M8 -4 h10 l2 4 h-12z" className="st-fig-boot" /> : null}
      {/* body */}
      <rect x="-15" y="-104" width="30" height="52" rx="8" className="st-fig-body" />
      {!no("VEST") ? (
        <g>
          <rect x="-15" y="-100" width="30" height="40" rx="7" className="st-fig-vest" />
          <path d="M-15 -82 H15 M-15 -72 H15" className="st-fig-reflect" />
        </g>
      ) : null}
      {!no("HARNESS") && pose === 1 ? <path d="M-12 -100 L12 -62 M12 -100 L-12 -62" className="st-fig-harness" /> : null}
      {/* arms */}
      <path d={`M-14 -96 L-24 ${-70 + arm} M14 -96 L26 ${-72 - arm / 2}`} className="st-fig-limb" />
      {!no("GLOVES") ? (
        <g className="st-fig-glove">
          <circle cx="-24" cy={-70 + arm} r="4" />
          <circle cx="26" cy={-72 - arm / 2} r="4" />
        </g>
      ) : null}
      {/* head */}
      <circle cx="0" cy="-116" r="11" className="st-fig-head" />
      {!no("HELMET") ? <path d="M-13 -117 a13 12 0 0 1 26 0 h3 v3 h-32 v-3z" className="st-fig-helmet" /> : null}
    </g>
  );
}

/**
 * PPE camera AI: a mock camera feed of the site with detection boxes. Red boxes are workers missing gear,
 * green ones are compliant. Alerts below can be confirmed or dismissed as false alarms.
 */
export function PpeCamera() {
  const { t, x, stamp } = useL();
  const checks = useOps((s) => s.ppeChecks);
  const workers = useOps((s) => s.workers);
  const patchItem = useOps((s) => s.patchItem);
  const addItem = useOps((s) => s.addItem);
  const nextRef = useOps((s) => s.nextRef);
  const pushFeed = useOps((s) => s.pushFeed);
  const cameras = useMemo(() => [...new Set(checks.map((c) => c.camera))].sort(), [checks]);
  const [cam, setCam] = useState<string>(() => cameras.find((c) => checks.some((k) => k.camera === c && k.status === "WAITING")) ?? cameras[0] ?? "CAM-01 Admin");
  const [filter, setFilter] = useState<PpeCheck["status"] | null>("WAITING");
  const [picked, setPicked] = useState<string | null>(null);

  const onCam = checks.filter((c) => c.camera === cam);
  const inScene = onCam.filter((c) => c.status !== "FALSE_ALARM").slice(0, 3);
  const zone = onCam[0]?.zone;
  const list = checks.filter((c) => !filter || c.status === filter).sort((a, b) => b.at.localeCompare(a.at));
  const seed = hash01(cam);
  const people = Math.min(SLOTS.length, Math.max(3, inScene.length + 2));

  const decide = (c: PpeCheck, status: "CONFIRMED" | "FALSE_ALARM") => {
    patchItem("ppeChecks", c.id, { status });
    const what = c.missing.map((g) => PPE_ITEM[g]);
    const w = workers.find((y) => y.id === c.workerId);
    if (status === "CONFIRMED") {
      pushFeed("PM", { en: `PPE breach confirmed on ${c.camera}: ${what.map((g) => g.en.toLowerCase()).join(", ")} missing${w ? ` (${w.name})` : ""}`, az: `${c.camera} kamerasında FMV pozuntusu təsdiqləndi: ${what.map((g) => g.az.toLowerCase()).join(", ")} yoxdur${w ? ` (${w.name})` : ""}` }, "pm/safety?tab=ppe");
      toast(t("Breach confirmed and sent to the site supervisor"), "bad");
    } else {
      toast(t("Marked as a false alarm. The model will learn from it."), "info");
    }
  };
  const runCheck = () => {
    const id = freshRef(() => nextRef("PPE"), (r) => useOps.getState().ppeChecks.some((p) => p.id === r));
    const n = Number(id.replace(/\D/g, "")) || 1;
    const missing: Gear[] = [ALL_GEAR[n % ALL_GEAR.length]!];
    addItem("ppeChecks", { id, at: nowStamp(), camera: cam, zone: zone ?? { en: cam, az: cam }, missing, status: "WAITING", workerId: null }, true);
    setFilter("WAITING");
    setPicked(id);
    toast(t("New detection on {cam}: {what} missing", { cam, what: x(PPE_ITEM[missing[0]!]).toLowerCase() }), "warn");
  };

  return (
    <div className="k-stack">
      <div className="st-ppe-top">
        <Segmented
          label={t("Camera")}
          value={cam}
          onChange={(v) => {
            setCam(v);
            setPicked(null);
          }}
          options={cameras.map((c) => ({ value: c, label: c, count: checks.filter((k) => k.camera === c && k.status === "WAITING").length || undefined }))}
        />
        <span className="k-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={runCheck}>
          <ScanEye size={14} />
          {t("Scan this camera now")}
        </button>
      </div>

      <div className="st-ppe">
        <div className="st-stage">
          <svg viewBox="0 0 640 360" role="img" aria-label={t("Camera view {cam}", { cam })}>
            <defs>
              <linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2a2733" />
                <stop offset="1" stopColor="#1d1b24" />
              </linearGradient>
            </defs>
            <rect width="640" height="360" fill="url(#st-sky)" />
            {/* structure in the background */}
            <g className="st-scene-bg">
              <path d={`M${40 + seed * 40} 230 V 90 H ${260 + seed * 30} V 230`} />
              {[0, 1, 2, 3].map((i) => (
                <path key={i} d={`M${40 + seed * 40} ${110 + i * 30} H ${260 + seed * 30}`} />
              ))}
              {[1, 2, 3, 4].map((i) => (
                <path key={`v${i}`} d={`M${40 + seed * 40 + i * 48} 90 V 230`} />
              ))}
              <path d="M520 230 V 40 M520 48 H 640 M520 48 L 600 230 M560 48 V 70" className="st-scene-crane" />
              <rect x="300" y="196" width="120" height="34" rx="2" />
            </g>
            <path d="M0 230 H 640 V 360 H 0 Z" className="st-scene-ground" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} d={`M${-40 + i * 130} 360 L ${120 + i * 80} 230`} className="st-scene-lane" />
            ))}

            {SLOTS.map(([sx, sy, ss], i) => {
              const alert = inScene[i];
              const missing = alert ? alert.missing : [];
              const pose = (i + Math.round(seed * 10)) % 3;
              const h = 128 * ss;
              const w = 64 * ss;
              const bx = sx - w / 2;
              const by = sy - h - 6;
              const tone = alert ? "bad" : "ok";
              const label = alert ? `${alert.missing.map((g) => x(PPE_ITEM[g])).join(" + ")} ${t("missing")} ${conf(alert.id)}%` : `${t("PPE OK")} ${conf(`${cam}${i}`)}%`;
              const on = alert && picked === alert.id;
              if (i >= people) return null;
              return (
                <g key={i} className={`st-det ${tone}${on ? " on" : ""}`} onClick={() => alert && setPicked(alert.id)} style={{ animationDelay: `${300 + i * 180}ms` }}>
                  <Figure x={sx} y={sy} s={ss} missing={missing} pose={pose} />
                  <rect x={bx} y={by} width={w} height={h + 8} rx="3" className="st-det-box" />
                  <path d={`M${bx} ${by + 10} v-10 h10 M${bx + w - 10} ${by} h10 v10 M${bx} ${by + h - 2} v10 h10 M${bx + w - 10} ${by + h + 8} h10 v-10`} className="st-det-corner" />
                  <g transform={`translate(${bx} ${by - 18})`}>
                    <rect width={Math.max(w, label.length * 6.3 + 12)} height="16" rx="3" className="st-det-tag" />
                    <text x="6" y="11.5" className="st-det-text">
                      {label}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
          <div className="st-scan" aria-hidden="true" />
          <div className="st-stage-hud">
            <span className="st-rec">
              <i /> {t("Live")}
            </span>
            <span>{cam}</span>
            <span>{zone ? x(zone) : ""}</span>
          </div>
          <div className="st-stage-foot">
            <Cctv size={13} />
            {t("{n} people · {a} alerts in view", { n: people, a: inScene.filter((c) => c.status === "WAITING").length })}
          </div>
        </div>

        <Panel
          title={t("Alerts")}
          count={checks.filter((c) => c.status === "WAITING").length}
          className="st-ppe-alerts"
        >
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { value: "WAITING" as const, label: t("Waiting"), count: checks.filter((c) => c.status === "WAITING").length },
              { value: "CONFIRMED" as const, label: t("Confirmed"), count: checks.filter((c) => c.status === "CONFIRMED").length },
              { value: "FALSE_ALARM" as const, label: t("False alarms"), count: checks.filter((c) => c.status === "FALSE_ALARM").length },
            ]}
          />
          {list.length ? (
            <ul className="st-alerts">
              {list.map((c) => {
                const w = workers.find((y) => y.id === c.workerId);
                return (
                  <li key={c.id} className={`${picked === c.id ? "on" : ""} ${c.camera === cam ? "here" : ""}`}>
                    <button
                      type="button"
                      className="st-alert-main"
                      onClick={() => {
                        setCam(c.camera);
                        setPicked(c.id);
                      }}
                    >
                      <span className="k-cell-title">
                        <strong>
                          {c.missing.map((g) => x(PPE_ITEM[g])).join(" + ")} {t("missing")}
                          <span className="st-conf num-inline">{conf(c.id)}%</span>
                        </strong>
                        <small>
                          {c.camera} · {x(c.zone)} · {stamp(c.at)}
                          {w ? ` · ${w.name}` : ""}
                        </small>
                      </span>
                      <SiteBadge kind="ppe" status={c.status} />
                    </button>
                    {c.status === "WAITING" ? (
                      <div className="st-alert-acts">
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(c, "CONFIRMED")}>
                          <Check size={13} />
                          {t("Confirm")}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => decide(c, "FALSE_ALARM")}>
                          <XIcon size={13} />
                          {t("False alarm")}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title={t("No alerts here")}>{filter === "WAITING" ? t("Every detection has been reviewed.") : t("Nothing in this list yet.")}</Empty>
          )}
          <p className="small muted st-ppe-note">
            <Badge tone="brand" dot={false}>
              AI
            </Badge>{" "}
            {t("Detections run on the site cameras every few seconds. Confidence is the model's own score.")}
          </p>
        </Panel>
      </div>
    </div>
  );
}

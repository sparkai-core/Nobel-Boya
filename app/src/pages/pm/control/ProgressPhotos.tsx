import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, Check, ImagePlus, Plane, ScanSearch, Smartphone, Sparkles, Video } from "lucide-react";
import { Badge, Dialog, Field, FilterChips, Panel, Register, Sparkline, toast, useL, type Column } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import { addCaptureWith } from "../../../ops/ext/control";
import { sheetImage } from "../../../data";
import { buildingShort } from "../../../lib/loc";
import type { ProgressZone } from "../../../ops/types";
import { hash, plannedPctAt } from "./shared";

type Source = ProgressZone["captures"][number]["source"];
const SOURCE_ICON: Record<Source, typeof Plane> = { DRONE: Plane, PHONE: Smartphone, CCTV: Video };
const SOURCE_LABEL: Record<Source, string> = { DRONE: "Drone", PHONE: "Phone", CCTV: "CCTV" };
const PHOTOS = ["KS-5", "KS-7", "KS-12", "KS-21", "AR-10", "AR-11", "BP-7"];

/** Photos view: before/after wipe of a zone and the wall of captures. */
export function PhotosView({ zoneId, onZone }: { zoneId: string | null; onZone: (id: string) => void }) {
  const { t, x, d } = useL();
  const zones = useOps((s) => s.zones);
  const [source, setSource] = useState<Source | null>(null);
  const [adding, setAdding] = useState(false);
  const wipeRef = useRef<HTMLDivElement>(null);
  const zone = zones.find((z) => z.id === zoneId) ?? zones.find((z) => z.captures.length >= 2) ?? zones[0];

  const wall = useMemo(
    () =>
      zones
        .flatMap((z) => z.captures.map((c, i) => ({ z, c, key: `${z.id}-${i}` })))
        .filter((r) => !source || r.c.source === source)
        .sort((a, b) => b.c.date.localeCompare(a.c.date) || b.c.pct - a.c.pct),
    [zones, source],
  );
  const counts = (s: Source) => zones.reduce((a, z) => a + z.captures.filter((c) => c.source === s).length, 0);

  return (
    <div className="k-stack">
      {zone && zone.captures.length >= 1 ? (
        <div ref={wipeRef}>
          <Panel
            title={t("Before and after")}
            icon={<ScanSearch size={15} />}
            sub={t("Drag across the picture to compare the first and the latest capture of a zone.")}
            actions={
              <select className="input select pmc-zone-select" value={zone.id} onChange={(e) => onZone(e.target.value)} aria-label={t("Zone")}>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code} · {x(z.name)}
                  </option>
                ))}
              </select>
            }
          >
            <Wipe zone={zone} />
          </Panel>
        </div>
      ) : null}

      <Panel
        title={t("Captures")}
        icon={<Camera size={15} />}
        count={wall.length}
        actions={
          <span className="k-row" style={{ gap: 8 }}>
            <FilterChips value={source} onChange={setSource} options={(Object.keys(SOURCE_LABEL) as Source[]).map((s) => ({ value: s, label: t(SOURCE_LABEL[s]), count: counts(s) }))} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
              <ImagePlus size={14} />
              {t("Add photo")}
            </button>
          </span>
        }
      >
        <div className="pmc-wall">
          {wall.map(({ z, c, key }, i) => {
            const Icon = SOURCE_ICON[c.source];
            return (
              <button
                key={key}
                type="button"
                className={`pmc-shot k-rise${zone?.id === z.id ? " on" : ""}`}
                style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                onClick={() => {
                  onZone(z.id);
                  wipeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <span className="pmc-shot-img">
                  <img src={sheetImage(c.photo, true)} alt="" loading="lazy" />
                  <span className="pmc-shot-src">
                    <Icon size={12} /> {t(SOURCE_LABEL[c.source])}
                  </span>
                  <span className="pmc-shot-pct num-inline">{c.pct}%</span>
                </span>
                <span className="pmc-shot-body">
                  <strong className="truncate">{x(z.name)}</strong>
                  <small>
                    {d(c.date, false)} · {t("AI {n}%", { n: Math.round(c.confidence * 100) })}
                  </small>
                  <span className="pmc-shot-note">{x(c.note)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <AddPhotoDialog open={adding} onClose={() => setAdding(false)} zoneId={zone?.id ?? null} onDone={onZone} />
    </div>
  );
}

function Wipe({ zone }: { zone: ProgressZone }) {
  const { t, d } = useL();
  const [pos, setPos] = useState(50);
  const first = zone.captures[0]!;
  const last = zone.captures[zone.captures.length - 1]!;
  return (
    <div className="pmc-wipe">
      <div className="pmc-wipe-stage">
        <img src={sheetImage(last.photo)} alt="" className="pmc-wipe-after" />
        <div className="pmc-wipe-before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          <img src={sheetImage(first.photo)} alt="" />
        </div>
        <span className="pmc-wipe-tag left">
          {t("Before")} · {d(first.date, false)} · <b className="num-inline">{first.pct}%</b>
        </span>
        <span className="pmc-wipe-tag right">
          {t("After")} · {d(last.date, false)} · <b className="num-inline">{last.pct}%</b>
        </span>
        <span className="pmc-wipe-handle" style={{ left: `${pos}%` }} aria-hidden="true">
          <i />
        </span>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label={t("Compare before and after")} />
      </div>
      <p className="muted small">
        {t("{n} points of progress between the two captures.", { n: last.pct - first.pct })} {zone.captures.length > 2 ? t("{n} captures in total.", { n: zone.captures.length }) : null}
      </p>
    </div>
  );
}

const STEPS = ["Reading the picture", "Finding the activity", "Comparing with the programme"];

function AddPhotoDialog({ open, onClose, zoneId, onDone }: { open: boolean; onClose: () => void; zoneId: string | null; onDone: (id: string) => void }) {
  const { t, x } = useL();
  const zones = useOps((s) => s.zones);
  const activities = useOps((s) => s.activities);
  const [zid, setZid] = useState(zoneId ?? zones[0]?.id ?? "");
  const [photo, setPhoto] = useState(PHOTOS[1]!);
  const [source, setSource] = useState<Source>("PHONE");
  const [note, setNote] = useState("");
  const [step, setStep] = useState(-1);
  const [pct, setPct] = useState(0);
  const [conf, setConf] = useState(0.88);

  useEffect(() => {
    if (!open) return;
    setZid(zoneId ?? zones[0]?.id ?? "");
    setStep(-1);
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => setStep(-1), [zid, photo]);

  const zone = zones.find((z) => z.id === zid);
  const act = zone ? activities.find((a) => a.id === zone.activityId) : undefined;

  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    const id = setTimeout(() => setStep((s) => s + 1), 750);
    return () => clearTimeout(id);
  }, [step]);

  const estimate = () => {
    if (!zone || !act) return;
    const hsh = hash(`${zone.id}/${photo}/${zone.captures.length}`);
    const plan = plannedPctAt(act, TODAY);
    const sug = Math.max(act.pct, Math.min(100, Math.round(act.pct + Math.max(2, (plan - act.pct) * 0.35) + (hsh % 5))));
    setPct(sug);
    setConf(0.82 + (hsh % 12) / 100);
    setStep(0);
  };

  const apply = () => {
    if (!zone) return;
    addCaptureWith(zone.id, pct, note.trim(), photo, conf, source);
    toast(t("{zone} updated to {n}%. Progress logged on {code}.", { zone: x(zone.name), n: pct, code: act?.code ?? "" }));
    onDone(zone.id);
    onClose();
  };

  const done = step >= STEPS.length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={620}
      kicker={t("Site progress")}
      title={t("Add photo")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <span className="k-spacer" />
          {done ? (
            <button type="button" className="btn btn-primary" onClick={apply}>
              <Check size={15} />
              {t("Apply {n}%", { n: pct })}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={estimate} disabled={step >= 0 || !zone}>
              <Sparkles size={15} />
              {t("Estimate progress with AI")}
            </button>
          )}
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Zone")}>
          <select className="input select" value={zid} onChange={(e) => setZid(e.target.value)}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code} · {x(z.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Source")}>
          <select className="input select" value={source} onChange={(e) => setSource(e.target.value as Source)}>
            {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
              <option key={s} value={s}>
                {t(SOURCE_LABEL[s])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Picture")} wide>
          <div className="pmc-pick-photos">
            {PHOTOS.map((p) => (
              <button key={p} type="button" className={photo === p ? "on" : undefined} onClick={() => setPhoto(p)} aria-pressed={photo === p}>
                <img src={sheetImage(p, true)} alt={p} />
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("Note")} wide>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("What the picture shows")} />
        </Field>
      </div>
      {step >= 0 ? (
        <div className="k-ai pmc-ai-read" aria-live="polite">
          <span className="k-ai-tag">
            <Sparkles size={12} /> {t("AI reading")}
          </span>
          <ol>
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "done" : i === step ? "now" : ""}>
                <span className="pmc-ai-dot">{i < step ? <Check size={11} strokeWidth={3} /> : null}</span>
                <span className={i === step ? "k-typing" : undefined}>{t(s)}</span>
              </li>
            ))}
          </ol>
          {done && act ? (
            <div className="pmc-ai-result k-rise">
              <span>
                <small>{t("Suggested progress on {code}", { code: act.code })}</small>
                <span className="k-row" style={{ gap: 8 }}>
                  <input className="input num-inline pmc-ai-pct" type="number" min={0} max={100} value={pct} onChange={(e) => setPct(Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))))} />
                  <b>%</b>
                </span>
              </span>
              <span>
                <small>{t("Confidence")}</small>
                <Badge tone={conf >= 0.88 ? "ok" : "warn"}>{Math.round(conf * 100)}%</Badge>
              </span>
              <span>
                <small>{t("Was")}</small>
                <b className="num-inline">{act.pct}%</b>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
}

/** Zones view: plan against photo estimate per zone, with a trend and a link to the programme. */
export function ZonesView({ onOpen }: { onOpen: (zoneId: string) => void }) {
  const { t, x, lang } = useL();
  const zones = useOps((s) => s.zones);
  const activities = useOps((s) => s.activities);
  const act = (id: string) => activities.find((a) => a.id === id);
  const plan = (z: ProgressZone) => {
    const a = act(z.activityId);
    return a ? Math.round(plannedPctAt(a, TODAY)) : z.expectedPct;
  };
  const photo = (z: ProgressZone) => z.captures[z.captures.length - 1]?.pct ?? z.actualPct;

  const columns: Column<ProgressZone>[] = [
    {
      key: "zone",
      header: t("Zone"),
      sort: (z) => z.code,
      render: (z) => (
        <div className="k-cell-title">
          <span className="k-ref">{z.code}</span>
          <strong>{x(z.name)}</strong>
          <small>{buildingShort(z.building, lang)}</small>
        </div>
      ),
    },
    { key: "act", header: t("Activity"), sort: (z) => act(z.activityId)?.code ?? "", hideBelow: 900, render: (z) => <span className="pmc-code">{act(z.activityId)?.code}</span> },
    {
      key: "cmp",
      header: t("Plan against photo estimate"),
      sort: (z) => photo(z) - plan(z),
      render: (z) => {
        const p = plan(z);
        const e = photo(z);
        return (
          <span className="pmc-zcmp">
            <span className="pmc-zcmp-bars">
              <i className="plan" style={{ width: `${p}%` }} />
              <i className={`est${e < p - 3 ? " behind" : ""}`} style={{ width: `${e}%` }} />
            </span>
            <span className="num-inline">
              {e}% <small>/ {p}%</small>
            </span>
          </span>
        );
      },
    },
    {
      key: "gap",
      header: t("Gap"),
      align: "right",
      sort: (z) => photo(z) - plan(z),
      render: (z) => {
        const g = photo(z) - plan(z);
        return <b className={`num-inline ${g < -3 ? "k-text-bad" : g > 3 ? "k-text-brand" : "k-text-ok"}`}>{g > 0 ? `+${g}` : g}</b>;
      },
    },
    { key: "trend", header: t("Trend"), hideBelow: 700, render: (z) => <Sparkline values={z.captures.map((c) => c.pct)} width={96} height={26} tone={photo(z) < plan(z) - 3 ? "bad" : "brand"} /> },
    {
      key: "open",
      header: "",
      align: "right",
      render: (z) => (
        <Link className="k-link-btn" to={R.programme(z.activityId)} onClick={(e) => e.stopPropagation()}>
          {t("Open in the programme")} <ArrowRight size={13} />
        </Link>
      ),
    },
  ];
  return <Register rows={zones} columns={columns} rowKey={(z) => z.id} onRowClick={(z) => onOpen(z.id)} initialSort={{ key: "gap", dir: "asc" }} empty={t("No zones are tracked yet.")} />;
}

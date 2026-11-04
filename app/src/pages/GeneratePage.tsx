import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { data, evidenceBySheet, itemById, sheetImage } from "../data";
import { useBoq } from "../lib/boq";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { Logo } from "../components/ui";

const STAGES = [
  { key: "read", label: "Reading the package", end: 1100 },
  { key: "classify", label: "Sorting sheets by structure and discipline", end: 2100 },
  { key: "schedules", label: "Reading schedules and tables", end: 3700 },
  { key: "locate", label: "Marking each value on its sheet", end: 4900 },
  { key: "checks", label: "Cross-checking the drawings", end: 5900 },
  { key: "price", label: "Building and pricing the bill", end: 7000 },
] as const;

const TOTAL_MS = STAGES[STAGES.length - 1]!.end;

export function GeneratePage() {
  const navigate = useNavigate();
  const setGenerated = useApp((s) => s.setGenerated);
  const boq = useBoq();
  const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const [t, setT] = useState(reduce ? TOTAL_MS : 0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setGenerated(true);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const el = now - t0;
      setT(Math.min(el, TOTAL_MS));
      if (el < TOTAL_MS) raf.current = requestAnimationFrame(tick);
      else setGenerated(true);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [reduce, setGenerated]);

  const skip = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setT(TOTAL_MS);
    setGenerated(true);
  };

  const done = t >= TOTAL_MS;
  const stageIndex = STAGES.findIndex((s) => t < s.end);
  const current = stageIndex === -1 ? STAGES.length : stageIndex;

  const evidenceSheets = useMemo(() => data.sheets.filter((s) => evidenceBySheet.has(s.id)), []);
  const evidenceOrder = useMemo(() => new Map(evidenceSheets.map((s, i) => [s.id, i])), [evidenceSheets]);
  const sourceCount = useMemo(() => data.items.reduce((a, i) => a + i.src.length, 0), []);
  const textSources = useMemo(() => data.items.reduce((a, i) => a + i.src.filter((s) => s.how === "text").length, 0), []);
  const scheduleSheets = evidenceSheets.length;

  const progress = (i: number) => {
    const start = i === 0 ? 0 : STAGES[i - 1]!.end;
    return Math.max(0, Math.min(1, (t - start) / (STAGES[i]!.end - start)));
  };
  const ease = (k: number) => 1 - Math.pow(1 - k, 3);

  const sev = data.checks.reduce<Record<string, number>>((a, c) => ({ ...a, [c.severity]: (a[c.severity] ?? 0) + 1 }), {});
  const details = [
    `${Math.round(ease(progress(0)) * 205)} of 205 sheets in 4 files`,
    `${data.buildings.length} structures, ${new Set(data.sheets.map((s) => s.discipline)).size - 1} disciplines`,
    `${Math.round(ease(progress(2)) * data.items.length)} quantities from ${Math.round(ease(progress(2)) * scheduleSheets)} sheets`,
    progress(3) < 1
      ? `${Math.round(ease(progress(3)) * sourceCount)} of ${sourceCount} values marked`
      : `${sourceCount} values marked, ${textSources} on the text layer, ${sourceCount - textSources} by hand`,
    progress(4) > 0 ? `${sev.error ?? 0} error, ${sev.warn ?? 0} conflicts, ${sev.info ?? 0} notes, ${Math.round(ease(progress(4)) * (sev.ok ?? 0))} agreements` : "Arithmetic, counts and cross-discipline values",
    `${boq.lines.length} bill lines, ${fmtMoney(ease(progress(5)) * boq.total)} AZN`,
  ];

  let tileIndex = 0;
  const step = 900 / data.sheets.length;
  const evStep = 1400 / Math.max(1, evidenceSheets.length);
  const mkStep = 1050 / Math.max(1, evidenceSheets.length);

  return (
    <div className="generate">
      <header className="gen-top">
        <span className="brand-inline">
          <Logo />
          <strong>Storm</strong>
        </span>
        {!done ? (
          <button type="button" className="btn btn-ghost" onClick={skip}>
            Skip
          </button>
        ) : null}
      </header>

      <div className="gen-body">
        <section className="gen-side">
          <h1>{done ? "The bill is ready" : "Generating the bill"}</h1>
          <p className="lead">{data.project.nameEn}</p>
          <ol className="gen-stages">
            {STAGES.map((s, i) => {
              const state = i < current ? "done" : i === current ? "running" : "pending";
              return (
                <li key={s.key} className={`gen-stage ${state}`}>
                  <span className="gen-icon" aria-hidden="true">
                    {state === "done" ? <Check size={13} strokeWidth={3} /> : state === "running" ? <span className="spinner" /> : null}
                  </span>
                  <div>
                    <div className="gen-label">{s.label}</div>
                    <div className="gen-detail num-inline">{state === "pending" ? "" : details[i]}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className={`gen-result${done ? " show" : ""}`}>
            <div className="gen-total">
              <span className="muted">Total including VAT</span>
              <strong className="num">{fmtMoney(boq.total)} AZN</strong>
            </div>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate("/overview")} disabled={!done}>
              Open the bill
            </button>
          </div>
        </section>

        <section className={`mosaic${t >= STAGES[0].end ? " classified" : ""}`} aria-label="Sheets in the package">
          {data.documents.map((d) => {
            const sheets = data.sheets.filter((s) => s.doc === d.code);
            return (
              <div key={d.code} className="mosaic-doc">
                <div className="mosaic-head">
                  <strong>{d.en}</strong>
                  <span className="muted num-inline">{sheets.length} sheets</span>
                </div>
                <div className="mosaic-grid">
                  {sheets.map((s) => {
                    const i = tileIndex++;
                    const ev = evidenceOrder.get(s.id);
                    const marks = ev != null ? evidenceBySheet.get(s.id)! : [];
                    const style = {
                      ["--in" as string]: `${Math.round(40 + i * step)}ms`,
                      ["--hl" as string]: ev != null ? `${Math.round(STAGES[1].end + ev * evStep)}ms` : "0ms",
                      ["--mk" as string]: ev != null ? `${Math.round(STAGES[2].end + ev * mkStep)}ms` : "0ms",
                    };
                    return (
                      <div key={s.id} className={`tile d-${s.discipline}${ev != null ? " has-ev" : ""}${reduce ? " still" : ""}`} style={style} title={`${s.id} ${s.titleEn}`}>
                        <svg viewBox={`0 0 ${s.w} ${s.h}`} preserveAspectRatio="xMidYMid meet">
                          <image href={sheetImage(s.id, true)} width={s.w} height={s.h} />
                          {marks.map((m, k) => {
                            const b = itemById.get(m.itemId)!.src[m.srcIndex]!.box;
                            return <rect key={k} x={b[0] - 6} y={b[1] - 6} width={b[2] - b[0] + 12} height={b[3] - b[1] + 12} />;
                          })}
                        </svg>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

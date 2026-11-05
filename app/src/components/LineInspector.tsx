import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { data, sheetById, P } from "../data";
import type { Item, Source } from "../data/types";
import { effectiveQty, type Line } from "../lib/boq";
import { fmtMoney, fmtNum, fmtQty, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { EvidenceCrop } from "./EvidenceCrop";
import { methodHint, MethodTag, SeverityTag } from "./ui";
import { buildingShort, checkTitle, formulaText, noteText, sheetTitle } from "../lib/loc";
import { useT } from "../lib/i18n";

export function LineInspector({ line }: { line: Line }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const setRate = useApp((s) => s.setRate);
  const rateOverridden = line.rate !== line.sampleRate;
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const other = lang === "az" ? line.en : line.az;

  return (
    <div className="inspector">
      <section className="insp-desc">
        <p className="insp-primary">{lang === "az" ? line.az : line.en}</p>
        <p className="insp-secondary">{other}</p>
      </section>

      <section className="insp-figures">
        <div className="figure">
          <span className="figure-label">{t("Quantity")}</span>
          <span className="figure-value num">
            {fmtQty(line.qty, line.unit)} <small>{unitLabel(line.unit, lang)}</small>
          </span>
          {line.adjusted ? (
            <span className="figure-note">
              {t("Printed {q}, {how}", { q: fmtQty(line.printedQty, line.unit), how: line.adjusted === "fix" ? t("corrected from a check") : t("overridden by hand") })}
            </span>
          ) : null}
        </div>
        <div className="figure">
          <label className="figure-label" htmlFor={`rate-${line.id}`}>
            {t("Rate, AZN per {u}", { u: unitLabel(line.unit, lang) })}
          </label>
          <span className="rate-edit">
            <input
              id={`rate-${line.id}`}
              className="input num"
              inputMode="decimal"
              value={rateDraft ?? fmtNum(line.rate, 2)}
              onFocus={(e) => {
                setRateDraft(String(line.rate));
                requestAnimationFrame(() => e.target.select());
              }}
              onChange={(e) => setRateDraft(e.target.value)}
              onBlur={() => {
                const v = Number(String(rateDraft).replace(",", "."));
                if (rateDraft != null && Number.isFinite(v) && v >= 0) setRate(line.rateKey, v === line.sampleRate ? null : v);
                setRateDraft(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            {rateOverridden ? (
              <button type="button" className="icon-btn" title={t("Back to sample rate {r}", { r: fmtNum(line.sampleRate) })} onClick={() => setRate(line.rateKey, null)}>
                <RotateCcw size={14} />
              </button>
            ) : null}
          </span>
          <span className="figure-note">{rateOverridden ? t("Edited. Sample rate {r}", { r: fmtNum(line.sampleRate) }) : t("Sample rate, not from the package")}</span>
        </div>
        <div className="figure">
          <span className="figure-label">{t("Amount, AZN")}</span>
          <span className="figure-value num">{fmtMoney(line.amount)}</span>
        </div>
      </section>

      {line.checks.length ? (
        <section className="insp-checks">
          {line.checks.map((c) => (
            <Link key={c.id} to={`${P}/checks/${c.id}`} className={`insp-check sev-row-${c.severity}`}>
              <SeverityTag severity={c.severity} kind={c.kind} />
              <span>{checkTitle(c, lang)}</span>
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </section>
      ) : null}

      <section className="insp-sources">
        <h3>{t("Where the number comes from")}</h3>
        {line.items.map((it) => (
          <ItemEvidence key={it.id} item={it} showQty={line.items.length > 1} />
        ))}
      </section>
    </div>
  );
}

function ItemEvidence({ item, showQty }: { item: Item; showQty: boolean }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const qtyOverrides = useApp((s) => s.qty);
  const fixes = useApp((s) => s.fixes);
  const setQty = useApp((s) => s.setQty);
  const eff = effectiveQty(item, qtyOverrides, fixes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(eff.value));
  const [reason, setReason] = useState(qtyOverrides[item.id]?.reason ?? "");

  return (
    <article className="evidence">
      <header className="evidence-head">
        <MethodTag method={item.method} />
        {showQty ? (
          <span className="evidence-qty num">
            {fmtQty(eff.value, item.unit)} {unitLabel(item.unit, lang)}
          </span>
        ) : null}
      </header>
      {showQty ? <p className="evidence-title">{lang === "az" ? item.az : item.en}</p> : null}
      <p className="evidence-hint">{methodHint(item.method, lang)}</p>
      {item.formula ? (
        <p className="formula">
          <span className="muted">{t("Formula")}</span> <span className="num">{formulaText(item.formula, lang)}</span>
        </p>
      ) : null}
      {item.note ? <p className="evidence-note">{noteText(item.id, item.note, lang)}</p> : null}
      <div className="evidence-sources">
        {item.src.map((s, i) => (
          <SourceCard key={i} source={s} itemId={item.id} index={i} />
        ))}
      </div>
      <div className="override">
        {editing ? (
          <form
            className="override-form"
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(draft.replace(",", "."));
              if (!Number.isFinite(v) || v < 0) return;
              setQty(item.id, v === item.qty && !reason ? null : { qty: v, reason: reason || t("Edited by reviewer") });
              setEditing(false);
            }}
          >
            <input className="input num" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={t("Quantity")} autoFocus />
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Reason")} aria-label={t("Reason for override")} />
            <button type="submit" className="btn btn-primary btn-sm">
              {t("Save")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              {t("Cancel")}
            </button>
          </form>
        ) : (
          <div className="override-row">
            {qtyOverrides[item.id] ? (
              <>
                <span className="small">
                  {t("Overridden to {q}: {r}", { q: fmtQty(qtyOverrides[item.id]!.qty, item.unit), r: qtyOverrides[item.id]!.reason })}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQty(item.id, null)}>
                  {t("Restore printed value")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDraft(String(eff.value));
                  setEditing(true);
                }}
              >
                {t("Override quantity")}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function SourceCard({ source, itemId, index, compact }: { source: Source; itemId?: string; index?: number; compact?: boolean }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const sheet = sheetById.get(source.sheet);
  const doc = data.documents.find((d) => d.code === sheet?.doc);
  const to = `${P}/drawings/${source.sheet}${itemId != null ? `?item=${itemId}&src=${index ?? 0}` : ""}`;
  return (
    <figure className={`source${compact ? " compact" : ""}`}>
      <Link to={to} className="source-crop" aria-label={t("Open {s} at the marked value", { s: source.sheet })}>
        <EvidenceCrop source={source} />
      </Link>
      <figcaption>
        <div className="source-sheet">
          <Link to={to} className="source-link">
            {source.sheet}
            <ArrowUpRight size={13} />
          </Link>
          <span className="truncate">{sheet ? sheetTitle(sheet, lang) : ""}</span>
        </div>
        <blockquote lang="az" className="source-quote">
          {source.quote}
        </blockquote>
        {!compact ? (
          <div className="source-meta muted small">
            {t("{f}, page {p}", { f: doc?.file ?? "", p: sheet?.page ?? "" })}
            {sheet ? `, ${buildingShort(sheet.building, lang)}` : ""}
          </div>
        ) : null}
      </figcaption>
    </figure>
  );
}

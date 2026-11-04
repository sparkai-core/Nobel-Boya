import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Layers,
  RotateCcw,
  Ruler,
  Save,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { buildingById, sheetById } from "../data";
import type { Item, Source } from "../data/types";
import { effectiveQty, type Line } from "../lib/boq";
import { fmtMoney, fmtNum, fmtQty, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { EvidenceCrop } from "./EvidenceCrop";
import { METHOD_HINT, MethodTag, SeverityTag } from "./ui";

type Props = {
  line: Line;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { current: number; total: number };
  onFocusSheet?: (sheetId: string, box: [number, number, number, number]) => void;
};

export function LineInspector({ line, onPrev, onNext, position, onFocusSheet }: Props) {
  const lang = useApp((s) => s.lang);
  const setRate = useApp((s) => s.setRate);
  const approvedMap = useApp((s) => s.approved);
  const toggleApprove = useApp((s) => s.toggleApprove);

  const rateOverridden = line.rate !== line.sampleRate;
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const otherDesc = lang === "az" ? line.en : line.az;

  // Primary item on this line
  const primaryItem = line.items[0];
  const isApproved = primaryItem ? Boolean(approvedMap[primaryItem.id]) : false;

  return (
    <div className="inspector modern-inspector">
      {/* Top Navigation & Status Bar */}
      <div className="insp-nav-bar">
        <div className="insp-item-badge">
          <Tag size={13} className="text-muted" />
          <span className="insp-item-code num-inline">{line.code}</span>
          <span className="insp-item-trade">{line.section}</span>
        </div>

        {position ? (
          <div className="insp-cycle-controls">
            <button
              type="button"
              className="icon-btn-sm"
              disabled={!onPrev || position.current <= 1}
              onClick={onPrev}
              title="Previous item"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="insp-position-counter num-inline">
              {position.current} <span className="muted">of</span> {position.total}
            </span>
            <button
              type="button"
              className="icon-btn-sm"
              disabled={!onNext || position.current >= position.total}
              onClick={onNext}
              title="Next item"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
      </div>

      {/* Item Title & Bilingual Descriptions */}
      <section className="insp-desc">
        <div className="insp-desc-header">
          <h3 className="insp-primary">{lang === "az" ? line.az : line.en}</h3>
          <p className="insp-secondary">{otherDesc}</p>
        </div>

        {/* Prominent Constech-style Approval Widget */}
        {primaryItem ? (
          <div className="insp-approval-card">
            <div className="approval-status-info">
              {isApproved ? (
                <>
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong className="text-emerald">Verified & Approved</strong>
                    <span className="text-muted small">Confirmed by Quantity Surveyor</span>
                  </div>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} className="text-muted" />
                  <div>
                    <strong>Verification Pending</strong>
                    <span className="text-muted small">Cross-reference drawing citation below</span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              className={`btn ${isApproved ? "btn-approved" : "btn-approve"}`}
              onClick={() => toggleApprove(primaryItem.id)}
            >
              <Check size={15} />
              <span>{isApproved ? "Approved" : "Approve Quantity"}</span>
            </button>
          </div>
        ) : null}
      </section>

      {/* KPI Metrics: Quantity, Rate, Amount */}
      <section className="insp-figures-grid">
        <div className="figure-card">
          <span className="figure-label">Total Quantity</span>
          <div className="figure-value num">
            {fmtQty(line.qty, line.unit)} <span className="figure-unit">{unitLabel(line.unit, lang)}</span>
          </div>
          {line.adjusted ? (
            <span className="figure-note-tag warning">
              Printed {fmtQty(line.printedQty, line.unit)} • {line.adjusted === "fix" ? "Audit Correction" : "Surveyor Override"}
            </span>
          ) : (
            <span className="figure-note-tag success">Verified from Drawing</span>
          )}
        </div>

        <div className="figure-card">
          <label className="figure-label" htmlFor={`rate-${line.id}`}>
            Unit Rate (AZN / {unitLabel(line.unit, "en")})
          </label>
          <div className="rate-edit-row">
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
                if (rateDraft != null && Number.isFinite(v) && v >= 0) {
                  setRate(line.rateKey, v === line.sampleRate ? null : v);
                }
                setRateDraft(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            {rateOverridden ? (
              <button
                type="button"
                className="icon-btn-sm"
                title={`Reset to base rate (${fmtNum(line.sampleRate)})`}
                onClick={() => setRate(line.rateKey, null)}
              >
                <RotateCcw size={14} />
              </button>
            ) : null}
          </div>
          <span className="figure-note">
            {rateOverridden ? `Custom rate (Base: ${fmtNum(line.sampleRate)})` : "Standard contractor rate library"}
          </span>
        </div>

        <div className="figure-card highlight">
          <span className="figure-label">Line Total (AZN)</span>
          <div className="figure-value amount-primary num">{fmtMoney(line.amount)}</div>
          <span className="figure-note">Before indirect mark-ups & VAT</span>
        </div>
      </section>

      {/* Discrepancy / Engineering Checks */}
      {line.checks.length ? (
        <section className="insp-checks-section">
          <h4 className="insp-section-heading">Cross-Discipline Audit Findings</h4>
          <div className="insp-checks-list">
            {line.checks.map((c) => (
              <Link key={c.id} to={`/checks/${c.id}`} className={`insp-check-item sev-card-${c.severity}`}>
                <SeverityTag severity={c.severity} kind={c.kind} compact />
                <span className="insp-check-title">{c.title}</span>
                <ArrowUpRight size={14} className="text-muted" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Drawing Provenance & Dimensional Inspector */}
      <section className="insp-sources-section">
        <h4 className="insp-section-heading">Drawing Provenance & Dimensions</h4>
        {line.items.map((it) => (
          <ItemDimensionInspector
            key={it.id}
            item={it}
            showQty={line.items.length > 1}
            onFocusSheet={onFocusSheet}
          />
        ))}
      </section>
    </div>
  );
}

/** Constech-style Dimension, Formula & Drawing Crop Inspector for each takeoff item */
function ItemDimensionInspector({
  item,
  showQty,
  onFocusSheet,
}: {
  item: Item;
  showQty: boolean;
  onFocusSheet?: (sheetId: string, box: [number, number, number, number]) => void;
}) {
  const lang = useApp((s) => s.lang);
  const qtyOverrides = useApp((s) => s.qty);
  const fixes = useApp((s) => s.fixes);
  const setQty = useApp((s) => s.setQty);
  const dimensions = useApp((s) => s.dimensions);
  const setDimensions = useApp((s) => s.setDimensions);

  const eff = effectiveQty(item, qtyOverrides, fixes);
  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState(String(eff.value));
  const [reason, setReason] = useState(qtyOverrides[item.id]?.reason ?? "");

  // Physical dimension inputs
  const currentDims = dimensions[item.id] ?? {};
  const [len, setLen] = useState(currentDims.length != null ? String(currentDims.length) : "");
  const [wid, setWid] = useState(currentDims.width != null ? String(currentDims.width) : "");
  const [dep, setDep] = useState(currentDims.height != null ? String(currentDims.height) : "");
  const [cnt, setCnt] = useState(currentDims.count != null ? String(currentDims.count) : "");

  const hasOverride = Boolean(qtyOverrides[item.id]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(draftQty.replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return;

    setQty(item.id, v === item.qty && !reason ? null : { qty: v, reason: reason || "Reviewed by surveyor" });

    // Save physical dimensions if entered
    const lNum = Number(len);
    const wNum = Number(wid);
    const dNum = Number(dep);
    const cNum = Number(cnt);
    if (lNum || wNum || dNum || cNum) {
      setDimensions(item.id, {
        length: lNum || undefined,
        width: wNum || undefined,
        height: dNum || undefined,
        count: cNum || undefined,
        note: reason,
      });
    }

    setEditing(false);
  };

  const handleReset = () => {
    setQty(item.id, null);
    setDimensions(item.id, null);
    setDraftQty(String(item.qty));
    setReason("");
    setLen("");
    setWid("");
    setDep("");
    setCnt("");
    setEditing(false);
  };

  return (
    <article className="dimension-inspector-card">
      <header className="dim-card-header">
        <div className="dim-method-wrap">
          <MethodTag method={item.method} />
          {hasOverride ? <span className="override-badge">User Override</span> : null}
        </div>

        {showQty ? (
          <span className="dim-qty-display num">
            {fmtQty(eff.value, item.unit)} {unitLabel(item.unit, lang)}
          </span>
        ) : null}
      </header>

      {showQty ? <p className="dim-item-title">{lang === "az" ? item.az : item.en}</p> : null}
      <p className="dim-method-hint">{METHOD_HINT[item.method]}</p>

      {/* Explicit Mathematical Formula */}
      {item.formula ? (
        <div className="formula-box">
          <div className="formula-header">
            <Ruler size={13} className="text-muted" />
            <span>Parametric Formula</span>
          </div>
          <div className="formula-expression num">{item.formula}</div>
        </div>
      ) : null}

      {/* Dimension & Quantity Editor */}
      {editing ? (
        <form className="dim-editor-form" onSubmit={handleSave}>
          <div className="dim-inputs-grid">
            <label className="dim-field">
              <span className="dim-label">Net Quantity ({item.unit})</span>
              <input
                className="input num"
                type="text"
                autoFocus
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
              />
            </label>
            <label className="dim-field">
              <span className="dim-label">Count / Units</span>
              <input
                className="input num"
                type="number"
                placeholder="e.g. 31"
                value={cnt}
                onChange={(e) => setCnt(e.target.value)}
              />
            </label>
          </div>

          <div className="dim-inputs-grid tri-col">
            <label className="dim-field">
              <span className="dim-label">Length (m)</span>
              <input
                className="input num"
                placeholder="L"
                value={len}
                onChange={(e) => setLen(e.target.value)}
              />
            </label>
            <label className="dim-field">
              <span className="dim-label">Width (m)</span>
              <input
                className="input num"
                placeholder="W"
                value={wid}
                onChange={(e) => setWid(e.target.value)}
              />
            </label>
            <label className="dim-field">
              <span className="dim-label">Depth/Height (m)</span>
              <input
                className="input num"
                placeholder="H"
                value={dep}
                onChange={(e) => setDep(e.target.value)}
              />
            </label>
          </div>

          <label className="dim-field">
            <span className="dim-label">Reviewer Note / Justification</span>
            <input
              className="input"
              type="text"
              placeholder="e.g. Verified against revision 2 structural plan"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>

          <div className="dim-form-actions">
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={13} />
              <span>Apply Changes</span>
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="dim-display-row">
          <div className="dim-values-summary">
            <span className="dim-summary-label">Takeoff Quantity:</span>
            <strong className="num">
              {fmtQty(eff.value, item.unit)} {unitLabel(item.unit, lang)}
            </strong>
            {hasOverride ? (
              <span className="text-muted small">({qtyOverrides[item.id]?.reason})</span>
            ) : null}
          </div>

          <div className="dim-actions-group">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setDraftQty(String(eff.value));
                setReason(qtyOverrides[item.id]?.reason ?? "");
                setEditing(true);
              }}
            >
              <Edit3 size={13} />
              <span>Edit Dimensions</span>
            </button>
            {hasOverride ? (
              <button
                type="button"
                className="icon-btn-sm"
                title="Reset to original drawing value"
                onClick={handleReset}
              >
                <RotateCcw size={14} />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Visual Drawing Evidence Cards */}
      <div className="dim-evidence-list">
        {item.src.map((s, i) => (
          <SourceCard
            key={i}
            source={s}
            itemId={item.id}
            index={i}
            onFocusSheet={onFocusSheet}
          />
        ))}
      </div>
    </article>
  );
}

/** Exported SourceCard component for Drawing Evidence display across inspector & checks */
export function SourceCard({
  source,
  itemId,
  index = 0,
  onFocusSheet,
}: {
  source: Source;
  itemId?: string;
  index?: number;
  onFocusSheet?: (sheetId: string, box: [number, number, number, number]) => void;
}) {
  const sheet = sheetById.get(source.sheet);
  const building = sheet ? buildingById.get(sheet.building) : undefined;

  return (
    <div className="evidence-card">
      <div className="evidence-card-top">
        <div className="evidence-sheet-badge">
          <Layers size={13} className="text-muted" />
          <span className="sheet-id-tag">{source.sheet}</span>
          <span className="sheet-title-text">{sheet?.titleEn || sheet?.title}</span>
          {building ? <span className="sheet-bldg-tag">{building.short}</span> : null}
        </div>

        {itemId ? (
          <Link
            to={`/drawings/${source.sheet}?item=${itemId}&src=${index}`}
            className="evidence-view-link"
            onClick={() => {
              if (onFocusSheet) onFocusSheet(source.sheet, source.box);
            }}
            title="Open in Blueprint Canvas"
          >
            <span>View on Drawing</span>
            <ExternalLink size={12} />
          </Link>
        ) : null}
      </div>

      {/* Interactive Visual Crop */}
      <div className="evidence-crop-container">
        <EvidenceCrop source={source} />
      </div>

      {/* Verbatim Source Quote from Schedule */}
      <div className="evidence-quote-wrap">
        <span className="quote-label">Original Drawing Citation:</span>
        <blockquote className="evidence-quote" lang="az">
          "{source.quote}"
        </blockquote>
      </div>
    </div>
  );
}

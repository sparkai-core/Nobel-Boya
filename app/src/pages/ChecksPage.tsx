import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Check as CheckIcon,
  CheckCircle2,
  ExternalLink,
  Layers,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { buildingById, data, itemById, sheetById } from "../data";
import type { Check } from "../data/types";
import { useBoq } from "../lib/boq";
import { fmtMoney, fmtNum, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { t } from "../lib/i18n";
import { SourceCard } from "../components/LineInspector";
import { SeverityTag } from "../components/ui";

const KIND_EN: Record<Check["kind"], string> = {
  arithmetic: "Schedule Arithmetic Discrepancy",
  conflict: "Cross-Discipline Conflict (Structure vs Arch)",
  missing: "Pending Specification Quantity",
  identity: "Drawing Sheet Numbering & Identity",
  review: "Engineering Review Required",
  agree: "Cross-Document Alignment (Verified Match)",
};

const KIND_AZ: Record<Check["kind"], string> = {
  arithmetic: "Cədvəl Hesablama Uyğunsuzluğu",
  conflict: "Sahələrarası Ziddiyyət (Konstruksiya vs Memarlıq)",
  missing: "Gözləmədə Olan Spesifikasiya Həcmi",
  identity: "Çertyoj Nömrələnməsi və İdentifikasiyası",
  review: "Mühəndis Baxışı Tələb Olunur",
  agree: "Sənədlərarası Tam Uyğunluq (Təsdiqlənmiş)",
};

export function ChecksPage() {
  const { checkId } = useParams();
  const navigate = useNavigate();
  const fixes = useApp((s) => s.fixes);
  const setFix = useApp((s) => s.setFix);
  const lang = useApp((s) => s.lang);
  const boq = useBoq();

  const check = data.checks.find((c) => c.id === checkId) ?? data.checks[0]!;

  const lines = [...new Set(check.items.map((id) => boq.lineByItem.get(id)).filter(Boolean))];
  const fixItem = check.fix ? itemById.get(check.fix.item) : null;
  const fixLine = check.fix ? boq.lineByItem.get(check.fix.item) : null;
  const delta = check.fix && fixItem && fixLine ? (check.fix.qty - fixItem.qty) * fixLine.rate : 0;
  const applied = Boolean(fixes[check.id]);
  const isAgreement = check.severity === "ok";

  const GROUPS = [
    { title: t("auditGroupErrors", lang), match: (c: Check) => c.severity === "error" || c.severity === "warn", icon: AlertTriangle },
    { title: t("auditGroupNotes", lang), match: (c: Check) => c.severity === "info", icon: Layers },
    { title: t("auditGroupAgreements", lang), match: (c: Check) => c.severity === "ok", icon: CheckCircle2 },
  ];

  const kindLabel = lang === "az" ? KIND_AZ[check.kind] : KIND_EN[check.kind];

  return (
    <div className="checks modern-checks">
      {/* Left Navigation Sidebar */}
      <aside className="check-list scroll">
        <div className="check-list-header">
          <h1>{t("auditsTitle", lang)}</h1>
          <p className="check-lead">
            {t("auditsLead", lang)}
          </p>
        </div>

        {GROUPS.map((g) => {
          const list = data.checks.filter(g.match);
          const GroupIcon = g.icon;
          return (
            <section key={g.title} className="check-group-section">
              <h2 className="check-group">
                <GroupIcon size={14} className="text-muted" />
                <span>{g.title}</span>
                <span className="muted num-inline check-group-badge">{list.length}</span>
              </h2>
              <ul className="check-items-list">
                {list.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`check-row${c.id === check.id ? " active" : ""}`}
                      onClick={() => navigate(`/checks/${c.id}`)}
                    >
                      <div className="check-row-top">
                        <SeverityTag severity={c.severity} kind={c.kind} compact />
                        <span className="check-row-bldg">{buildingById.get(c.building)?.short}</span>
                      </div>
                      <span className="check-row-title">{c.title}</span>
                      <div className="check-row-meta">
                        <span className="check-row-id">{c.id}</span>
                        {fixes[c.id] ? <span className="check-applied-tag">{t("fixed", lang)}</span> : null}
                        <span className="check-source-count">{c.sources.length} {t("citations", lang)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </aside>

      {/* Right Detail Pane */}
      <section className="check-detail scroll" key={check.id}>
        <div className="check-detail-inner">
          {/* Header Bar */}
          <div className="check-kicker">
            <SeverityTag severity={check.severity} kind={check.kind} />
            <span className="kicker-type">
              {kindLabel} • {lang === "az" ? buildingById.get(check.building)?.short : buildingById.get(check.building)?.en}
            </span>
            <span className="kicker-id font-mono">{check.id}</span>
          </div>

          <h2 className="check-title">{check.title}</h2>
          <p className="check-text">{check.detail}</p>

          {/* DUAL COMPARISON CARD (For BOTH Conflicts AND Matching checks) */}
          <div className={`audit-comparison-card ${isAgreement ? "card-matching" : "card-conflict"}`}>
            <div className="comp-header">
              <div className="comp-title-group">
                {isAgreement ? (
                  <>
                    <ShieldCheck size={18} className="text-emerald" />
                    <strong>{lang === "az" ? "Təsdiqlənmiş Çarpaz Sənəd Uyğunluğu" : "Verified Cross-Document Alignment"}</strong>
                    <span className="comp-pill comp-pill-emerald">{lang === "az" ? "100% Dəqiq Uyğunluq" : "100% Match Confirmed"}</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={18} className="text-amber" />
                    <strong>{lang === "az" ? "Ziddiyyət / Fərq Təhlili" : "Discrepancy / Variance Analysis"}</strong>
                    <span className="comp-pill comp-pill-amber">{lang === "az" ? "Uyğunsuzluq Aşkarlanıb" : "Variance Identified"}</span>
                  </>
                )}
              </div>
            </div>

            <div className="comp-body-grid">
              {/* Document 1 Box */}
              <div className="comp-side-box">
                <span className="comp-side-label">{lang === "az" ? "Mənbə Sənəd 1" : "Source Document 1"}</span>
                {check.sources[0] ? (
                  <div className="comp-doc-meta">
                    <strong>{lang === "az" ? `Vərəq ${check.sources[0].sheet}` : `Sheet ${check.sources[0].sheet}`}</strong>
                    <span className="text-muted small">
                      {lang === "az" ? sheetById.get(check.sources[0].sheet)?.title : (sheetById.get(check.sources[0].sheet)?.titleEn ?? "Design Sheet")}
                    </span>
                    <blockquote className="comp-quote">"{check.sources[0].quote}"</blockquote>
                  </div>
                ) : null}
                <div className="comp-figure-display">
                  <span className="fig-caption">{isAgreement ? (lang === "az" ? "Təsdiqlənmiş Dəyər" : "Verified Value") : (lang === "az" ? "Çertyojda Yazılan" : "Printed in Drawing")}</span>
                  <span className={`fig-num num ${!isAgreement && check.expected != null ? "strike" : ""}`}>
                    {check.printed != null ? fmtNum(check.printed) : check.sources[0]?.value ?? "—"}{" "}
                    <small>{unitLabel(check.unit ?? "", lang)}</small>
                  </span>
                </div>
              </div>

              {/* Center Operator / Difference Indicator */}
              <div className="comp-center-divider">
                {isAgreement ? (
                  <div className="comp-match-glyph" title="Exact match confirmed between drawings">
                    <CheckCircle2 size={24} className="text-emerald" />
                    <span>{lang === "az" ? "UYĞUN" : "MATCH"}</span>
                  </div>
                ) : (
                  <div className="comp-variance-glyph" title="Variance between documents">
                    <Scale size={24} className="text-amber" />
                    <span>Δ {lang === "az" ? "FƏRQ" : "VARIANCE"}</span>
                  </div>
                )}
              </div>

              {/* Document 2 Box */}
              <div className="comp-side-box">
                <span className="comp-side-label">
                  {check.sources.length > 1
                    ? (lang === "az" ? "Çarpaz Sənəd 2" : "Cross-Check Document 2")
                    : (lang === "az" ? "Yenidən Hesablanmış Spesifikasiya" : "Re-Calculated Specification")}
                </span>
                {check.sources[1] ? (
                  <div className="comp-doc-meta">
                    <strong>{lang === "az" ? `Vərəq ${check.sources[1].sheet}` : `Sheet ${check.sources[1].sheet}`}</strong>
                    <span className="text-muted small">
                      {lang === "az" ? sheetById.get(check.sources[1].sheet)?.title : (sheetById.get(check.sources[1].sheet)?.titleEn ?? "Referenced Sheet")}
                    </span>
                    <blockquote className="comp-quote">"{check.sources[1].quote}"</blockquote>
                  </div>
                ) : (
                  <div className="comp-doc-meta">
                    <strong>{lang === "az" ? "Müstəqil Yenidən Hesablama" : "Independent Re-Calculation"}</strong>
                    <span className="text-muted small">{lang === "az" ? "Cədvəl sətirlərinin və element saylarının cəmi" : "Sum of member schedules & structural counts"}</span>
                    <blockquote className="comp-quote">{lang === "az" ? "Fərdi sətirlərin riyazi cəmi yoxlanıldı" : "Verified sum of individual component rows"}</blockquote>
                  </div>
                )}
                <div className="comp-figure-display">
                  <span className="fig-caption">{isAgreement ? (lang === "az" ? "Yoxlanılmış Dəyər" : "Cross-Checked Value") : (lang === "az" ? "Gözlənilən / Audit Həcmi" : "Expected / Audited")}</span>
                  <span className="fig-num num font-bold text-blue">
                    {check.expected != null ? fmtNum(check.expected) : check.sources[1]?.value ?? check.printed ?? "—"}{" "}
                    <small>{unitLabel(check.unit ?? "", lang)}</small>
                  </span>
                </div>
              </div>
            </div>

            {/* Delta & Correction Bar */}
            {check.expected != null && check.printed != null && !isAgreement ? (
              <div className="comp-delta-bar">
                <div className="delta-stat">
                  <span className="delta-label">{lang === "az" ? "Riyazi Fərq:" : "Arithmetic Difference:"}</span>
                  <strong className="delta-val num">
                    {fmtNum(check.printed - check.expected)} {unitLabel(check.unit ?? "", lang)}
                  </strong>
                </div>
                {check.fix ? (
                  <div className="delta-action">
                    <button
                      type="button"
                      className={`btn ${applied ? "btn-outline" : "btn-primary"} btn-sm`}
                      onClick={() => setFix(check.id, !applied)}
                    >
                      {applied ? (
                        <>
                          <Undo2 size={13} />
                          <span>{t("revertCorrection", lang)}</span>
                        </>
                      ) : (
                        <>
                          <CheckIcon size={13} strokeWidth={2.5} />
                          <span>
                            {lang === "az"
                              ? `Smeta Cədvəlinə Düzəliş Tətbiq Et (${fmtMoney(Math.abs(delta))} AZN təsir)`
                              : `Apply Correction to BOQ (${fmtMoney(Math.abs(delta))} AZN impact)`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Interactive Evidence Drawing Crops */}
          <h3 className="check-sub">{lang === "az" ? "Çertyoj Əsasları və Kəsikləri" : "Drawing Evidence Crops"}</h3>
          <div className="check-sources-grid">
            {check.sources.map((s, i) => (
              <div key={i} className="check-source-card">
                <div className="source-card-top">
                  <span className="source-doc-tag">{lang === "az" ? `Sənəd ${i + 1}` : `Document ${i + 1}`}</span>
                  <Link
                    to={`/drawings/${s.sheet}?check=${check.id}&src=${i}`}
                    className="btn btn-outline btn-xs"
                    title="View high-resolution drawing sheet"
                  >
                    <span>{lang === "az" ? `Vərəq ${s.sheet}-i İncələ` : `Inspect Sheet ${s.sheet}`}</span>
                    <ExternalLink size={11} />
                  </Link>
                </div>
                <SourceCard source={s} />
              </div>
            ))}
          </div>

          {/* Affected Bill Lines */}
          {lines.length ? (
            <div className="affected-bill-lines-section">
              <h3 className="check-sub">{lang === "az" ? "Təsir Edilən Smeta Bəndləri" : "Affected Bill Lines"}</h3>
              <ul className="affected-lines-list">
                {lines.map((l) => (
                  <li key={l!.id}>
                    <Link to={`/bill?line=${l!.id}`} className="affected-line-row">
                      <span className="affected-code font-mono">{l!.code}</span>
                      <span className="affected-desc truncate">{lang === "az" ? l!.az : l!.en}</span>
                      <span className="affected-amount num font-semibold">{fmtMoney(l!.amount)} AZN</span>
                      <ExternalLink size={12} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

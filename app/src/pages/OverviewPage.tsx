import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Layers,
  ReceiptText,
} from "lucide-react";
import { data } from "../data";
import type { Method } from "../data/types";
import { useBoq } from "../lib/boq";
import { fmtMoney, pct } from "../lib/format";
import { useApp } from "../lib/store";
import { PageHead } from "../components/Shell";
import { METHOD_HINT, METHOD_LABEL, SeverityTag } from "../components/ui";

const METHODS: Method[] = ["schedule", "derived", "image"];

export function OverviewPage() {
  const boq = useBoq();
  const navigate = useNavigate();
  const fixes = useApp((s) => s.fixes);
  const lang = useApp((s) => s.lang);
  const works = boq.works || 1;

  const trades = new Map<string, { az: string; en: string; total: number; lines: number }>();
  for (const b of boq.buildings)
    for (const s of b.sections) {
      const t = trades.get(s.id) ?? { az: s.az, en: s.en, total: 0, lines: 0 };
      t.total += s.total;
      t.lines += s.lines.length;
      trades.set(s.id, t);
    }
  const tradeList = [...trades.entries()].sort((a, z) => z[1].total - a[1].total);
  const maxTrade = tradeList[0]?.[1].total || 1;

  const findings = data.checks.filter((c) => c.severity !== "ok");
  const agreements = data.checks.filter((c) => c.severity === "ok");
  const appliedFixesCount = Object.keys(fixes).length;
  const sheetCount = new Set(data.items.flatMap((i) => i.src.map((s) => s.sheet))).size;

  return (
    <div className="page modern-page">
      <PageHead
        title="Project Overview"
        lead={
          <>
            Automated Quantity Takeoff for <strong>{data.project.nameEn}</strong>. Built from{" "}
            {data.items.length} verified quantities across {sheetCount} of {data.sheets.length} drawing sheets in 4 packages.
            Every item links to original coordinate evidence.
          </>
        }
      />

      {/* Modern Executive KPI Stats Grid */}
      <div className="overview-hero-metrics">
        <div className="hero-kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap kpi-blue">
              <ReceiptText size={18} />
            </div>
            <span className="kpi-pill kpi-pill-blue">18% VAT Incl.</span>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Contract Valuation</span>
            <div className="kpi-value num">
              {fmtMoney(boq.total)} <span className="kpi-unit">AZN</span>
            </div>
            <span className="kpi-subtext">Direct works {fmtMoney(boq.works)} + 4 commercial mark-up tiers</span>
          </div>
        </div>

        <div className="hero-kpi-card clickable" onClick={() => navigate("/drawings")}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap kpi-slate">
              <Layers size={18} />
            </div>
            <span className="kpi-pill kpi-pill-slate">4 Volumes</span>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Drawing Scope</span>
            <div className="kpi-value num">
              {data.sheets.length} <span className="kpi-unit">Sheets</span>
            </div>
            <span className="kpi-subtext">Master Plan, Architecture, Structure, &amp; MEP</span>
          </div>
        </div>

        <div className="hero-kpi-card clickable" onClick={() => navigate("/bill")}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap kpi-emerald">
              <CheckCircle2 size={18} />
            </div>
            <span className="kpi-pill kpi-pill-emerald">100% Backed</span>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Verified Bill Lines</span>
            <div className="kpi-value num">
              {boq.lines.length} <span className="kpi-unit">Lines</span>
            </div>
            <span className="kpi-subtext">{data.items.length} quantities cited directly from schedules &amp; plans</span>
          </div>
        </div>

        <div className="hero-kpi-card clickable" onClick={() => navigate("/checks")}>
          <div className="kpi-top">
            <div className="kpi-icon-wrap kpi-amber">
              <AlertTriangle size={18} />
            </div>
            <span className="kpi-pill kpi-pill-amber">{findings.length} Active Findings</span>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Drawing Audits</span>
            <div className="kpi-value num">
              {data.checks.length} <span className="kpi-unit">Checks</span>
            </div>
            <span className="kpi-subtext">
              {appliedFixesCount > 0
                ? `${appliedFixesCount} corrections applied to bill`
                : "Inspect cross-discipline variances & apply fixes →"}
            </span>
          </div>
        </div>
      </div>

      <div className="overview">
        {/* Left Column: Commercial Contract Breakdown */}
        <section className="panel collection">
          <header className="panel-head">
            <div>
              <h2>Summary of the Bill</h2>
              <span className="muted small">Direct works and statutory commercial mark-ups</span>
            </div>
            <span className="pill-badge-subtle">AZN Standard</span>
          </header>
          <table className="collection-table">
            <thead>
              <tr className="table-header-row">
                <th style={{ width: "44px" }}>Code</th>
                <th>Asset / Structure</th>
                <th className="num" style={{ width: "80px" }}>Scope</th>
                <th className="num" style={{ width: "80px" }}>Share</th>
                <th className="num" style={{ width: "130px" }}>Direct Works</th>
              </tr>
            </thead>
            <tbody>
              {boq.buildings.map((b) => (
                <tr key={b.id} className="clickable" onClick={() => navigate(`/bill?b=${b.id}`)} title="View bill lines for this building">
                  <td className="code num">{b.code}</td>
                  <td>
                    <div className="coll-name">{lang === "az" ? b.az : b.en}</div>
                    <div className="share-bar" aria-hidden="true">
                      <span style={{ width: `${(b.total / works) * 100}%` }} />
                    </div>
                  </td>
                  <td className="num muted">{b.sections.reduce((a, s) => a + s.lines.length, 0)} lines</td>
                  <td className="num muted">{pct(b.total / works)}</td>
                  <td className="num amount">{fmtMoney(b.total)}</td>
                </tr>
              ))}
            </tbody>
            <tbody className="chain">
              {boq.chain.map((c) => (
                <tr key={c.key} className={c.key === "works" ? "chain-works" : ""}>
                  <td />
                  <td>
                    {c.label}
                    {c.rate != null ? <span className="muted"> ({pct(c.rate, 0)})</span> : null}
                  </td>
                  <td />
                  <td />
                  <td className="num">{fmtMoney(c.amount)}</td>
                </tr>
              ))}
              <tr className="chain-total">
                <td />
                <td>
                  <strong>Total Contract Valuation (incl. VAT)</strong>
                </td>
                <td />
                <td />
                <td className="num">
                  <strong>{fmtMoney(boq.total)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Right Column: Evidence & Findings */}
        <div className="overview-side">
          <section className="panel">
            <header className="panel-head">
              <div>
                <h2>Evidence Behind the Value</h2>
                <span className="muted small">Verification methodology share</span>
              </div>
            </header>
            <div className="evidence-bar" role="img" aria-label="Share of bill value by evidence type">
              {METHODS.map((m) => (
                <span key={m} className={`ev-${m}`} style={{ width: `${(boq.methodValue[m] / works) * 100}%` }} />
              ))}
            </div>
            <ul className="evidence-legend">
              {METHODS.map((m) => (
                <li key={m}>
                  <i className={`ev-dot ev-${m}`} aria-hidden="true" />
                  <div>
                    <div className="ev-name">
                      {METHOD_LABEL[m]} <span className="num muted">{boq.methodCount[m]} lines</span>
                    </div>
                    <div className="muted small">{METHOD_HINT[m]}</div>
                  </div>
                  <span className="num">{pct(boq.methodValue[m] / works)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h2>Findings in the Drawings</h2>
                <span className="muted small">Discipline &amp; calculation audits</span>
              </div>
              <Link to="/checks" className="text-link">
                All checks →
              </Link>
            </header>
            <ul className="finding-list">
              {findings.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/checks/${c.id}`} title={c.title}>
                    <SeverityTag severity={c.severity} kind={c.kind} compact />
                    <span className="finding-title">{c.title}</span>
                    <span className="finding-bldg">{c.building}</span>
                    {fixes[c.id] ? (
                      <span className="applied">
                        <Check size={11} strokeWidth={2.5} />
                        Corrected
                      </span>
                    ) : null}
                    <ArrowUpRight size={14} className="finding-arrow" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="finding-foot">
              {findings.length - Math.min(5, findings.length)} more notes, and {agreements.length} cross-checks where documents agree.
            </p>
          </section>
        </div>

        {/* Bottom Full-Width Sections: Trade Breakdown & Package Exclusions */}
        <section className="panel trades">
          <header className="panel-head">
            <div>
              <h2>Trade Distribution</h2>
              <span className="muted small">All structures, direct works value before mark-ups</span>
            </div>
          </header>
          <ul className="trade-list">
            {tradeList.map(([id, t]) => (
              <li key={id}>
                <span className="trade-name">{lang === "az" ? t.az : t.en}</span>
                <span className="trade-bar" aria-hidden="true">
                  <span style={{ width: `${(t.total / maxTrade) * 100}%` }} />
                </span>
                <span className="num muted">{t.lines} lines</span>
                <span className="num amount">{fmtMoney(t.total)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel gaps">
          <header className="panel-head">
            <div>
              <h2>Package Exclusions</h2>
              <span className="muted small">Excluded from bill rather than guessed</span>
            </div>
          </header>
          <ul className="gap-list">
            {data.gaps.map((g) => (
              <li key={g.en}>
                <strong>{g.en}</strong>
                <span className="muted">{g.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

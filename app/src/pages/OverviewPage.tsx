import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
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

  return (
    <div className="page">
      <PageHead
        title="Overview"
        lead={
          <>
            {boq.lines.length} bill lines built from {data.items.length} quantities on {new Set(data.items.flatMap((i) => i.src.map((s) => s.sheet))).size} of 205
            sheets. Quantities come from the drawings. Rates are a sample library you can edit.
          </>
        }
      />

      <div className="overview">
        <section className="panel collection">
          <header className="panel-head">
            <h2>Summary of the bill</h2>
            <span className="muted small">AZN</span>
          </header>
          <table className="collection-table">
            <tbody>
              {boq.buildings.map((b) => (
                <tr key={b.id} className="clickable" onClick={() => navigate(`/bill?b=${b.id}`)}>
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
                    {c.rate != null ? <span className="muted"> {pct(c.rate, 0)}</span> : null}
                  </td>
                  <td />
                  <td />
                  <td className="num">{fmtMoney(c.amount)}</td>
                </tr>
              ))}
              <tr className="chain-total">
                <td />
                <td>Total including VAT</td>
                <td />
                <td />
                <td className="num">{fmtMoney(boq.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="overview-side">
          <section className="panel">
            <header className="panel-head">
              <h2>Evidence behind the value</h2>
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
              <h2>Findings in the drawings</h2>
              <Link to="/checks" className="text-link">
                All checks
              </Link>
            </header>
            <ul className="finding-list">
              {findings.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/checks/${c.id}`}>
                    <SeverityTag severity={c.severity} kind={c.kind} />
                    <span className="finding-title">{c.title}</span>
                    {fixes[c.id] ? <span className="applied">Applied</span> : null}
                    <ArrowUpRight size={14} className="faint" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="muted small finding-foot">
              {findings.length - Math.min(5, findings.length)} more notes, and {agreements.length} places where two documents agree.
            </p>
          </section>
        </div>

        <section className="panel trades">
          <header className="panel-head">
            <h2>By trade</h2>
            <span className="muted small">All structures, before mark-ups</span>
          </header>
          <ul className="trade-list">
            {tradeList.map(([id, t]) => (
              <li key={id}>
                <span className="trade-name">{lang === "az" ? t.az : t.en}</span>
                <span className="trade-bar" aria-hidden="true">
                  <span style={{ width: `${(t.total / maxTrade) * 100}%` }} />
                </span>
                <span className="num muted">{t.lines}</span>
                <span className="num">{fmtMoney(t.total)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel gaps">
          <header className="panel-head">
            <h2>Not in the package</h2>
            <span className="muted small">Left out of the bill rather than guessed</span>
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

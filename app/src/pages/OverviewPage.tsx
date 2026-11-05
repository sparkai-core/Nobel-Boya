import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { COVER_SHEETS, data, P, sheetImage } from "../data";
import type { Method } from "../data/types";
import { useBoq } from "../lib/boq";
import { fmtMoney, pct } from "../lib/format";
import { useApp } from "../lib/store";
import { buildingName, chainLabel, checkTitle, gapDetail, gapName, projectName, projectPlace } from "../lib/loc";
import { methodLabel, SeverityTag } from "../components/ui";
import { useT } from "../lib/i18n";

const METHODS: Method[] = ["schedule", "derived", "image"];
const METHOD_COLOR: Record<Method, string> = { schedule: "#2b0266", derived: "#9b87d6", image: "#c98a1b" };

export function OverviewPage() {
  const t = useT();
  const boq = useBoq();
  const navigate = useNavigate();
  const fixes = useApp((s) => s.fixes);
  const lang = useApp((s) => s.lang);
  const works = boq.works || 1;
  const markups = boq.total - boq.works;
  const sheetsUsed = new Set(data.items.flatMap((i) => i.src.map((s) => s.sheet))).size;

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
  const open = data.checks.filter((c) => c.severity === "error" || c.severity === "warn").length;
  const agreements = data.checks.filter((c) => c.severity === "ok").length;

  let acc = 0;
  const R = 46;
  const C = 2 * Math.PI * R;
  const arcs = METHODS.map((m) => {
    const share = boq.methodValue[m] / works;
    const arc = { m, share, dash: share * C, offset: -acc * C };
    acc += share;
    return arc;
  });

  return (
    <div className="page ov">
      <section className="ov-hero card">
        <div className="ov-hero-copy">
          <span className="ov-place">{projectPlace(lang)}</span>
          <h1>{projectName(lang)}</h1>
          <div className="ov-total">
            <span className="ov-total-label">{t("Bill total including VAT")}</span>
            <span className="ov-total-value num-inline">
              {fmtMoney(boq.total)} <small>AZN</small>
            </span>
          </div>
          <dl className="ov-stats">
            <div>
              <dt>{t("Measured works")}</dt>
              <dd className="num-inline">{fmtMoney(boq.works)}</dd>
            </div>
            <div>
              <dt>{t("Mark-ups and VAT")}</dt>
              <dd className="num-inline">{fmtMoney(markups)}</dd>
            </div>
            <div>
              <dt>{t("Bill lines")}</dt>
              <dd className="num-inline">{boq.lines.length}</dd>
            </div>
            <div>
              <dt>{t("Sheets used")}</dt>
              <dd className="num-inline">
                {sheetsUsed} <span className="muted">{t("of 205")}</span>
              </dd>
            </div>
          </dl>
          <div className="ov-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate(`${P}/bill`)}>
              {t("Open the bill")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(`${P}/checks`)}>
              {t("Review {n} findings", { n: open })}
            </button>
          </div>
        </div>
        <button type="button" className="ov-hero-art project-cover" onClick={() => navigate(`${P}/drawings`)} aria-label={t("Open the drawings")}>
          {COVER_SHEETS.map((id) => (
            <img key={id} src={sheetImage(id, true)} alt="" loading="lazy" />
          ))}
        </button>
      </section>

      <div className="ov-grid">
        <section className="card ov-summary">
          <header className="card-head">
            <h2>{t("Summary by structure")}</h2>
            <span className="muted small">{t("AZN, sample rates")}</span>
          </header>
          <table className="collection-table">
            <tbody>
              {boq.buildings.map((b) => (
                <tr key={b.id} className="clickable" onClick={() => navigate(`${P}/bill?b=${b.id}`)}>
                  <td className="code num-inline">{b.code}</td>
                  <td>
                    <div className="coll-name">{buildingName(b.id, lang)}</div>
                    <div className="share-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(1, (b.total / works) * 100)}%` }} />
                    </div>
                  </td>
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
                    {chainLabel(c.key, c.label, lang)}
                    {c.rate != null ? <span className="muted"> {pct(c.rate, 0)}</span> : null}
                  </td>
                  <td />
                  <td className="num">{fmtMoney(c.amount)}</td>
                </tr>
              ))}
              <tr className="chain-total">
                <td />
                <td>{t("Total including VAT")}</td>
                <td />
                <td className="num">{fmtMoney(boq.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="ov-side">
          <section className="card">
            <header className="card-head">
              <h2>{t("Evidence behind the value")}</h2>
            </header>
            <div className="donut-wrap">
              <svg className="donut" viewBox="0 0 120 120" role="img" aria-label={t("Share of bill value by evidence type")}>
                <circle cx="60" cy="60" r={R} className="donut-track" />
                {arcs.map((a) => (
                  <circle
                    key={a.m}
                    cx="60"
                    cy="60"
                    r={R}
                    fill="none"
                    stroke={METHOD_COLOR[a.m]}
                    strokeWidth="14"
                    strokeDasharray={`${Math.max(0, a.dash - 1.5)} ${C}`}
                    strokeDashoffset={a.offset}
                    transform="rotate(-90 60 60)"
                  />
                ))}
                <text x="60" y="57" textAnchor="middle" className="donut-value">
                  {pct(boq.methodValue.schedule / works, 0)}
                </text>
                <text x="60" y="73" textAnchor="middle" className="donut-label">
                  {t("printed")}
                </text>
              </svg>
              <ul className="donut-legend">
                {METHODS.map((m) => (
                  <li key={m}>
                    <i style={{ background: METHOD_COLOR[m] }} aria-hidden="true" />
                    <span>{methodLabel(m, lang)}</span>
                    <span className="num-inline muted">{boq.methodCount[m]}</span>
                    <span className="num-inline">{pct(boq.methodValue[m] / works)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card">
            <header className="card-head">
              <h2>{t("Findings in the drawings")}</h2>
              <Link to={`${P}/checks`} className="text-link small">
                {t("All checks")}
              </Link>
            </header>
            <ul className="finding-list">
              {findings.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`${P}/checks/${c.id}`}>
                    <SeverityTag severity={c.severity} kind={c.kind} />
                    <span className="finding-title">{checkTitle(c, lang)}</span>
                    {fixes[c.id] ? <span className="applied">{t("Applied")}</span> : <ArrowUpRight size={14} className="faint" />}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="muted small finding-foot">
              {t("{n} more notes, and {a} places where two documents agree.", { n: findings.length - Math.min(5, findings.length), a: agreements })}
            </p>
          </section>
        </div>

        <section className="card ov-trades">
          <header className="card-head">
            <h2>{t("By trade")}</h2>
            <span className="muted small">{t("All structures, before mark-ups")}</span>
          </header>
          <ul className="trade-list">
            {tradeList.map(([id, t]) => (
              <li key={id}>
                <span className="trade-name">{lang === "az" ? t.az : t.en}</span>
                <span className="trade-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(1.5, (t.total / maxTrade) * 100)}%` }} />
                </span>
                <span className="num-inline muted trade-lines">{t.lines}</span>
                <span className="num-inline trade-amount">{fmtMoney(t.total)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card ov-gaps">
          <header className="card-head">
            <h2>{t("Not in the package")}</h2>
            <span className="muted small">{t("Left out rather than guessed")}</span>
          </header>
          <ul className="gap-list">
            {data.gaps.map((g) => (
              <li key={g.en}>
                <strong>{gapName(g, lang)}</strong>
                <span className="muted">{gapDetail(g, lang)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

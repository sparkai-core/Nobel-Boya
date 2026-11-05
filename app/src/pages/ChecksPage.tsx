import { Link, useNavigate, useParams } from "react-router-dom";
import { Check as CheckIcon, Undo2 } from "lucide-react";
import { data, itemById, P } from "../data";
import type { Check } from "../data/types";
import { useBoq } from "../lib/boq";
import { fmtMoney, fmtNum, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { buildingName, buildingShort, checkDetail, checkFix, checkTitle } from "../lib/loc";
import { SourceCard } from "../components/LineInspector";
import { SeverityTag } from "../components/ui";
import { useT } from "../lib/i18n";

const GROUPS: { title: string; match: (c: Check) => boolean }[] = [
  { title: "Errors and conflicts", match: (c) => c.severity === "error" || c.severity === "warn" },
  { title: "Notes", match: (c) => c.severity === "info" },
  { title: "Agreements", match: (c) => c.severity === "ok" },
];

const KIND: Record<Check["kind"], string> = {
  arithmetic: "Arithmetic",
  conflict: "Two documents disagree",
  missing: "Missing value",
  identity: "Sheet identity",
  review: "Needs review",
  agree: "Cross-check",
};

export function ChecksPage() {
  const t = useT();
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

  return (
    <div className="checks">
      <aside className="check-list scroll">
        <h1>{t("Checks")}</h1>
        <p className="muted small check-lead">
          {t("Every schedule was added up again and compared with the same quantity on other sheets. Nothing in the bill was changed silently.")}
        </p>
        {GROUPS.map((g) => {
          const list = data.checks.filter(g.match);
          return (
            <section key={g.title}>
              <h2 className="check-group">
                {t(g.title)} <span className="muted num-inline">{list.length}</span>
              </h2>
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={`check-row${c.id === check.id ? " active" : ""}`} onClick={() => navigate(`${P}/checks/${c.id}`)}>
                      <SeverityTag severity={c.severity} kind={c.kind} />
                      <span className="check-row-title">{checkTitle(c, lang)}</span>
                      <span className="check-row-meta muted small">
                        {c.id}, {buildingShort(c.building, lang)}
                        {fixes[c.id] ? t(", correction applied") : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </aside>

      <section className="check-detail scroll" key={check.id}>
        <div className="check-detail-inner">
          <div className="check-kicker">
            <SeverityTag severity={check.severity} kind={check.kind} />
            <span className="muted">
              {t(KIND[check.kind])}, {buildingName(check.building, lang)}
            </span>
          </div>
          <h2 className="check-title">{checkTitle(check, lang)}</h2>
          <p className="check-text">{checkDetail(check, lang)}</p>

          {check.expected != null && check.printed != null ? (
            <div className="check-figures">
              <div>
                <span className="figure-label">{t("Printed")}</span>
                <span className="figure-value num strike">
                  {fmtNum(check.printed)} <small>{unitLabel(check.unit ?? "", lang)}</small>
                </span>
              </div>
              <div>
                <span className="figure-label">{t("Rows add up to")}</span>
                <span className="figure-value num">
                  {fmtNum(check.expected)} <small>{unitLabel(check.unit ?? "", lang)}</small>
                </span>
              </div>
              <div>
                <span className="figure-label">{t("Difference")}</span>
                <span className="figure-value num">
                  {fmtNum(check.printed - check.expected)} <small>{unitLabel(check.unit ?? "", lang)}</small>
                </span>
              </div>
            </div>
          ) : null}

          {check.fix ? (
            <div className={`fix${applied ? " applied" : ""}`}>
              <div>
                <strong>{applied ? t("Correction applied to the bill") : t("Correction available")}</strong>
                <p className="muted small">
                  {t("{l}. Bill line {c} changes by {d} AZN before mark-ups.", { l: checkFix(check, lang), c: fixLine?.code ?? "", d: fmtMoney(delta) })}
                </p>
              </div>
              <button type="button" className={`btn ${applied ? "btn-ghost" : "btn-primary"}`} onClick={() => setFix(check.id, !applied)}>
                {applied ? (
                  <>
                    <Undo2 size={15} /> {t("Use the printed value")}
                  </>
                ) : (
                  <>
                    <CheckIcon size={15} /> {t("Apply to the bill")}
                  </>
                )}
              </button>
            </div>
          ) : null}

          <h3 className="check-sub">{t("Evidence")}</h3>
          <div className="check-sources">
            {check.sources.map((s, i) => (
              <SourceCardForCheck key={i} checkId={check.id} index={i} source={s} />
            ))}
          </div>

          {lines.length ? (
            <>
              <h3 className="check-sub">{t("Bill lines affected")}</h3>
              <table className="mini-table">
                <tbody>
                  {lines.map((l) => (
                    <tr key={l!.id}>
                      <td className="num code">{l!.code}</td>
                      <td>
                        <Link to={`${P}/bill?line=${encodeURIComponent(l!.id)}`} className="text-link">
                          {lang === "az" ? l!.az : l!.en}
                        </Link>
                      </td>
                      <td className="num">{fmtMoney(l!.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SourceCardForCheck({ checkId, index, source }: { checkId: string; index: number; source: Check["sources"][number] }) {
  const t = useT();
  return (
    <div className="check-source">
      <SourceCard source={source} />
      <Link to={`${P}/drawings/${source.sheet}?check=${checkId}&src=${index}`} className="text-link small">
        {t("Open on the sheet")}
      </Link>
    </div>
  );
}

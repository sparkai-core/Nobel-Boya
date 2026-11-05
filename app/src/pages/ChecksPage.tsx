import { Link, useNavigate, useParams } from "react-router-dom";
import { Check as CheckIcon, Undo2 } from "lucide-react";
import { buildingById, data, itemById } from "../data";
import type { Check } from "../data/types";
import { useBoq } from "../lib/boq";
import { fmtMoney, fmtNum, unitLabel } from "../lib/format";
import { useApp } from "../lib/store";
import { SourceCard } from "../components/LineInspector";
import { SeverityTag } from "../components/ui";

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
        <h1>Checks</h1>
        <p className="muted small check-lead">
          Every schedule was added up again and compared with the same quantity on other sheets. Nothing in the bill was changed silently.
        </p>
        {GROUPS.map((g) => {
          const list = data.checks.filter(g.match);
          return (
            <section key={g.title}>
              <h2 className="check-group">
                {g.title} <span className="muted num-inline">{list.length}</span>
              </h2>
              <ul>
                {list.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={`check-row${c.id === check.id ? " active" : ""}`} onClick={() => navigate(`/checks/${c.id}`)}>
                      <SeverityTag severity={c.severity} kind={c.kind} />
                      <span className="check-row-title">{c.title}</span>
                      <span className="check-row-meta muted small">
                        {c.id}, {buildingById.get(c.building)?.short}
                        {fixes[c.id] ? ", correction applied" : ""}
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
              {KIND[check.kind]}, {buildingById.get(check.building)?.en}
            </span>
          </div>
          <h2 className="check-title">{check.title}</h2>
          <p className="check-text">{check.detail}</p>

          {check.expected != null && check.printed != null ? (
            <div className="check-figures">
              <div>
                <span className="figure-label">Printed</span>
                <span className="figure-value num strike">
                  {fmtNum(check.printed)} <small>{unitLabel(check.unit ?? "", "en")}</small>
                </span>
              </div>
              <div>
                <span className="figure-label">Rows add up to</span>
                <span className="figure-value num">
                  {fmtNum(check.expected)} <small>{unitLabel(check.unit ?? "", "en")}</small>
                </span>
              </div>
              <div>
                <span className="figure-label">Difference</span>
                <span className="figure-value num">
                  {fmtNum(check.printed - check.expected)} <small>{unitLabel(check.unit ?? "", "en")}</small>
                </span>
              </div>
            </div>
          ) : null}

          {check.fix ? (
            <div className={`fix${applied ? " applied" : ""}`}>
              <div>
                <strong>{applied ? "Correction applied to the bill" : "Correction available"}</strong>
                <p className="muted small">
                  {check.fix.label}. Bill line {fixLine?.code} changes by {fmtMoney(delta)} AZN before mark-ups.
                </p>
              </div>
              <button type="button" className={`btn ${applied ? "btn-ghost" : "btn-primary"}`} onClick={() => setFix(check.id, !applied)}>
                {applied ? (
                  <>
                    <Undo2 size={15} /> Use the printed value
                  </>
                ) : (
                  <>
                    <CheckIcon size={15} /> Apply to the bill
                  </>
                )}
              </button>
            </div>
          ) : null}

          <h3 className="check-sub">Evidence</h3>
          <div className="check-sources">
            {check.sources.map((s, i) => (
              <SourceCardForCheck key={i} checkId={check.id} index={i} source={s} />
            ))}
          </div>

          {lines.length ? (
            <>
              <h3 className="check-sub">Bill lines affected</h3>
              <table className="mini-table">
                <tbody>
                  {lines.map((l) => (
                    <tr key={l!.id}>
                      <td className="num code">{l!.code}</td>
                      <td>
                        <Link to={`/bill?line=${encodeURIComponent(l!.id)}`} className="text-link">
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
  return (
    <div className="check-source">
      <SourceCard source={source} />
      <Link to={`/drawings/${source.sheet}?check=${checkId}&src=${index}`} className="text-link small">
        Open on the sheet
      </Link>
    </div>
  );
}

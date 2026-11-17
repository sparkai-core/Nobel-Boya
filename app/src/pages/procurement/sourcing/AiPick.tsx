import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { PRESETS, R, scoreQuotes } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { Quotation } from "../../../ops/types";
import { pickStory, TypedText, useSequence } from "./shared";

const LOOKS = ["Price", "Delivery", "Vendor record", "Risk"];

/**
 * Compact AI comparison used on the RFQ page: what is compared lights up in sequence, then the pick
 * types itself in with a ranking table (best-overall weights).
 */
export function AiPick({ rfqId, quotes }: { rfqId: string; quotes: Quotation[] }) {
  const { t, x } = useL();
  const vendors = useOps((s) => s.vendors);
  const [run, setRun] = useState(0);
  const enough = quotes.length >= 2;
  const rows = useMemo(() => scoreQuotes({ vendors }, quotes, PRESETS.best.weights), [vendors, quotes]);
  const story = useMemo(() => pickStory(rows, t, x), [rows, t, x]);
  const lit = useSequence(LOOKS.length, `${run}-${quotes.length}`, 400, enough);
  const done = enough && lit >= LOOKS.length;

  return (
    <div className="k-ai ps-ai">
      <div className="ps-ai-head">
        <span className="k-ai-tag">
          <Sparkles size={13} />
          {t("AI comparison")}
        </span>
        {enough ? (
          <button type="button" className="icon-btn" onClick={() => setRun((n) => n + 1)} aria-label={t("Score again")} title={t("Score again")}>
            <RotateCcw size={14} />
          </button>
        ) : null}
      </div>
      <p className="ps-ai-label">{t("What is compared")}</p>
      <ul className="ps-looks">
        {LOOKS.map((l, i) => (
          <li key={l} className={i < lit ? "on" : undefined}>
            {i < lit ? <Check size={11} strokeWidth={3} /> : <i aria-hidden="true" />}
            {t(l)}
          </li>
        ))}
      </ul>
      {!enough ? (
        <p className="muted small">{quotes.length === 1 ? t("One quote is in. The comparison starts when a second vendor quotes.") : t("No quotes yet. The comparison starts when two vendors have quoted.")}</p>
      ) : (
        <>
          <div className={`ps-ai-pick${done ? " on" : ""}`}>
            <span className="ps-ai-label">{t("The pick")}</span>
            <strong>{rows[0]?.vendor.name}</strong>
            <TypedText text={story.summary.split(". ").slice(0, 3).join(". ").replace(/\.?$/, ".")} runKey={run} active={done} />
          </div>
          <table className={`ps-mini${done ? " on" : ""}`}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("Vendor")}</th>
                <th className="r">{t("Total")}</th>
                <th className="r">{t("Delivery")}</th>
                <th className="r">{t("Score")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.quote.id} className={r.rank === 1 ? "top" : undefined}>
                  <td className="num-inline">{r.rank}</td>
                  <td className="truncate">{r.vendor.name}</td>
                  <td className="r num-inline">{fmtMoneyShort(r.total)}</td>
                  <td className="r num-inline">{t("{n} d", { n: r.quote.deliveryDays })}</td>
                  <td className="r num-inline">
                    <b>{r.score}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link to={R.compare(rfqId)} className="btn btn-primary btn-sm ps-ai-open">
            {t("Open in Comparison")}
          </Link>
        </>
      )}
    </div>
  );
}

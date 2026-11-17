import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Coins, ExternalLink, FileImage, Search } from "lucide-react";
import { Dialog, useL } from "../../../components/kit";
import { SheetViewer } from "../../../components/SheetViewer";
import { data, DISCIPLINES, P, sheetById, sheetImage } from "../../../data";
import { disciplineName, sheetTitle } from "../../../lib/loc";
import { sectionValue } from "../../../ops/seed/util";
import { TODAY } from "../../../ops/dates";
import type { ChangeOrder, Rfi } from "../../../ops/types";

/** Works value of the whole BOQ at sample rates: the sum of every building × section value. */
export const WORKS_VALUE = [...sectionValue.values()].reduce((a, v) => a + v, 0);

export const rfiOverdue = (r: Rfi) => r.status === "OPEN" && r.dueAt < TODAY;
/** Status used for display: an open RFI past its due date shows as OVERDUE. */
export const rfiShownStatus = (r: Rfi) => (rfiOverdue(r) ? "OVERDUE" : r.status);

export const changeCost = (c: Pick<ChangeOrder, "lines">) => c.lines.reduce((a, l) => a + l.qtyDelta * l.rate, 0);

export const DISCIPLINE_KEYS = Object.keys(DISCIPLINES).filter((k) => k !== "general");

/** Signed money, e.g. "+7,534" / "−648". */
export const signed = (v: number, fmt: (n: number) => string) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmt(Math.abs(v))}`;

/** Drawing sheet thumbnail chip. Click opens the sheet larger. */
export function SheetChip({ sheetId, onOpen, size = "sm" }: { sheetId: string | null; onOpen?: (id: string) => void; size?: "sm" | "lg" }) {
  const { lang, t } = useL();
  if (!sheetId) return <span className="muted">—</span>;
  const sh = sheetById.get(sheetId);
  return (
    <button
      type="button"
      className={`pmr-sheetchip ${size}`}
      title={sh ? `${sheetId} · ${sheetTitle(sh, lang)}` : sheetId}
      aria-label={t("Open sheet {id}", { id: sheetId })}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(sheetId);
      }}
    >
      <img src={sheetImage(sheetId, true)} alt="" loading="lazy" />
      <span>{sheetId}</span>
    </button>
  );
}

/** Larger view of a sheet: pan / zoom viewer plus a link to the drawings register. */
export function SheetLightbox({ sheetId, onClose }: { sheetId: string | null; onClose: () => void }) {
  const { t, lang } = useL();
  const sh = sheetId ? sheetById.get(sheetId) : undefined;
  return (
    <Dialog
      open={!!sheetId && !!sh}
      onClose={onClose}
      width={1080}
      kicker={sh ? `${sh.id} · ${disciplineName(sh.discipline, lang)}` : undefined}
      title={sh ? sheetTitle(sh, lang) : ""}
      footer={
        sh ? (
          <>
            <span className="muted small">{t("Drag to pan, scroll to zoom.")}</span>
            <Link to={`${P}/drawings/${sh.id}`} className="btn btn-ghost">
              <ExternalLink size={14} />
              {t("Open in drawings")}
            </Link>
          </>
        ) : null
      }
    >
      {sh ? (
        <div className="pmr-viewer-host">
          <SheetViewer sheet={sh} marks={[]} />
        </div>
      ) : null}
    </Dialog>
  );
}

/** Searchable sheet picker used by the "New RFI" dialog. */
export function SheetPicker({ value, onChange, discipline }: { value: string | null; onChange: (id: string | null) => void; discipline: string }) {
  const { t, lang } = useL();
  const [q, setQ] = useState("");
  const [allDisc, setAllDisc] = useState(false);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.sheets
      .filter((s) => s.discipline !== "general")
      .filter((s) => allDisc || !discipline || s.discipline === discipline || needle.length > 0)
      .filter((s) => !needle || s.id.toLowerCase().includes(needle) || s.title.toLowerCase().includes(needle) || s.titleEn.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [q, discipline, allDisc]);
  const picked = value ? sheetById.get(value) : undefined;
  return (
    <div className="pmr-picker">
      {picked ? (
        <div className="pmr-picked">
          <img src={sheetImage(picked.id, true)} alt="" />
          <div>
            <b>{picked.id}</b>
            <small>{sheetTitle(picked, lang)}</small>
          </div>
          <button type="button" className="k-link-btn" onClick={() => onChange(null)}>
            {t("Change")}
          </button>
        </div>
      ) : (
        <>
          <label className="search k-search pmr-picker-search">
            <Search size={15} />
            <input className="input" type="search" value={q} placeholder={t("Search sheets by number or title")} onChange={(e) => setQ(e.target.value)} aria-label={t("Search sheets by number or title")} />
          </label>
          <div className="pmr-picker-list" role="listbox" aria-label={t("Drawing sheets")}>
            {list.map((s) => (
              <button key={s.id} type="button" role="option" aria-selected={false} className="pmr-picker-row" onClick={() => onChange(s.id)}>
                <img src={sheetImage(s.id, true)} alt="" loading="lazy" />
                <span>
                  <b>{s.id}</b>
                  <small>{sheetTitle(s, lang)}</small>
                </span>
              </button>
            ))}
            {!list.length ? <p className="muted small pmr-picker-empty">{t("No sheet matches.")}</p> : null}
          </div>
          {discipline && !allDisc && !q ? (
            <button type="button" className="k-link-btn" onClick={() => setAllDisc(true)}>
              <FileImage size={13} />
              {t("Show sheets from every discipline")}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Cost / time impact icons shown in registers. */
export function ImpactIcons({ cost, time }: { cost: boolean; time: boolean }) {
  const { t } = useL();
  return (
    <span className="pmr-impact">
      <i className={cost ? "on cost" : undefined} title={cost ? t("Affects cost") : t("No cost effect")}>
        <Coins size={13} />
      </i>
      <i className={time ? "on time" : undefined} title={time ? t("Affects time") : t("No time effect")}>
        <Clock size={13} />
      </i>
    </span>
  );
}

/** Not-found body for detail pages. */
export function NotFound({ what, back, backLabel }: { what: string; back: string; backLabel: string }) {
  const { t } = useL();
  return (
    <div className="k-page">
      <div className="k-empty">
        <h3>{t("{what} not found", { what })}</h3>
        <p>{t("It may have been removed when the demo data was reset.")}</p>
        <Link to={back} className="btn btn-ghost">
          {t(backLabel)}
        </Link>
      </div>
    </div>
  );
}

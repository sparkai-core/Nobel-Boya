import { useState } from "react";
import { AlertTriangle, CalendarRange, FileCheck2, ShieldAlert, Upload } from "lucide-react";
import { Badge, Empty, PageHero, Panel, StatTiles, useL } from "../../components/kit";
import { addDays, diffDays, monthShort, TODAY } from "../../ops/dates";
import { BUYER, DOC_META, useVendor, vendorDocs, type VendorDoc } from "./model";
import { DocDialog, useEyebrow } from "./parts";

const FROM = addDays(TODAY, -90);
const TO = addDays(TODAY, 400);
const SPAN = diffDays(FROM, TO);
const X = (date: string) => Math.max(0, Math.min(100, (diffDays(FROM, date) / SPAN) * 100));

/** Compliance documents: an expiry timeline, flags and renewing a document by upload. */
export function VpDocuments() {
  const { t, x, d, rel, stamp, lang } = useL();
  const eyebrow = useEyebrow();
  const { s, view } = useVendor();
  const [doc, setDoc] = useState<VendorDoc | null>(null);
  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;
  const docs = vendorDocs(s, view.vendor);
  const blocking = docs.filter((dc) => dc.required && (dc.state === "expired" || dc.state === "missing"));
  const soon = docs.filter((dc) => dc.state === "expiring");

  // Month ticks along the axis.
  const ticks: string[] = [];
  for (let i = 0; i <= SPAN; i++) {
    const dt = addDays(FROM, i);
    if (dt.endsWith("-01")) ticks.push(dt);
  }
  const monthLabel = (iso: string) => monthShort(Number(iso.slice(5, 7)) - 1, lang);

  return (
    <div className="k-page vp-page">
      <PageHero
        eyebrow={eyebrow("Documents")}
        title={t("Compliance documents")}
        subtitle={t("What {buyer} keeps on file about you. Renew a document before it expires so orders keep coming.", { buyer: BUYER })}
        flow={["Upload", "Read", "On file", "Renew before expiry"]}
        art="vendor"
      />

      <StatTiles
        items={[
          { label: t("Valid"), value: docs.filter((dc) => dc.state === "valid").length, sub: t("of {n} documents", { n: docs.length }), tone: "ok" },
          { label: t("Expire within 30 days"), value: soon.length, sub: soon[0] ? t("{doc} first", { doc: x(soon[0].label) }) : t("none soon"), tone: soon.length ? "warn" : undefined },
          { label: t("Expired or missing"), value: blocking.length + docs.filter((dc) => !dc.required && (dc.state === "expired" || dc.state === "missing")).length, sub: blocking.length ? t("orders are blocked") : t("nothing blocking"), tone: blocking.length ? "bad" : undefined },
        ]}
      />

      {blocking.length ? (
        <div className="k-callout k-tone-bad">
          <AlertTriangle size={15} />
          <span>
            <b>{t("{buyer} cannot place new orders with you until these are renewed:", { buyer: BUYER })}</b> {blocking.map((dc) => x(dc.label)).join(", ")}.
          </span>
        </div>
      ) : null}

      <Panel title={t("Expiry timeline")} icon={<CalendarRange size={15} />} sub={t("Each bar runs to the document's expiry date. The shaded band is the next 30 days.")}>
        <div className="vp-dtl">
          <div className="vp-dtl-axis" aria-hidden="true">
            {ticks.map((tk) => (
              <span key={tk} style={{ left: `${X(tk)}%` }}>
                {monthLabel(tk)}
              </span>
            ))}
          </div>
          <div className="vp-dtl-rows">
            <span className="vp-dtl-soon" style={{ left: `${X(TODAY)}%`, width: `${X(addDays(TODAY, 30)) - X(TODAY)}%` }} aria-hidden="true" />
            <span className="vp-dtl-today" style={{ left: `${X(TODAY)}%` }}>
              <small>{t("Today")}</small>
            </span>
            {docs.map((dc, i) => {
              const meta = DOC_META[dc.state];
              const start = dc.expires ? addDays(dc.expires, -365) : FROM;
              const end = dc.expires ?? TO;
              return (
                <div key={dc.key} className="vp-dtl-row">
                  <span className="vp-dtl-name truncate">{x(dc.label)}</span>
                  <span className="vp-dtl-track">
                    {dc.ref ? (
                      <i className={`vp-dtl-bar k-tone-${meta.tone}${dc.expires ? "" : " open"}`} style={{ left: `${X(start)}%`, width: `${Math.max(1.5, X(end) - X(start))}%`, animationDelay: `${i * 70}ms` }} title={dc.expires ? `${x(dc.label)}: ${d(dc.expires)}` : x(dc.label)}>
                        {dc.expires ? <b className="vp-dtl-end" /> : null}
                      </i>
                    ) : (
                      <em className="vp-dtl-missing">{t("Not on file")}</em>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <ul className="vp-doccards">
        {docs.map((dc, i) => {
          const meta = DOC_META[dc.state];
          return (
            <li key={dc.key} className={`vp-doccard k-tone-${meta.tone}`} style={{ animationDelay: `${i * 50}ms` }}>
              <header>
                <span className="vp-doc-icon">{dc.state === "valid" ? <FileCheck2 size={17} /> : <ShieldAlert size={17} />}</span>
                <div>
                  <b>{x(dc.label)}</b>
                  <small>{dc.required ? t("Required") : t("Optional")}</small>
                </div>
                <Badge tone={meta.tone}>{t(meta.label)}</Badge>
              </header>
              <dl>
                <div>
                  <dt>{t("Reference")}</dt>
                  <dd className="k-mono">{dc.ref ?? "—"}</dd>
                </div>
                <div>
                  <dt>{t("Expires")}</dt>
                  <dd>{dc.expires ? d(dc.expires) : dc.ref ? t("Does not expire") : "—"}</dd>
                </div>
              </dl>
              {dc.expires ? <p className={`vp-doccard-left k-text-${meta.tone}`}>{dc.state === "expired" ? t("Expired {when}", { when: rel(dc.expires) }) : t("Expires {when}", { when: rel(dc.expires) })}</p> : null}
              {dc.sentAt ? <p className="muted small">{t("{file} uploaded {when}.", { file: dc.file ?? "", when: stamp(dc.sentAt) })}</p> : null}
              {dc.key !== "vat" ? (
                <button type="button" className={`btn btn-sm ${dc.state === "valid" ? "btn-ghost" : "btn-primary"}`} onClick={() => setDoc(dc)}>
                  <Upload size={13} />
                  {dc.state === "missing" ? t("Upload") : t("Renew")}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <DocDialog open={!!doc} onClose={() => setDoc(null)} doc={doc} vendorId={view.vendor.id} />
    </div>
  );
}

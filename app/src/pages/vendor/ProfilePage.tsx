import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Building2, FileCheck2, Gauge, History, ShieldAlert, Upload } from "lucide-react";
import { Avatar, Badge, Empty, KeyVals, PageHero, Panel, StatusBadge, useL } from "../../components/kit";
import { tradeName } from "../../ops/select";
import { diffDays, TODAY } from "../../ops/dates";
import { fmtMoneyShort } from "../../lib/format";
import { BUYER, DOC_META, useVendor, vendorDocs, VP, type VendorDoc } from "./model";
import { DocDialog, ScoreRings, useEyebrow } from "./parts";

/** Company profile: what the buyer has on file, the score rings, past projects and documents with expiry flags. */
export function VpProfile() {
  const { t, x, d, rel, stamp, lang } = useL();
  const eyebrow = useEyebrow();
  const { s, view } = useVendor();
  const [doc, setDoc] = useState<VendorDoc | null>(null);
  if (!view) return <div className="k-page"><Empty title={t("Vendor not found")} /></div>;
  const v = view.vendor;
  const docs = vendorDocs(s, v);
  const maxHist = Math.max(1, ...v.history.map((h) => h.value));

  return (
    <div className="k-page vp-page">
      <PageHero eyebrow={eyebrow("Company profile")} title={t("Your company")} subtitle={t("What {buyer} has on file about you, and how they score your work.", { buyer: BUYER })} art="vendor" />

      <div className="k-grid-main">
        <div className="k-stack">
          <section className="vp-company">
            <header className="vp-company-head">
              <Avatar name={v.name} size={56} />
              <div>
                <h2>{v.name}</h2>
                <p>
                  {v.trades.map((tr) => tradeName(tr, lang)).join(" · ")} · {v.city}
                </p>
                <span className="k-row" style={{ gap: 6 }}>
                  <StatusBadge kind="vendor" status={v.status} />
                  <StatusBadge kind="risk" status={v.risk} />
                  <Badge tone="neutral" dot={false}>
                    {t("Supplier since {date}", { date: d(v.since) })}
                  </Badge>
                </span>
              </div>
            </header>
            {v.note ? (
              <div className={`k-callout ${v.status === "APPROVED" ? "k-tone-warn" : "k-tone-bad"}`}>
                <AlertTriangle size={15} />
                <span>
                  <b>{t("Note from the buyer")}</b> {x(v.note)}
                </span>
              </div>
            ) : null}
            <KeyVals
              items={[
                { k: t("TRN"), v: <span className="k-mono">{v.trn}</span> },
                {
                  k: t("Trade licence"),
                  v: v.licence ? (
                    <span className="k-mono">{v.licence}</span>
                  ) : (
                    <span className="vp-flag-missing">
                      <ShieldAlert size={13} /> {t("Missing")}
                    </span>
                  ),
                },
                { k: t("Contact"), v: v.contact },
                { k: t("Email"), v: v.email },
                { k: t("Phone"), v: <span className="num-inline">{v.phone}</span> },
                { k: t("Website"), v: v.website ?? "—" },
                { k: t("Usual delivery time"), v: t("{n} days", { n: v.avgDeliveryDays }) },
                { k: t("Payment terms"), v: t(v.paymentTerms) },
              ]}
            />
          </section>

          <Panel title={t("Documents on file")} icon={<FileCheck2 size={15} />} sub={t("The buyer checks these before every order. Send a renewed copy before one expires.")} pad={false} actions={<Link to={VP.documents} className="k-link-btn">{t("All documents")}</Link>}>
            <ul className="vp-docs">
              {docs.map((dc) => {
                const meta = DOC_META[dc.state];
                const left = dc.expires ? Math.max(0, Math.min(1, diffDays(TODAY, dc.expires) / 365)) : 1;
                return (
                  <li key={dc.key} className={`d-${dc.state}`}>
                    <span className={`vp-doc-icon k-tone-${meta.tone}`}>{dc.state === "valid" ? <FileCheck2 size={16} /> : <ShieldAlert size={16} />}</span>
                    <div className="vp-doc-text">
                      <b>
                        {x(dc.label)}
                        {!dc.required ? <small className="muted"> · {t("optional")}</small> : null}
                      </b>
                      <small>
                        {dc.ref ? <span className="k-mono">{dc.ref}</span> : t("Not on file")}
                        {dc.expires ? <> · {dc.state === "expired" ? t("expired {date}", { date: d(dc.expires) }) : t("expires {date} ({when})", { date: d(dc.expires), when: rel(dc.expires) })}</> : dc.ref ? <> · {t("does not expire")}</> : null}
                      </small>
                      {dc.sentAt ? <small className="k-text-ok">{t("{file} uploaded {when}.", { file: dc.file ?? "", when: stamp(dc.sentAt) })}</small> : null}
                      {dc.expires ? (
                        <span className="vp-doc-life" aria-hidden="true">
                          <i className={`k-tone-${meta.tone}`} style={{ width: `${Math.max(3, left * 100)}%` }} />
                        </span>
                      ) : null}
                    </div>
                    <span className="vp-doc-side">
                      <Badge tone={meta.tone}>{t(meta.label)}</Badge>
                      {dc.state !== "valid" && dc.key !== "vat" ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDoc(dc)}>
                          <Upload size={13} />
                          {dc.state === "missing" ? t("Upload") : t("Renew")}
                        </button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="k-stack">
          <Panel title={t("How the buyer scores you")} icon={<Gauge size={15} />} sub={t("Scores out of 100. The overall score weighs reliability and quality most.")}>
            <ScoreRings vendor={v} size={200} />
          </Panel>

          <Panel title={t("Past projects")} icon={<History size={15} />} pad={false}>
            {v.history.length ? (
              <ul className="vp-hist">
                {v.history.map((h) => (
                  <li key={h.project + h.year}>
                    <div className="vp-hist-top">
                      <b>{h.project}</b>
                      <span className="num-inline">{fmtMoneyShort(h.value)} AZN</span>
                    </div>
                    <span className="vp-hist-bar">
                      <i className="k-grow-x" style={{ width: `${(h.value / maxHist) * 100}%` }} />
                    </span>
                    <small>
                      {h.year} · {h.onTime ? <span className="k-text-ok">{t("Delivered on time")}</span> : <span className="k-text-warn">{t("Delivered late")}</span>}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-panel-body muted">{t("No past projects recorded yet.")}</p>
            )}
          </Panel>

          <Panel title={t("With {buyer}", { buyer: BUYER })} icon={<Building2 size={15} />}>
            <KeyVals
              cols={2}
              items={[
                { k: t("Invitations"), v: <b className="num-inline">{view.invites.length}</b> },
                { k: t("Quotes"), v: <b className="num-inline">{view.quotes.length}</b> },
                { k: t("Orders"), v: <b className="num-inline">{view.pos.length}</b> },
                { k: t("Deliveries"), v: <b className="num-inline">{view.grns.filter((g) => g.status !== "DRAFT").length}</b> },
              ]}
            />
          </Panel>
        </div>
      </div>

      <DocDialog open={!!doc} onClose={() => setDoc(null)} doc={doc} vendorId={v.id} />
    </div>
  );
}

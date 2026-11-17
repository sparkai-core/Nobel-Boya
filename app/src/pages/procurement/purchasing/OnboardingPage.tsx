import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Check, ClipboardCheck, Copy, ExternalLink, Inbox, Mail, RotateCcw, ShieldCheck, UserPlus, X } from "lucide-react";
import { Avatar, Badge, Breadcrumbs, Dialog, Field, PageHero, RingGauge, StatTiles, toast, useL } from "../../../components/kit";
import { Drawer } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { R, tradeName, TRADES, type Tone } from "../../../ops/select";
import type { Trade, Txt, VendorInvite } from "../../../ops/types";

type InvStatus = VendorInvite["status"];
type CheckItem = VendorInvite["checklist"][number];

const INV_META: Record<InvStatus, { label: Txt; tone: Tone }> = {
  INVITED: { label: { en: "Invited", az: "Dəvət edilib" }, tone: "info" },
  IN_REVIEW: { label: { en: "In review", az: "Yoxlanılır" }, tone: "warn" },
  APPROVED: { label: { en: "Approved", az: "Təsdiqlənib" }, tone: "ok" },
  REJECTED: { label: { en: "Rejected", az: "Rədd edilib" }, tone: "bad" },
};

const CHECKS: { key: string; label: Txt; must?: boolean }[] = [
  { key: "trn", label: { en: "Tax registration (VÖEN)", az: "VÖEN" }, must: true },
  { key: "licence", label: { en: "Trade licence", az: "Ticarət lisenziyası" }, must: true },
  { key: "insurance", label: { en: "Insurance certificate", az: "Sığorta sertifikatı" } },
  { key: "refs", label: { en: "Two project references", az: "İki layihə arayışı" } },
  { key: "hse", label: { en: "HSE policy and record", az: "ƏMSE siyasəti və göstəriciləri" } },
  { key: "iso", label: { en: "ISO 9001 certificate", az: "ISO 9001 sertifikatı" } },
];
const NA = "N/A";
const isNa = (c: CheckItem) => c.ok === null && (c.note ?? "").startsWith(NA);
const checklistOf = (inv: VendorInvite): CheckItem[] => (inv.checklist.length ? inv.checklist : CHECKS.map((c) => ({ key: c.key, label: c.label, ok: null, note: null })));

/** Checklist share 0–100 (N/A items left out) and the combined score with the manual rating (0–10). */
function scoreOf(list: CheckItem[], rating: number) {
  const applicable = list.filter((c) => !isNa(c));
  const ok = applicable.filter((c) => c.ok === true).length;
  const chk = applicable.length ? (ok / applicable.length) * 100 : 0;
  return { ok, applicable: applicable.length, missing: list.filter((c) => c.ok === false).length, open: applicable.filter((c) => c.ok === null).length, chk, total: Math.round(chk * 0.7 + rating * 10 * 0.3) };
}
/** Rating implied by a stored score, so the slider reopens where it was left. */
function ratingFrom(inv: VendorInvite) {
  if (inv.score == null) return 7;
  const { chk } = scoreOf(checklistOf(inv), 0);
  return Math.max(0, Math.min(10, Math.round(((inv.score * 10 - chk * 0.7) / 0.3 / 10) * 2) / 2));
}
const inviteLink = (id: string) => `${window.location.origin}${window.location.pathname}#/vendor/accept?invite=${id}`;

/** Vendor onboarding: portal invites move Invited → In review → Approved / Rejected, with a prequalification check for each. */
export function OnboardingPage() {
  const { t, x, d, rel, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [openId, setOpenId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const opened = s.invites.find((i) => i.id === openId) ?? null;

  const by = (st: InvStatus) => s.invites.filter((i) => i.status === st).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const scored = s.invites.filter((i) => i.score != null);
  const avg = scored.length ? scored.reduce((a, i) => a + (i.score ?? 0), 0) / scored.length : null;

  const papersIn = (inv: VendorInvite) => {
    s.patchItem("invites", inv.id, { status: "IN_REVIEW", checklist: checklistOf(inv) });
    s.pushFeed("VENDOR", { en: `${inv.company} sent its papers for prequalification`, az: `${inv.company} ilkin yoxlama üçün sənədlərini göndərdi` }, "procurement/vendors/onboarding", inv.contact);
    toast(t("{c} moved to review. Check the papers.", { c: inv.company }), "brand");
    setOpenId(inv.id);
  };
  const reopen = (inv: VendorInvite) => {
    s.patchItem("invites", inv.id, { status: "IN_REVIEW" });
    toast(t("{c} is back in review.", { c: inv.company }), "brand");
  };

  const columns: { key: InvStatus; icon: ReactNode; hint: string }[] = [
    { key: "INVITED", icon: <Mail size={14} />, hint: t("Link sent, waiting for papers") },
    { key: "IN_REVIEW", icon: <ClipboardCheck size={14} />, hint: t("Papers in, being checked") },
    { key: "APPROVED", icon: <BadgeCheck size={14} />, hint: t("Vendor record created") },
    { key: "REJECTED", icon: <X size={14} />, hint: t("Did not pass") },
  ];

  return (
    <div className="k-page pur-page">
      <Breadcrumbs items={[{ label: t("Procurement"), to: R.proc }, { label: t("Vendors"), to: R.vendors }, { label: t("Vendor onboarding") }]} />
      <PageHero
        eyebrow={t("Procurement · Vendors")}
        title={t("Vendor onboarding")}
        subtitle={t("Invite new vendors to the portal, check their papers and approve them for RFQs and orders.")}
        flow={["Invite", "Papers in", "Prequalify", "Approve"]}
        art="portal"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setInviting(true)}>
            <UserPlus size={15} />
            {t("Invite vendor")}
          </button>
        }
      />

      <StatTiles
        items={[
          { label: t("Waiting for papers"), value: by("INVITED").length, sub: t("invites with no answer yet"), tone: "brand" },
          { label: t("In review"), value: by("IN_REVIEW").length, sub: t("papers to check"), tone: by("IN_REVIEW").length ? "warn" : "ok" },
          { label: t("Approved"), value: by("APPROVED").length, sub: t("{n} vendors on the register", { n: s.vendors.length }), tone: "ok" },
          { label: t("Average score"), value: avg != null ? `${avg.toFixed(1)} / 10` : "—", sub: t("from prequalification") },
        ]}
      />

      <section className="pur-howto" aria-label={t("How the portal invite works")}>
        <ol>
          <li>
            <b>1</b>
            <span>
              <strong>{t("Send the invite")}</strong>
              <small>{t("The vendor gets a link to the portal's accept page.")}</small>
            </span>
          </li>
          <li>
            <b>2</b>
            <span>
              <strong>{t("Vendor sends papers")}</strong>
              <small>{t("On the accept page they confirm details and upload VÖEN, licence and certificates.")}</small>
            </span>
          </li>
          <li>
            <b>3</b>
            <span>
              <strong>{t("You prequalify")}</strong>
              <small>{t("Tick each paper here; the score adds your rating.")}</small>
            </span>
          </li>
          <li>
            <b>4</b>
            <span>
              <strong>{t("Approve")}</strong>
              <small>{t("A vendor record is created with portal access, ready for RFQs.")}</small>
            </span>
          </li>
        </ol>
      </section>

      <section className="pur-board" aria-label={t("Onboarding pipeline")}>
        {columns.map((c, ci) => {
          const list = by(c.key);
          return (
            <div key={c.key} className={`pur-col ${c.key.toLowerCase()}`}>
              <header>
                <span className={`pur-col-icon k-tone-${INV_META[c.key].tone}`}>{c.icon}</span>
                <span>
                  <b>{x(INV_META[c.key].label)}</b>
                  <small>{c.hint}</small>
                </span>
                <em className="num-inline">{list.length}</em>
                {ci < 2 ? <ArrowRight size={14} className="pur-col-arrow" aria-hidden="true" /> : null}
              </header>
              <div className="pur-col-body">
                {list.length ? (
                  list.map((inv, i) => {
                    const cl = checklistOf(inv);
                    const sc = scoreOf(cl, ratingFrom(inv));
                    return (
                      <article key={inv.id} className="pur-inv k-rise" style={{ animationDelay: `${i * 60}ms` }}>
                        <button type="button" className="pur-inv-main" onClick={() => setOpenId(inv.id)}>
                          <Avatar name={inv.company} size={30} />
                          <span>
                            <b>{inv.company}</b>
                            <small>
                              {tradeName(inv.trade, lang)} · {inv.contact}
                            </small>
                          </span>
                        </button>
                        <div className="pur-inv-pips" aria-label={t("{a} of {b} papers OK", { a: sc.ok, b: sc.applicable })}>
                          {cl.map((ck) => (
                            <i key={ck.key} className={isNa(ck) ? "na" : ck.ok === true ? "ok" : ck.ok === false ? "miss" : "open"} title={x(ck.label)} />
                          ))}
                          <small className="muted">{inv.status === "INVITED" && !inv.checklist.length ? t("sent {when}", { when: rel(inv.sentAt) }) : t("{a}/{b} papers", { a: sc.ok, b: sc.applicable })}</small>
                        </div>
                        <footer>
                          {inv.score != null ? <Badge tone={inv.score >= 8 ? "ok" : inv.score >= 6.5 ? "brand" : "warn"}>{`${inv.score.toFixed(1)} / 10`}</Badge> : <span className="muted small">{d(inv.sentAt, false)}</span>}
                          {inv.status === "INVITED" ? (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => papersIn(inv)}>
                              <Inbox size={13} />
                              {t("Papers received")}
                            </button>
                          ) : inv.status === "IN_REVIEW" ? (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpenId(inv.id)}>
                              <ShieldCheck size={13} />
                              {t("Prequalify")}
                            </button>
                          ) : inv.status === "APPROVED" && inv.vendorId ? (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(R.vendor(inv.vendorId!))}>
                              {t("Open vendor")}
                            </button>
                          ) : inv.status === "REJECTED" ? (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => reopen(inv)}>
                              <RotateCcw size={13} />
                              {t("Reopen")}
                            </button>
                          ) : null}
                        </footer>
                      </article>
                    );
                  })
                ) : (
                  <p className="pur-col-empty">{c.key === "INVITED" ? t("No open invites.") : c.key === "IN_REVIEW" ? t("Nothing to check.") : c.key === "APPROVED" ? t("None approved yet.") : t("None rejected.")}</p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <Drawer open={!!opened} onClose={() => setOpenId(null)} kicker={opened ? `${opened.id} · ${t("Prequalification")}` : undefined} title={opened?.company ?? ""} width={480}>
        {opened ? <Prequal key={opened.id} inv={opened} onDone={() => setOpenId(null)} /> : null}
      </Drawer>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}

function Prequal({ inv, onDone }: { inv: VendorInvite; onDone: () => void }) {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [rating, setRating] = useState(() => ratingFrom(inv));
  const list = checklistOf(inv);
  const sc = scoreOf(list, rating);
  const link = inviteLink(inv.id);
  const done = inv.status === "APPROVED" || inv.status === "REJECTED";
  const mustFail = CHECKS.filter((c) => c.must).filter((c) => list.find((y) => y.key === c.key)?.ok !== true);

  const save = (next: CheckItem[], r = rating) => {
    const sc2 = scoreOf(next, r);
    s.patchItem("invites", inv.id, { checklist: next, score: Math.round(sc2.total) / 10, status: inv.status === "INVITED" ? "IN_REVIEW" : inv.status });
  };
  const setCheck = (key: string, state: "ok" | "miss" | "na") =>
    save(list.map((c) => (c.key !== key ? c : state === "ok" ? { ...c, ok: true, note: isNa(c) ? null : c.note } : state === "miss" ? { ...c, ok: false, note: isNa(c) ? null : c.note } : { ...c, ok: null, note: NA })));
  const setNote = (key: string, note: string) => save(list.map((c) => (c.key !== key ? c : { ...c, note: note.trim() ? note : null })));

  const approve = () => {
    save(list);
    const vid = s.approveInvite(inv.id);
    if (!vid) return;
    toast(t("{c} approved as a vendor with portal access.", { c: inv.company }), "ok", { label: t("Open vendor"), onClick: () => navigate(R.vendor(vid)) });
    onDone();
  };
  const reject = () => {
    s.patchItem("invites", inv.id, { status: "REJECTED", checklist: list });
    s.pushFeed("PROC", { en: `${inv.company} did not pass prequalification`, az: `${inv.company} ilkin yoxlamadan keçmədi` }, "procurement/vendors/onboarding");
    toast(t("{c} rejected.", { c: inv.company }), "bad");
    onDone();
  };

  return (
    <div className="pur-pq">
      <div className="pur-pq-head">
        <RingGauge value={sc.total} size={104} tone={sc.total >= 80 ? "ok" : sc.total >= 60 ? "brand" : "warn"} label={t("score")} />
        <div>
          <Badge tone={INV_META[inv.status].tone}>{x(INV_META[inv.status].label)}</Badge>
          <p className="pur-pq-who">
            {tradeName(inv.trade, lang)} · {inv.contact}
          </p>
          <a href={`mailto:${inv.email}`} className="small">
            {inv.email}
          </a>
          <small className="muted">{t("Invited {d} ({n} days ago)", { d: d(inv.sentAt), n: diffDays(inv.sentAt, TODAY) })}</small>
        </div>
      </div>

      <dl className="pur-pq-split">
        <div>
          <dt>{t("Papers")}</dt>
          <dd className="num-inline">
            {sc.ok}/{sc.applicable} <small>· 70%</small>
          </dd>
        </div>
        <div>
          <dt>{t("Your rating")}</dt>
          <dd className="num-inline">
            {rating.toFixed(1)}/10 <small>· 30%</small>
          </dd>
        </div>
      </dl>
      <label className="pur-pq-rating">
        <span className="k-field-label">{t("Rating from calls and references")}</span>
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={rating}
          disabled={done}
          onChange={(e) => setRating(Number(e.target.value))}
          onMouseUp={() => save(list, rating)}
          onTouchEnd={() => save(list, rating)}
          onKeyUp={() => save(list, rating)}
        />
      </label>

      <h3 className="pur-pq-h">{t("Checklist")}</h3>
      <ul className="pur-checks">
        {list.map((c) => {
          const state = isNa(c) ? "na" : c.ok === true ? "ok" : c.ok === false ? "miss" : "open";
          const must = CHECKS.find((y) => y.key === c.key)?.must;
          return (
            <li key={c.key} className={state}>
              <div className="pur-check-top">
                <span className="pur-check-dot">{state === "ok" ? <Check size={11} strokeWidth={3} /> : state === "miss" ? <X size={11} strokeWidth={3} /> : null}</span>
                <b>
                  {x(c.label)}
                  {must ? <em>{t("required")}</em> : null}
                </b>
                <div className="pur-tri" role="radiogroup" aria-label={x(c.label)}>
                  {(["ok", "miss", "na"] as const).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={state === k} className={state === k ? `on ${k}` : undefined} disabled={done || (k === "na" && must)} onClick={() => setCheck(c.key, k)}>
                      {k === "ok" ? t("OK") : k === "miss" ? t("Missing") : t("N/A")}
                    </button>
                  ))}
                </div>
              </div>
              <input className="input pur-check-note" defaultValue={isNa(c) ? "" : (c.note ?? "")} placeholder={t("Note, e.g. expiry date or reference")} disabled={done || state === "na"} onBlur={(e) => !isNa(c) && e.target.value !== (c.note ?? "") && setNote(c.key, e.target.value)} />
            </li>
          );
        })}
      </ul>

      <h3 className="pur-pq-h">{t("Portal invite link")}</h3>
      <div className="pur-linkbox">
        <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t("Invite link")} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            void navigator.clipboard?.writeText(link);
            toast(t("Invite link copied"));
          }}
        >
          <Copy size={13} />
          {t("Copy")}
        </button>
      </div>
      <p className="muted small">{t("The link opens the vendor portal's accept page for this invite. Papers sent there land in this checklist.")}</p>

      {done ? (
        inv.status === "APPROVED" && inv.vendorId ? (
          <button type="button" className="btn btn-primary pur-mt" onClick={() => navigate(R.vendor(inv.vendorId!))}>
            <ExternalLink size={14} />
            {t("Open vendor")}
          </button>
        ) : null
      ) : (
        <>
          {mustFail.length ? <p className="k-field-error pur-mt">{t("{list} must be OK before approval.", { list: mustFail.map((c) => x(c.label)).join(", ") })}</p> : sc.missing ? <p className="k-text-warn small pur-mt">{t("{n} papers missing. You can still approve and chase them later.", { n: sc.missing })}</p> : null}
          <div className="pur-pq-actions">
            <button type="button" className="btn btn-primary" disabled={mustFail.length > 0} onClick={approve}>
              <BadgeCheck size={15} />
              {t("Approve")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reject}>
              <X size={15} />
              {t("Reject")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useL();
  const s = useOps();
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [trade, setTrade] = useState<Trade>("Steel");
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const close = () => {
    setCompany("");
    setContact("");
    setEmail("");
    setTrade("Steel");
    setTried(false);
    setSent(null);
    onClose();
  };
  const send = () => {
    setTried(true);
    if (!company.trim() || !contact.trim() || !emailOk) return;
    const id = s.inviteVendor({ company: company.trim(), contact: contact.trim(), email: email.trim(), trade });
    setSent(id);
    toast(t("Invite sent to {c}", { c: company.trim() }));
  };
  const link = sent ? inviteLink(sent) : "";

  return (
    <Dialog
      open={open}
      onClose={close}
      kicker={t("Vendor portal")}
      title={sent ? t("Invite sent") : t("Invite vendor")}
      footer={
        sent ? (
          <button type="button" className="btn btn-primary" onClick={close}>
            {t("Done")}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={close}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={send}>
              <Mail size={15} />
              {t("Send invite")}
            </button>
          </>
        )
      }
    >
      {sent ? (
        <div className="pur-sent k-rise">
          <span className="pur-sent-icon">
            <Check size={20} strokeWidth={3} />
          </span>
          <p>{t("{c} gets this link by e-mail. It opens the portal's accept page, where they send their papers.", { c: company })}</p>
          <div className="pur-linkbox">
            <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t("Invite link")} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(link);
                toast(t("Invite link copied"));
              }}
            >
              <Copy size={13} />
              {t("Copy")}
            </button>
          </div>
        </div>
      ) : (
        <div className="k-form">
          <Field label={t("Company")} wide error={tried && !company.trim() ? t("Required") : undefined}>
            <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("e.g. Kür Polad Zavodu")} />
          </Field>
          <Field label={t("Contact person")} error={tried && !contact.trim() ? t("Required") : undefined}>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label={t("E-mail")} error={tried && !emailOk ? t("Enter a valid e-mail") : undefined}>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@company.az" />
          </Field>
          <Field label={t("Trade")} wide>
            <select className="input select" value={trade} onChange={(e) => setTrade(e.target.value as Trade)}>
              {TRADES.map((tr) => (
                <option key={tr} value={tr}>
                  {tradeName(tr, lang)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </Dialog>
  );
}

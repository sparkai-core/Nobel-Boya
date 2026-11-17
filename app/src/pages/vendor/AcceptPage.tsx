import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, FileCheck2, Inbox, Link2Off, Package, ReceiptText } from "lucide-react";
import { toast, useL } from "../../components/kit";
import { useApp } from "../../lib/store";
import { useOps } from "../../ops/store";
import { addDays, TODAY } from "../../ops/dates";
import { tradeName } from "../../ops/select";
import { BUYER, VP } from "./model";

/** Invite links stay valid for 14 days. */
const VALID_DAYS = 14;

/** Accept-invite card: a supplier opens the link from the buyer's e-mail and joins the vendor portal. */
export function VpAccept() {
  const { t, d, lang } = useL();
  const setLang = useApp((x) => x.setLang);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invites = useOps((s) => s.invites);
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const [agree, setAgree] = useState(false);

  const id = params.get("invite")?.trim().toUpperCase() ?? "";
  const inv = invites.find((i) => i.id === id) ?? null;
  const until = inv ? addDays(inv.sentAt, VALID_DAYS) : null;
  const state: "invalid" | "expired" | "joined" | "ready" = !inv ? "invalid" : inv.status === "REJECTED" || (inv.status === "INVITED" && until! < TODAY) ? "expired" : inv.status === "IN_REVIEW" || inv.status === "APPROVED" ? "joined" : "ready";
  const open = invites.filter((i) => i.status === "INVITED" && addDays(i.sentAt, VALID_DAYS) >= TODAY);

  const accept = () => {
    if (!inv) return;
    patchItem("invites", inv.id, { status: "IN_REVIEW" });
    pushFeed("VENDOR", { en: `${inv.company} accepted the portal invite and sent its documents for review`, az: `${inv.company} portal dəvətini qəbul etdi və sənədlərini yoxlamaya göndərdi` }, "procurement/vendors/onboarding", inv.company);
    toast(t("Welcome, {company}. {buyer} is checking your documents.", { company: inv.company, buyer: BUYER }));
    navigate(VP.home);
  };

  return (
    <div className="vp-join">
      <div className="vp-join-lang lang" role="group" aria-label={t("Language")}>
        <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
          EN
        </button>
        <button type="button" aria-pressed={lang === "az"} onClick={() => setLang("az")}>
          AZ
        </button>
      </div>
      <main className="vp-join-card k-rise">
        <header className="vp-join-brand">
          <img src="./brand/nobel-mark.png" alt="" />
          <span>
            <strong>{t("Vendor portal")}</strong>
            <small>{t("Qobu project")}</small>
          </span>
        </header>

        {state === "ready" && inv ? (
          <>
            <span className="vp-join-kicker">{t("Invitation {id}", { id: inv.id })}</span>
            <h1>{t("Join the portal")}</h1>
            <p className="vp-join-lead">{t("{buyer} invites {company} to work with them on the Qobu project through the vendor portal.", { buyer: BUYER, company: inv.company })}</p>
            <dl className="vp-join-facts">
              <div>
                <dt>{t("Company")}</dt>
                <dd>{inv.company}</dd>
              </div>
              <div>
                <dt>{t("Contact")}</dt>
                <dd>{inv.contact}</dd>
              </div>
              <div>
                <dt>{t("Email")}</dt>
                <dd className="truncate">{inv.email}</dd>
              </div>
              <div>
                <dt>{t("Trade")}</dt>
                <dd>{tradeName(inv.trade, lang)}</dd>
              </div>
              <div>
                <dt>{t("Invited")}</dt>
                <dd>{d(inv.sentAt)}</dd>
              </div>
              <div>
                <dt>{t("Link valid until")}</dt>
                <dd>{d(until)}</dd>
              </div>
            </dl>
            <ul className="vp-join-can">
              <li>
                <Inbox size={15} /> {t("Answer requests for quotation")}
              </li>
              <li>
                <Package size={15} /> {t("Accept orders and dispatch deliveries")}
              </li>
              <li>
                <ReceiptText size={15} /> {t("Send invoices and see when you are paid")}
              </li>
              <li>
                <FileCheck2 size={15} /> {t("Keep your company documents current")}
              </li>
            </ul>
            <label className="vp-join-agree">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>{t("I agree to the portal terms and confirm I can act for {company}.", { company: inv.company })}</span>
            </label>
            <button type="button" className="btn btn-primary btn-lg vp-join-go" onClick={accept} disabled={!agree}>
              {t("Accept invite and open the portal")}
              <ArrowRight size={16} />
            </button>
            <p className="vp-join-note">{t("After you join, {buyer} checks your trade licence, insurance and references before the first order.", { buyer: BUYER })}</p>
          </>
        ) : state === "joined" && inv ? (
          <div className="vp-join-state ok">
            <CheckCircle2 size={28} />
            <h1>{t("{company} has already joined", { company: inv.company })}</h1>
            <p>{inv.status === "APPROVED" ? t("You are an approved supplier. Open the portal to see requests and orders.") : t("{buyer} is checking your documents. You can open the portal meanwhile.", { buyer: BUYER })}</p>
            <button type="button" className="btn btn-primary" onClick={() => navigate(VP.home)}>
              {t("Open the portal")}
              <ArrowRight size={15} />
            </button>
          </div>
        ) : state === "expired" && inv ? (
          <div className="vp-join-state warn">
            <Clock3 size={28} />
            <h1>{t("This invite has expired")}</h1>
            <p>{inv.status === "REJECTED" ? t("This invitation was withdrawn by {buyer}.", { buyer: BUYER }) : t("The link was valid until {date}. Ask {buyer} to send a new one.", { date: d(until), buyer: BUYER })}</p>
          </div>
        ) : (
          <div className="vp-join-state bad">
            <Link2Off size={28} />
            <h1>{t("This invite link is not valid")}</h1>
            <p>{id ? t("No invitation {id} was found. Check the link in your e-mail.", { id }) : t("The link has no invitation in it. Open it again from your e-mail.")}</p>
            {open.length ? (
              <div className="vp-join-demo">
                <span>{t("Demo: open invitations")}</span>
                {open.map((i) => (
                  <Link key={i.id} to={VP.accept(i.id)}>
                    {i.id} · {i.company}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </main>
      <footer className="vp-join-foot">
        {t("Powered by")} <img src="./brand/nobel-logo.png" alt="Nobel" />
      </footer>
    </div>
  );
}

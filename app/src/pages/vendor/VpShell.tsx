import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Building2, Check, ChevronDown, FileCheck2, FileText, Inbox, LayoutDashboard, Menu, Package, ReceiptText, Truck, Wallet, X, type LucideIcon } from "lucide-react";
import { Avatar, Toaster, toast, useL } from "../../components/kit";
import { useApp } from "../../lib/store";
import { useOps } from "../../ops/store";
import { tradeName } from "../../ops/select";
import { BUYER, portalVendorId, VP, vendorCounts, vendorView } from "./model";

type BadgeKey = "rfqs" | "orders" | "invoice" | "docs" | "queries";
type NavItem = { to: string; label: string; short: string; icon: LucideIcon; end?: boolean; badge?: BadgeKey; tab?: boolean };

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [{ to: VP.home, label: "Dashboard", short: "Home", icon: LayoutDashboard, end: true, tab: true }] },
  {
    group: "Quoting",
    items: [
      { to: VP.rfqs, label: "RFQ inbox", short: "RFQs", icon: Inbox, badge: "rfqs", tab: true },
      { to: VP.quotes, label: "My quotes", short: "Quotes", icon: FileText, tab: true },
    ],
  },
  {
    group: "Fulfillment",
    items: [
      { to: VP.orders, label: "Purchase orders", short: "Orders", icon: Package, badge: "orders", tab: true },
      { to: VP.deliveries, label: "Deliveries", short: "Deliveries", icon: Truck },
      { to: VP.invoices, label: "Invoices", short: "Invoices", icon: ReceiptText, badge: "queries" },
      { to: VP.payments, label: "Payments", short: "Payments", icon: Wallet, badge: "invoice", tab: true },
    ],
  },
  {
    group: "Account",
    items: [
      { to: VP.documents, label: "Documents", short: "Documents", icon: FileCheck2, badge: "docs" },
      { to: VP.profile, label: "Company profile", short: "Profile", icon: Building2 },
    ],
  },
];

/**
 * The vendor portal frame: its own sidebar (Overview / Quoting / Fulfillment / Account), a top bar with the
 * vendor's company, the buyer context, the language switch and the demo "viewing as" switcher. On phones the
 * sidebar becomes a drawer and the main pages sit in a bottom tab bar.
 */
export function VpShell({ children }: { children: ReactNode }) {
  const { t } = useL();
  const s = useOps();
  const setVendorAs = useOps((x) => x.setVendorAs);
  const lang = useApp((x) => x.lang);
  const setLang = useApp((x) => x.setLang);
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const main = useRef<HTMLDivElement>(null);

  // ?as=V-03 picks the vendor (links from the buyer's vendor pages).
  const as = params.get("as");
  useEffect(() => {
    if (!as) return;
    if (s.vendors.some((v) => v.id === as)) setVendorAs(as);
    const next = new URLSearchParams(params);
    next.delete("as");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [as]);

  useEffect(() => {
    setOpen(false);
    main.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const vendorId = portalVendorId(s);
  const view = useMemo(() => vendorView(s, vendorId), [s, vendorId]);
  const counts = useMemo(() => (view ? vendorCounts(s, view) : null), [s, view]);
  const vendor = view?.vendor;

  useEffect(() => {
    const before = document.title;
    document.title = vendor ? `${vendor.name} · ${t("Vendor portal")}` : t("Vendor portal");
    return () => {
      document.title = before;
    };
  }, [vendor, t]);

  const badge = (k?: BadgeKey) => (k && counts ? counts[k] : 0);

  return (
    <div className={`vp-app${open ? " nav-open" : ""}`}>
      <div className="vp-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className="vp-side" aria-label={t("Vendor portal navigation")}>
        <div className="vp-brand">
          <img src="./brand/nobel-mark.png" alt="" className="vp-brand-mark" />
          <span>
            <strong>{t("Vendor portal")}</strong>
            <small>{t("Qobu project")}</small>
          </span>
          <button type="button" className="icon-btn vp-side-close" onClick={() => setOpen(false)} aria-label={t("Close menu")}>
            <X size={18} />
          </button>
        </div>
        {vendor ? (
          <div className="vp-side-company">
            <Avatar name={vendor.name} size={34} />
            <span>
              <strong className="truncate">{vendor.name}</strong>
              <small className="truncate">{tradeName(vendor.trade, lang)} · {vendor.city}</small>
            </span>
          </div>
        ) : null}
        <nav className="vp-nav">
          {NAV.map((g) => (
            <div key={g.group} className="vp-nav-group">
              <span className="vp-nav-label">{t(g.group)}</span>
              {g.items.map((it) => {
                const Icon = it.icon;
                const n = badge(it.badge);
                return (
                  <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `vp-link${isActive ? " active" : ""}`}>
                    <Icon size={17} />
                    <span>{t(it.label)}</span>
                    {n ? <b className={`vp-link-badge${it.badge === "docs" || it.badge === "queries" ? " warn" : ""}`}>{n}</b> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="vp-side-foot">
          <span className="vp-powered">
            {t("Powered by")} <img src="./brand/nobel-logo.png" alt="Nobel" />
          </span>
        </div>
      </aside>

      <div className="vp-main" ref={main}>
        <header className="vp-top">
          <button type="button" className="icon-btn vp-menu" onClick={() => setOpen(true)} aria-label={t("Open menu")}>
            <Menu size={19} />
          </button>
          {vendor ? (
            <div className="vp-top-who">
              <span className="vp-top-avatar">
                <Avatar name={vendor.name} size={36} />
              </span>
              <span className="vp-top-names">
                <strong className="truncate">{vendor.name}</strong>
                <small className="truncate">
                  {t("Qobu project")} · {t("buyer")}: {BUYER}
                </small>
              </span>
            </div>
          ) : null}
          <div className="vp-top-end">
            <VendorSwitch current={vendorId} />
            <div className="lang vp-lang" role="group" aria-label={t("Language")}>
              <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
                EN
              </button>
              <button type="button" aria-pressed={lang === "az"} onClick={() => setLang("az")}>
                AZ
              </button>
            </div>
          </div>
        </header>

        <div className="vp-content">{children}</div>

        <footer className="vp-foot">
          <span className="vp-powered">
            {t("Powered by")} <img src="./brand/nobel-logo.png" alt="Nobel" />
          </span>
          <span className="muted small">{t("Vendor portal for the Qobu project. Demo data is kept in this browser and shared with the buyer's tab.")}</span>
        </footer>
      </div>

      <nav className="vp-tabs" aria-label={t("Main pages")}>
        {NAV.flatMap((g) => g.items)
          .filter((it) => it.tab)
          .map((it) => {
            const Icon = it.icon;
            const n = badge(it.badge);
            return (
              <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `vp-tab${isActive ? " active" : ""}`}>
                <span className="vp-tab-icon">
                  <Icon size={19} />
                  {n ? <b>{n}</b> : null}
                </span>
                <span>{t(it.short)}</span>
              </NavLink>
            );
          })}
      </nav>
      <Toaster />
    </div>
  );
}

/** Demo control: whose portal the presenter is looking at. Lists vendors with something to do first. */
function VendorSwitch({ current }: { current: string }) {
  const { t, lang } = useL();
  const s = useOps();
  const setVendorAs = useOps((x) => x.setVendorAs);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  const rows = useMemo(
    () =>
      s.vendors
        .map((v) => {
          const view = vendorView(s, v.id)!;
          const c = vendorCounts(s, view);
          const tags: string[] = [];
          if (c.rfqs) tags.push(t("{n} RFQ to answer", { n: c.rfqs }));
          if (c.accept) tags.push(t("{n} order to accept", { n: c.accept }));
          if (c.dispatch) tags.push(t("{n} to dispatch", { n: c.dispatch }));
          if (c.invoice) tags.push(t("{n} to invoice", { n: c.invoice }));
          if (c.queries) tags.push(t("{n} invoice query", { n: c.queries }));
          const sent = view.invites.filter((i) => i.bucket === "sent").length;
          if (!tags.length && sent) tags.push(t("{n} quote with the buyer", { n: sent }));
          return { v, tags, busy: c.total };
        })
        .sort((a, b) => (b.busy ? 1 : 0) - (a.busy ? 1 : 0) || a.v.id.localeCompare(b.v.id)),
    [s, t],
  );
  const me = s.vendors.find((v) => v.id === current);

  return (
    <div className="vp-switch" ref={ref}>
      <button type="button" className="vp-switch-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="vp-demo-tag">{t("Demo")}</span>
        <span className="vp-switch-text">
          <small>{t("Viewing as")}</small>
          <b className="truncate">{me?.name ?? current}</b>
        </span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="vp-switch-pop" role="listbox" aria-label={t("Switch vendor")}>
          <p className="vp-switch-note">{t("Demo control: pick the vendor whose portal you want to show. Everything they do appears in the buyer's tab.")}</p>
          <ul>
            {rows.map(({ v, tags }) => (
              <li key={v.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={v.id === current}
                  className={v.id === current ? "on" : undefined}
                  onClick={() => {
                    setVendorAs(v.id);
                    setOpen(false);
                    if (v.id !== current) toast(t("Now viewing as {name}", { name: v.name }), "info");
                  }}
                >
                  <Avatar name={v.name} size={28} />
                  <span className="vp-switch-name">
                    <strong className="truncate">{v.name}</strong>
                    <small className="truncate">
                      {v.id} · {tradeName(v.trade, lang)}
                    </small>
                    {tags.length ? (
                      <span className="vp-switch-tags">
                        {tags.map((tg) => (
                          <em key={tg}>{tg}</em>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  {v.id === current ? <Check size={15} className="vp-switch-check" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

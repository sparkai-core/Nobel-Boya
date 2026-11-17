import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChartGantt,
  ClipboardList,
  Clock,
  CornerDownLeft,
  ExternalLink,
  FileCheck2,
  FileInput,
  FileQuestion,
  FileStack,
  GitFork,
  type LucideIcon,
  Plus,
  Receipt,
  Search,
  Send,
  ShieldAlert,
  ShoppingCart,
  SquarePlus,
  Truck,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useL } from "./core";
import { useOps } from "../../ops/store";
import { MODULES } from "../../ops/nav";
import { R, statusMeta, to, tradeName, type Tone } from "../../ops/select";

/** Opens the command palette from anywhere (e.g. the rail's search button). */
export const openPalette = () => window.dispatchEvent(new Event("k:palette"));

type Scope = "all" | "pages" | "proc" | "pm" | "vendors";
type Hit = {
  key: string;
  scope: Exclude<Scope, "all">;
  group: string;
  icon: LucideIcon;
  label: string;
  ref?: string;
  sub?: string;
  status?: { label: string; tone: Tone };
  to: string;
  /** Opens in a new tab (vendor portal). */
  external?: boolean;
  /** Extra words that match in search but are not shown. */
  keywords?: string;
};
type Recent = Pick<Hit, "key" | "label" | "sub" | "to" | "group" | "external">;

const RECENT_KEY = "nobel.palette.recent";
const readRecent = (): Recent[] => {
  try {
    return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Recent[]).slice(0, 6);
  } catch {
    return [];
  }
};
const saveRecent = (h: Hit) => {
  try {
    const list = [{ key: h.key, label: h.label, sub: h.sub, to: h.to, group: h.group, external: h.external }, ...readRecent().filter((r) => r.key !== h.key)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
};

/** Bold the parts of `text` that match any query word. */
function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) => (words.includes(p.toLowerCase()) ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

/**
 * Ctrl/⌘+K command palette.
 * Empty query: recent items, quick actions and the most used pages.
 * With a query: ranked results across pages and records, grouped, with status, scope chips and keyboard navigation.
 */
export function CommandPalette() {
  const { t, x, lang } = useL();
  const navigate = useNavigate();
  const s = useOps();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("k:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("k:palette", onOpen);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    setQ("");
    setScope("all");
    setSel(0);
    setRecent(readRecent());
    const id = window.setTimeout(() => input.current?.focus(), 10);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const SCOPES: { key: Scope; label: string }[] = [
    { key: "all", label: t("All") },
    { key: "pages", label: t("Pages") },
    { key: "proc", label: t("Procurement") },
    { key: "pm", label: t("Project management") },
    { key: "vendors", label: t("Vendors") },
  ];

  const index = useMemo<Hit[]>(() => {
    const vendor = (id: string) => s.vendors.find((v) => v.id === id)?.name ?? id;
    const st = (kind: string, status: string) => {
      const m = statusMeta(kind, status);
      return { label: x(m.label), tone: m.tone };
    };
    const pages: Hit[] = MODULES.flatMap((m) =>
      m.groups.flatMap((g) => g.links.map((l) => ({ key: `p:${l.to}`, scope: "pages" as const, group: t("Pages"), icon: l.icon, label: t(l.label), sub: `${t(m.label)}${g.label ? ` · ${t(g.label)}` : ""}`, to: l.to }))),
    );
    return [
      ...pages,
      { key: "p:vendor", scope: "pages", group: t("Pages"), icon: ExternalLink, label: t("Vendor portal"), sub: t("Opens without login"), to: "#/vendor", external: true },
      { key: "p:projects", scope: "pages", group: t("Pages"), icon: Building2, label: t("Projects"), sub: t("Portfolio"), to: "/projects" },
      ...s.mrs.map<Hit>((m) => ({ key: m.id, scope: "proc", group: t("Material requests"), icon: ClipboardList, ref: m.ref, label: x(m.title), sub: m.requestedBy, status: st("mr", m.status), to: R.request(m.id) })),
      ...s.rfqs.map<Hit>((r) => ({ key: r.id, scope: "proc", group: t("RFQs"), icon: Send, ref: r.ref, label: x(r.title), sub: t("{n} vendors", { n: r.invitations.length }), status: st("rfq", r.status), to: R.rfq(r.id) })),
      ...s.quotes.map<Hit>((q2) => ({ key: q2.id, scope: "proc", group: t("Quotations"), icon: FileStack, ref: q2.id, label: vendor(q2.vendorId), sub: q2.ref, status: st("quote", q2.status), to: R.quote(q2.id) })),
      ...s.approvals.map<Hit>((a) => ({ key: a.id, scope: "proc", group: t("Approvals"), icon: BadgeCheck, ref: a.ref, label: x(a.title), sub: vendor(a.vendorId), status: st("approval", a.status), to: R.approval(a.id) })),
      ...s.pos.map<Hit>((p) => ({ key: p.id, scope: "proc", group: t("Purchase orders"), icon: ShoppingCart, ref: p.ref, label: vendor(p.vendorId), sub: p.lines.map((l) => x(l.description)).slice(0, 2).join(", "), status: st("po", p.status), to: R.order(p.id) })),
      ...s.grns.map<Hit>((g) => ({ key: g.id, scope: "proc", group: t("Goods receipt"), icon: Truck, ref: g.ref, label: vendor(g.vendorId), sub: g.poId, status: st("grn", g.status), to: R.receipt(g.id) })),
      ...s.invoices.map<Hit>((i) => ({ key: i.id, scope: "proc", group: t("Supplier invoices"), icon: Receipt, ref: i.id, label: `${i.ref} · ${vendor(i.vendorId)}`, sub: i.poId, to: to(`procurement/invoices/${i.id}`) })),
      ...s.payments.map<Hit>((p) => ({ key: p.id, scope: "proc", group: t("Payments"), icon: Wallet, ref: p.ref, label: vendor(p.vendorId), sub: p.poId, status: st("payment", p.status), to: R.payment(p.id) })),
      ...s.vendors.map<Hit>((v) => ({ key: v.id, scope: "vendors", group: t("Vendors"), icon: Building2, ref: v.id, label: v.name, sub: `${tradeName(v.trade, lang)} · ${v.city} · ${v.overall.toFixed(1)}/10`, keywords: [v.trade, ...v.trades].join(" "), status: st("vendor", v.status), to: R.vendor(v.id) })),
      ...s.activities.map<Hit>((a) => ({ key: a.id, scope: "pm", group: t("Activities"), icon: ChartGantt, ref: a.code, label: x(a.name), sub: `${a.pct}%`, status: st("activity", a.status), to: R.programme(a.id) })),
      ...s.rfis.map<Hit>((r) => ({ key: r.id, scope: "pm", group: t("RFIs"), icon: FileQuestion, ref: r.ref, label: x(r.subject), sub: r.raisedBy, status: st("rfi", r.status), to: R.rfi(r.id) })),
      ...s.changes.map<Hit>((c) => ({ key: c.id, scope: "pm", group: t("Changes"), icon: GitFork, ref: c.ref, label: x(c.title), status: st("change", c.status), to: R.change(c.id) })),
      ...s.submittals.map<Hit>((c) => ({ key: c.id, scope: "pm", group: t("Submittals"), icon: FileCheck2, ref: c.ref, label: x(c.title), sub: c.manufacturer, to: to(`pm/submittals/${c.id}`) })),
      ...s.inspections.map<Hit>((c) => ({ key: c.id, scope: "pm", group: t("Inspections"), icon: ShieldAlert, ref: c.ref, label: x(c.title), status: st("inspection", c.status), to: R.inspection(c.id) })),
    ];
  }, [s, t, x, lang]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const hits = useMemo(() => {
    if (!words.length) return [];
    const pool = scope === "all" ? index : index.filter((h) => h.scope === scope);
    const scored = pool
      .map((h) => {
        const hay = `${h.ref ?? ""} ${h.label} ${h.sub ?? ""} ${h.group} ${h.keywords ?? ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return null;
        const ref = (h.ref ?? "").toLowerCase();
        const label = h.label.toLowerCase();
        const k = words.join(" ");
        const score = (ref === k ? 100 : 0) + (ref.startsWith(k) ? 40 : 0) + (label.startsWith(k) ? 30 : 0) + (h.scope === "pages" ? 8 : 0) - label.length / 100;
        return { h, score };
      })
      .filter((v): v is { h: Hit; score: number } => v !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
      .map((v) => v.h);
    // Keep groups together in order of their best hit.
    const order: string[] = [];
    for (const h of scored) if (!order.includes(h.group)) order.push(h.group);
    return order.flatMap((g) => scored.filter((h) => h.group === g).slice(0, 8));
  }, [index, words, scope]);

  const counts = useMemo(() => {
    const c: Record<Scope, number> = { all: 0, pages: 0, proc: 0, pm: 0, vendors: 0 };
    if (!words.length) return c;
    for (const h of index) {
      const hay = `${h.ref ?? ""} ${h.label} ${h.sub ?? ""} ${h.group} ${h.keywords ?? ""}`.toLowerCase();
      if (words.every((w) => hay.includes(w))) {
        c.all++;
        c[h.scope]++;
      }
    }
    return c;
  }, [index, words]);

  const actions: Hit[] = [
    { key: "a:mr", scope: "proc", group: t("Quick actions"), icon: Plus, label: t("New material request"), to: R.newRequest },
    { key: "a:po", scope: "proc", group: t("Quick actions"), icon: SquarePlus, label: t("New purchase order"), to: to("procurement/orders/new") },
    { key: "a:p6", scope: "pm", group: t("Quick actions"), icon: FileInput, label: t("Import a P6 or MS Project file"), to: to("pm/planning") },
    { key: "a:delay", scope: "pm", group: t("Quick actions"), icon: Zap, label: t("Report something on site"), to: R.live },
    { key: "a:vendor", scope: "pages", group: t("Quick actions"), icon: ExternalLink, label: t("Open the vendor portal"), to: "#/vendor", external: true },
  ];
  const popular = ["Overview", "Programme", "Material requests", "Purchase orders", "Supplier invoices", "Progress tracking"]
    .map((l) => index.find((h) => h.scope === "pages" && h.label === t(l)))
    .filter((h): h is Hit => !!h)
    .slice(0, 6);
  const recentHits: Hit[] = recent.map((r) => ({ ...r, scope: "pages", icon: Clock }));
  const flat = words.length ? hits : [...recentHits, ...actions, ...popular];

  useEffect(() => setSel(0), [q, scope]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    setOpen(false);
    if (!h.key.startsWith("a:")) saveRecent(h);
    if (h.external) window.open(h.to, "_blank", "noopener");
    else navigate(h.to);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((v) => Math.min(flat.length - 1, v + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((v) => Math.max(0, v - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[sel]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (q) setQ("");
      else setOpen(false);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const i = SCOPES.findIndex((sc) => sc.key === scope);
      setScope(SCOPES[(i + (e.shiftKey ? SCOPES.length - 1 : 1)) % SCOPES.length]!.key);
    }
  };

  if (!open) return null;

  let i = -1;
  const row = (h: Hit) => {
    i++;
    const idx = i;
    const Icon = h.icon;
    return (
      <button key={`${h.key}-${idx}`} type="button" data-i={idx} className={`kp-row${idx === sel ? " on" : ""}`} onMouseMove={() => sel !== idx && setSel(idx)} onClick={() => go(h)}>
        <span className="kp-icon">
          <Icon size={15} />
        </span>
        <span className="kp-main">
          <span className="kp-title">
            {h.ref ? (
              <code>
                <Highlight text={h.ref} words={words} />
              </code>
            ) : null}
            <span className="truncate">
              <Highlight text={h.label} words={words} />
            </span>
          </span>
          {h.sub ? (
            <small className="truncate">
              <Highlight text={h.sub} words={words} />
            </small>
          ) : null}
        </span>
        {h.status ? <span className={`kp-status k-tone-${h.status.tone}`}>{h.status.label}</span> : null}
        <span className="kp-go">{idx === sel ? <CornerDownLeft size={13} /> : h.external ? <ExternalLink size={13} /> : <ArrowRight size={13} />}</span>
      </button>
    );
  };
  const section = (title: string, items: Hit[], extra?: ReactNode) =>
    items.length ? (
      <section className="kp-section" key={title}>
        <header>
          <span>{title}</span>
          {extra}
        </header>
        {items.map(row)}
      </section>
    ) : null;

  const grouped: { group: string; items: Hit[] }[] = [];
  for (const h of hits) {
    const g = grouped.find((x2) => x2.group === h.group);
    if (g) g.items.push(h);
    else grouped.push({ group: h.group, items: [h] });
  }

  return createPortal(
    <div className="kp-scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="kp" role="dialog" aria-modal="true" aria-label={t("Search everything")}>
        <div className="kp-head">
          <Search size={18} className="kp-head-icon" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={t("Search pages, orders, vendors, activities…")} aria-label={t("Search everything")} role="combobox" aria-expanded="true" aria-controls="kp-list" />
          {q ? (
            <button type="button" className="kp-clear" onClick={() => setQ("")} aria-label={t("Clear")}>
              <X size={14} />
            </button>
          ) : null}
          <button type="button" className="kp-esc" onClick={() => setOpen(false)}>
            Esc
          </button>
        </div>
        <div className="kp-scopes" role="tablist">
          {SCOPES.map((sc) => (
            <button key={sc.key} type="button" role="tab" aria-selected={scope === sc.key} className={scope === sc.key ? "on" : undefined} onClick={() => setScope(sc.key)}>
              {sc.label}
              {words.length ? <b>{counts[sc.key]}</b> : null}
            </button>
          ))}
        </div>
        <div className="kp-list" id="kp-list" ref={list}>
          {words.length ? (
            hits.length ? (
              grouped.map((g) => section(g.group, g.items, <b>{g.items.length}</b>))
            ) : (
              <div className="kp-empty">
                <span>
                  <Search size={20} />
                </span>
                <strong>{t("No match for “{q}”", { q: q.trim() })}</strong>
                <p>{t("Try a reference like PO-0002, an activity code like WH-150, or a vendor name.")}</p>
              </div>
            )
          ) : (
            <>
              {section(t("Recent"), recentHits)}
              {section(t("Quick actions"), actions)}
              {section(t("Go to"), popular)}
            </>
          )}
        </div>
        <footer className="kp-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t("to move")}
          </span>
          <span>
            <kbd>Enter</kbd> {t("to open")}
          </span>
          <span>
            <kbd>Tab</kbd> {t("to change scope")}
          </span>
          <span className="kp-foot-end">
            <kbd>Ctrl</kbd>
            <kbd>K</kbd> {t("anywhere")}
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

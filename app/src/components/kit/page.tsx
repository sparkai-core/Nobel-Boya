import { Fragment, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useL } from "./core";
import { HeaderArt, type ArtName } from "./art";
import { R, statusMeta, type TrailStep } from "../../ops/select";
import type { HistoryEvent } from "../../ops/types";

// ---------------------------------------------------------------- page hero

/**
 * Page header used by every PM / Procurement page: eyebrow, title, subtitle, an optional "flow" line
 * (the steps this page moves work through) and animated line art on the right.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  flow,
  art,
  actions,
  back,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  flow?: string[];
  art?: ArtName;
  actions?: ReactNode;
  back?: { to: string; label: string };
  children?: ReactNode;
}) {
  const { t } = useL();
  return (
    <header className={`k-hero${art ? " has-art" : ""}`}>
      <div className="k-hero-copy">
        {back ? (
          <Link to={back.to} className="k-back">
            <ArrowLeft size={14} />
            {t(back.label)}
          </Link>
        ) : null}
        <span className="k-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle ? <p className="k-hero-sub">{subtitle}</p> : null}
        {flow?.length ? (
          <ol className="k-hero-flow" aria-label={t("How work moves here")}>
            {flow.map((f, i) => (
              <li key={i}>
                {i ? <ChevronRight size={12} aria-hidden="true" /> : null}
                <span>{t(f)}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {children}
        {actions ? <div className="k-hero-actions">{actions}</div> : null}
      </div>
      {art ? (
        <div className="k-hero-art" aria-hidden="true">
          <HeaderArt name={art} />
        </div>
      ) : null}
    </header>
  );
}

// ---------------------------------------------------------------- procurement flow rail

export const PROC_FLOW: { key: string; label: string; to: string }[] = [
  { key: "request", label: "Request", to: R.requests },
  { key: "rfq", label: "RFQ", to: R.rfqs },
  { key: "quotes", label: "Quotes", to: R.quotes },
  { key: "compare", label: "Compare", to: R.compare() },
  { key: "approve", label: "Approve", to: R.approvals },
  { key: "order", label: "Order", to: R.orders },
  { key: "receive", label: "Receive", to: R.receipts },
  { key: "pay", label: "Pay", to: R.payments },
];

/** Numbered pill links across the procurement chain; the current step is highlighted. */
export function FlowRail({ current }: { current: string }) {
  const { t } = useL();
  const idx = PROC_FLOW.findIndex((f) => f.key === current);
  return (
    <nav className="k-flow" aria-label={t("Procurement flow")}>
      {PROC_FLOW.map((f, i) => (
        <Fragment key={f.key}>
          {i ? <span className={`k-flow-line${i <= idx ? " done" : ""}`} aria-hidden="true" /> : null}
          <Link to={f.to} className={`k-flow-step${i === idx ? " current" : i < idx ? " done" : ""}`} aria-current={i === idx ? "step" : undefined}>
            <b>{i + 1}</b>
            <span>{t(f.label)}</span>
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------- stage path (status filter)

/**
 * The status path drawn as arrows with counts. Clicking an arrow filters the list (click again to clear).
 * Off-path states (Cancelled, Rejected…) show as small chips after the arrows.
 */
export function StagePath({ kind, path, counts, value, onChange, extras = [] }: { kind: string; path: readonly string[]; counts: Record<string, number>; value: string | null; onChange: (v: string | null) => void; extras?: string[] }) {
  const { x, t } = useL();
  return (
    <div className="k-stagepath" role="group" aria-label={t("Filter by stage")}>
      <div className="k-stagepath-arrows">
        {path.map((st, i) => {
          const meta = statusMeta(kind, st);
          const on = value === st;
          return (
            <button key={st} type="button" className={`k-stage k-tone-${meta.tone}${on ? " on" : ""}${value && !on ? " dim" : ""}`} style={{ zIndex: path.length - i }} aria-pressed={on} onClick={() => onChange(on ? null : st)}>
              <span>{x(meta.label)}</span>
              <b className="num-inline">{counts[st] ?? 0}</b>
            </button>
          );
        })}
      </div>
      {extras.filter((e) => counts[e]).map((e) => {
        const meta = statusMeta(kind, e);
        const on = value === e;
        return (
          <button key={e} type="button" className={`k-stage-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? null : e)}>
            {x(meta.label)} <b className="num-inline">{counts[e]}</b>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- detail pages

export function DetailHeader({ refCode, badges, title, meta, aside, children }: { refCode: ReactNode; badges?: ReactNode; title: ReactNode; meta?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <section className="k-detail-head">
      <div className="k-detail-main">
        <div className="k-detail-top">
          <span className="k-ref">{refCode}</span>
          {badges}
        </div>
        <h1>{title}</h1>
        {meta ? <div className="k-detail-meta">{meta}</div> : null}
        {children}
      </div>
      {aside ? <div className="k-detail-aside">{aside}</div> : null}
    </section>
  );
}

/** The large date / amount block on the right of a detail header. */
export function KeyFigure({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="k-keyfig">
      <span>{label}</span>
      <strong className={tone ? `k-text-${tone}` : undefined}>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

/** Status path on a detail page: past steps ticked, current highlighted, future blank. */
export function StatusSteps({ kind, path, status, rejected }: { kind: string; path: readonly string[]; status: string; rejected?: boolean }) {
  const { x } = useL();
  const idx = path.indexOf(status);
  return (
    <ol className="k-steps">
      {path.map((st, i) => {
        const state = rejected && i === idx ? "rejected" : i < idx || (i === idx && i === path.length - 1) ? "done" : i === idx ? "current" : "todo";
        return (
          <li key={st} className={`k-step ${state}`}>
            <span className="k-step-dot">{state === "done" ? <Check size={11} strokeWidth={3} /> : i + 1}</span>
            <span>{x(statusMeta(kind, st).label)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** One sentence that says what happens next, one primary action and optional extras. */
export function NextBar({ text, children, tone = "brand" }: { text: ReactNode; children?: ReactNode; tone?: "brand" | "ok" | "warn" | "bad" | "muted" }) {
  const { t } = useL();
  return (
    <div className={`k-nextbar k-tone-${tone}`}>
      <span className="k-nextbar-label">{t("Next")}</span>
      <p>{text}</p>
      {children ? <div className="k-nextbar-actions">{children}</div> : null}
    </div>
  );
}

/** Breadcrumb of the procurement chain a record belongs to. */
export function Trail({ steps, current }: { steps: TrailStep[]; current?: string }) {
  const { x, t } = useL();
  if (!steps.length) return null;
  return (
    <nav className="k-trail" aria-label={t("Came from")}>
      {steps.map((s, i) => {
        const meta = statusMeta(
          { MR: "mr", RFQ: "rfq", QUOTE: "quote", APPROVAL: "approval", PO: "po", GRN: "grn", PAYMENT: "payment" }[s.kind],
          s.status,
        );
        return (
          <Fragment key={`${s.kind}-${s.id}`}>
            {i ? <ChevronRight size={13} className="k-trail-sep" aria-hidden="true" /> : null}
            {s.id === current ? (
              <span className="k-trail-step current">
                <small>{x(s.label)}</small>
                <b>{s.ref}</b>
              </span>
            ) : (
              <Link to={s.href} className={`k-trail-step k-tone-${meta.tone}`}>
                <small>{x(s.label)}</small>
                <b>{s.ref}</b>
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export type PathStep = { label: ReactNode; who?: ReactNode; at?: ReactNode; state: "done" | "current" | "todo" | "rejected" };
/** Horizontal approval chain: dots joined by solid (done) or dashed (to do) lines. */
export function ApprovalPath({ steps }: { steps: PathStep[] }) {
  return (
    <ol className="k-apath">
      {steps.map((s, i) => (
        <li key={i} className={`k-apath-step ${s.state}`}>
          <span className="k-apath-dot">{s.state === "done" ? <Check size={12} strokeWidth={3} /> : s.state === "rejected" ? "×" : null}</span>
          <strong>{s.label}</strong>
          {s.who ? <span>{s.who}</span> : null}
          {s.at ? <small>{s.at}</small> : null}
        </li>
      ))}
    </ol>
  );
}

/** Vertical history list. */
export function Timeline({ events }: { events: HistoryEvent[] }) {
  const { x, stamp, t } = useL();
  const ACTOR: Record<HistoryEvent["actor"], string> = { SYSTEM: "System", AI: "AI", USER: "User", VENDOR: "Vendor" };
  return (
    <ol className="k-timeline">
      {[...events].reverse().map((e, i) => (
        <li key={i} className={`k-tl-${e.actor.toLowerCase()}`}>
          <span className="k-tl-dot" aria-hidden="true" />
          <div>
            <p>{x(e.text)}</p>
            <small>
              {t(ACTOR[e.actor])} · {stamp(e.at)}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Underline tabs for detail-page sections (state lives in the page). */
export function TabBar<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="k-tabs" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.value} type="button" role="tab" aria-selected={tb.value === value} className={tb.value === value ? "on" : undefined} onClick={() => onChange(tb.value)}>
          {tb.label}
          {tb.count != null ? <span className="k-count">{tb.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Sub-navigation strip for a module section (e.g. PM: Schedule | Analysis | Control). */
export function SubNav({ items }: { items: { to: string; label: string; end?: boolean }[] }) {
  const { t } = useL();
  return (
    <nav className="k-subnav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? "on" : undefined)}>
          {t(it.label)}
        </NavLink>
      ))}
    </nav>
  );
}

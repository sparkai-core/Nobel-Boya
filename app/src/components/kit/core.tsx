import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { MoreHorizontal, X } from "lucide-react";
import { useT, type Lang } from "../../lib/i18n";
import { useApp } from "../../lib/store";
import { fmtMoney, fmtMoneyShort } from "../../lib/format";
import { fmtDate, fmtRel, fmtStamp, tx } from "../../ops/dates";
import { initials, statusMeta, type Tone } from "../../ops/select";
import type { Txt } from "../../ops/types";

// ---------------------------------------------------------------- language helper

/**
 * One hook for every page: t() for interface strings (EN key → AZ dictionary),
 * x() for bilingual data (Txt), and date/money formatters bound to the language.
 */
export function useL() {
  const t = useT();
  const lang = useApp((s) => s.lang) as Lang;
  const x = useCallback((v: Txt | null | undefined) => tx(v, lang), [lang]);
  const d = useCallback((v: string | null | undefined, year = true) => fmtDate(v, lang, { year }), [lang]);
  const stamp = useCallback((v: string | null | undefined) => fmtStamp(v, lang), [lang]);
  const rel = useCallback((v: string) => fmtRel(v, lang), [lang]);
  return { t, lang, x, d, stamp, rel };
}

// ---------------------------------------------------------------- badges

export function Badge({ tone = "neutral", children, dot = true, title }: { tone?: Tone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span className={`k-badge k-tone-${tone}`} title={title}>
      {dot ? <i aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Status pill from the central status map (ops/select STATUS). */
export function StatusBadge({ kind, status, dot = true }: { kind: string; status: string; dot?: boolean }) {
  const { x } = useL();
  const meta = statusMeta(kind, status);
  return (
    <Badge tone={meta.tone} dot={dot}>
      {x(meta.label)}
    </Badge>
  );
}

const AVATAR_TONES = ["#2b0266", "#1f8a72", "#9a5b00", "#3d1590", "#4b5563", "#157a52", "#7a3b9a", "#a3402a"];
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className="k-avatar" title={name} style={{ width: size, height: size, background: AVATAR_TONES[h % AVATAR_TONES.length], fontSize: Math.max(10, size * 0.38) }}>
      {initials(name)}
    </span>
  );
}

export function Money({ value, short, currency = true, className }: { value: number; short?: boolean; currency?: boolean; className?: string }) {
  return (
    <span className={`num-inline${className ? ` ${className}` : ""}`}>
      {short ? fmtMoneyShort(value) : fmtMoney(value)}
      {currency ? <small className="k-cur"> AZN</small> : null}
    </span>
  );
}

/** Thin progress meter. `value` is 0–1. */
export function Meter({ value, tone = "brand", marker, label }: { value: number; tone?: Tone; marker?: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className={`k-meter k-tone-${tone}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <i style={{ width: `${v * 100}%` }} />
      {marker != null ? <b style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} /> : null}
    </span>
  );
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts up to `value` once when it first renders (or when the value changes). */
export function CountUp({ value, format = (v: number) => String(Math.round(v)), duration = 700 }: { value: number; format?: (v: number) => string; duration?: number }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="num-inline">{format(shown)}</span>;
}

// ---------------------------------------------------------------- surfaces

export function Panel({ title, icon, count, actions, children, className, pad = true, sub }: { title?: ReactNode; icon?: ReactNode; count?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean; sub?: ReactNode }) {
  return (
    <section className={`k-panel${className ? ` ${className}` : ""}`}>
      {title ? (
        <header className="k-panel-head">
          <div className="k-panel-title">
            {icon ? <span className="k-panel-icon">{icon}</span> : null}
            <h2>{title}</h2>
            {count != null ? <span className="k-count">{count}</span> : null}
          </div>
          {actions ? <div className="k-panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      {sub ? <p className="k-panel-sub">{sub}</p> : null}
      <div className={pad ? "k-panel-body" : "k-panel-flush"}>{children}</div>
    </section>
  );
}

export type Stat = { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: ReactNode; onClick?: () => void };
export function StatTiles({ items, className }: { items: Stat[]; className?: string }) {
  return (
    <div className={`k-stats${className ? ` ${className}` : ""}`}>
      {items.map((s, i) => {
        const inner = (
          <>
            <span className="k-stat-label">
              {s.icon}
              {s.label}
            </span>
            <strong className={`k-stat-value k-text-${s.tone ?? "neutral"}`}>{s.value}</strong>
            {s.sub ? <span className="k-stat-sub">{s.sub}</span> : null}
          </>
        );
        return s.onClick ? (
          <button key={i} type="button" className="k-stat k-stat-btn" onClick={s.onClick}>
            {inner}
          </button>
        ) : (
          <div key={i} className="k-stat">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- form bits

export function Field({ label, hint, children, wide, error }: { label: ReactNode; hint?: ReactNode; children: ReactNode; wide?: boolean; error?: ReactNode }) {
  return (
    <label className={`k-field${wide ? " k-field-wide" : ""}`}>
      <span className="k-field-label">{label}</span>
      {children}
      {error ? <span className="k-field-error">{error}</span> : hint ? <span className="k-field-hint">{hint}</span> : null}
    </label>
  );
}

// ---------------------------------------------------------------- dialog

export function Dialog({ open, onClose, title, children, footer, width = 520, kicker }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; kicker?: ReactNode }) {
  const { t } = useL();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="k-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="k-dialog" role="dialog" aria-modal="true" style={{ width }}>
        <header className="k-dialog-head">
          <div>
            {kicker ? <div className="k-dialog-kicker">{kicker}</div> : null}
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("Close")}>
            <X size={18} />
          </button>
        </header>
        <div className="k-dialog-body">{children}</div>
        {footer ? <footer className="k-dialog-foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- menu

export type MenuItem = { label: ReactNode; onClick: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean };
export function Kebab({ items, label = "More actions", children }: { items: MenuItem[]; label?: string; children?: ReactNode }) {
  const { t } = useL();
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
  return (
    <div className="k-menu-wrap" ref={ref}>
      <button
        type="button"
        className={children ? "btn btn-ghost" : "icon-btn"}
        aria-label={t(label)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {children ?? <MoreHorizontal size={17} />}
      </button>
      {open ? (
        <div className="k-menu" role="menu">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className={it.danger ? "danger" : undefined}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- toasts

type ToastItem = { id: number; text: string; tone: Tone; action?: { label: string; onClick: () => void } };
const useToasts = create<{ items: ToastItem[]; push: (t: Omit<ToastItem, "id">) => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 4200);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

/** Shows a short confirmation at the bottom of the screen. Pass already-translated text. */
export function toast(text: string, tone: Tone = "ok", action?: ToastItem["action"]) {
  useToasts.getState().push({ text, tone, action });
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  const drop = useToasts((s) => s.drop);
  return createPortal(
    <div className="k-toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`k-toast k-tone-${t.tone}`}>
          <i aria-hidden="true" />
          <span>{t.text}</span>
          {t.action ? (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                drop(t.id);
              }}
            >
              {t.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- misc

/** Bilingual-aware text search across any fields. */
export function useSearch<T>(rows: T[], query: string, fields: (row: T) => (string | Txt | null | undefined)[]) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      fields(r).some((f) => {
        if (!f) return false;
        if (typeof f === "string") return f.toLowerCase().includes(q);
        return f.en.toLowerCase().includes(q) || f.az.toLowerCase().includes(q);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query]);
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="k-empty">
      {icon ? <span className="k-empty-icon">{icon}</span> : null}
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** Small key/value grid used in detail pages. */
export function KeyVals({ items, cols = 2 }: { items: { k: ReactNode; v: ReactNode }[]; cols?: number }) {
  return (
    <dl className="k-kv" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it, i) => (
        <div key={i}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

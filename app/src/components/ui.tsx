import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Check as CheckType, Method } from "../data/types";

export const METHOD_LABEL: Record<Method, string> = {
  schedule: "Schedule Extraction",
  image: "Plan Takeoff",
  derived: "Parametric Takeoff",
};

export const METHOD_HINT: Record<Method, string> = {
  schedule: "Extracted directly from vector design schedules and cross-referenced with element marks.",
  image: "Measured from dimensioned architectural plans and cross-referenced with room finish schedules.",
  derived: "Computed using explicit engineering formulas combining member dimensions and component counts.",
};

export function MethodTag({ method, compact }: { method: Method; compact?: boolean }) {
  return (
    <span className={`method method-${method}`} title={METHOD_HINT[method]}>
      <i aria-hidden="true" />
      {compact ? null : METHOD_LABEL[method]}
    </span>
  );
}

export const SEVERITY_LABEL: Record<CheckType["severity"], string> = {
  error: "Calculation Discrepancy",
  warn: "Cross-Discipline Variance",
  info: "Engineering Note",
  ok: "Verified Alignment",
};

export function severityLabel(check: Pick<CheckType, "severity" | "kind">) {
  if (check.severity === "warn" && check.kind === "missing") return "Specification Pending";
  return SEVERITY_LABEL[check.severity];
}

export function SeverityTag({ severity, kind }: { severity: CheckType["severity"]; kind?: CheckType["kind"] }) {
  return (
    <span className={`sev sev-${severity}`}>
      <i aria-hidden="true" />
      {kind ? severityLabel({ severity, kind }) : SEVERITY_LABEL[severity]}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count != null ? <span className="count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  kicker,
  children,
  width,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside className={`drawer modern-drawer${open ? " open" : ""}`} aria-hidden={!open} style={width ? { width } : undefined}>
      <header className="drawer-head">
        <div className="drawer-titles">
          {kicker ? <div className="drawer-kicker">{kicker}</div> : null}
          <h2>{title}</h2>
        </div>
        <button type="button" className="icon-btn close-btn" onClick={onClose} aria-label="Close inspector">
          <X size={18} />
        </button>
      </header>
      <div className="drawer-body scroll">{open ? children : null}</div>
    </aside>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="logo">
      <rect x="3.5" y="5.5" width="21" height="17" rx="2" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
      <path d="M7 10.5h9M7 14h6M7 17.5h8" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="15.5" y="11.5" width="7" height="4.5" rx="1" fill="none" stroke="#2563eb" strokeWidth="1.6" />
    </svg>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <p className="empty-desc">{children}</p> : null}
    </div>
  );
}

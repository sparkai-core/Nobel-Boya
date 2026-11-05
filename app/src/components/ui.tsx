import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Check, Method } from "../data/types";

export const METHOD_LABEL: Record<Method, string> = {
  schedule: "Printed schedule",
  image: "Read from image",
  derived: "Derived",
};

export const METHOD_HINT: Record<Method, string> = {
  schedule: "The number is printed in a schedule on a sheet with a text layer and was located there automatically.",
  image: "The sheet is flattened. The number was read from the drawing at high zoom and its position marked by hand.",
  derived: "Calculated from printed values. The formula and every input are listed.",
};

export function MethodTag({ method, compact }: { method: Method; compact?: boolean }) {
  return (
    <span className={`method method-${method}`} title={METHOD_HINT[method]}>
      <i aria-hidden="true" />
      {compact ? null : METHOD_LABEL[method]}
    </span>
  );
}

export const SEVERITY_LABEL: Record<Check["severity"], string> = { error: "Error", warn: "Conflict", info: "Note", ok: "Agrees" };

export function severityLabel(check: Pick<Check, "severity" | "kind">) {
  if (check.severity === "warn" && check.kind === "missing") return "Missing";
  return SEVERITY_LABEL[check.severity];
}

export function SeverityTag({ severity, kind }: { severity: Check["severity"]; kind?: Check["kind"] }) {
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

export function Drawer({ open, onClose, title, kicker, children, width }: { open: boolean; onClose: () => void; title: ReactNode; kicker?: ReactNode; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <aside className={`drawer${open ? " open" : ""}`} aria-hidden={!open} style={width ? { width } : undefined}>
      <header className="drawer-head">
        <div className="drawer-titles">
          {kicker ? <div className="drawer-kicker">{kicker}</div> : null}
          <h2>{title}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
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
      <rect x="3.5" y="5.5" width="21" height="17" rx="1.5" fill="#fff" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 10.5h9M7 14h6M7 17.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="15.6" y="12" width="6.4" height="4.2" rx="0.8" fill="none" stroke="#D63F28" strokeWidth="1.6" />
    </svg>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children ? <p className="muted">{children}</p> : null}
    </div>
  );
}

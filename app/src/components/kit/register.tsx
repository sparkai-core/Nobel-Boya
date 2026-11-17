import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useL } from "./core";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sort?: (row: T) => string | number;
  width?: string;
  align?: "left" | "right" | "center";
  /** Hide below this viewport width (px). */
  hideBelow?: number;
};

/**
 * The list register used on every list page: a toolbar slot, a sortable table, row click,
 * an empty state and a pager. Rows become cards on phones.
 */
export function Register<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  toolbar,
  empty,
  pageSize = 12,
  initialSort,
  rowClass,
  dense,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  rowClass?: (row: T) => string | undefined;
  dense?: boolean;
}) {
  const { t } = useL();
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page >= pages) setPage(0);
  }, [pages, page]);
  const shown = sorted.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <section className={`k-register${dense ? " dense" : ""}`}>
      {toolbar ? <div className="k-register-toolbar">{toolbar}</div> : null}
      {sorted.length === 0 ? (
        <div className="k-register-empty">{empty ?? t("Nothing matches these filters.")}</div>
      ) : (
        <div className="k-table-wrap">
          <table className="k-table">
            <thead>
              <tr>
                {columns.map((c) => {
                  const on = sort?.key === c.key;
                  return (
                    <th key={c.key} style={{ width: c.width, textAlign: c.align }} className={c.hideBelow ? `hide-${c.hideBelow}` : undefined} aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {c.sort ? (
                        <button type="button" className={`k-th-sort${on ? " on" : ""}`} onClick={() => setSort(on && sort!.dir === "desc" ? { key: c.key, dir: "asc" } : { key: c.key, dir: on ? "desc" : "desc" })}>
                          {c.header}
                          {on ? sort!.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={rowKey(r)} className={`${onRowClick ? "clickable" : ""} ${rowClass?.(r) ?? ""}`} onClick={onRowClick ? () => onRowClick(r) : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(r) : undefined}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align }} className={c.hideBelow ? `hide-${c.hideBelow}` : undefined} data-label={typeof c.header === "string" ? c.header : undefined}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <footer className="k-pager">
          <span className="muted small">{t("{a}–{b} of {n}", { a: page * pageSize + 1, b: Math.min(sorted.length, (page + 1) * pageSize), n: sorted.length })}</span>
          <div>
            <button type="button" className="icon-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label={t("Previous page")}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="icon-btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label={t("Next page")}>
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { t } = useL();
  return (
    <label className="search k-search">
      <Search size={15} />
      <input className="input" type="search" value={value} placeholder={t(placeholder)} onChange={(e) => onChange(e.target.value)} aria-label={t(placeholder)} />
    </label>
  );
}

/** Toggleable filter chips with counts. Single-select; click the active chip to clear. */
export function FilterChips<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode; count?: number }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div className="k-chips">
      {options.map((o) => (
        <button key={o.value} type="button" className={`k-chip${value === o.value ? " on" : ""}`} aria-pressed={value === o.value} onClick={() => onChange(value === o.value ? null : o.value)}>
          {o.label}
          {o.count != null ? <b className="num-inline">{o.count}</b> : null}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div className="k-toolbar">
      <div className="k-toolbar-main">{children}</div>
      {end ? <div className="k-toolbar-end">{end}</div> : null}
    </div>
  );
}

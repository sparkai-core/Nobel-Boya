import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useL } from "./core";
import { useOps } from "../../ops/store";
import { P } from "../../data";

const SEEN_KEY = "nobel.ops.seen";

/** Bell with unread count from the live feed, and a popover of the latest events. */
export function NotificationBell({ compact }: { compact?: boolean }) {
  const { t, x, stamp } = useL();
  const feed = useOps((s) => s.feed);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string>(() => {
    try {
      return localStorage.getItem(SEEN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const ref = useRef<HTMLDivElement>(null);
  const unread = feed.filter((f) => f.at > seen).length;
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const markRead = () => {
    const latest = feed[0]?.at ?? "";
    setSeen(latest);
    try {
      localStorage.setItem(SEEN_KEY, latest);
    } catch {
      /* storage blocked: keep in memory */
    }
  };
  return (
    <div className="k-bell-wrap" ref={ref}>
      <button type="button" className={`rail-link k-bell${compact ? " compact" : ""}`} title={t("Notifications")} aria-label={t("Notifications")} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={17} strokeWidth={1.8} />
        <span>{t("Notifications")}</span>
        {unread ? <span className="rail-badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="k-bell-pop" role="dialog" aria-label={t("Notifications")}>
          <header>
            <strong>{t("Notifications")}</strong>
            <button type="button" className="k-link-btn" onClick={markRead} disabled={!unread}>
              {t("Mark all read")}
            </button>
          </header>
          <ol>
            {feed.slice(0, 14).map((f) => (
              <li key={f.id} className={f.at > seen ? "unread" : undefined}>
                <span className={`k-bell-dot m-${f.module.toLowerCase()}`} aria-hidden="true" />
                <div>
                  {f.link ? (
                    <Link to={f.link.startsWith("/") ? f.link : `${P}/${f.link}`} onClick={() => setOpen(false)}>
                      {x(f.text)}
                    </Link>
                  ) : (
                    <span>{x(f.text)}</span>
                  )}
                  <small>
                    {f.actor} · {stamp(f.at)}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export { CommandPalette, openPalette } from "./palette";

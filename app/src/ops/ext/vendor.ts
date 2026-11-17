import { useOps } from "../store";
import { nowStamp } from "../dates";
import type { FeedEvent, OpsData, Txt } from "../types";

/**
 * Vendor-portal helpers that the shared store has no action for. Invoices are real records now
 * (see ops/ext/money-p2 sendPortalInvoice). Renewed compliance documents are written as a VENDOR feed
 * event in the store's own shape, so the buyer sees them in the live feed (and in the other tab, through
 * the storage event); the document record is read back from the feed link, which carries the fields.
 */

const vendorName = (s: OpsData, id: string) => s.vendors.find((v) => v.id === id)?.name ?? id;

function withFeed(s: OpsData, text: Txt, link: string, actor: string, seq = s.seq): Pick<OpsData, "feed" | "seq"> {
  const n = (seq.F ?? 0) + 1;
  const ev: FeedEvent = { id: `F-${n}`, at: nowStamp(), module: "VENDOR", text, link, actor };
  return { feed: [ev, ...s.feed].slice(0, 80), seq: { ...seq, F: n } };
}

export type DocUpload = { key: string; file: string; at: string; expires: string | null };

/** The vendor uploads a renewed compliance document (file name only) with its new expiry date. */
export function sendDocument(vendorId: string, key: string, label: Txt, file: string, expires: string | null) {
  const s = useOps.getState();
  const name = vendorName(s, vendorId);
  const link = `procurement/vendors/${vendorId}?doc=${encodeURIComponent(key)}&file=${encodeURIComponent(file)}${expires ? `&expires=${expires}` : ""}`;
  useOps.setState(withFeed(s, { en: `${name} uploaded a renewed ${label.en.toLowerCase()} (${file})`, az: `${name} yenilənmiş sənəd yüklədi: ${label.az} (${file})` }, link, name));
}

function query(link: string | null) {
  if (!link) return null;
  const i = link.indexOf("?");
  return i < 0 ? null : { path: link.slice(0, i), params: new URLSearchParams(link.slice(i + 1)) };
}

/** Latest renewed document per document key. */
export function docUploadsOf(feed: FeedEvent[], vendorId: string): Map<string, DocUpload> {
  const out = new Map<string, DocUpload>();
  for (const f of feed) {
    if (f.module !== "VENDOR") continue;
    const q = query(f.link);
    if (!q || q.path !== `procurement/vendors/${vendorId}`) continue;
    const key = q.params.get("doc");
    if (!key || out.has(key)) continue;
    out.set(key, { key, file: q.params.get("file") ?? "", at: f.at, expires: q.params.get("expires") });
  }
  return out;
}

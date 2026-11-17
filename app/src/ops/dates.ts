import type { Lang } from "../lib/i18n";
import type { Txt } from "./types";

/** The demo runs on a fixed "today" so the seeded programme always reads the same way. */
export const TODAY = "2026-11-17";
export const PROJECT_START = "2026-10-05";
export const PROJECT_FINISH = "2027-08-27";
/** Above this amount a purchase needs two approvals. */
export const APPROVAL_LIMIT = 50_000;

const DAY = 86_400_000;

export function toDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}
export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function addDays(isoDate: string, days: number) {
  return iso(new Date(toDate(isoDate).getTime() + days * DAY));
}
/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
}
export function minDate(...d: string[]) {
  return d.reduce((a, b) => (a < b ? a : b));
}
export function maxDate(...d: string[]) {
  return d.reduce((a, b) => (a > b ? a : b));
}
export function isWeekend(isoDate: string) {
  const w = toDate(isoDate).getUTCDay();
  return w === 0;
}
/** Timestamp "now" inside the demo: TODAY plus the real clock time, so new records sort last. */
export function nowStamp() {
  const t = new Date();
  return `${TODAY}T${t.toISOString().slice(11, 19)}Z`;
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_AZ = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
const MONTHS_LONG_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_LONG_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_AZ = ["B.", "B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş."];

export function monthShort(m: number, lang: Lang) {
  return (lang === "az" ? MONTHS_AZ : MONTHS_EN)[m]!;
}
export function monthLong(m: number, lang: Lang) {
  return (lang === "az" ? MONTHS_LONG_AZ : MONTHS_LONG_EN)[m]!;
}
export function dowShort(d: number, lang: Lang) {
  return (lang === "az" ? DOW_AZ : DOW_EN)[d]!;
}

/** "17 Nov 2026" / "17 noy 2026". */
export function fmtDate(isoDate: string | null | undefined, lang: Lang, opts: { year?: boolean } = {}) {
  if (!isoDate) return "—";
  const d = toDate(isoDate);
  const s = `${d.getUTCDate()} ${monthShort(d.getUTCMonth(), lang)}`;
  return opts.year === false ? s : `${s} ${d.getUTCFullYear()}`;
}
/** "17 Nov, 14:20" for timestamps. */
export function fmtStamp(stamp: string | null | undefined, lang: Lang) {
  if (!stamp) return "—";
  const time = stamp.length > 10 ? stamp.slice(11, 16) : "";
  return `${fmtDate(stamp, lang, { year: false })}${time ? `, ${time}` : ""}`;
}
/** "in 5 days" / "3 days ago" / "today", relative to TODAY. */
export function fmtRel(isoDate: string, lang: Lang) {
  const n = diffDays(TODAY, isoDate.slice(0, 10));
  if (lang === "az") {
    if (n === 0) return "bu gün";
    if (n === 1) return "sabah";
    if (n === -1) return "dünən";
    return n > 0 ? `${n} gün sonra` : `${-n} gün əvvəl`;
  }
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** Picks the language variant of a bilingual text. */
export function tx(t: Txt | null | undefined, lang: Lang) {
  if (!t) return "";
  return lang === "az" ? t.az : t.en;
}
/** Same text in both languages (user input). */
export function same(s: string): Txt {
  return { en: s, az: s };
}

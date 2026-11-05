import { buildingById, data, DISCIPLINES } from "../data";
import type { Check, Gap, Sheet } from "../data/types";
import { CHAIN_AZ, CHECK_AZ, DISCIPLINE_AZ, GAP_AZ, RATE_AZ, RATE_GROUP_AZ, SHORT_AZ, type Lang } from "./i18n";

const itemAzByRate = new Map<string, string>();
for (const it of data.items) if (!itemAzByRate.has(it.rate)) itemAzByRate.set(it.rate, it.az);

export const buildingShort = (id: string, lang: Lang) => (lang === "az" ? SHORT_AZ[id] : buildingById.get(id)?.short) ?? id;
export const buildingName = (id: string, lang: Lang) => {
  const b = buildingById.get(id);
  return b ? (lang === "az" ? b.az : b.en) : id;
};
export const disciplineName = (d: string, lang: Lang) => (lang === "az" ? DISCIPLINE_AZ[d] : DISCIPLINES[d]) ?? d;
export const sheetTitle = (s: Sheet, lang: Lang) => (lang === "az" ? s.title : s.titleEn);
export const chainLabel = (key: string, label: string, lang: Lang) => (lang === "az" ? (CHAIN_AZ[key] ?? label) : label);
export const checkTitle = (c: Check, lang: Lang) => (lang === "az" ? (CHECK_AZ[c.id]?.title ?? c.title) : c.title);
export const checkDetail = (c: Check, lang: Lang) => (lang === "az" ? (CHECK_AZ[c.id]?.detail ?? c.detail) : c.detail);
export const checkFix = (c: Check, lang: Lang) => (lang === "az" ? (CHECK_AZ[c.id]?.fix ?? c.fix?.label ?? "") : (c.fix?.label ?? ""));
export const gapName = (g: Gap, lang: Lang) => (lang === "az" ? g.az : g.en);
export const gapDetail = (g: Gap, lang: Lang) => (lang === "az" ? (GAP_AZ[g.en] ?? g.detail) : g.detail);
export const rateDesc = (key: string, lang: Lang) => {
  const r = data.rates[key];
  if (lang !== "az") return r?.en ?? key;
  return RATE_AZ[key] ?? itemAzByRate.get(key) ?? r?.en ?? key;
};
export const rateGroup = (g: string, lang: Lang) => (lang === "az" ? (RATE_GROUP_AZ[g] ?? g) : g);
export const docName = (code: string, lang: Lang) => {
  const d = data.documents.find((x) => x.code === code);
  return d ? (lang === "az" ? d.az : d.en) : code;
};
export const projectName = (lang: Lang) => (lang === "az" ? data.project.name : data.project.nameEn);
export const projectPlace = (lang: Lang) => (lang === "az" ? data.project.place : data.project.placeEn);

const NOTE_AZ: Record<string, string> = {
  "wh-strip": "Cədvəldə 192.00 m lentvari bünövrə var; 192.00 × 0.40 × 0.50 = 38.40 m³.",
  "wh-sr2": "Çap olunmuş profil cəmi düzgün toplanmır. C-01 yoxlamasına baxın.",
  "ad-slab": "Memarlıqda burada 150 mm göstərilib. C-03 yoxlamasına baxın.",
};

export const formulaText = (f: string, lang: Lang) =>
  lang !== "az"
    ? f
    : f
        .replace(/kg profiles/g, "kq profil")
        .replace(/kg plates/g, "kq lövhə")
        .replace(/\(as printed\)/g, "(çap olunduğu kimi)")
        .replace(/\brooms\b/g, "otaqlar")
        .replace(/\bno\./g, "ədəd")
        .replace(/\bkg\b/g, "kq");

export const noteText = (id: string, note: string, lang: Lang) => (lang === "az" ? (NOTE_AZ[id] ?? note) : note);

import raw from "./qobu.json";
import type { Building, Dataset, Doc, Item, Section, Sheet } from "./types";

let _activeDataset: Dataset = raw as unknown as Dataset;

export const sheetById = new Map<string, Sheet>();
export const itemById = new Map<string, Item>();
export const docByCode = new Map<string, Doc>();
export const buildingById = new Map<string, Building>();
export const sectionById = new Map<string, Section>();
export const evidenceBySheet = new Map<string, { itemId: string; srcIndex: number }[]>();

export function rebuildLookups(ds: Dataset) {
  _activeDataset = ds;

  sheetById.clear();
  (ds.sheets || []).forEach((s) => sheetById.set(s.id, s));

  itemById.clear();
  (ds.items || []).forEach((i) => itemById.set(i.id, i));

  docByCode.clear();
  (ds.documents || []).forEach((d) => docByCode.set(d.code, d));

  buildingById.clear();
  (ds.buildings || []).forEach((b) => buildingById.set(b.id, b));

  sectionById.clear();
  (ds.sections || []).forEach((s) => sectionById.set(s.id, s));

  evidenceBySheet.clear();
  for (const it of ds.items || []) {
    it.src?.forEach((s, i) => {
      const list = evidenceBySheet.get(s.sheet) ?? [];
      list.push({ itemId: it.id, srcIndex: i });
      evidenceBySheet.set(s.sheet, list);
    });
  }
}

// Initial populate with default Qobu dataset
rebuildLookups(raw as unknown as Dataset);

export function getActiveDataset(): Dataset {
  return _activeDataset;
}

export function setActiveDataset(dataset: Dataset) {
  rebuildLookups(dataset);
}

export const data: Dataset = new Proxy({} as Dataset, {
  get(_target, prop: string | symbol) {
    return (_activeDataset as any)[prop];
  },
  set(_target, prop: string | symbol, value: any) {
    (_activeDataset as any)[prop] = value;
    return true;
  },
});

export const DISCIPLINES: Record<string, string> = {
  general: "General",
  site: "Site",
  arch: "Architecture",
  struct: "Structure",
  elec: "Electrical",
  hvac: "Heating and ventilation",
  plumb: "Water and drainage",
  fire: "Firefighting",
  alarm: "Fire alarm",
  lowcur: "Communications and CCTV",
  pa: "Public address",
};

/** Base route of the open project. */
export const P = "/p/qobu";

/** One representative sheet per file, used as the project cover. */
export const COVER_SHEETS: string[] = new Proxy([] as string[], {
  get(_target, prop: string | symbol) {
    const list = (_activeDataset.sheets && _activeDataset.sheets.length > 0)
      ? _activeDataset.sheets.slice(0, 4).map((s) => s.id)
      : ["BP-7", "AR-10", "KS-7", "MEP-24"];
    return (list as any)[prop];
  },
});

export type SheetKind = "drawing" | "schedule" | "source";

/** Drawings are plans, sections and elevations; schedules are tables; source files are covers, licences and notes. */
export function sheetKind(s: { title: string; titleEn: string; discipline: string }): SheetKind {
  const t = `${s.title || ""} ${s.titleEn || ""}`.toLowerCase();
  if (s.discipline === "general" || /general (data|notes)|legend|şərti işarələr|ümumi/.test(t)) return "source";
  if (/schedule|təsnifat|spesifikasiya|sərfi|cədvəl/.test(t)) return "schedule";
  return "drawing";
}

export function sheetImage(id: string, thumb = false) {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const base = apiUrl
    ? apiUrl.replace(/\/+$/, "")
    : (import.meta.env.BASE_URL || "./");
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}sheets/${id}${thumb ? ".t" : ""}.webp`;
}

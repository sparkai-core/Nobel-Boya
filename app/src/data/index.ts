import raw from "./qobu.json";
import type { Dataset, Sheet } from "./types";

export const data = raw as unknown as Dataset;

export const sheetById = new Map<string, Sheet>(data.sheets.map((s) => [s.id, s]));
export const itemById = new Map(data.items.map((i) => [i.id, i]));
export const docByCode = new Map(data.documents.map((d) => [d.code, d]));
export const buildingById = new Map(data.buildings.map((b) => [b.id, b]));
export const sectionById = new Map(data.sections.map((s) => [s.id, s]));

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

export function sheetImage(id: string, thumb = false) {
  return `./sheets/${id}${thumb ? ".t" : ""}.webp`;
}

/** Every evidence box printed on a sheet, keyed back to the takeoff item that cites it. */
export const evidenceBySheet = (() => {
  const map = new Map<string, { itemId: string; srcIndex: number }[]>();
  for (const it of data.items) {
    it.src.forEach((s, i) => {
      const list = map.get(s.sheet) ?? [];
      list.push({ itemId: it.id, srcIndex: i });
      map.set(s.sheet, list);
    });
  }
  return map;
})();

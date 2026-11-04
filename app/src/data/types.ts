export type Box = [number, number, number, number];

export type Source = {
  sheet: string;
  box: Box;
  quote: string;
  value: string | null;
  how: "text" | "image";
  role: string | null;
};

export type Method = "schedule" | "image" | "derived";

export type Item = {
  id: string;
  building: string;
  section: string;
  az: string;
  en: string;
  unit: string;
  qty: number;
  src: Source[];
  method: Method;
  formula: string | null;
  rate: string;
  note: string | null;
  line: string | null;
};

export type Sheet = {
  id: string;
  doc: string;
  page: number;
  w: number;
  h: number;
  title: string;
  titleEn: string;
  building: string;
  discipline: string;
  no: string | null;
};

export type Rate = { unit: string; rate: number; en: string; group: string };

export type Check = {
  id: string;
  kind: "arithmetic" | "conflict" | "missing" | "identity" | "review" | "agree";
  severity: "error" | "warn" | "info" | "ok";
  building: string;
  title: string;
  detail: string;
  expected?: number;
  printed?: number;
  unit?: string;
  sources: Source[];
  items: string[];
  fix?: { item: string; qty: number; label: string };
};

export type Doc = { code: string; file: string; az: string; en: string; date: string; text: boolean | "partial"; note: string };
export type Building = { id: string; az: string; en: string; short: string };
export type Section = { id: string; az: string; en: string };
export type Gap = { az: string; en: string; detail: string };

export type Dataset = {
  project: {
    name: string;
    nameEn: string;
    place: string;
    placeEn: string;
    client: string;
    designer: string;
    chiefEngineer: string;
    stage: string;
    issued: string;
    currency: string;
    site: { areaHa: number; footprint: number; greenery: number };
  };
  documents: Doc[];
  buildings: Building[];
  sections: Section[];
  sheets: Sheet[];
  items: Item[];
  lineGroups: Record<string, { az: string; en: string }>;
  rates: Record<string, Rate>;
  checks: Check[];
  gaps: Gap[];
};

import { data } from "../data";
import type { Txt } from "./types";

/** Delivery address of the active project: its own site, as the drawings name it. */
export function siteAddress(): Txt {
  const p = data.project;
  const en = [p?.nameEn, p?.placeEn].filter(Boolean).join(", ");
  const az = [p?.name, p?.place].filter(Boolean).join(", ");
  return { en: en || az, az: az || en };
}

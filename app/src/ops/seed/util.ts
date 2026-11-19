import { data } from "../../data";
import { RATE_AZ } from "../../lib/i18n";
import { useApp } from "../../lib/store";
import type { Txt } from "../types";

/** Deterministic PRNG. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const T = (en: string, az: string): Txt => ({ en, az });

export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Bilingual name of a BOQ rate line, from the active project. */
export function rateName(key: string): Txt {
  const r = data.rates[key];
  const item = data.items.find((i) => i.rate === key);
  return { en: r?.en ?? item?.en ?? key, az: RATE_AZ[key] ?? item?.az ?? r?.en ?? key };
}

/** Rate of a BOQ line as the bill prices it: the user's own rate if set, else the project's rate. */
export function rateFor(key: string): number {
  return useApp.getState().rates[key] ?? data.rates[key]?.rate ?? 0;
}

/** Works value of each building × BOQ section (quantity × bill rate) of the active project. */
export function sectionValueMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of data.items ?? []) {
    const k = `${it.building}/${it.section}`;
    map.set(k, (map.get(k) ?? 0) + rateFor(it.rate) * it.qty);
  }
  return map;
}

/** Total measured quantity per rate key of the active project. */
export function qtyByRateMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const it of data.items ?? []) map.set(it.rate, (map.get(it.rate) ?? 0) + it.qty);
  return map;
}

export const pad = (n: number, w = 4) => String(n).padStart(w, "0");

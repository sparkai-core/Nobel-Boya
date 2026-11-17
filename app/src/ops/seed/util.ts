import { data } from "../../data";
import { RATE_AZ } from "../../lib/i18n";
import type { Txt } from "../types";

/** Deterministic PRNG so the seed is identical on every reset. */
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

const itemAzByRate = new Map<string, string>();
for (const it of data.items) if (!itemAzByRate.has(it.rate)) itemAzByRate.set(it.rate, it.az);

/** Bilingual name of a BOQ rate line. */
export function rateName(key: string): Txt {
  const r = data.rates[key];
  return { en: r?.en ?? key, az: RATE_AZ[key] ?? itemAzByRate.get(key) ?? r?.en ?? key };
}

/** Sample works value of one building × BOQ section (qty × sample rate). */
export const sectionValue = (() => {
  const map = new Map<string, number>();
  for (const it of data.items) {
    const r = data.rates[it.rate];
    const k = `${it.building}/${it.section}`;
    map.set(k, (map.get(k) ?? 0) + (r ? r.rate * it.qty : 0));
  }
  return map;
})();

/** Total measured quantity per rate key. */
export const qtyByRate = (() => {
  const map = new Map<string, number>();
  for (const it of data.items) map.set(it.rate, (map.get(it.rate) ?? 0) + it.qty);
  return map;
})();

/** Highest-value BOQ items of one building × section, used to build realistic request lines. */
export function topItems(building: string, section: string, n: number) {
  return data.items
    .filter((i) => i.building === building && i.section === section)
    .map((i) => ({ item: i, value: (data.rates[i.rate]?.rate ?? 0) * i.qty }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
    .map((x) => x.item);
}

export const pad = (n: number, w = 4) => String(n).padStart(w, "0");

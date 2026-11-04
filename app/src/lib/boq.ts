import { useMemo } from "react";
import { data } from "../data";
import type { Check, Item, Method } from "../data/types";
import { useApp, type Markups } from "./store";

export type Line = {
  id: string;
  code: string;
  building: string;
  section: string;
  az: string;
  en: string;
  unit: string;
  qty: number;
  printedQty: number;
  rateKey: string;
  rate: number;
  sampleRate: number;
  amount: number;
  items: Item[];
  method: Method;
  adjusted: "override" | "fix" | null;
  checks: Check[];
};

export type SectionBlock = { id: string; code: string; az: string; en: string; lines: Line[]; total: number };
export type BuildingBlock = { id: string; code: string; az: string; en: string; short: string; sections: SectionBlock[]; total: number };

export type ChainStep = { key: string; label: string; rate: number | null; base: number; amount: number; running: number };

export type Boq = {
  buildings: BuildingBlock[];
  lines: Line[];
  lineByItem: Map<string, Line>;
  works: number;
  chain: ChainStep[];
  total: number;
  methodValue: Record<Method, number>;
  methodCount: Record<Method, number>;
};

export const checksByItem = (() => {
  const map = new Map<string, Check[]>();
  for (const c of data.checks) for (const id of c.items) map.set(id, [...(map.get(id) ?? []), c]);
  return map;
})();

const sectionOrder = new Map(data.sections.map((s, i) => [s.id, i]));

export function effectiveQty(item: Item, qty: Record<string, { qty: number }>, fixes: Record<string, boolean>) {
  if (qty[item.id]) return { value: qty[item.id]!.qty, adjusted: "override" as const };
  for (const c of checksByItem.get(item.id) ?? []) {
    if (c.fix && c.fix.item === item.id && fixes[c.id]) return { value: c.fix.qty, adjusted: "fix" as const };
  }
  return { value: item.qty, adjusted: null };
}

export function buildBoq(rates: Record<string, number>, markups: Markups, qty: Record<string, { qty: number }>, fixes: Record<string, boolean>): Boq {
  const buildings: BuildingBlock[] = [];
  const lines: Line[] = [];
  const lineByItem = new Map<string, Line>();
  const methodValue: Record<Method, number> = { schedule: 0, image: 0, derived: 0 };
  const methodCount: Record<Method, number> = { schedule: 0, image: 0, derived: 0 };

  data.buildings.forEach((b) => {
    const bItems = data.items.filter((i) => i.building === b.id);
    const bySection = new Map<string, Item[]>();
    for (const it of bItems) bySection.set(it.section, [...(bySection.get(it.section) ?? []), it]);
    const secIds = [...bySection.keys()].sort((a, z) => (sectionOrder.get(a) ?? 0) - (sectionOrder.get(z) ?? 0));
    const bCode = String(buildings.length + 1);
    const sections: SectionBlock[] = [];
    secIds.forEach((sid, si) => {
      const sec = data.sections.find((s) => s.id === sid)!;
      const sCode = `${bCode}.${si + 1}`;
      const groups: Item[][] = [];
      const seen = new Map<string, Item[]>();
      for (const it of bySection.get(sid)!) {
        if (it.line) {
          const g = seen.get(it.line);
          if (g) g.push(it);
          else {
            const ng = [it];
            seen.set(it.line, ng);
            groups.push(ng);
          }
        } else groups.push([it]);
      }
      const secLines = groups.map((group, li) => {
        const first = group[0]!;
        const desc = first.line ? data.lineGroups[first.line]! : { az: first.az, en: first.en };
        let q = 0;
        let printed = 0;
        let adjusted: Line["adjusted"] = null;
        for (const it of group) {
          const e = effectiveQty(it, qty, fixes);
          q += e.value;
          printed += it.qty;
          if (e.adjusted) adjusted = adjusted === "override" ? "override" : e.adjusted;
        }
        const rateKey = first.rate;
        const sample = data.rates[rateKey]?.rate ?? 0;
        const rate = rates[rateKey] ?? sample;
        const methods = new Set(group.map((g) => g.method));
        const method: Method = methods.size === 1 ? first.method : methods.has("image") ? "image" : "derived";
        const line: Line = {
          id: first.line ?? first.id,
          code: `${sCode}.${li + 1}`,
          building: b.id,
          section: sid,
          az: desc.az,
          en: desc.en,
          unit: first.unit,
          qty: round(q, 3),
          printedQty: round(printed, 3),
          rateKey,
          rate,
          sampleRate: sample,
          amount: round(q * rate, 2),
          items: group,
          method,
          adjusted,
          checks: [...new Set(group.flatMap((g) => checksByItem.get(g.id) ?? []))],
        };
        for (const it of group) lineByItem.set(it.id, line);
        methodValue[method] += line.amount;
        methodCount[method] += 1;
        lines.push(line);
        return line;
      });
      sections.push({ id: sid, code: sCode, az: sec.az, en: sec.en, lines: secLines, total: sum(secLines.map((l) => l.amount)) });
    });
    buildings.push({ id: b.id, code: bCode, az: b.az, en: b.en, short: b.short, sections, total: sum(sections.map((s) => s.total)) });
  });

  const works = sum(buildings.map((b) => b.total));
  const chain: ChainStep[] = [];
  let running = works;
  chain.push({ key: "works", label: "Measured works", rate: null, base: works, amount: works, running });
  const step = (key: string, label: string, r: number) => {
    const amount = round(running * r, 2);
    const base = running;
    running = round(running + amount, 2);
    chain.push({ key, label, rate: r, base, amount, running });
  };
  step("overheads", "Overheads", markups.overheads);
  step("profit", "Profit", markups.profit);
  step("contingency", "Contingency", markups.contingency);
  step("vat", "VAT", markups.vat);

  return { buildings, lines, lineByItem, works, chain, total: running, methodValue, methodCount };
}

export function useBoq() {
  const rates = useApp((s) => s.rates);
  const markups = useApp((s) => s.markups);
  const qty = useApp((s) => s.qty);
  const fixes = useApp((s) => s.fixes);
  return useMemo(() => buildBoq(rates, markups, qty, fixes), [rates, markups, qty, fixes]);
}

function sum(v: number[]) {
  return round(v.reduce((a, b) => a + b, 0), 2);
}

function round(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

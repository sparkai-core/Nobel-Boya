import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Markups = { overheads: number; profit: number; contingency: number; vat: number };

export const DEFAULT_MARKUPS: Markups = { overheads: 0.08, profit: 0.06, contingency: 0.05, vat: 0.18 };

export type User = {
  name: string;
  email: string;
  role: string;
  organization: string;
};

export const DEMO_USER: User = {
  name: "Elmir Məmmədov",
  email: "e.mammadov@stormbuilding.az",
  role: "Lead Quantity Surveyor",
  organization: "Storm Building MMC",
};

export type QtyOverride = { qty: number; reason: string };

export type DimensionSpec = {
  length?: number;
  width?: number;
  height?: number;
  count?: number;
  unit?: string;
  note?: string;
};

type State = {
  user: User | null;
  lang: "az" | "en";
  generated: boolean;
  rates: Record<string, number>;
  markups: Markups;
  qty: Record<string, QtyOverride>;
  fixes: Record<string, boolean>;
  approved: Record<string, boolean>;
  dimensions: Record<string, DimensionSpec>;
  showSettings: boolean;
  showShortcuts: boolean;

  login: (user?: User) => void;
  logout: () => void;
  setLang: (l: "az" | "en") => void;
  setGenerated: (v: boolean) => void;
  setRate: (key: string, value: number | null) => void;
  setMarkup: (key: keyof Markups, value: number) => void;
  setQty: (itemId: string, value: QtyOverride | null) => void;
  setFix: (checkId: string, on: boolean) => void;
  toggleApprove: (itemId: string) => void;
  setDimensions: (itemId: string, spec: DimensionSpec | null) => void;
  resetPricing: () => void;
  setShowSettings: (v: boolean) => void;
  setShowShortcuts: (v: boolean) => void;
};

export const useApp = create<State>()(
  persist(
    (set) => ({
      user: DEMO_USER,
      lang: "en",
      generated: true,
      rates: {},
      markups: DEFAULT_MARKUPS,
      qty: {},
      fixes: {},
      approved: {},
      dimensions: {},
      showSettings: false,
      showShortcuts: false,

      login: (u) => set({ user: u ?? DEMO_USER, generated: true }),
      logout: () => set({ user: null }),
      setLang: (lang) => set({ lang }),
      setGenerated: (generated) => set({ generated }),
      setRate: (key, value) =>
        set((s) => {
          const rates = { ...s.rates };
          if (value == null) delete rates[key];
          else rates[key] = value;
          return { rates };
        }),
      setMarkup: (key, value) => set((s) => ({ markups: { ...s.markups, [key]: value } })),
      setQty: (itemId, value) =>
        set((s) => {
          const qty = { ...s.qty };
          if (value == null) delete qty[itemId];
          else qty[itemId] = value;
          return { qty };
        }),
      setFix: (checkId, on) => set((s) => ({ fixes: { ...s.fixes, [checkId]: on } })),
      toggleApprove: (itemId) =>
        set((s) => ({
          approved: { ...s.approved, [itemId]: !s.approved[itemId] },
        })),
      setDimensions: (itemId, spec) =>
        set((s) => {
          const dimensions = { ...s.dimensions };
          if (spec == null) delete dimensions[itemId];
          else dimensions[itemId] = spec;
          return { dimensions };
        }),
      resetPricing: () => set({ rates: {}, markups: DEFAULT_MARKUPS }),
      setShowSettings: (showSettings) => set({ showSettings }),
      setShowShortcuts: (showShortcuts) => set({ showShortcuts }),
    }),
    { name: "storm.boq.v1" },
  ),
);

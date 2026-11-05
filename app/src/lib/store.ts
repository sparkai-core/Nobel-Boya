import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Markups = { overheads: number; profit: number; contingency: number; vat: number };

export const DEFAULT_MARKUPS: Markups = { overheads: 0.08, profit: 0.06, contingency: 0.05, vat: 0.18 };

type QtyOverride = { qty: number; reason: string };

type State = {
  lang: "az" | "en";
  user: string | null;
  generated: boolean;
  rates: Record<string, number>;
  markups: Markups;
  qty: Record<string, QtyOverride>;
  fixes: Record<string, boolean>;
  setLang: (l: "az" | "en") => void;
  signIn: (email: string) => void;
  signOut: () => void;
  setGenerated: (v: boolean) => void;
  setRate: (key: string, value: number | null) => void;
  setMarkup: (key: keyof Markups, value: number) => void;
  setQty: (itemId: string, value: QtyOverride | null) => void;
  setFix: (checkId: string, on: boolean) => void;
  resetPricing: () => void;
};

export const useApp = create<State>()(
  persist(
    (set) => ({
      lang: "en",
      user: null,
      generated: false,
      rates: {},
      markups: DEFAULT_MARKUPS,
      qty: {},
      fixes: {},
      setLang: (lang) => set({ lang }),
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
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
      resetPricing: () => set({ rates: {}, markups: DEFAULT_MARKUPS }),
    }),
    { name: "nobel.boq.v1" },
  ),
);

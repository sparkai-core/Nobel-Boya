import { create } from "zustand";
import { persist } from "zustand/middleware";
import { data, setActiveDataset } from "../data";
import rawQobu from "../data/qobu.json";

export type Markups = { overheads: number; profit: number; contingency: number; vat: number };

export const DEFAULT_MARKUPS: Markups = { overheads: 0.08, profit: 0.06, contingency: 0.05, vat: 0.18 };

type QtyOverride = { qty: number; reason: string };

type State = {
  lang: "az" | "en";
  user: string | null;
  userEmail: string;
  activeProjectId: string;
  activeProjectTitle: string;
  projectRev: number;
  generated: boolean;
  rates: Record<string, number>;
  markups: Markups;
  qty: Record<string, QtyOverride>;
  fixes: Record<string, boolean>;
  setLang: (l: "az" | "en") => void;
  signIn: (email: string) => void;
  signOut: () => void;
  setActiveProject: (id: string, dataset?: any) => void;
  bumpProjectRev: () => void;
  setGenerated: (v: boolean) => void;
  setRate: (key: string, value: number | null) => void;
  setFullRates: (rates: Record<string, number>) => void;
  addRateItem: (key: string, item: any) => void;
  setMarkup: (key: keyof Markups, value: number) => void;
  setQty: (itemId: string, value: QtyOverride | null) => void;
  setFix: (checkId: string, on: boolean) => void;
  resetPricing: () => void;
};

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      lang: "en",
      user: "Elmir Məmmədov",
      userEmail: "elmir@stormtakeoff.com",
      activeProjectId: "proj_qobu",
      activeProjectTitle: "Qobu Logistics Center",
      projectRev: 0,
      generated: true,
      rates: {},
      markups: DEFAULT_MARKUPS,
      qty: {},
      fixes: {},
      setLang: (lang) => set({ lang }),
      signIn: (email) => {
        const norm = email.trim().toLowerCase();
        const name = norm.includes("@")
          ? norm.split("@")[0]!.replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : norm;
        const current = get().userEmail;
        if (current !== norm) {
          // Switch user workspace
          const isLead = norm === "elmir@stormtakeoff.com" || norm === "demo@nobel.az" || norm === "elmir@nobel.az";
          set({
            user: isLead ? "Elmir Məmmədov" : name,
            userEmail: norm,
            activeProjectId: isLead ? "proj_qobu" : "",
            rates: {},
            qty: {},
            fixes: {},
            projectRev: get().projectRev + 1,
          });
          if (isLead) {
            setActiveDataset(rawQobu as any);
          }
        } else {
          set({ user: name, userEmail: norm });
        }
      },
      signOut: () =>
        set({
          user: null,
          userEmail: "",
          activeProjectId: "",
          rates: {},
          qty: {},
          fixes: {},
          projectRev: get().projectRev + 1,
        }),
      setActiveProject: (activeProjectId, dataset) => {
        if (dataset) {
          setActiveDataset(dataset);
          set((s) => ({
            activeProjectId,
            activeProjectTitle: dataset.project?.name || activeProjectId,
            projectRev: s.projectRev + 1,
            rates: {},
            qty: {},
            fixes: {},
          }));
        } else if (activeProjectId === "proj_qobu" || activeProjectId === "qobu") {
          setActiveDataset(rawQobu as any);
          set((s) => ({
            activeProjectId: "proj_qobu",
            activeProjectTitle: "Qobu Logistics Center",
            projectRev: s.projectRev + 1,
            rates: {},
            qty: {},
            fixes: {},
          }));
        } else {
          set((s) => ({ activeProjectId, projectRev: s.projectRev + 1 }));
        }
      },
      bumpProjectRev: () => set((s) => ({ projectRev: s.projectRev + 1 })),
      setGenerated: (generated) => set({ generated }),
      setRate: (key, value) =>
        set((s) => {
          const rates = { ...s.rates };
          if (value == null) delete rates[key];
          else rates[key] = value;
          return { rates };
        }),
      setFullRates: (newRates) =>
        set((s) => ({
          rates: { ...s.rates, ...newRates },
          projectRev: s.projectRev + 1,
        })),
      addRateItem: (key, item) => {
        if (!data.rates) (data as any).rates = {};
        data.rates[key] = item;
        set((s) => ({
          rates: { ...s.rates, [key]: item.rate },
          projectRev: s.projectRev + 1,
        }));
      },
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

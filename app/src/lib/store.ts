import { create } from "zustand";
import { persist } from "zustand/middleware";
import { data, setActiveDataset } from "../data";

export type Markups = { overheads: number; profit: number; contingency: number; vat: number };

export const DEFAULT_MARKUPS: Markups = { overheads: 0.08, profit: 0.06, contingency: 0.05, vat: 0.18 };

type QtyOverride = { qty: number; reason: string };

export type Session = {
  token: string;
  expires_at: number;
  user: { id: string; email: string; name: string; role: string };
};

type State = {
  lang: "az" | "en";
  user: string | null;
  userEmail: string;
  token: string | null;
  tokenExpires: number;
  activeProjectId: string;
  activeProjectTitle: string;
  projectRev: number;
  generated: boolean;
  rates: Record<string, number>;
  markups: Markups;
  qty: Record<string, QtyOverride>;
  fixes: Record<string, boolean>;
  setLang: (l: "az" | "en") => void;
  signIn: (session: Session) => void;
  signOut: () => void;
  setActiveProject: (id: string, dataset?: any) => void;
  bumpProjectRev: () => void;
  setGenerated: (v: boolean) => void;
  setRate: (key: string, value: number | null) => void;
  setFullRates: (rates: Record<string, number>) => void;
  addRateItem: (key: string, item: any) => void;
  mergeServerRates: (rates: Record<string, any>) => void;
  setMarkup: (key: keyof Markups, value: number) => void;
  setQty: (itemId: string, value: QtyOverride | null) => void;
  setFix: (checkId: string, on: boolean) => void;
  resetPricing: () => void;
};

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      lang: "en",
      user: null,
      userEmail: "",
      token: null,
      tokenExpires: 0,
      activeProjectId: "",
      activeProjectTitle: "",
      projectRev: 0,
      generated: true,
      rates: {},
      markups: DEFAULT_MARKUPS,
      qty: {},
      fixes: {},
      setLang: (lang) => set({ lang }),
      signIn: (session) => {
        const email = session.user.email.toLowerCase();
        const sameUser = get().userEmail === email;
        set((s) => ({
          user: session.user.name || email,
          userEmail: email,
          token: session.token,
          tokenExpires: session.expires_at,
          // a different account never inherits the previous account's open project or edits
          ...(sameUser ? {} : { activeProjectId: "", activeProjectTitle: "", rates: {}, qty: {}, fixes: {} }),
          projectRev: s.projectRev + 1,
        }));
      },
      signOut: () =>
        set({
          user: null,
          userEmail: "",
          token: null,
          tokenExpires: 0,
          activeProjectId: "",
          activeProjectTitle: "",
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
      mergeServerRates: (serverRates) => {
        // the server copy is the saved library; replace it and drop local overrides for the same keys
        (data as any).rates = { ...(data.rates || {}), ...serverRates };
        set((s) => {
          const rates = { ...s.rates };
          for (const k of Object.keys(serverRates)) delete rates[k];
          return { rates, projectRev: s.projectRev + 1 };
        });
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
    { name: "nobel.boq.v2" },
  ),
);

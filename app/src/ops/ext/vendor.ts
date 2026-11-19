import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useOps } from "../store";
import { nowStamp } from "../dates";
import type { Txt } from "../types";

/**
 * Vendor compliance documents: only what the vendor (in the portal) or the buyer actually added.
 * Each record keeps the type, the reference printed on it, its expiry date and the file name for
 * reference (the file itself is not stored). Kept in this browser and shared by all projects, like vendors.
 */

export type DocType = "licence" | "vat" | "insurance" | "iso" | "hse" | "other";

export const DOC_TYPES: { key: DocType; label: Txt }[] = [
  { key: "licence", label: { en: "Trade licence", az: "Ticarət lisenziyası" } },
  { key: "vat", label: { en: "VAT registration certificate", az: "ƏDV qeydiyyat şəhadətnaməsi" } },
  { key: "insurance", label: { en: "Liability insurance", az: "Məsuliyyət sığortası" } },
  { key: "iso", label: { en: "Quality certificate (ISO 9001)", az: "Keyfiyyət sertifikatı (ISO 9001)" } },
  { key: "hse", label: { en: "HSE policy", az: "ƏMSE siyasəti" } },
  { key: "other", label: { en: "Other document", az: "Digər sənəd" } },
];

export type VendorDocRec = {
  id: string;
  vendorId: string;
  type: DocType;
  /** Name for an "other" document. */
  title: string;
  ref: string;
  expires: string | null;
  file: string;
  addedAt: string;
  addedBy: string;
};

type DocState = {
  docs: VendorDocRec[];
  add: (d: Omit<VendorDocRec, "id" | "addedAt">) => string;
  remove: (id: string) => void;
};

export const useVendorDocs = create<DocState>()(
  persist(
    (set, get) => ({
      docs: [],
      add: (d) => {
        const n = get().docs.reduce((m, x) => Math.max(m, Number(x.id.slice(4)) || 0), 0) + 1;
        const id = `DOC-${String(n).padStart(4, "0")}`;
        set({ docs: [{ ...d, id, addedAt: nowStamp() }, ...get().docs] });
        const s = useOps.getState();
        const name = s.vendors.find((v) => v.id === d.vendorId)?.name ?? d.vendorId;
        const label = d.type === "other" ? { en: d.title || "document", az: d.title || "sənəd" } : DOC_TYPES.find((x) => x.key === d.type)!.label;
        s.pushFeed("VENDOR", { en: `${name} added a document: ${label.en}${d.ref ? ` (${d.ref})` : ""}`, az: `${name} sənəd əlavə etdi: ${label.az}${d.ref ? ` (${d.ref})` : ""}` }, `procurement/vendors/${d.vendorId}`, d.addedBy);
        return id;
      },
      remove: (id) => set({ docs: get().docs.filter((x) => x.id !== id) }),
    }),
    { name: "nobel.ops.vendor-docs", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ docs: s.docs }) },
  ),
);

// The portal opens in another tab: keep the document list in step.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "nobel.ops.vendor-docs") void useVendorDocs.persist.rehydrate();
  });
}

export const docLabel = (d: Pick<VendorDocRec, "type" | "title">): Txt => (d.type === "other" && d.title ? { en: d.title, az: d.title } : (DOC_TYPES.find((x) => x.key === d.type)?.label ?? { en: d.type, az: d.type }));

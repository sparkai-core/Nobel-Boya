import { useOps, me } from "../store";
import { addDays, nowStamp, PROJECT_START, same, TODAY } from "../dates";
import { sectionValueMap } from "../seed/util";
import { data } from "../../data";
import type { Activity, ChangeOrder, FeedEvent, Ipc, OpsData, Party, PartyRole, Txt } from "../types";

/**
 * Store helpers for the PM commercial & site records pages (RFIs, changes, inspections, billing,
 * parties, subcontractors). Each one writes to the shared ops store immutably and, where useful,
 * pushes a feed event in the same shape the store uses.
 */

function feedPatch(s: OpsData, text: Txt, link: string | null, actor = me()): Pick<OpsData, "feed" | "seq"> {
  const n = (s.seq.F ?? 0) + 1;
  const ev: FeedEvent = { id: `F-${n}`, at: nowStamp(), module: "PM", text, link, actor };
  return { feed: [ev, ...s.feed].slice(0, 80), seq: { ...s.seq, F: n } };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

const monthEnd = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

/** Budget-weighted progress (0–1) of the activities on one building × BOQ section, or null when none. */
export function sectionProgress(activities: Activity[], building: string, section: string): number | null {
  const acts = activities.filter((a) => a.building === building && a.section === section);
  if (!acts.length) return null;
  const tot = acts.reduce((a, x) => a + x.budget, 0);
  const p = tot > 0 ? acts.reduce((a, x) => a + x.budget * x.pct, 0) / tot : acts.reduce((a, x) => a + x.pct, 0) / acts.length;
  return Math.max(0, Math.min(1, p / 100));
}

/** Every building × BOQ section of the active project that carries value, in the dataset's order. */
export function boqSections(): { building: string; section: string }[] {
  const values = sectionValueMap();
  const bOrder = new Map((data.buildings ?? []).map((b, i) => [b.id, i]));
  const sOrder = new Map((data.sections ?? []).map((s, i) => [s.id, i]));
  return [...values.entries()]
    .filter(([, v]) => v > 0)
    .map(([k]) => {
      const [building = "", section = ""] = k.split("/");
      return { building, section };
    })
    .sort((a, b) => (bOrder.get(a.building) ?? 99) - (bOrder.get(b.building) ?? 99) || (sOrder.get(a.section) ?? 99) - (sOrder.get(b.section) ?? 99));
}

/**
 * Opens the next interim payment certificate as a draft. The first one is built from the project's BOQ:
 * one line per building × section, measured from programme progress where activities exist, else 0 for
 * the user to enter. Later ones carry the last certificate's to-date values as "previous".
 * Retention starts at 5% and advance recovery at 0%; both are editable on the draft.
 * Returns the new id, or null when the latest certificate is still a draft.
 */
export function prepareNextIpc(): string | null {
  const s = useOps.getState();
  const last = [...s.ipcs].sort((a, b) => b.no - a.no)[0];
  if (last && last.status === "DRAFT") return null;
  const no = (last?.no ?? 0) + 1;
  const id = `IPC-${String(no).padStart(2, "0")}`;
  const from = last ? addDays(last.to, 1) : PROJECT_START < TODAY ? PROJECT_START : TODAY;
  const to = last ? monthEnd(from) : monthEnd(TODAY);
  const prev = new Map((last?.lines ?? []).map((l) => [`${l.building}/${l.section}`, l]));
  const lines: Ipc["lines"] = boqSections().map(({ building, section }) => {
    const before = prev.get(`${building}/${section}`);
    const pctPrev = before ? r3(before.pctToDate) : 0;
    const site = sectionProgress(s.activities, building, section);
    return { building, section, pctPrev, pctToDate: r3(Math.max(pctPrev, site ?? pctPrev)) };
  });
  // Keep any earlier line the BOQ no longer lists, so certified amounts do not vanish.
  for (const l of last?.lines ?? []) if (!lines.some((x) => x.building === l.building && x.section === l.section)) lines.push({ building: l.building, section: l.section, pctPrev: r3(l.pctToDate), pctToDate: r3(l.pctToDate) });
  const ipc: Ipc = {
    id,
    no,
    from,
    to: to < from ? monthEnd(from) : to,
    status: "DRAFT",
    submittedAt: null,
    certifiedAt: null,
    retention: last?.retention ?? 0.05,
    advanceRecovery: last?.advanceRecovery ?? 0,
    lines,
  };
  useOps.setState({ ipcs: [...s.ipcs, ipc], ...feedPatch(s, { en: `${id} opened as a draft`, az: `${id} qaralama kimi açıldı` }, `pm/billing/${id}`) });
  return id;
}

/** Changes the retention or advance-recovery share (0–1) of a draft certificate. */
export function setIpcTerms(id: string, patch: Partial<Pick<Ipc, "retention" | "advanceRecovery" | "from" | "to">>) {
  useOps.setState((s) => ({ ipcs: s.ipcs.map((i) => (i.id === id && i.status === "DRAFT" ? { ...i, ...patch } : i)) }));
}

/** Removes a draft certificate (only drafts can be removed). */
export function removeDraftIpc(id: string) {
  useOps.setState((s) => ({ ipcs: s.ipcs.filter((i) => !(i.id === id && i.status === "DRAFT")) }));
}

// ---------------------------------------------------------------- parties

const ROLE_EN: Record<PartyRole, string> = { OWNER: "client", CONSULTANT: "consultant", CONTRACTOR: "main contractor", SUBCONTRACTOR: "subcontractor", VENDOR: "vendor" };
const ROLE_AZ: Record<PartyRole, string> = { OWNER: "sifarişçi", CONSULTANT: "məsləhətçi", CONTRACTOR: "baş podratçı", SUBCONTRACTOR: "subpodratçı", VENDOR: "təchizatçı" };

/** Adds an organisation to the project. Returns its id (the existing one when the same name and role exist). */
export function addParty(role: PartyRole, name: string): string {
  const s = useOps.getState();
  const clean = name.trim();
  const existing = s.parties.find((p) => p.role === role && p.name.trim().toLowerCase() === clean.toLowerCase());
  if (existing) return existing.id;
  let n = s.parties.length + 1;
  while (s.parties.some((p) => p.id === `PT-${n}`)) n++;
  const party: Party = { id: `PT-${n}`, role, name: clean, people: [] };
  useOps.setState({ parties: [...s.parties, party], ...feedPatch(s, { en: `${clean} added as the ${ROLE_EN[role]}`, az: `${clean} ${ROLE_AZ[role]} kimi əlavə edildi` }, "pm/parties") });
  return party.id;
}

/** Renames an organisation. */
export function renameParty(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  useOps.setState((s) => ({ parties: s.parties.map((p) => (p.id === id ? { ...p, name: clean } : p)) }));
}

/** Removes an organisation with its people. Returns it so the page can offer an undo. */
export function removeParty(id: string): Party | null {
  const s = useOps.getState();
  const party = s.parties.find((p) => p.id === id) ?? null;
  if (!party) return null;
  useOps.setState({ parties: s.parties.filter((p) => p.id !== id) });
  return party;
}

/** Puts a removed organisation back. */
export function restoreParty(party: Party) {
  useOps.setState((s) => ({ parties: s.parties.some((p) => p.id === party.id) ? s.parties : [...s.parties, party] }));
}

export type NewPerson = Party["people"][number];

/**
 * Adds a person to a project party. A subcontractor or vendor that has no party record yet gets one under
 * its own name; a party with no name is never created.
 */
export function addPartyPerson(target: { id: string | null; role: Party["role"]; name: string }, person: { name: string; title: string; access: NewPerson["access"] }): boolean {
  const s = useOps.getState();
  const entry: NewPerson = { name: person.name, title: same(person.title), access: person.access };
  const existing = target.id ? s.parties.find((p) => p.id === target.id) : s.parties.find((p) => p.role === target.role && p.name === target.name);
  if (!existing && !target.name.trim()) return false;
  let parties: Party[];
  if (existing) parties = s.parties.map((p) => (p.id === existing.id ? { ...p, people: [...p.people.filter((x) => x.name !== entry.name), entry] } : p));
  else {
    let n = s.parties.length + 1;
    while (s.parties.some((p) => p.id === `PT-${n}`)) n++;
    parties = [...s.parties, { id: `PT-${n}`, role: target.role, name: target.name.trim(), people: [entry] }];
  }
  useOps.setState({ parties, ...feedPatch(s, { en: `${person.name} added to ${target.name}`, az: `${person.name} ${target.name} komandasına əlavə edildi` }, "pm/parties") });
  return true;
}

/** Removes a person from a party. Returns the removed entry so the page can offer an undo. */
export function removePartyPerson(partyId: string, name: string): NewPerson | null {
  const s = useOps.getState();
  const party = s.parties.find((p) => p.id === partyId);
  const person = party?.people.find((x) => x.name === name) ?? null;
  if (!party || !person) return null;
  useOps.setState({ parties: s.parties.map((p) => (p.id === partyId ? { ...p, people: p.people.filter((x) => x.name !== name) } : p)) });
  return person;
}

/** Puts a removed person back exactly as they were. */
export function restorePartyPerson(partyId: string, person: NewPerson) {
  useOps.setState((s) => ({ parties: s.parties.map((p) => (p.id === partyId ? { ...p, people: [...p.people.filter((x) => x.name !== person.name), person] } : p)) }));
}

/** Edits a change order while it is still a draft (lines, title, description, days). */
export function updateChange(id: string, patch: Partial<Pick<ChangeOrder, "title" | "description" | "daysDelta" | "lines">>) {
  useOps.setState((s) => ({ changes: s.changes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

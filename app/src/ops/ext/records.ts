import { useOps, ME } from "../store";
import { addDays, nowStamp, same, TODAY } from "../dates";
import type { ChangeOrder, FeedEvent, Ipc, OpsData, Party, Txt } from "../types";

/**
 * Store helpers for the PM commercial & site records pages (RFIs, changes, inspections, billing,
 * parties, subcontractors). Each one writes to the shared ops store immutably and, where useful,
 * pushes a feed event in the same shape the store uses.
 */

function feedPatch(s: OpsData, text: Txt, link: string | null, actor = ME): Pick<OpsData, "feed" | "seq"> {
  const n = (s.seq.F ?? 0) + 1;
  const ev: FeedEvent = { id: `F-${n}`, at: nowStamp(), module: "PM", text, link, actor };
  return { feed: [ev, ...s.feed].slice(0, 80), seq: { ...s.seq, F: n } };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Opens the next interim payment certificate as a draft. Its "previous" percentages are the last
 * certificate's to-date values, and the period runs for the month after the last one.
 * Returns the new id, or null when the latest certificate is still a draft.
 */
export function prepareNextIpc(): string | null {
  const s = useOps.getState();
  const last = [...s.ipcs].sort((a, b) => b.no - a.no)[0];
  if (last && last.status === "DRAFT") return null;
  const no = (last?.no ?? 0) + 1;
  const id = `IPC-${String(no).padStart(2, "0")}`;
  const from = last ? addDays(last.to, 1) : TODAY;
  const d = new Date(`${from}T00:00:00Z`);
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const ipc: Ipc = {
    id,
    no,
    from,
    to,
    status: "DRAFT",
    submittedAt: null,
    certifiedAt: null,
    retention: last?.retention ?? 0.05,
    advanceRecovery: last?.advanceRecovery ?? 0.1,
    lines: (last?.lines ?? []).map((l) => ({ building: l.building, section: l.section, pctPrev: r3(l.pctToDate), pctToDate: r3(l.pctToDate) })),
  };
  useOps.setState({ ipcs: [...s.ipcs, ipc], ...feedPatch(s, { en: `${id} opened as a draft`, az: `${id} qaralama kimi açıldı` }, `pm/billing/${id}`) });
  return id;
}

export type NewPerson = Party["people"][number];

/** Adds a person to a project party. The party is created first when the company has none yet. */
export function addPartyPerson(target: { id: string | null; role: Party["role"]; name: string }, person: { name: string; title: string; access: NewPerson["access"] }) {
  const s = useOps.getState();
  const entry: NewPerson = { name: person.name, title: same(person.title), access: person.access };
  const existing = target.id ? s.parties.find((p) => p.id === target.id) : s.parties.find((p) => p.role === target.role && p.name === target.name);
  const parties = existing
    ? s.parties.map((p) => (p.id === existing.id ? { ...p, people: [...p.people.filter((x) => x.name !== entry.name), entry] } : p))
    : [...s.parties, { id: `PT-X${s.parties.length + 1}`, role: target.role, name: target.name, people: [entry] }];
  useOps.setState({ parties, ...feedPatch(s, { en: `${person.name} added to ${target.name}`, az: `${person.name} ${target.name} komandasına əlavə edildi` }, "pm/parties") });
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

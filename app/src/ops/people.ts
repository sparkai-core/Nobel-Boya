import { useApp } from "../lib/store";

/** Name of the signed-in user; records created in the app are signed with it. */
export function me(): string {
  return useApp.getState().user || "—";
}

export type Role = "pm" | "planner" | "site" | "qs" | "buyer" | "store" | "finance" | "qa" | "director" | "client" | "engineer" | "architect";

/**
 * The app has no team directory, so every role resolves to the signed-in user.
 * Read it at the moment a record is made, never in a module-level constant.
 */
export const PEOPLE = new Proxy({} as Record<Role, string>, { get: () => me() });

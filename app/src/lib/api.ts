/** Client for the Nobel BOQ backend. Every project call carries the signed session token.
 *
 * Static hosts (Vercel, Netlify) can serve the app without the Python server. In that case
 * the demo account opens a read-only demo of the bundled sample project; anything that needs
 * the server (uploads, saving rates, comparisons) says so instead of failing silently.
 */
import raw from "../data/qobu.json";
import { useApp, type Session } from "./store";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, "")}/api`
  : "/api";

export const DEMO_EMAIL = "demo@nobel.az";
export const DEMO_PASSWORD = "demo";
export const DEMO_TOKEN = "demo-without-server";
const DEMO_PROJECT_ID = "proj_qobu";

/**
 * Accounts that also work on a static deployment with no server (Vercel). They open the bundled
 * sample project in the browser only; this is not real security, the server holds the real accounts.
 */
type StaticAccount = { id: string; email: string; password: string; name: string; role: string };
const STATIC_ACCOUNTS: StaticAccount[] = [
  { id: "demo", email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo User", role: "Quantity Surveyor" },
  { id: "boya", email: "boya@nobel.az", password: "Boya-A6hAtMPAF9", name: "Boya", role: "Project Manager" },
];

/** Thrown when no API answers: the site is deployed without its server. */
export class NoServerError extends Error {
  constructor() {
    super("This site is running without its server, so sign-in and uploads are not available here.");
    this.name = "NoServerError";
  }
}

export function isDemoWithoutServer() {
  return useApp.getState().token === DEMO_TOKEN;
}

function needsServer(): never {
  throw new Error("This is the demo without a server. Uploading files, saving rates and comparing bills need the Nobel BOQ server.");
}

function getHeaders(isFormData = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = useApp.getState().token;
  if (token && token !== DEMO_TOKEN) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";
  return headers;
}

async function request(path: string, init: RequestInit = {}, fallbackError = "Request failed") {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new NoServerError();
  }
  // A static host answers /api with 404/405, or with the app's own index.html
  const isHtml = (res.headers.get("content-type") || "").includes("text/html");
  if (res.status === 404 && isHtml) throw new NoServerError();
  if (res.status === 405 || (res.ok && isHtml)) throw new NoServerError();
  if (res.status === 404 && path.startsWith("/auth/")) throw new NoServerError();
  // A dev proxy with no server behind it answers 5xx with no JSON body.
  if (res.status >= 500 && !(res.headers.get("content-type") || "").includes("application/json")) throw new NoServerError();

  if (res.status === 401 && !path.startsWith("/auth/")) {
    // expired or invalid session: drop it and send the user to the sign-in page
    useApp.getState().signOut();
    if (!location.hash.includes("/login") && !location.pathname.endsWith("/login")) {
      location.assign(location.hash ? "#/login" : "/login");
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: fallbackError }));
    throw new Error(typeof err.detail === "string" ? err.detail : fallbackError);
  }
  return res.json();
}

function demoSession(acc: StaticAccount): Session {
  return {
    token: DEMO_TOKEN,
    expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    user: { id: acc.id, email: acc.email, name: acc.name, role: acc.role },
  };
}

export async function login(email: string, password: string): Promise<Session> {
  try {
    return await request("/auth/login", { method: "POST", headers: getHeaders(), body: JSON.stringify({ email, password }) }, "Sign-in failed");
  } catch (err) {
    if (err instanceof NoServerError) {
      const acc = STATIC_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase() && a.password === password);
      if (acc) return demoSession(acc);
      throw new Error("The email or password is not correct.");
    }
    throw err;
  }
}

export async function register(email: string, password: string, name: string): Promise<Session> {
  try {
    return await request("/auth/register", { method: "POST", headers: getHeaders(), body: JSON.stringify({ email, password, name }) }, "Could not create the account");
  } catch (err) {
    if (err instanceof NoServerError) throw new Error("Accounts need the Nobel BOQ server, which this site is running without.");
    throw err;
  }
}

const demoData = raw as any;

export async function fetchProjects() {
  if (isDemoWithoutServer()) {
    const p = demoData.project || {};
    return {
      projects: [{
        id: DEMO_PROJECT_ID,
        code: "qobu",
        title: p.name || "Qobu",
        client: p.client || "",
        designer: p.designer || "",
        place: p.place || "",
        created_at: "",
        cover_images: (demoData.sheets || []).slice(0, 4).map((s: any) => s.id),
        sheets_count: (demoData.sheets || []).length,
        documents_count: (demoData.documents || []).length,
        documents: demoData.documents || [],
      }],
    };
  }
  return request("/projects", { headers: getHeaders() }, "Failed to load projects");
}

export async function fetchProject(projectId: string) {
  if (isDemoWithoutServer()) {
    if (projectId !== DEMO_PROJECT_ID) throw new Error("Project not found.");
    return { id: DEMO_PROJECT_ID, data: demoData };
  }
  return request(`/projects/${encodeURIComponent(projectId)}`, { headers: getHeaders() }, "Failed to load project details");
}

export function createProject(formData: FormData) {
  if (isDemoWithoutServer()) needsServer();
  return request("/projects", { method: "POST", headers: getHeaders(true), body: formData }, "Project creation failed");
}

export function uploadRates(projectId: string, file: File) {
  if (isDemoWithoutServer()) needsServer();
  const fd = new FormData();
  fd.append("rates_file", file);
  return request(`/projects/${encodeURIComponent(projectId)}/rates`, { method: "POST", headers: getHeaders(true), body: fd }, "Failed to upload rates");
}

export async function updateManualRate(
  projectId: string,
  rateData: { key?: string; rate: number; unit?: string; en?: string; az?: string; group?: string },
) {
  if (isDemoWithoutServer()) {
    // demo: the change applies in this browser only
    const key = rateData.key || (rateData.en || "rate").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "rate";
    const existing = (demoData.rates || {})[key] || {};
    const rate = { ...existing, ...rateData, unit: rateData.unit || existing.unit || "m³", group: rateData.group || existing.group || "Custom rates" };
    return { success: true, key, rate, all_rates: {} };
  }
  return request(`/projects/${encodeURIComponent(projectId)}/rates/manual`, { method: "POST", headers: getHeaders(), body: JSON.stringify(rateData) }, "Failed to update rate");
}

export function compareBoq(projectId: string, file: File) {
  if (isDemoWithoutServer()) needsServer();
  const fd = new FormData();
  fd.append("boq_file", file);
  return request(`/projects/${encodeURIComponent(projectId)}/compare`, { method: "POST", headers: getHeaders(true), body: fd }, "Failed to compare BOQ");
}

export async function fetchComparison(projectId: string) {
  if (isDemoWithoutServer()) return { has_comparison: false, summary: null, lines: [] };
  try {
    return await request(`/projects/${encodeURIComponent(projectId)}/comparison`, { headers: getHeaders() });
  } catch {
    return { has_comparison: false, summary: null, lines: [] };
  }
}

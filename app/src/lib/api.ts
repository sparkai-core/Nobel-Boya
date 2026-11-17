/** Client for the Nobel BOQ backend. Every project call carries the signed session token. */
import { useApp, type Session } from "./store";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, "")}/api`
  : "/api";

function getHeaders(isFormData = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = useApp.getState().token;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";
  return headers;
}

async function request(path: string, init: RequestInit = {}, fallbackError = "Request failed") {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error("The server cannot be reached. Check your connection and try again.");
  }
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

export function login(email: string, password: string): Promise<Session> {
  return request("/auth/login", { method: "POST", headers: getHeaders(), body: JSON.stringify({ email, password }) }, "Sign-in failed");
}

export function register(email: string, password: string, name: string): Promise<Session> {
  return request("/auth/register", { method: "POST", headers: getHeaders(), body: JSON.stringify({ email, password, name }) }, "Could not create the account");
}

export function fetchProjects() {
  return request("/projects", { headers: getHeaders() }, "Failed to load projects");
}

export function fetchProject(projectId: string) {
  return request(`/projects/${encodeURIComponent(projectId)}`, { headers: getHeaders() }, "Failed to load project details");
}

export function createProject(formData: FormData) {
  return request("/projects", { method: "POST", headers: getHeaders(true), body: formData }, "Project creation failed");
}

export function uploadRates(projectId: string, file: File) {
  const fd = new FormData();
  fd.append("rates_file", file);
  return request(`/projects/${encodeURIComponent(projectId)}/rates`, { method: "POST", headers: getHeaders(true), body: fd }, "Failed to upload rates");
}

export function updateManualRate(
  projectId: string,
  rateData: { key?: string; rate: number; unit?: string; en?: string; az?: string; group?: string },
) {
  return request(`/projects/${encodeURIComponent(projectId)}/rates/manual`, { method: "POST", headers: getHeaders(), body: JSON.stringify(rateData) }, "Failed to update rate");
}

export function compareBoq(projectId: string, file: File) {
  const fd = new FormData();
  fd.append("boq_file", file);
  return request(`/projects/${encodeURIComponent(projectId)}/compare`, { method: "POST", headers: getHeaders(true), body: fd }, "Failed to compare BOQ");
}

export async function fetchComparison(projectId: string) {
  try {
    return await request(`/projects/${encodeURIComponent(projectId)}/comparison`, { headers: getHeaders() });
  } catch {
    return { has_comparison: false, summary: null, lines: [] };
  }
}

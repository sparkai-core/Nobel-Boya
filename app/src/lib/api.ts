/** Client API for Storm Takeoff backend. */
import { useApp } from "./store";

const API_BASE = "/api";

function getHeaders(isFormData = false): Record<string, string> {
  const email = useApp.getState().userEmail || "elmir@stormtakeoff.com";
  const headers: Record<string, string> = {
    "X-User-Email": email,
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export async function fetchProjects() {
  const res = await fetch(`${API_BASE}/projects`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

export async function fetchProject(projectId: string) {
  const res = await fetch(`${API_BASE}/projects/${projectId}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load project details");
  return res.json();
}

export async function createProject(formData: FormData) {
  const res = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: getHeaders(true),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Project creation failed" }));
    throw new Error(err.detail || "Project creation failed");
  }
  return res.json();
}

export async function uploadRates(projectId: string, file: File) {
  const fd = new FormData();
  fd.append("rates_file", file);
  const res = await fetch(`${API_BASE}/projects/${projectId}/rates`, {
    method: "POST",
    headers: getHeaders(true),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to upload rates" }));
    throw new Error(err.detail || "Failed to upload rates");
  }
  return res.json();
}

export async function compareBoq(projectId: string, file: File) {
  const fd = new FormData();
  fd.append("boq_file", file);
  const res = await fetch(`${API_BASE}/projects/${projectId}/compare`, {
    method: "POST",
    headers: getHeaders(true),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to compare BOQ" }));
    throw new Error(err.detail || "Failed to compare BOQ");
  }
  return res.json();
}

export async function fetchComparison(projectId: string) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/comparison`, {
    headers: getHeaders(),
  });
  if (!res.ok) return { has_comparison: false, summary: null, lines: [] };
  return res.json();
}

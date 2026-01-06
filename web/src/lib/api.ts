import { authHeaders, getToken, clearToken } from "./auth";

export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:10000";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers: HeadersInit = {
    ...authHeaders(),
    ...(init.headers || {}),
  };

  const r = await fetch(`${API}${path}`, { ...init, headers });
  if (r.status === 401) {
    // token invalid/expired
    clearToken();
  }
  return r;
}

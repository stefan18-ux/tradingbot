/**
 * Authenticated API client.
 *
 * Wraps fetch() and automatically attaches the Firebase ID token (JWT)
 * as a Bearer token in the Authorization header.
 */

import { auth } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/**
 * Get the current Firebase user's ID token (JWT).
 * Returns null if no user is logged in.
 */
export async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    // getIdToken(true) forces a refresh if the token is about to expire
    const token = await user.getIdToken(/* forceRefresh */ false);
    return token;
  } catch (err) {
    console.error("[API] Failed to get auth token:", err);
    return null;
  }
}

/**
 * Authenticated fetch wrapper.
 *
 * Usage:
 *   const res = await apiFetch("/api/users/1");
 *   const data = await res.json();
 *
 *   const res = await apiFetch("/api/sessions", {
 *     method: "POST",
 *     body: JSON.stringify({ user_id: 1 }),
 *   });
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

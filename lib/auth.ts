const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// Module-level token store — updated by AuthContext so controllers can read it
// without needing React hooks.
let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

/**
 * Calls the backend refresh endpoint (browser sends httpOnly refresh_token cookie
 * automatically via credentials: "include").
 * Returns the new access token, or null if the session has expired.
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch — attaches Bearer token from in-memory store.
 * On 401 it attempts a silent token refresh and retries once.
 */
export async function authFetch(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<Response> {
  const doFetch = (token: string | null) =>
    fetch(input, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await doFetch(_accessToken);

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      setAccessToken(newToken);
      res = await doFetch(newToken);
    }
  }

  return res;
}


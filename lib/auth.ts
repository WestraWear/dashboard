const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// Module-level token store — updated by AuthContext so controllers can read it
// without needing React hooks.
let _accessToken: string | null = null;

// Called by AuthContext whenever a new token is set (login, mount, proactive refresh)
let _onTokenRefreshed: ((token: string | null) => void) | null = null;
export function setTokenRefreshedCallback(cb: (token: string | null) => void) {
  _onTokenRefreshed = cb;
}

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

/**
 * Decode the `exp` field from a JWT without verifying the signature.
 * Returns the expiry as a Date, or null if the token is malformed.
 */
export function decodeTokenExp(token: string): Date | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!decoded.exp) return null;
    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
}

/**
 * Promise-lock so concurrent 401 retries don't issue multiple refresh calls
 * and race against each other (refresh tokens rotate on use).
 */
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Calls the backend refresh endpoint (browser sends httpOnly refresh_token cookie
 * automatically via credentials: "include").
 * Returns the new access token, or null if the session has expired.
 * Concurrent callers share the same in-flight promise.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
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
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
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
      _onTokenRefreshed?.(newToken); // notify AuthContext to schedule next proactive refresh
      res = await doFetch(newToken);
    }
  }

  return res;
}

export interface MeResult {
  username: string;
  role: string;
}

/**
 * Calls /auth/me with the current in-memory access token.
 * Returns { username, role } or null if the token is invalid/missing.
 */
export async function getMe(): Promise<MeResult | null> {
  if (!_accessToken) return null;
  try {
    const res = await fetch(`${BACKEND}/auth/me`, {
      headers: { Authorization: `Bearer ${_accessToken}` },
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.username) return null;
    return { username: data.username, role: data.role ?? "administrator" };
  } catch {
    return null;
  }
}

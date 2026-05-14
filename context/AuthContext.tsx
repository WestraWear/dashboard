"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  setAccessToken,
  refreshAccessToken,
  getMe,
  decodeTokenExp,
  setTokenRefreshedCallback,
  type MeResult,
} from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface AuthContextValue {
  accessToken: string | null;
  username: string | null;
  role: string | null;
  /** true while the initial silent refresh is in-flight */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [accessToken, _setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Proactive refresh timer handle
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref to applyToken so scheduleRefresh's useCallback can call the latest version
  const applyTokenRef = useRef<(t: string | null) => void>(() => {});

  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const exp = decodeTokenExp(token);
    if (!exp) return;
    // Refresh 60 seconds before expiry
    const msUntilRefresh = exp.getTime() - Date.now() - 60_000;
    if (msUntilRefresh <= 0) return; // already near expiry — let authFetch handle it
    refreshTimerRef.current = setTimeout(async () => {
      const newToken = await refreshAccessToken();
      if (newToken) {
        applyTokenRef.current(newToken);
        scheduleRefresh(newToken);
      }
    }, msUntilRefresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyToken = (t: string | null) => {
    _setToken(t);
    setAccessToken(t);
    if (t) scheduleRefresh(t);
    else if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  };
  applyTokenRef.current = applyToken;

  // Let authFetch notify us when it silently refreshes on a 401
  useEffect(() => {
    setTokenRefreshedCallback((t) => {
      if (t) scheduleRefresh(t);
    });
    return () => setTokenRefreshedCallback(() => {});
  }, [scheduleRefresh]);

  // Clear proactive refresh timer on unmount
  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // On mount, try to silently restore session from the httpOnly refresh_token cookie
  useEffect(() => {
    refreshAccessToken().then(async (token) => {
      applyToken(token);
      if (token) {
        const me = await getMe();
        setUsername(me?.username ?? null);
        setRole(me?.role ?? null);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${BACKEND}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // receive httpOnly refresh_token cookie
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail ?? "Login failed");
    }

    const data = await res.json();
    applyToken(data.access_token);

    // Fetch username + role from /me
    const me = await getMe();
    setUsername(me?.username ?? null);
    setRole(me?.role ?? null);

    // Lightweight sentinel cookie so Next.js middleware can do redirects
    document.cookie = "is_authenticated=1; Path=/; SameSite=Strict; Max-Age=" + 60 * 60 * 24 * 7;
    router.replace("/");
  }, [router]);

  const logout = useCallback(async () => {
    await fetch(`${BACKEND}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    applyToken(null);
    setUsername(null);
    setRole(null);
    document.cookie = "is_authenticated=; Path=/; Max-Age=0; SameSite=Strict";
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ accessToken, username, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  setAccessToken,
  refreshAccessToken,
} from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

interface AuthContextValue {
  accessToken: string | null;
  /** true while the initial silent refresh is in-flight */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [accessToken, _setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = (t: string | null) => {
    _setToken(t);
    setAccessToken(t); // keep module-level var in sync for authFetch
  };

  // On mount, try to silently restore session from the httpOnly refresh_token cookie
  useEffect(() => {
    refreshAccessToken().then((token) => {
      applyToken(token);
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
    document.cookie = "is_authenticated=; Path=/; Max-Age=0; SameSite=Strict";
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ accessToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

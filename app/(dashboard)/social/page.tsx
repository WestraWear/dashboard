"use client";

/**
 * Social Media Integration page
 *
 * UX flow:
 *  1. User clicks "Connect with Facebook"
 *  2. Facebook JS SDK popup opens (no page leave)
 *  3. On success the short-lived token is sent to the backend which:
 *       a. exchanges it for a long-lived token
 *       b. fetches all managed Pages + linked IG accounts
 *       c. returns the list
 *  4. If there is only one Page → auto-connect immediately
 *     If multiple → show a Page picker card
 *  5. Done. Shows live preview with real content.
 *
 *  "Refresh Token" button re-exchanges the stored long-lived token to renew it.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const FB_APP_ID = process.env.NEXT_PUBLIC_FB_APP_ID ?? "";

// Permissions we need from Meta
const FB_SCOPE =
  "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish,business_management";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialStatus {
  connected: boolean;
  fb_page_id?: string;
  fb_page_name?: string;
  ig_account_id?: string;
  ig_username?: string;
  fb_user_token_expires_at?: string;
  last_synced?: string;
}

interface PageOption {
  page_id: string;
  page_name: string;
  page_access_token: string;
  ig_account_id?: string;
  ig_username?: string;
}

interface InstagramPost {
  id: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
}

interface FacebookLive {
  id: string;
  title?: string;
  status: string;
  planned_start_time?: string;
  permalink_url?: string;
  thumbnail_url?: string;
}

type ConnectStep =
  | "idle"           // not connected, nothing in-flight
  | "sdk-loading"    // injecting the FB SDK script
  | "sdk-login"      // FB.login() popup open
  | "exchanging"     // POSTing short-lived token to backend
  | "picking"        // showing page picker (multiple pages)
  | "connecting"     // POSTing page selection to backend
  | "done";          // connected ✓

// ─── FB SDK loader ────────────────────────────────────────────────────────────

declare global {
  interface Window {
    FB: {
      init: (opts: object) => void;
      login: (cb: (res: { authResponse?: { accessToken: string } }) => void, opts: object) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function loadFbSdk(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    if (window.FB) return resolve();

    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: "v25.0",
      });
      resolve();
    };

    if (document.getElementById("facebook-jssdk")) return; // already injected
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
    document.head.appendChild(script);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const { accessToken } = useAuth();
  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  const [status, setStatus] = useState<SocialStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [step, setStep] = useState<ConnectStep>("idle");
  const [pages, setPages] = useState<PageOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [igPosts, setIgPosts] = useState<InstagramPost[]>([]);
  const [fbLives, setFbLives] = useState<FacebookLive[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── fetch current status on mount ──
  useEffect(() => {
    if (!accessToken) return;
    fetch(`${BASE}/social/config`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: SocialStatus) => {
        setStatus(d);
        if (d.connected) setStep("done");
      })
      .catch(() => setError("Could not load social config."))
      .finally(() => setLoadingStatus(false));
  }, [accessToken, authHeaders]);

  // ── main connect handler ──────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    setError(null);

    if (!FB_APP_ID) {
      setError("NEXT_PUBLIC_FB_APP_ID is not set. Add your Facebook App ID to the dashboard .env file.");
      return;
    }

    try {
      // 1. Load SDK
      setStep("sdk-loading");
      await loadFbSdk(FB_APP_ID);

      // 2. FB.login() popup
      setStep("sdk-login");
      const userToken = await new Promise<string>((resolve, reject) => {
        window.FB.login(
          (res) => {
            if (res.authResponse?.accessToken) resolve(res.authResponse.accessToken);
            else reject(new Error("Facebook login was cancelled or permission was denied."));
          },
          { scope: FB_SCOPE },
        );
      });

      // 3. Exchange token + fetch pages
      setStep("exchanging");
      const exchRes = await fetch(`${BASE}/social/auth/exchange`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ user_access_token: userToken }),
      });
      if (!exchRes.ok) {
        const msg = await exchRes.json().catch(() => ({ detail: exchRes.statusText }));
        throw new Error(msg.detail ?? "Token exchange failed.");
      }
      const exchData: { pages: PageOption[]; auto_connected?: boolean; status?: SocialStatus } = await exchRes.json();
      const pageList = exchData.pages;

      // Backend already auto-connected the single page — reflect that in the UI
      if (exchData.auto_connected && exchData.status) {
        setStatus(exchData.status);
        setStep("done");
        return;
      }

      if (pageList.length === 0) {
        throw new Error(
          "No Facebook Pages found. Make sure you have a Page with admin access linked to an Instagram Business account.",
        );
      }

      // Always show the picker so the user can see and confirm which page is connected
      setPages(pageList);
      setStep("picking");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
      setStep("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── connect a specific page (step 2 of flow) ─────────────────────────────
  const doConnectPage = useCallback(
    async (pageId: string) => {
      setStep("connecting");
      setError(null);
      try {
        const res = await fetch(`${BASE}/social/auth/connect-page`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ page_id: pageId }),
        });
        if (!res.ok) {
          const msg = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(msg.detail ?? "Failed to connect page.");
        }
        const newStatus: SocialStatus = await res.json();
        setStatus(newStatus);
        setStep("done");
        setPages([]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Connection failed.");
        setStep("idle");
      }
    },
    [authHeaders],
  );

  // ── refresh token ─────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/social/auth/refresh`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(msg.detail ?? "Refresh failed.");
      }
      const newStatus: SocialStatus = await res.json();
      setStatus(newStatus);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setIsRefreshing(false);
    }
  }, [authHeaders]);

  // ── disconnect ────────────────────────────────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    if (!confirm("Disconnect Facebook & Instagram integration?")) return;
    setError(null);
    try {
      await fetch(`${BASE}/social/config`, { method: "DELETE", headers: authHeaders() });
      setStatus({ connected: false });
      setStep("idle");
      setIgPosts([]);
      setFbLives([]);
    } catch {
      setError("Failed to disconnect.");
    }
  }, [authHeaders]);

  // ── live preview ──────────────────────────────────────────────────────────
  const handlePreview = useCallback(async () => {
    setPreviewLoading(true);
    const [ig, fb] = await Promise.allSettled([
      fetch(`${BASE}/social/instagram/feed?limit=6`).then((r) => r.json()),
      fetch(`${BASE}/social/facebook/lives`).then((r) => r.json()),
    ]);
    if (ig.status === "fulfilled") setIgPosts(ig.value);
    if (fb.status === "fulfilled") setFbLives(fb.value);
    setPreviewLoading(false);
  }, []);

  // ── token expiry countdown ─────────────────────────────────────────────────
  const daysUntilExpiry = status?.fb_user_token_expires_at
    ? Math.max(
        0,
        Math.round(
          (new Date(status.fb_user_token_expires_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  if (loadingStatus) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }

  const isConnected = status?.connected;
  const isBusy =
    step === "sdk-loading" ||
    step === "sdk-login" ||
    step === "exchanging" ||
    step === "connecting" ||
    isRefreshing;

  const stepLabel: Record<ConnectStep, string> = {
    idle: "Connect with Facebook",
    "sdk-loading": "Loading Facebook SDK…",
    "sdk-login": "Waiting for Facebook login…",
    exchanging: "Exchanging token…",
    picking: "Connect with Facebook",
    connecting: "Connecting…",
    done: "Connected",
  };

  return (
    <div className="p-6 md:p-10 max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Social Media</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Facebook Page and Instagram Business account. One click — no tokens to copy.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {/* ── Not connected state ── */}
      {!isConnected && step !== "picking" && (
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center gap-5 py-12">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-[#1877F2]">
                <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.882v2.253h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-base">Link your Facebook Page</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Your Instagram Business account and Facebook Live schedule will automatically
                appear on the website once connected.
              </p>
            </div>
            <Button
              size="lg"
              className="bg-[#1877F2] hover:bg-[#166FE5] text-white gap-2 min-w-[220px]"
              onClick={handleConnect}
              disabled={isBusy}
            >
              {isBusy && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {stepLabel[step]}
            </Button>
            {isBusy && step === "sdk-login" && (
              <p className="text-xs text-muted-foreground">
                A Facebook popup should have appeared. If it was blocked, please allow popups for this page.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Page picker (multiple pages) ── */}
      {step === "picking" && pages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose a Facebook Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your account manages {pages.length} pages. Select the one to connect to Westra.
            </p>
            {pages.map((p) => (
              <button
                key={p.page_id}
                onClick={() => doConnectPage(p.page_id)}
                className="w-full flex items-start gap-4 p-4 rounded-lg border text-left hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-[#1877F2] font-bold text-sm">
                  {p.page_name[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{p.page_name}</p>
                  <p className="text-xs text-muted-foreground">ID: {p.page_id}</p>
                  {p.ig_username ? (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      ✓ Instagram: @{p.ig_username}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-0.5">
                      ⚠ No Instagram Business account linked
                    </p>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Connected state ── */}
      {isConnected && step === "done" && (
        <>
          <Card>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
                      <circle cx="10" cy="10" r="10" fill="#10b981" />
                      <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {status?.fb_page_name ?? "Facebook Page"} connected
                    </p>
                    {status?.ig_username && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Instagram: @{status.ig_username}
                      </p>
                    )}
                    {daysUntilExpiry !== null && (
                      <p
                        className={`text-xs mt-0.5 ${
                          daysUntilExpiry < 7
                            ? "text-red-600 font-medium"
                            : daysUntilExpiry < 20
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        Token refreshes in {daysUntilExpiry} days
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex-1 sm:flex-none"
                  >
                    {isRefreshing ? "Refreshing…" : "Refresh Token"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Re-connect with a different account */}
              <div className="mt-5 pt-4 border-t">
                <button
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={handleConnect}
                  disabled={isBusy}
                >
                  Re-authenticate or switch Facebook account
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Live content preview */}
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Content Preview</h2>
              <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? "Fetching…" : "Load Live Preview"}
              </Button>
            </div>

            {igPosts.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Instagram Feed
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {igPosts.map((p) => (
                    <a key={p.id} href={p.permalink} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.thumbnail_url ?? p.media_url ?? ""}
                        alt={p.caption?.slice(0, 60) ?? "Instagram post"}
                        className="w-full aspect-square object-cover rounded-md border"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {fbLives.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Facebook Live / Scheduled
                </p>
                <div className="space-y-2">
                  {fbLives.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-4 p-3 rounded-md border bg-muted/20"
                    >
                      {v.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.thumbnail_url}
                          alt={v.title ?? "Live"}
                          className="w-16 h-10 object-cover rounded shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{v.title ?? "Untitled Stream"}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className="capitalize text-[10px] px-1.5 py-0">{v.status}</Badge>
                          {v.planned_start_time && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(v.planned_start_time).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {v.permalink_url && (
                        <a
                          href={v.permalink_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground underline shrink-0"
                        >
                          View →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {igPosts.length === 0 && fbLives.length === 0 && !previewLoading && (
              <p className="text-sm text-muted-foreground">
                Click &ldquo;Load Live Preview&rdquo; to fetch content from Meta.
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Setup guide ── */}
      <Separator />
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground select-none">
          Prerequisites — setting up your Meta App
        </summary>
        <ol className="mt-3 ml-4 list-decimal space-y-2 text-muted-foreground leading-relaxed">
          <li>
            Go to{" "}
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline">
              developers.facebook.com/apps
            </a>{" "}
            and create a <strong>Business</strong> app.
          </li>
          <li>
            Add the <strong>Facebook Login for Business</strong> product and set the{" "}
            <em>Valid OAuth Redirect URIs</em> to include your dashboard origin (e.g.{" "}
            <code>http://localhost:3001</code>).
          </li>
          <li>
            Add the <strong>Instagram Graph API</strong> product and link your Instagram Business
            account to your Facebook Page in{" "}
            <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer" className="underline">
              Meta Business Suite
            </a>
            .
          </li>
          <li>
            Copy your <strong>App ID</strong> → set <code>NEXT_PUBLIC_FB_APP_ID</code> in{" "}
            <code>dashboard/.env</code>.<br />
            Copy your <strong>App Secret</strong> → set <code>FB_APP_ID</code> and{" "}
            <code>FB_APP_SECRET</code> in <code>backend/.env</code>.
          </li>
          <li>
            While the app is in <em>Development</em> mode, add yourself as a Test User in{" "}
            <strong>App Roles</strong>. Switch to <em>Live</em> mode before going public.
          </li>
        </ol>
      </details>
    </div>
  );
}
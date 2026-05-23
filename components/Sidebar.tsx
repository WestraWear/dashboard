"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaShoppingBag, FaBox, FaChartBar, FaSignOutAlt, FaUsers, FaInstagram, FaBell } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
type NotifOrder = { id: string; order_number: string; customer_name: string; total: number; created_at: string };

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer rounded rectangle */}
      <rect
        x="1.5" y="1.5"
        width="15" height="15"
        rx="2.5"
        stroke="var(--sidebar)"
        strokeWidth="1.4"
        fill="none"
      />
      {/* Inner vertical line — slides right when collapsed */}
      <line
        x1="5.5" y1="5"
        x2="5.5" y2="13"
        stroke="var(--sidebar)"
        strokeWidth="1.4"
        strokeLinecap="round"
        style={{
          transform: collapsed ? "translateX(6px)" : "translateX(0px)",
          transition: "transform 280ms cubic-bezier(0.4,0,0.2,1)",
          transformBox: "fill-box",
          transformOrigin: "center",
        }}
      />
    </svg>
  );
}

const ALL_NAV_ITEMS = [
  { label: "Orders",    href: "/",          icon: FaShoppingBag },
  { label: "Products",  href: "/products",   icon: FaBox },
  { label: "Analytics", href: "/analytics",  icon: FaChartBar },
  { label: "Users",     href: "/users",      icon: FaUsers },
  { label: "Social",    href: "/social",     icon: FaInstagram },
];

const MANAGER_ITEMS = new Set(["/", "/products"]);

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, username, role } = useAuth();
  const initial = (username ?? "A")[0].toUpperCase();
  const navItems = role === "manager"
    ? ALL_NAV_ITEMS.filter((i) => MANAGER_ITEMS.has(i.href))
    : ALL_NAV_ITEMS;

  // ── Mobile notification state ──
  const [notifOrders, setNotifOrders] = useState<NotifOrder[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSeen, setNotifSeen] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("seen_orders") ?? "[]")); }
    catch { return new Set(); }
  });
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await authFetch(`${BASE}/orders?status=pending&limit=20`);
      if (!res.ok) return;
      setNotifOrders(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchPending();
    const id = setInterval(fetchPending, 30_000);
    return () => clearInterval(id);
  }, [fetchPending]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unseenNotifs = notifOrders.filter((o) => !notifSeen.has(o.id));

  const toggleNotifPanel = () => {
    if (!notifOpen) {
      const s = new Set(notifOrders.map((o) => o.id));
      setNotifSeen(s);
      localStorage.setItem("seen_orders", JSON.stringify([...s]));
    }
    setNotifOpen((v) => !v);
  };

  // ── Mobile profile popover state ──
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const mobileProfileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!mobileProfileRef.current?.contains(e.target as Node)) setMobileProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("westra-sidebar-collapsed") === "true";
    }
    return false;
  });
  const [hovered, setHovered] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Persist collapsed state across page navigations
  useEffect(() => {
    localStorage.setItem("westra-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  // Visually expanded when not collapsed OR when hovering over a collapsed sidebar
  const isExpanded = !collapsed || hovered;

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 overflow-hidden"
        style={{
          width: isExpanded ? 220 : 52,
          transition: "width 280ms cubic-bezier(0.4,0,0.2,1)",
          background: "#f0eae0",
          borderRight: "1px solid var(--border)",
        }}
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => { setHovered(false); if (collapsed) setProfileOpen(false); }}
      >
        {/* Logo row */}
        <div className="flex items-center h-14 px-3 gap-2 shrink-0 overflow-hidden">
          <div className="relative w-8 h-8 shrink-0">
            <Image src="/logo_transparent.png" alt="Westra" fill className="object-contain" />
          </div>
          <span
            className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap overflow-hidden"
            style={{
              opacity: isExpanded ? 1 : 0,
              maxWidth: isExpanded ? 160 : 0,
              transition: "opacity 180ms ease, max-width 280ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            Westra Admin
          </span>
        </div>

        <Separator />

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={!isExpanded ? label : undefined}
                className={cn(
                  "flex items-center rounded-md text-[13px] font-medium transition-colors overflow-hidden",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-[#e8ddd0]"
                )}
                style={{
                  height: 36,
                  paddingLeft: 10,
                  paddingRight: 10,
                  background: active ? "var(--sidebar)" : undefined,
                }}
              >
                <Icon size={14} className="shrink-0" style={{ marginRight: isExpanded ? 10 : 0, transition: "margin-right 280ms cubic-bezier(0.4,0,0.2,1)" }} />
                <span
                  className="whitespace-nowrap overflow-hidden"
                  style={{
                    opacity: isExpanded ? 1 : 0,
                    maxWidth: isExpanded ? 160 : 0,
                    transition: "opacity 180ms ease, max-width 280ms cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* Profile — inline with nav items */}
          <div className="mt-auto pt-1">
            <Separator className="mb-1" />
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                title={!isExpanded ? (username ?? "Profile") : undefined}
                className="w-full flex cursor-pointer items-center rounded-md text-[13px] font-medium transition-colors hover:bg-[#e8ddd0] overflow-hidden text-muted-foreground hover:text-foreground"
                style={{ height: 36, paddingLeft: 10, paddingRight: 10 }}
              >
                <span
                  className="flex items-center justify-center w-[14px] h-[14px] rounded-full text-white shrink-0 text-[9px] font-bold"
                  style={{
                    background: "var(--sidebar)",
                    width: 14,
                    height: 14,
                    marginRight: isExpanded ? 10 : 0,
                    transition: "margin-right 280ms cubic-bezier(0.4,0,0.2,1)",
                    // match icon size
                    fontSize: 9,
                    lineHeight: "14px",
                  }}
                >
                  {initial}
                </span>
                <span
                  className="whitespace-nowrap overflow-hidden"
                  style={{
                    opacity: isExpanded ? 1 : 0,
                    maxWidth: isExpanded ? 160 : 0,
                    transition: "opacity 180ms ease, max-width 280ms cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  {username ?? "Admin"}
                </span>
              </button>

              {profileOpen && (
                <div
                  className="absolute rounded-lg border shadow-lg overflow-hidden z-50"
                  style={{
                    background: "var(--card)",
                    bottom: "calc(100% + 4px)",
                    left: !isExpanded ? "calc(100% + 4px)" : "0px",
                    right: !isExpanded ? "auto" : "0px",
                    width: !isExpanded ? "180px" : "auto",
                  }}
                >
                  <div className="px-3 py-2.5 border-b">
                    <p className="text-xs font-semibold text-foreground">{username ?? "Admin"}</p>
                    <p className="text-[11px] text-muted-foreground">Administrator</p>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FaSignOutAlt size={12} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <Separator />

        {/* Collapse toggle */}
        <div className="flex px-2 py-2 justify-start">
          <button
            onClick={() => { setCollapsed((c) => !c); setHovered(false); if (isExpanded) setProfileOpen(false); }}
            className="p-2 rounded-md hover:bg-[#e8ddd0] transition-colors cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar — logo + bell */}
      <div className="md:hidden flex items-center gap-3 h-14 px-4 border-b shrink-0" style={{ background: "#f0eae0" }}>
        <div className="w-7 h-7 relative shrink-0">
          <Image src="/logo_transparent.png" alt="Westra" fill className="object-contain" />
        </div>
        <span className="text-sm font-semibold text-foreground">Westra Admin</span>

        {/* Notification bell */}
        <div className="ml-auto relative" ref={notifRef}>
          <button
            onClick={toggleNotifPanel}
            className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-[#e8ddd0] transition-colors"
          >
            <FaBell size={16} />
            {unseenNotifs.length > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full text-[10px] font-semibold text-white px-1"
                style={{ background: "var(--primary)" }}
              >
                {unseenNotifs.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-lg border shadow-lg z-50 flex flex-col overflow-hidden"
              style={{ background: "var(--card)" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-xs font-semibold text-foreground">Pending Orders</span>
                {notifOrders.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{notifOrders.length} pending</span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y">
                {notifOrders.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">No pending orders</p>
                ) : (
                  notifOrders.map((o) => (
                    <div key={o.id} className="flex items-start justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-xs font-medium text-foreground">{o.order_number}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{o.customer_name}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-xs font-medium text-foreground">₹{o.total.toLocaleString()}</p>
                        <Badge variant="secondary" className="text-[10px] mt-0.5 bg-amber-100 text-amber-700 border-amber-200">pending</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t"
        style={{ background: "#f0eae0", height: 60, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span
                className="flex items-center justify-center rounded-lg transition-all"
                style={{
                  width: 36,
                  height: 24,
                  background: active ? "var(--sidebar)" : "transparent",
                }}
              >
                <Icon size={13} color={active ? "#fff" : undefined} />
              </span>
              {label}
            </Link>
          );
        })}
        {/* User initial with sign-out popover */}
        <div className="flex flex-1 flex-col items-center justify-center relative" ref={mobileProfileRef}>
          <button
            onClick={() => setMobileProfileOpen((v) => !v)}
            className="flex flex-col items-center justify-center gap-1 w-full h-full text-[10px] font-medium text-muted-foreground"
          >
            <span
              className="flex items-center justify-center rounded-full text-white font-bold"
              style={{ width: 24, height: 24, background: "var(--sidebar)", fontSize: 11 }}
            >
              {initial}
            </span>
            {username ?? "Admin"}
          </button>

          {mobileProfileOpen && (
            <div
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 rounded-lg border shadow-lg overflow-hidden z-50 w-44"
              style={{ background: "var(--card)" }}
            >
              <div className="px-3 py-2.5 border-b">
                <p className="text-xs font-semibold text-foreground">{username ?? "Admin"}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{role ?? "Administrator"}</p>
              </div>
              <button
                onClick={() => { setMobileProfileOpen(false); logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                <FaSignOutAlt size={12} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
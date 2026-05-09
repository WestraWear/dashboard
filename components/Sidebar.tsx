"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaShoppingBag, FaBox, FaChartBar, FaAngleLeft, FaBars, FaSignOutAlt, FaUserCircle } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Orders",    href: "/",          icon: FaShoppingBag },
  { label: "Products",  href: "/products",   icon: FaBox },
  { label: "Analytics", href: "/analytics",  icon: FaChartBar },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-200 overflow-hidden",
          collapsed ? "w-[52px]" : "w-[220px]"
        )}
        style={{ background: "#FFFFFF", borderRight: "1px solid var(--border)" }}
      >
        {/* Logo row — no collapse button here */}
        <div className={cn("flex items-center h-14 px-3 gap-2 shrink-0", collapsed ? "justify-center" : "")}>
          <div className={cn("relative shrink-0", collapsed ? "w-7 h-7" : "w-8 h-8")}>
            <Image src="/logo_transparent.png" alt="Westra" fill className="object-contain" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-foreground">Westra</span>
          )}
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
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                style={active ? { background: "var(--sidebar)" } : {}}
              >
                <Icon size={14} className="shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        <Separator />

        {/* Collapse toggle — sits just above profile */}
        <div className={cn("flex px-2 pt-2", collapsed ? "justify-center" : "justify-start")}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <FaBars size={13} /> : <FaAngleLeft size={13} />}
          </button>
        </div>

        {/* Profile menu */}
        <div className="relative px-2 pb-3 pt-1" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={cn(
              "w-full flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors hover:bg-muted",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? "Profile" : undefined}
          >
            <span
              className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold shrink-0"
              style={{ background: "var(--sidebar)" }}
            >
              A
            </span>
            {!collapsed && (
              <span className="text-[13px] font-medium text-foreground truncate">Admin</span>
            )}
          </button>

          {profileOpen && (
            <div
              className="absolute bottom-full mb-1 rounded-lg border shadow-lg overflow-hidden z-50"
              style={{
                background: "var(--card)",
                left: collapsed ? "calc(100% + 4px)" : "8px",
                right: collapsed ? "auto" : "8px",
                width: collapsed ? "160px" : "auto",
                bottom: collapsed ? "0" : "100%",
              }}
            >
              <div className="px-3 py-2.5 border-b">
                <p className="text-xs font-semibold text-foreground">Admin</p>
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
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-3 h-14 px-4 border-b shrink-0 bg-white">
        <div className="w-7 h-7 relative shrink-0">
          <Image src="/logo_transparent.png" alt="Westra" fill className="object-contain" />
        </div>
        <span className="text-sm font-semibold text-foreground">Westra</span>
        <nav className="flex items-center gap-1 ml-auto">
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors",
                  active ? "text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                style={active ? { background: "var(--sidebar)" } : {}}
              >
                <Icon size={12} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
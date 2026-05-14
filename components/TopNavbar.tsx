"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { FaBell } from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/":          { title: "Orders",    description: "View and manage all customer orders" },
  "/products":  { title: "Products",  description: "Manage your product catalogue" },
  "/analytics": { title: "Analytics", description: "Store performance overview" },
};

type NotifOrder = { id: string; order_number: string; customer_name: string; total: number; created_at: string };

export default function TopNavbar() {
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? { title: "Dashboard", description: "" };

  const [orders, setOrders] = useState<NotifOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("seen_orders") ?? "[]")); }
    catch { return new Set(); }
  });
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await authFetch(`${BASE}/orders?status=pending&limit=20`);
      if (!res.ok) return;
      const data: NotifOrder[] = await res.json();
      setOrders(data);
    } catch { /* silent */ }
  }, []);

  // Poll every 30s
  useEffect(() => {
    fetchPending();
    const id = setInterval(fetchPending, 30_000);
    return () => clearInterval(id);
  }, [fetchPending]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unseen = orders.filter((o) => !seen.has(o.id));

  const markAllSeen = () => {
    const newSeen = new Set(orders.map((o) => o.id));
    setSeen(newSeen);
    localStorage.setItem("seen_orders", JSON.stringify([...newSeen]));
  };

  const togglePanel = () => {
    if (!open) markAllSeen();
    setOpen((v) => !v);
  };

  return (
    <header
      className="flex items-center justify-between h-14 px-6 shrink-0 border-b"
      style={{ background: "#f0eae0" }}
    >
      <div>
        <h1 className="text-sm font-semibold text-foreground leading-none">{meta.title}</h1>
        {meta.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
        )}
      </div>

      {/* Notification bell */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={togglePanel}
          className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-[#e8ddd0] transition-colors"
        >
          <FaBell size={16} />
          {unseen.length > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full text-[10px] font-semibold text-white px-1"
              style={{ background: "var(--primary)" }}
            >
              {unseen.length}
            </span>
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-2 w-80 rounded-lg border shadow-lg z-50 flex flex-col overflow-hidden"
            style={{ background: "var(--card)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-xs font-semibold text-foreground">Pending Orders</span>
              {orders.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{orders.length} pending</span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto divide-y">
              {orders.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No pending orders</p>
              ) : (
                orders.map((o) => (
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
    </header>
  );
}
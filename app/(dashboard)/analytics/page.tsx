"use client";

import { useEffect, useState, useCallback } from "react";
import { FaSyncAlt, FaChartLine, FaShoppingBag, FaRupeeSign, FaClock, FaBox } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { fetchOrders } from "@/controllers/orderController";
import { fetchProducts } from "@/controllers/productController";
import { computeStats } from "@/controllers/analyticsController";
import type { Order } from "@/models/order";
import type { Product } from "@/models/product";

const STATUS_COLORS: Record<string, string> = {
  pending:   "#D97706",
  confirmed: "#2563EB",
  shipped:   "#7C3AED",
  delivered: "#16A34A",
  cancelled: "#DC2626",
};

const STATUS_BG: Record<string, string> = {
  pending:   "#FEF3C7",
  confirmed: "#DBEAFE",
  shipped:   "#EDE9FE",
  delivered: "#DCFCE7",
  cancelled: "#FEE2E2",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className="shadow-none border py-0">
      <CardContent className="px-4 pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
            <p className="text-2xl font-semibold text-foreground leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          </div>
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ background: accent ? "var(--primary)" : "var(--muted)" }}
          >
            <Icon size={15} style={{ color: accent ? "var(--primary-foreground)" : "var(--muted-foreground)" }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BarChart({ data }: { data: { label: string; value: number; color: string; bg: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs capitalize text-foreground font-medium">{d.label}</span>
            <span className="text-xs text-muted-foreground font-mono">{d.value}</span>
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = 48;
  const pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v / max) * (h - 2 * pad));
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`${pad},${h} ${pts.join(" ")} ${w - pad},${h}`}
        fill="var(--primary)"
        fillOpacity="0.1"
      />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, productsData] = await Promise.all([
        fetchOrders(),
        fetchProducts(),
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch {
      /* show empty state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Derived stats
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const revenue = activeOrders.reduce((s, o) => s + o.total, 0);
  const avgOrder = activeOrders.length ? Math.round(revenue / activeOrders.length) : 0;
  const pending = orders.filter((o) => o.status === "pending").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;

  // Status breakdown
  const statusBreakdown = ["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => ({
    label: s,
    value: orders.filter((o) => o.status === s).length,
    color: STATUS_COLORS[s],
    bg: STATUS_BG[s],
  }));

  // Payment breakdown
  const paymentBreakdown = ["cod", "upi", "bank_transfer"].map((p) => ({
    label: p === "cod" ? "Cash on Delivery" : p === "upi" ? "UPI" : "Bank Transfer",
    value: orders.filter((o) => o.payment_method === p).length,
    color: "var(--primary)",
    bg: "var(--muted)",
  }));

  // Top products by order item mentions
  const productMap: Record<string, number> = {};
  for (const o of orders) {
    for (const item of o.items) {
      productMap[item.product_name] = (productMap[item.product_name] ?? 0) + item.qty;
    }
  }
  const topProducts = Object.entries(productMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ label: name, value: qty, color: "var(--primary)", bg: "var(--muted)" }));

  // Daily revenue (last 14 days)
  const today = new Date();
  const dailyRevenue = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return orders
      .filter((o) => o.status !== "cancelled" && o.created_at.startsWith(dateStr))
      .reduce((s, o) => s + o.total, 0);
  });

  // Category stock
  const categoryStock = CATEGORIES.map((cat) => {
    const ps = products.filter((p) => p.category === cat);
    return { category: cat, total: ps.length, inStock: ps.filter((p) => p.in_stock).length };
  }).filter((c) => c.total > 0);

  // Recent 5 orders
  const recent = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="p-6 flex flex-col gap-6">
        {/* Actions */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="gap-1.5 text-xs h-8">
            <FaSyncAlt size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FaRupeeSign} label="Total Revenue" value={`₹${revenue.toLocaleString()}`} sub={`${activeOrders.length} active orders`} accent />
          <StatCard icon={FaShoppingBag} label="Total Orders" value={orders.length} sub={`${delivered} delivered`} />
          <StatCard icon={FaChartLine} label="Avg. Order Value" value={`₹${avgOrder.toLocaleString()}`} />
          <StatCard icon={FaClock} label="Pending Orders" value={pending} sub="Needs attention" />
        </div>

        {/* Revenue sparkline + Status breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-none border py-0">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-medium">Revenue — Last 14 Days</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="h-12 animate-pulse bg-muted rounded" />
              ) : (
                <>
                  <MiniSparkline data={dailyRevenue} />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">14 days ago</span>
                    <span className="text-[10px] text-muted-foreground">Today</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none border py-0">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-medium">Orders by Status</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-5 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : (
                <BarChart data={statusBreakdown} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment + Top products + Catalogue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="shadow-none border py-0">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-5 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet.</p>
              ) : (
                <BarChart data={paymentBreakdown} />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none border py-0">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-medium">Top Products Ordered</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-5 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : topProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders yet.</p>
              ) : (
                <BarChart data={topProducts} />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none border py-0">
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <FaBox size={13} className="text-muted-foreground" />
                Catalogue by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-5 animate-pulse bg-muted rounded" />
                  ))}
                </div>
              ) : categoryStock.length === 0 ? (
                <p className="text-xs text-muted-foreground">No products yet.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {categoryStock.map((c) => (
                    <div key={c.category} className="flex items-center justify-between">
                      <span className="text-xs text-foreground">{c.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{c.inStock}/{c.total}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                          style={{ color: c.inStock === c.total ? "#16A34A" : c.inStock === 0 ? "#DC2626" : "#D97706" }}
                        >
                          {c.inStock === 0 ? "OOS" : c.inStock === c.total ? "All in" : "Partial"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent orders */}
        <Card className="shadow-none border py-0">
          <CardHeader className="px-4 pt-4 pb-3 border-b">
            <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse bg-muted rounded" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No orders yet.</p>
            ) : (
              <div>
                {recent.map((o, idx) => (
                  <div key={o.id}>
                    {idx > 0 && <Separator />}
                    <div className="flex items-center justify-between px-4 py-3 gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-medium text-foreground">{o.order_number}</span>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
                            style={{ background: STATUS_BG[o.status] ?? "var(--muted)", color: STATUS_COLORS[o.status] ?? "var(--foreground)" }}
                          >
                            {o.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{o.customer_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">₹{o.total.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const CATEGORIES = ["Sarees", "Kurtis", "Ethnic Wear", "Party Collection", "Seasonal", "Other"];

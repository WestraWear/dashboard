"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { FaChartLine, FaShoppingBag, FaRupeeSign, FaClock, FaBox } from "react-icons/fa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
} from "recharts";
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

const revenueConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--primary))" },
};

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueTab, setRevenueTab] = useState<"monthly" | "weekly">("monthly");

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

  // Payment status breakdown
  const paymentStatusBreakdown = [
    { label: "Paid",    key: "paid",    color: "#16A34A" },
    { label: "Pending", key: "pending", color: "#D97706" },
    { label: "Failed",  key: "failed",  color: "#DC2626" },
  ].map(({ label, key, color }) => ({
    label,
    value: orders.filter((o) => o.payment_status === key).length,
    color,
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

  // Monthly revenue (last 6 months)
  const today = new Date();
  const revenueData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    const month = d.toLocaleString("default", { month: "short" });
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const rev = orders
      .filter((o) => {
        const od = new Date(o.created_at);
        return o.status !== "cancelled" && od.getFullYear() === yr && od.getMonth() === mo;
      })
      .reduce((s, o) => s + o.total, 0);
    return { month, revenue: rev };
  });

  // Weekly revenue (last 7 weeks)
  const weeklyRevenueData = useMemo(() => {
    const now = new Date();
    // Align to start of current week (Monday)
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const start = new Date(weekStart);
      start.setDate(weekStart.getDate() - (6 - i) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const label = start.toLocaleString("default", { month: "short", day: "numeric" });
      const rev = orders
        .filter((o) => {
          const od = new Date(o.created_at);
          return o.status !== "cancelled" && od >= start && od < end;
        })
        .reduce((s, o) => s + o.total, 0);
      return { month: label, revenue: rev };
    });
  }, [orders]);

  // Category stock — derived from actual product data
  const categoryStock = Array.from(new Set(products.map((p) => p.category)))
    .filter(Boolean)
    .map((cat) => {
      const ps = products.filter((p) => p.category === cat);
      return { category: cat, total: ps.length, inStock: ps.filter((p) => p.in_stock).length };
    })
    .filter((c) => c.total > 0);

  // Recent 5 orders
  const recent = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="p-6 flex flex-col gap-6">
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
            <CardHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {revenueTab === "monthly" ? "Revenue — Last 6 Months" : "Revenue — Last 7 Weeks"}
              </CardTitle>
              <Tabs value={revenueTab} onValueChange={(v) => setRevenueTab(v as "monthly" | "weekly")}>
                <TabsList className="h-7 p-0.5">
                  <TabsTrigger value="monthly" className="text-[11px] px-2.5 h-6">Monthly</TabsTrigger>
                  <TabsTrigger value="weekly" className="text-[11px] px-2.5 h-6">Weekly</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {loading ? (
                <div className="h-[200px] animate-pulse bg-muted rounded" />
              ) : (
                <ChartContainer config={revenueConfig} className="h-[180px] sm:h-[200px] w-full">
                  <AreaChart data={revenueTab === "monthly" ? revenueData : weeklyRevenueData} margin={{ left: 0, right: 0 }}>
                    <defs>
                      <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={8} />
                    <YAxis tickFormatter={(v) => `₹${v / 1000}K`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent
                        formatter={(value) => [`₹${Number(value).toLocaleString()}`]}
                      />}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} fill="url(#fillRevenue)" />
                  </AreaChart>
                </ChartContainer>
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
              <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
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
                <BarChart data={paymentStatusBreakdown} />
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


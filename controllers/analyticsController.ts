import { Order } from "@/models/order";
import { Product } from "@/models/product";

export interface AnalyticsStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  avgOrderValue: number;
  statusBreakdown: Record<string, number>;
  dailyRevenue: { date: string; revenue: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
  categoryStock: { category: string; total: number; inStock: number }[];
}

export function computeStats(
  orders: Order[],
  products: Product[]
): AnalyticsStats {
  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total, 0);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
  const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  for (const o of orders) {
    statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;
  }

  // Daily revenue (last 14 days)
  const dayMap: Record<string, number> = {};
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const day = o.created_at.slice(0, 10);
    if (day in dayMap) dayMap[day] += o.total;
  }
  const dailyRevenue = Object.entries(dayMap).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  // Top products by revenue
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    for (const item of o.items) {
      if (!productMap[item.product_id]) {
        productMap[item.product_id] = {
          name: item.product_name,
          qty: 0,
          revenue: 0,
        };
      }
      productMap[item.product_id].qty += item.qty;
      productMap[item.product_id].revenue += item.price * item.qty;
    }
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Category stock breakdown
  const catMap: Record<string, { total: number; inStock: number }> = {};
  for (const p of products) {
    if (!catMap[p.category]) catMap[p.category] = { total: 0, inStock: 0 };
    catMap[p.category].total += 1;
    if (p.in_stock) catMap[p.category].inStock += 1;
  }
  const categoryStock = Object.entries(catMap).map(([category, v]) => ({
    category,
    ...v,
  }));

  return {
    totalRevenue,
    totalOrders,
    pendingOrders,
    deliveredOrders,
    cancelledOrders,
    avgOrderValue,
    statusBreakdown,
    dailyRevenue,
    topProducts,
    categoryStock,
  };
}

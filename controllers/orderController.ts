import { Order } from "@/models/order";
import { authFetch } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function fetchOrders(params?: {
  status?: string;
  limit?: number;
  skip?: number;
}): Promise<Order[]> {
  const url = new URL(`${BASE}/orders`);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.limit !== undefined)
    url.searchParams.set("limit", String(params.limit));
  if (params?.skip !== undefined)
    url.searchParams.set("skip", String(params.skip));
  const res = await authFetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order> {
  const res = await authFetch(`${BASE}/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update order status");
  return res.json();
}

export async function deleteOrder(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/orders/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete order");
}

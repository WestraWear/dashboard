"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { FaChartLine, FaClock, FaRupeeSign, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { fetchOrders, updateOrderStatus as apiUpdateOrderStatus } from "@/controllers/orderController";
import type { Order } from "@/models/order";

const STATUS_OPTIONS = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
const STATUS_TABS = ["all", ...STATUS_OPTIONS] as const;

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  razorpay: "Razorpay (Online)",
};

const PAYMENT_STATUS_CLASSES: Record<string, string> = {
  paid:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  failed:  "bg-red-100 text-red-700 border-red-200",
};

const STATUS_BADGE_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending:   "secondary",
  confirmed: "default",
  shipped:   "default",
  delivered: "default",
  cancelled: "destructive",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100",
  shipped:   "bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  cancelled: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
};

function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={STATUS_BADGE_VARIANTS[status] ?? "outline"}
      className={`capitalize text-[11px] font-medium ${STATUS_BADGE_CLASSES[status] ?? ""}`}
    >
      {status}
    </Badge>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<typeof STATUS_TABS[number]>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchOrders(activeTab !== "all" ? { status: activeTab } : undefined);
      setOrders(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    try {
      await apiUpdateOrderStatus(orderId, status as Order["status"]);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: status as Order["status"] } : o))
      );
    } catch {
      alert("Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const revenue   = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
  const pending   = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="p-6 flex flex-col gap-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-none border py-0">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FaChartLine size={12} /> Total Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-semibold text-foreground">{orders.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none border py-0">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FaClock size={12} /> Pending
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-semibold text-foreground">{pending}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none border py-0">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FaRupeeSign size={12} /> Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-semibold text-foreground">₹{revenue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders table */}
        <Card className="shadow-none border py-0">
          <CardHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-sm font-medium">All Orders</CardTitle>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof STATUS_TABS[number])}>
                <TabsList className="h-8 text-xs">
                  {STATUS_TABS.map((tab) => (
                    <TabsTrigger key={tab} value={tab} className="capitalize text-xs px-3 h-7">
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md animate-pulse bg-muted" />
              ))}
            </div>
          ) : error ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              Failed to load orders. Is the backend running?
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              No orders found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wide w-[140px]">Order #</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Customer</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide hidden md:table-cell">Items</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Total</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide hidden lg:table-cell">Payment</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide hidden lg:table-cell">Pay Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide hidden lg:table-cell">Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide w-[140px]">Update</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <Fragment key={order.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    >
                      <TableCell className="font-mono text-xs font-medium py-3">{order.order_number}</TableCell>
                      <TableCell className="py-3">
                        <p className="text-sm font-medium leading-tight">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell py-3">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="font-medium text-sm py-3">₹{order.total.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell py-3">
                        {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-medium border capitalize ${
                            PAYMENT_STATUS_CLASSES[order.payment_status] ?? "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {order.payment_status ?? "pending"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell py-3">
                        {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={order.status}
                          onValueChange={(val) => updateStatus(order.id, val)}
                          disabled={updatingId === order.id}
                        >
                          <SelectTrigger className="h-7 text-xs w-full capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-3 text-muted-foreground">
                        {expandedId === order.id ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
                      </TableCell>
                    </TableRow>

                    {expandedId === order.id && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={10} className="py-4 px-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Delivery Details</p>
                              <p className="text-sm text-muted-foreground leading-relaxed">{order.customer_address}</p>
                              {order.customer_email && (
                                <p className="text-xs text-muted-foreground mt-1">{order.customer_email}</p>
                              )}
                              {order.razorpay_payment_id && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Razorpay ID:{" "}
                                  <span className="font-mono text-foreground">{order.razorpay_payment_id}</span>
                                </p>
                              )}
                              {order.notes && (
                                <>
                                  <Separator className="my-2" />
                                  <p className="text-xs text-muted-foreground italic">{order.notes}</p>
                                </>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Order Items</p>
                              <div className="space-y-1.5">
                                {order.items.map((item, i) => (
                                  <div key={i} className="flex justify-between text-sm">
                                    <span className="text-foreground">
                                      {item.product_name}
                                      {item.size && item.size !== "One Size" && (
                                        <span className="text-muted-foreground ml-1 text-xs">({item.size})</span>
                                      )}
                                      <span className="text-muted-foreground ml-1 text-xs">× {item.qty}</span>
                                    </span>
                                    <span className="text-foreground font-medium">₹{(item.price * item.qty).toLocaleString()}</span>
                                  </div>
                                ))}
                                <Separator className="my-1.5" />
                                <div className="flex justify-between text-sm font-semibold">
                                  <span>Total</span>
                                  <span>₹{order.total.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

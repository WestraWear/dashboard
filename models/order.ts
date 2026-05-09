export interface OrderItem {
  product_id: string;
  product_name: string;
  size: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address: string;
  items: OrderItem[];
  total: number;
  payment_method: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  notes?: string;
  created_at: string;
  updated_at: string;
}

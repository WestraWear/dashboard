import { Product } from "@/models/product";
import { authFetch } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function fetchProducts(params?: {
  category?: string;
  in_stock?: boolean;
}): Promise<Product[]> {
  const url = new URL(`${BASE}/products`);
  if (params?.category) url.searchParams.set("category", params.category);
  if (params?.in_stock !== undefined)
    url.searchParams.set("in_stock", String(params.in_stock));
  const res = await authFetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export async function createProduct(
  body: Omit<Product, "id">
): Promise<Product> {
  const res = await authFetch(`${BASE}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create product");
  return res.json();
}

export async function updateProduct(
  id: string,
  body: Partial<Omit<Product, "id">>
): Promise<Product> {
  const res = await authFetch(`${BASE}/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update product");
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/products/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete product");
}

export async function toggleStock(
  id: string,
  in_stock: boolean
): Promise<Product> {
  return updateProduct(id, { in_stock });
}

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch(`${BASE}/products/upload-image`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.url as string;
}

export async function deleteProductImage(id: string): Promise<Product> {
  const res = await authFetch(`${BASE}/products/${id}/image`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete image");
  return res.json();
}

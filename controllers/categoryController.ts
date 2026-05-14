import { authFetch } from "@/lib/auth";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface Category {
  id: string;
  name: string;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BACKEND}/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function createCategory(name: string): Promise<Category> {
  const res = await authFetch(`${BACKEND}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail ?? "Failed to create category");
  }
  return res.json();
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await authFetch(`${BACKEND}/categories/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete category");
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { FaPlus, FaTrash, FaSyncAlt, FaBoxOpen, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchProducts,
  createProduct as apiCreate,
  updateProduct as apiUpdate,
  deleteProduct as apiDelete,
  toggleStock as apiToggle,
} from "@/controllers/productController";
import {
  fetchCategories,
  createCategory as apiCreateCategory,
  deleteCategory as apiDeleteCategory,
  type Category,
} from "@/controllers/categoryController";
import type { Product } from "@/models/product";
import ProductFormDialog, { EMPTY_FORM, type ProductFormData } from "@/components/ProductFormDialog";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("products");

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [catError, setCatError] = useState("");

  const loadCategories = useCallback(async () => {
    try { setCategories(await fetchCategories()); } catch { /* ignore */ }
  }, []);

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setSavingCat(true);
    setCatError("");
    try {
      const created = await apiCreateCategory(name);
      setCategories((prev) => [...prev, created]);
      setNewCatName("");
    } catch (e: unknown) {
      setCatError(e instanceof Error ? e.message : "Failed to add category");
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setDeletingCatId(id);
    try {
      await apiDeleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ } finally {
      setDeletingCatId(null);
    }
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setProducts(await fetchProducts());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const openCreate = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditTarget(p); setDialogOpen(true); };

  const handleSave = async (data: ProductFormData) => {
    setSaving(true);
    try {
      if (editTarget) {
        await apiUpdate(editTarget.id, data);
      } else {
        await apiCreate(data as Omit<Product, "id">);
      }
      setDialogOpen(false);
      await loadProducts();
    } catch {
      alert("Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    try {
      await apiDelete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Failed to delete.");
    } finally {
      setDeleteId(null);
    }
  };

  const toggleStock = async (p: Product) => {
    try {
      await apiToggle(p.id, !p.in_stock);
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, in_stock: !x.in_stock } : x))
      );
    } catch {
      alert("Failed to update.");
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const inStock = products.filter((p) => p.in_stock).length;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="p-6 flex flex-col gap-6">
        {/* Metric cards — always visible */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Products", value: products.length },
            { label: "In Stock", value: inStock },
            { label: "Out of Stock", value: products.length - inStock },
            { label: "Categories", value: categories.length },
          ].map((s) => (
            <Card key={s.label} className="shadow-none border py-0">
              <CardContent className="px-4 pt-4 pb-4">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs below metric cards */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TabsList className="h-9">
              <TabsTrigger value="products" className="text-xs px-4">Products</TabsTrigger>
              <TabsTrigger value="categories" className="text-xs px-4">Categories</TabsTrigger>
            </TabsList>
            {activeTab === "products" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadProducts} disabled={loading} className="gap-1.5 text-xs h-8 bg-card cursor-pointer">
                  <FaSyncAlt size={12} className={loading ? "animate-spin" : ""} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={openCreate}
                  className="gap-1.5 text-xs h-8 cursor-pointer"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <FaPlus size={13} />
                  Add Product
                </Button>
              </div>
            )}
          </div>

          {/* ── Products tab ─────────────────────────────────────── */}
          <TabsContent value="products" className="mt-4 flex flex-col gap-4">
            {/* Table card */}
            <Card className="shadow-none border py-0">
              <CardHeader className="px-4 py-3 border-b">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-sm font-medium">Catalogue</CardTitle>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or category…"
                    className="h-8 text-xs w-56 bg-white border-gray-300"
                  />
                </div>
              </CardHeader>

              {loading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-md animate-pulse bg-muted" />
                  ))}
                </div>
              ) : error ? (
                <div className="py-20 text-center">
                  <FaBoxOpen className="mx-auto mb-3 text-muted-foreground" size={32} />
                  <p className="text-sm text-muted-foreground">Failed to load products. Is the backend running?</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <FaBoxOpen className="mx-auto mb-3 text-muted-foreground" size={32} />
                  <p className="text-sm text-muted-foreground">
                    {search ? "No products match your search." : "No products yet. Add your first one."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wide">Name</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide hidden sm:table-cell">Category</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide">Price</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide hidden md:table-cell">Sizes</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide hidden lg:table-cell">Tags</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide">Stock</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="py-3">
                          <button
                            onClick={() => openEdit(product)}
                            className="text-left hover:underline underline-offset-2 cursor-pointer"
                          >
                            <p className="text-sm font-medium leading-tight">{product.name}</p>
                            {product.tagline && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{product.tagline}</p>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell py-3">
                          {product.category}
                        </TableCell>
                        <TableCell className="py-3">
                          <p className="text-sm font-medium">₹{product.price.toLocaleString()}</p>
                          {product.original_price && (
                            <p className="text-xs text-muted-foreground line-through">₹{product.original_price.toLocaleString()}</p>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell py-3">
                          {product.sizes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {product.sizes.map((s) => (
                                <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">{s}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell py-3">
                          {product.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {product.tags.slice(0, 3).map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                              ))}
                              {product.tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{product.tags.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <button
                            onClick={() => toggleStock(product)}
                            className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                            style={{ color: product.in_stock ? "#16A34A" : "#DC2626" }}
                          >
                            {product.in_stock ? <FaCheckCircle size={14} /> : <FaTimesCircle size={14} />}
                            {product.in_stock ? "In Stock" : "Out"}
                          </button>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                            onClick={() => handleDelete(product.id)}
                            disabled={deleteId === product.id}
                          >
                            <FaTrash size={13} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* ── Categories tab ───────────────────────────────────── */}
          <TabsContent value="categories" className="mt-4">
            <Card className="shadow-none border py-0">
              <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-sm font-medium">Manage Categories</CardTitle>
              </CardHeader>
              <CardContent className="px-4 py-5 flex flex-col gap-5">
                <div className="flex flex-wrap gap-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No categories yet. Add your first one below.</p>
                  ) : (
                    categories.map((cat) => (
                      <span
                        key={cat.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium bg-muted/40"
                      >
                        {cat.name}
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          disabled={deletingCatId === cat.id}
                          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 ml-0.5"
                        >
                          <FaTrash size={11} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={newCatName}
                    onChange={(e) => { setNewCatName(e.target.value); setCatError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddCategory(); } }}
                    placeholder="New category name"
                    className="h-8 text-xs w-56"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddCategory}
                    disabled={savingCat || !newCatName.trim()}
                    className="gap-1.5 text-xs h-8"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <FaPlus size={11} />
                    Add
                  </Button>
                </div>
                {catError && <p className="text-xs text-red-500">{catError}</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editTarget ? { ...editTarget } : EMPTY_FORM}
        onSave={handleSave}
        saving={saving}
        productId={editTarget?.id}
        categories={categories.map((c) => c.name)}
      />
    </div>
  );
}
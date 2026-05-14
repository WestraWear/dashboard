"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Product } from "@/models/product";
import { uploadProductImage, deleteProductImage } from "@/controllers/productController";
import { FaCloudUploadAlt, FaTimesCircle } from "react-icons/fa";

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "One Size", "Free Size"];

export type ProductFormData = Omit<Product, "id">;

export const EMPTY_FORM: ProductFormData = {
  name: "",
  tagline: "",
  category: "",
  price: 0,
  original_price: undefined,
  sizes: [],
  tags: [],
  in_stock: true,
  description: "",
  image_placeholder: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  initial: ProductFormData;
  onSave: (data: ProductFormData) => Promise<void>;
  saving: boolean;
  productId?: string;
  categories: string[];
}

export default function ProductFormDialog({ open, onClose, initial, onSave, saving, productId, categories }: Props) {
  const [form, setForm] = useState<ProductFormData>(initial);
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(initial);
    setTagInput("");
    setUploadError("");
  }, [initial, open]);

  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const toggleSize = (s: string) =>
    set("sizes", form.sizes.includes(s) ? form.sizes.filter((x) => x !== s) : [...form.sizes, s]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]);
    setTagInput("");
  };

  const handleRemoveImage = async () => {
    if (productId) {
      try { await deleteProductImage(productId); } catch { /* best-effort */ }
    }
    set("image_placeholder", "");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadProductImage(file);
      set("image_placeholder", url);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="!max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-2">
        {/* Static header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">
            {initial.name ? "Edit Product" : "New Product"}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-4">
          {/* Name */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Product Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Banarasi Silk Saree"
              className="text-sm h-9"
            />
          </div>

          {/* Tagline */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Tagline</Label>
            <Input
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Short marketing line"
              className="text-sm h-9"
            />
          </div>

          {/* Category */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Category *</Label>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No categories yet — add them on the Products page.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set("category", cat)}
                    className="px-3 py-1 rounded text-xs font-medium border transition-colors"
                    style={{
                      background: form.category === cat ? "var(--primary)" : "transparent",
                      color: form.category === cat ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      borderColor: form.category === cat ? "var(--primary)" : "var(--border)",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Price (₹) *</Label>
              <Input
                type="number"
                value={form.price || ""}
                onChange={(e) => set("price", Number(e.target.value))}
                placeholder="0"
                className="text-sm h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Original Price (₹)</Label>
              <Input
                type="number"
                value={form.original_price ?? ""}
                onChange={(e) =>
                  set("original_price", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="For strikethrough"
                className="text-sm h-9"
              />
            </div>
          </div>

          {/* Sizes */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Sizes</Label>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className="px-3 py-1 rounded text-xs border transition-colors"
                  style={{
                    background: form.sizes.includes(s) ? "var(--primary)" : "transparent",
                    color: form.sizes.includes(s) ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    borderColor: form.sizes.includes(s) ? "var(--primary)" : "var(--border)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Type and press Enter"
                className="text-sm h-9 flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag} className="h-9 px-3">
                Add
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {form.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[11px] cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => set("tags", form.tags.filter((t) => t !== tag))}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Product details..."
              className="text-sm resize-none"
              rows={3}
            />
          </div>

          <Separator />

          {/* Image Upload */}
          <div className="grid gap-2">
            <Label className="text-xs">Product Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {form.image_placeholder ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_placeholder}
                  alt="Product"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage()}
                  className="absolute top-2 right-2 bg-white rounded-full p-0.5 text-red-500 hover:text-red-700 shadow transition-colors"
                >
                  <FaTimesCircle size={16} />
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute bottom-2 right-2 text-xs h-7"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Replace
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center justify-center gap-2 w-full h-32 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground disabled:opacity-60"
              >
                {uploading ? (
                  <span className="text-xs animate-pulse">Uploading…</span>
                ) : (
                  <>
                    <FaCloudUploadAlt size={22} />
                    <span className="text-xs">Click to upload image</span>
                    <span className="text-[11px] opacity-60">JPG, PNG, WEBP up to 10MB</span>
                  </>
                )}
              </button>
            )}

            {uploadError && (
              <p className="text-[11px] text-destructive">{uploadError}</p>
            )}
          </div>

          <Separator />

          {/* In stock toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">In Stock</p>
              <p className="text-xs text-muted-foreground">Toggle availability on the shop</p>
            </div>
            <Switch
              checked={form.in_stock}
              onCheckedChange={(v) => set("in_stock", v)}
            />
          </div>
        </div>

        {/* Static footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(form)}
            disabled={saving || uploading || !form.name || !form.price}
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {saving ? "Saving…" : "Save Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

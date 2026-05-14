"use client";

import { useEffect, useState, useCallback } from "react";
import { FaUserCircle, FaTrash, FaPlus } from "react-icons/fa";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type AdminUser = {
  username: string;
  display_name: string;
  role: string;
};

export default function UsersPage() {
  const { username: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", display_name: "", role: "administrator" as string });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND}/auth/users`);
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (username: string) => {
    if (!confirm(`Remove user "${username}"?`)) return;
    await authFetch(`${BACKEND}/auth/users/${username}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((u) => u.username !== username));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = "Required";
    if (form.password.length < 6) errs.password = "Minimum 6 characters";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await authFetch(`${BACKEND}/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          display_name: form.display_name.trim() || undefined,
          role: form.role,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors({ form: data.detail ?? "Failed to create user" });
        return;
      }
      const created: AdminUser = await res.json();
      setUsers((prev) => [...prev, created]);
      setForm({ username: "", password: "", display_name: "", role: "administrator" });
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const openForm = () => {
    setForm({ username: "", password: "", display_name: "", role: "administrator" });
    setErrors({});
    setShowForm(true);
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Users</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage dashboard admin accounts</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs h-8 cursor-pointer" onClick={openForm}>
          <FaPlus size={10} /> Add User
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setErrors({}); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">New Admin User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Username *</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. johndoe"
                className="h-8 text-xs"
              />
              {errors.username && <p className="text-[11px] text-red-500">{errors.username}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Password *</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 6 characters"
                className="h-8 text-xs"
              />
              {errors.password && <p className="text-[11px] text-red-500">{errors.password}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Display Name</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Optional — defaults to username"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="h-8 text-xs capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrator" className="text-xs">Administrator</SelectItem>
                  <SelectItem value="manager" className="text-xs">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {errors.form && (
              <p className="sm:col-span-2 text-[11px] text-red-500">{errors.form}</p>
            )}
            <DialogFooter className="sm:col-span-2 pt-2">
              <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="text-xs h-8 cursor-pointer" disabled={submitting}>
                {submitting ? "Creating…" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Users table */}
      <Card className="shadow-none border py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 opacity-40">
              <FaUserCircle size={32} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No users found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Username</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.username} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold shrink-0"
                          style={{ background: "var(--sidebar)" }}
                        >
                          {user.display_name[0].toUpperCase()}
                        </span>
                        <span className="font-medium text-foreground text-[13px]">{user.display_name}</span>
                        {user.username === currentUser && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">You</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground font-mono">{user.username}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px] capitalize">{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.username !== currentUser && (
                        <button
                          onClick={() => handleDelete(user.username)}
                          className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors cursor-pointer"
                          title="Remove user"
                        >
                          <FaTrash size={11} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

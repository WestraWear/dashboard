"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaLock, FaUser } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-sm rounded-lg border p-8 flex flex-col gap-6"
      style={{ background: "var(--card)" }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-10 w-32">
          <Image
            src="/logo_transparent.png"
            alt="Westra"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sign in to continue</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="username" className="text-xs">Username</Label>
          <div className="relative">
            <FaUser
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="pl-8 h-9 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="password" className="text-xs">Password</Label>
          <div className="relative">
            <FaLock
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-8 h-9 text-sm"
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded px-3 py-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-9 text-sm mt-1"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";

type Me = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500";

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setMe(data.user);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change password");
        return;
      }
      setMessage("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !me) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Account" subtitle="Loading…" />
        <p className="p-8 text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  const home = me.role === "TRAINER" ? "/trainer" : "/student";

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Account"
        subtitle={`${me.displayName} (@${me.username})`}
        badge={me.role === "TRAINER" ? "Trainer" : "Student"}
      />
      <main className="max-w-md mx-auto px-4 py-8 w-full space-y-6">
        <Link href={home} className="text-xs text-slate-400 hover:text-sky-300">
          ← Back to dashboard
        </Link>

        <form
          onSubmit={onSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-100">Change password</h2>
          <p className="text-xs text-slate-500">
            New password must be at least 8 characters. Stored with bcrypt.
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              required
              autoComplete="current-password"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Confirm new password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm"
          >
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      </main>
    </div>
  );
}

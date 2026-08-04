"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TrainerNav } from "@/components/TrainerNav";

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  createdAt: string;
  _count: { submissions: number; assignments: number };
};

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500";

export default function TrainerUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "TRAINER">("STUDENT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Failed to load users");
    const data = await res.json();
    setUsers(data.users);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create user");
        return;
      }
      setMessage(`Created ${data.user.username}.`);
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("STUDENT");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Provision student and trainer accounts"
        badge="Trainer"
      />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-6">
        <TrainerNav active="users" />

        <form
          onSubmit={onCreate}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-xl"
        >
          <h2 className="text-sm font-semibold text-slate-100">Create user</h2>
          <p className="text-xs text-slate-500">
            Passwords are hashed with bcrypt (min 8 characters for new accounts).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 block">
              <span className="text-xs text-slate-400">Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-slate-400">Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-slate-400">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
                minLength={8}
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-slate-400">Role</span>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "STUDENT" | "TRAINER")
                }
                className={inputClass}
              >
                <option value="STUDENT">Student</option>
                <option value="TRAINER">Trainer</option>
              </select>
            </label>
          </div>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm"
          >
            {saving ? "Creating…" : "Create account"}
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-slate-400">Loading users…</p>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 text-xs font-semibold text-slate-400">
              Accounts ({users.length})
            </div>
            <div className="divide-y divide-slate-800">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm text-slate-100">
                      {u.displayName}{" "}
                      <span className="text-slate-500">@{u.username}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {u._count.assignments} assigned · {u._count.submissions}{" "}
                      submissions
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      u.role === "TRAINER"
                        ? "border-emerald-500/30 text-emerald-400"
                        : "border-sky-500/30 text-sky-400"
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

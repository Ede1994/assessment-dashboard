"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }
      router.push(data.redirectTo ?? "/student");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-100">Create student account</h1>
          <p className="text-sm text-slate-400">
            Self-registration creates a student role. Trainers are provisioned by an
            existing trainer. Password minimum 8 characters.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              autoComplete="username"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              autoComplete="name"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-slate-400">Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>

          {error ? (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center">
          Already registered?{" "}
          <Link href="/login" className="text-sky-400 hover:text-sky-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

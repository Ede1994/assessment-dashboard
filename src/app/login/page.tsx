"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push(data.redirectTo);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function fill(role: "student" | "trainer") {
    if (role === "student") {
      setUsername("student");
      setPassword("student");
    } else {
      setUsername("trainer");
      setPassword("NRAD2026");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl">
            <i className="fa-solid fa-brain text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            Student Assessment Platform
          </h1>
          <p className="text-sm text-slate-400">
            Sign in with your account. Passwords are stored as bcrypt hashes —
            never plaintext.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => fill("student")}
              className="text-xs px-3 py-2 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 hover:border-sky-500/40 transition"
            >
              Demo student
            </button>
            <button
              type="button"
              onClick={() => fill("trainer")}
              className="text-xs px-3 py-2 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 hover:border-emerald-500/40 transition"
            >
              Demo trainer
            </button>
          </div>
        </form>

        <p className="text-xs text-slate-500 text-center">
          New student?{" "}
          <Link href="/register" className="text-sky-400 hover:text-sky-300">
            Create an account
          </Link>
        </p>
        <div className="text-xs text-slate-600 text-center space-y-1">
          <p>
            Seeded demos (hashed):{" "}
            <code className="text-slate-400">student / student</code>,{" "}
            <code className="text-slate-400">trainer / NRAD2026</code>
          </p>
        </div>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function AppHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-50 px-4 lg:px-8 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
            <i className="fa-solid fa-brain text-2xl" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              {title}
              {badge ? (
                <span className="text-xs bg-sky-500/20 text-sky-300 px-2.5 py-0.5 rounded-full border border-sky-500/30">
                  {badge}
                </span>
              ) : null}
            </h1>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-sky-300 border border-slate-800 transition"
          >
            <i className="fa-solid fa-key mr-1.5" />
            Account
          </Link>
          <button
            type="button"
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-rose-300 border border-slate-800 transition"
          >
            <i className="fa-solid fa-right-from-bracket mr-1.5" />
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

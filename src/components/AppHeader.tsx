"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon?: string;
  active?: boolean;
};

type ProgressChip = {
  answered: number;
  total: number;
};

export function AppHeader({
  title,
  subtitle,
  badge,
  nav,
  progress,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  nav?: NavItem[];
  progress?: ProgressChip | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.user?.displayName) {
          setDisplayName(String(data.user.displayName));
        }
      } catch {
        // ignore — header still works without name
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
              {progress && progress.total > 0 ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 tabular-nums font-medium">
                  <i className="fa-solid fa-chart-line mr-1.5 text-emerald-400" />
                  {progress.answered}/{progress.total}
                </span>
              ) : null}
            </h1>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {nav?.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                item.active
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-slate-950 text-slate-400 hover:text-sky-300 border-slate-800"
              }`}
            >
              {item.icon ? <i className={`fa-solid ${item.icon} mr-1.5`} /> : null}
              {item.label}
            </Link>
          ))}
          {displayName ? (
            <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 max-w-[10rem] truncate">
              <i className="fa-solid fa-user mr-1.5 text-sky-400" />
              {displayName}
            </span>
          ) : null}
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

"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "assessment-theme";

export function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("light") ? "light" : "dark",
    );
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const light = theme === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ||
        "text-xs px-3 py-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800 transition"
      }
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Dark theme" : "Light theme"}
    >
      <i className={`fa-solid ${light ? "fa-moon" : "fa-sun"}`} />
      <span className="ml-1.5 hidden sm:inline">{light ? "Dark" : "Light"}</span>
    </button>
  );
}

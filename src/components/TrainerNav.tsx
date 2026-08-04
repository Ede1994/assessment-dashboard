"use client";

import Link from "next/link";

export function TrainerNav({
  active,
}: {
  active:
    | "overview"
    | "questions"
    | "submissions"
    | "assignments"
    | "users";
}) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
      <NavLink
        href="/trainer"
        label="Overview"
        icon="fa-chart-simple"
        active={active === "overview"}
      />
      <NavLink
        href="/trainer/questions"
        label="Question bank"
        icon="fa-book"
        active={active === "questions"}
      />
      <NavLink
        href="/trainer/assignments"
        label="Assign tasks"
        icon="fa-list-check"
        active={active === "assignments"}
      />
      <NavLink
        href="/trainer/submissions"
        label="Student answers"
        icon="fa-users"
        active={active === "submissions"}
      />
      <NavLink
        href="/trainer/users"
        label="Users"
        icon="fa-user-plus"
        active={active === "users"}
      />
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 border ${
        active
          ? "bg-sky-600 text-white border-sky-600"
          : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
      }`}
    >
      <i className={`fa-solid ${icon}`} />
      {label}
    </Link>
  );
}

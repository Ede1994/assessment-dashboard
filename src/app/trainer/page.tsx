"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TrainerNav } from "@/components/TrainerNav";

type StudentRow = {
  id: string;
  username: string;
  displayName: string;
  answered: number;
  total: number;
};

export default function TrainerHomePage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/submissions");
        if (!res.ok) throw new Error("Failed to load overview");
        const data = await res.json();
        if (cancelled) return;
        setStudents(data.students ?? []);
        setSubmissionCount((data.submissions ?? []).length);
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

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Review solutions and student submissions"
        badge="Trainer"
      />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-8">
        <TrainerNav active="overview" />

        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 p-6 rounded-2xl border border-emerald-500/20 shadow-xl">
          <h2 className="text-base font-bold text-emerald-300 flex items-center gap-2 mb-2">
            <i className="fa-solid fa-chalkboard-user" />
            Trainer overview
          </h2>
          <p className="text-sm text-slate-400">
            View the full answer key, inspect ideal solutions, and compare each student
            submission side-by-side with the reference answer.
          </p>
        </section>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                label="Students"
                value={String(students.length)}
                icon="fa-user-graduate"
              />
              <StatCard
                label="Total submissions"
                value={String(submissionCount)}
                icon="fa-inbox"
              />
              <StatCard
                label="Questions in bank"
                value={String(students[0]?.total ?? "—")}
                icon="fa-list-check"
              />
            </div>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200">Student progress</h3>
              </div>
              <div className="divide-y divide-slate-800">
                {students.map((s) => {
                  const pct =
                    s.total === 0 ? 0 : Math.round((s.answered / s.total) * 100);
                  return (
                    <div
                      key={s.id}
                      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          {s.displayName}
                        </p>
                        <p className="text-xs text-slate-500">@{s.username}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-40 bg-slate-950 rounded-full h-2 border border-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 tabular-nums w-20 text-right">
                          {s.answered}/{s.total} ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/trainer/assignments"
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm transition"
              >
                Assign tasks
              </Link>
              <Link
                href="/trainer/questions"
                className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm hover:border-slate-600 transition"
              >
                Open question bank
              </Link>
              <Link
                href="/trainer/submissions"
                className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm hover:border-slate-600 transition"
              >
                Review submissions
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-sky-400">
          <i className={`fa-solid ${icon}`} />
        </div>
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

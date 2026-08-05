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
  freeTextAnswered: number;
  mcAnswered: number;
  mcCorrect: number;
  mcScorePct: number | null;
};

export default function TrainerHomePage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [bankTotal, setBankTotal] = useState<number | null>(null);
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
        setStudents(data.scoreboard ?? data.students ?? []);
        setSubmissionCount((data.submissions ?? []).length);
        setBankTotal(
          typeof data.bank?.totalQuestions === "number"
            ? data.bank.totalQuestions
            : null,
        );
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

  const ranked = [...students].sort((a, b) => {
    const ap = a.mcScorePct ?? -1;
    const bp = b.mcScorePct ?? -1;
    if (bp !== ap) return bp - ap;
    return b.answered - a.answered;
  });

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
            Multiple-choice answers are graded automatically. Free-text answers
            can be scored and released to students on the submissions page.
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
                value={bankTotal != null ? String(bankTotal) : "—"}
                icon="fa-list-check"
              />
            </div>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-200">
                  MC scoreboard
                </h3>
                <span className="text-[11px] text-slate-500">
                  Click a row to open that student’s submissions
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="text-left font-medium px-5 py-3">#</th>
                      <th className="text-left font-medium px-5 py-3">Student</th>
                      <th className="text-right font-medium px-5 py-3">MC score</th>
                      <th className="text-right font-medium px-5 py-3">MC correct</th>
                      <th className="text-right font-medium px-5 py-3">Completed</th>
                      <th className="text-right font-medium px-5 py-3">Free text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {ranked.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-950/60">
                        <td className="px-5 py-3 text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/trainer/submissions?student=${s.id}`}
                            className="block group"
                          >
                            <p className="text-slate-100 font-medium group-hover:text-sky-300 transition">
                              {s.displayName}
                            </p>
                            <p className="text-xs text-slate-500">@{s.username}</p>
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {s.mcScorePct === null ? (
                            <span className="text-slate-600">—</span>
                          ) : (
                            <span
                              className={
                                s.mcScorePct >= 70
                                  ? "text-emerald-400 font-semibold"
                                  : s.mcScorePct >= 40
                                    ? "text-amber-300 font-semibold"
                                    : "text-rose-400 font-semibold"
                              }
                            >
                              {s.mcScorePct}%
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-300 tabular-nums">
                          {s.mcCorrect}/{s.mcAnswered}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-300 tabular-nums">
                          {s.answered}/{s.total}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-400 tabular-nums">
                          {s.freeTextAnswered}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MathText } from "@/components/MathText";
import { TrainerNav } from "@/components/TrainerNav";

type StudentRow = {
  id: string;
  username: string;
  displayName: string;
  answered: number;
  total: number;
  mcCorrect?: number;
  mcAnswered?: number;
  mcScorePct?: number | null;
};

type SubmissionRow = {
  id: string;
  textAnswer: string | null;
  selectedChoiceId: string | null;
  aiFeedback: string | null;
  aiReviewedAt: string | null;
  updatedAt: string;
  user: { id: string; username: string; displayName: string };
  selectedChoice: { id: string; label: string; isCorrect: boolean } | null;
  question: {
    id: string;
    title: string;
    prompt: string;
    type: "FREE_TEXT" | "MULTIPLE_CHOICE";
    category: { name: string; slug: string };
    solution: {
      idealAnswer: string;
      explanation: string;
      codeSolution: string | null;
    } | null;
    choices: Array<{ id: string; label: string; isCorrect: boolean }>;
  };
};

export default function TrainerSubmissionsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [studentFilter, setStudentFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/submissions");
        if (!res.ok) throw new Error("Failed to load submissions");
        const data = await res.json();
        if (cancelled) return;
        setStudents(data.students ?? []);
        setSubmissions(data.submissions ?? []);
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

  const filtered = useMemo(() => {
    if (studentFilter === "all") return submissions;
    return submissions.filter((s) => s.user.id === studentFilter);
  }, [submissions, studentFilter]);

  async function runAiReview(submissionId: string) {
    setAiBusyId(submissionId);
    setAiError("");
    try {
      const res = await fetch(`/api/submissions/${submissionId}/ai-review`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "AI review failed");
        return;
      }
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                aiFeedback: data.submission.aiFeedback,
                aiReviewedAt: data.submission.aiReviewedAt,
              }
            : s,
        ),
      );
    } catch {
      setAiError("Network error while requesting AI review");
    } finally {
      setAiBusyId(null);
    }
  }

  function exportCsv() {
    const rows = filtered;
    const escape = (value: string) => {
      if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };
    const header = [
      "student_username",
      "student_display_name",
      "category",
      "question_title",
      "question_type",
      "answer",
      "mc_correct",
      "updated_at",
      "ai_feedback",
    ];
    const lines = [header.join(",")];
    for (const s of rows) {
      const answer =
        s.question.type === "FREE_TEXT"
          ? s.textAnswer ?? ""
          : (s.selectedChoice?.label ?? "");
      const mcCorrect =
        s.question.type === "MULTIPLE_CHOICE" && s.selectedChoice
          ? s.selectedChoice.isCorrect
            ? "true"
            : "false"
          : "";
      lines.push(
        [
          s.user.username,
          s.user.displayName,
          s.question.category.name,
          s.question.title,
          s.question.type,
          answer,
          mcCorrect,
          s.updatedAt,
          s.aiFeedback ?? "",
        ]
          .map((cell) => escape(String(cell)))
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download =
      studentFilter === "all"
        ? `submissions-${stamp}.csv`
        : `submissions-${stamp}-filtered.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Student answers compared with ideal solutions"
        badge="Trainer"
      />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-8">
        <TrainerNav active="submissions" />

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 mr-2">Filter student:</span>
            <button
              type="button"
              onClick={() => setStudentFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs border ${
                studentFilter === "all"
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-slate-900 text-slate-400 border-slate-800"
              }`}
            >
              All
            </button>
            {students.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStudentFilter(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  studentFilter === s.id
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-slate-900 text-slate-400 border-slate-800"
                }`}
              >
                {s.displayName} ({s.answered}/{s.total}
                {s.mcScorePct != null ? ` · MC ${s.mcScorePct}%` : ""})
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || filtered.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-sky-500/40 hover:text-sky-300 disabled:opacity-40"
            title="Download currently filtered submissions as CSV"
          >
            <i className="fa-solid fa-download mr-1.5" />
            Export CSV
          </button>
        </div>

        {aiError ? (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            {aiError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">
            No submissions yet. Have a student answer some questions first.
          </p>
        ) : (
          <section className="grid grid-cols-1 gap-6">
            {filtered.map((s) => (
              <article
                key={s.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      {s.question.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {s.question.category.name} • answered by{" "}
                      <span className="text-slate-300">{s.user.displayName}</span> (@
                      {s.user.username}) •{" "}
                      {new Date(s.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  {s.question.type === "MULTIPLE_CHOICE" && s.selectedChoice ? (
                    <span
                      className={`text-xs px-3 py-1.5 rounded-lg border ${
                        s.selectedChoice.isCorrect
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {s.selectedChoice.isCorrect
                        ? "Correct (auto-graded)"
                        : "Incorrect (auto-graded)"}
                    </span>
                  ) : null}
                </div>

                <div className="text-xs text-slate-400">
                  <MathText text={s.question.prompt} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-slate-950 border border-sky-500/20 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-sky-400">
                      Student answer
                    </h4>
                    {s.question.type === "FREE_TEXT" ? (
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">
                        {s.textAnswer || "—"}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-200">
                        {s.selectedChoice?.label ?? "—"}
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-950 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400">
                      Ideal solution
                    </h4>
                    {s.question.solution ? (
                      <>
                        <div className="text-sm text-slate-200">
                          <MathText text={s.question.solution.idealAnswer} />
                        </div>
                        <div className="text-xs text-slate-400 border-t border-slate-800 pt-2">
                          <MathText text={s.question.solution.explanation} />
                        </div>
                        {s.question.solution.codeSolution ? (
                          <pre className="text-xs text-slate-300 overflow-x-auto bg-slate-900 p-2 rounded-lg border border-slate-800">
                            <code>{s.question.solution.codeSolution}</code>
                          </pre>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No solution stored.</p>
                    )}
                  </div>
                </div>

                {s.question.type === "FREE_TEXT" ? (
                  <div className="bg-slate-950 border border-violet-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-xs font-bold text-violet-300">
                        AI assist (trainer only)
                      </h4>
                      <button
                        type="button"
                        disabled={aiBusyId === s.id}
                        onClick={() => runAiReview(s.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition"
                      >
                        {aiBusyId === s.id
                          ? "Asking model…"
                          : s.aiFeedback
                            ? "Re-run AI review"
                            : "Generate AI review"}
                      </button>
                    </div>
                    {s.aiFeedback ? (
                      <>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">
                          {s.aiFeedback}
                        </p>
                        {s.aiReviewedAt ? (
                          <p className="text-[11px] text-slate-500">
                            Generated {new Date(s.aiReviewedAt).toLocaleString()}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Uses your Open WebUI / Ollama endpoint (
                        <code className="text-slate-400">AI_BASE_URL</code> +{" "}
                        <code className="text-slate-400">AI_API_KEY</code>). Suggestion
                        only — it does not change the student answer.
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        )}

        <Link href="/trainer" className="text-xs text-slate-500 hover:text-sky-300">
          ← Back to overview
        </Link>
      </main>
    </div>
  );
}

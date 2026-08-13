"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { MathText } from "@/components/MathText";
import { TrainerNav } from "@/components/TrainerNav";
import { useToast } from "@/components/Toast";
import { formatDuration } from "@/lib/time";

type StudentRow = {
  id: string;
  username: string;
  displayName: string;
  answered: number;
  total: number;
  mcCorrect?: number;
  mcAnswered?: number;
  mcScorePct?: number | null;
  timeSpentMs?: number;
};

type SubmissionRow = {
  id: string;
  textAnswer: string | null;
  selectedChoiceId: string | null;
  aiFeedback: string | null;
  aiReviewedAt: string | null;
  trainerScore: number | null;
  trainerPassed: boolean | null;
  trainerComment: string | null;
  feedbackReleased: boolean;
  trainerGradedAt: string | null;
  updatedAt: string;
  timeSpentMs?: number;
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

type GradeDraft = {
  trainerScore: string;
  trainerPassed: "" | "true" | "false";
  trainerComment: string;
  feedbackReleased: boolean;
};

function draftFromSubmission(s: SubmissionRow): GradeDraft {
  return {
    trainerScore: s.trainerScore != null ? String(s.trainerScore) : "",
    trainerPassed:
      s.trainerPassed === true
        ? "true"
        : s.trainerPassed === false
          ? "false"
          : "",
    trainerComment: s.trainerComment ?? "",
    feedbackReleased: Boolean(s.feedbackReleased),
  };
}

export default function TrainerSubmissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <AppHeader
            title="Student Assessment Platform"
            subtitle="Loading…"
            badge="Trainer"
          />
          <p className="p-8 text-sm text-slate-400">Loading submissions…</p>
        </div>
      }
    >
      <TrainerSubmissionsContent />
    </Suspense>
  );
}

function TrainerSubmissionsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStudent = searchParams.get("student") ?? "all";

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [studentFilter, setStudentFilter] = useState(initialStudent);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "FREE_TEXT" | "MULTIPLE_CHOICE">(
    "all",
  );
  const [onlyMissingAi, setOnlyMissingAi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [aiError, setAiError] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, GradeDraft>>({});
  const [gradeBusyId, setGradeBusyId] = useState<string | null>(null);
  const [gradeMessage, setGradeMessage] = useState<Record<string, string>>({});
  const [gradeError, setGradeError] = useState("");

  useEffect(() => {
    const fromUrl = searchParams.get("student") ?? "all";
    setStudentFilter(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/submissions");
        if (!res.ok) throw new Error("Failed to load submissions");
        const data = await res.json();
        if (cancelled) return;
        const rows: SubmissionRow[] = (data.submissions ?? []).map(
          (s: SubmissionRow) => ({
            ...s,
            trainerScore: s.trainerScore ?? null,
            trainerPassed: s.trainerPassed ?? null,
            trainerComment: s.trainerComment ?? null,
            feedbackReleased: Boolean(s.feedbackReleased),
            trainerGradedAt: s.trainerGradedAt ?? null,
          }),
        );
        setStudents(data.students ?? []);
        setSubmissions(rows);
        const drafts: Record<string, GradeDraft> = {};
        for (const s of rows) {
          if (s.question.type === "FREE_TEXT") {
            drafts[s.id] = draftFromSubmission(s);
          }
        }
        setGradeDrafts(drafts);
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

  function setFilter(studentId: string) {
    setStudentFilter(studentId);
    const url =
      studentId === "all"
        ? "/trainer/submissions"
        : `/trainer/submissions?student=${studentId}`;
    router.replace(url);
  }

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) {
      map.set(s.question.category.slug, s.question.category.name);
    }
    return [...map.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions]);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      if (studentFilter !== "all" && s.user.id !== studentFilter) return false;
      if (categoryFilter !== "all" && s.question.category.slug !== categoryFilter) {
        return false;
      }
      if (typeFilter !== "all" && s.question.type !== typeFilter) return false;
      if (onlyMissingAi) {
        if (s.question.type !== "FREE_TEXT") return false;
        if (s.aiFeedback) return false;
      }
      return true;
    });
  }, [submissions, studentFilter, categoryFilter, typeFilter, onlyMissingAi]);

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

  async function saveGrade(submissionId: string) {
    const draft = gradeDrafts[submissionId];
    if (!draft) return;
    setGradeBusyId(submissionId);
    setGradeError("");
    setGradeMessage((m) => ({ ...m, [submissionId]: "" }));
    try {
      const res = await fetch(`/api/submissions/${submissionId}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainerScore: draft.trainerScore === "" ? null : Number(draft.trainerScore),
          trainerPassed:
            draft.trainerPassed === ""
              ? null
              : draft.trainerPassed === "true",
          trainerComment: draft.trainerComment,
          feedbackReleased: draft.feedbackReleased,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGradeError(data.error ?? "Could not save grade");
        return;
      }
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? {
                ...s,
                trainerScore: data.submission.trainerScore,
                trainerPassed: data.submission.trainerPassed,
                trainerComment: data.submission.trainerComment,
                feedbackReleased: data.submission.feedbackReleased,
                trainerGradedAt: data.submission.trainerGradedAt,
              }
            : s,
        ),
      );
      setGradeDrafts((prev) => ({
        ...prev,
        [submissionId]: {
          trainerScore:
            data.submission.trainerScore != null
              ? String(data.submission.trainerScore)
              : "",
          trainerPassed:
            data.submission.trainerPassed === true
              ? "true"
              : data.submission.trainerPassed === false
                ? "false"
                : "",
          trainerComment: data.submission.trainerComment ?? "",
          feedbackReleased: Boolean(data.submission.feedbackReleased),
        },
      }));
      setGradeMessage((m) => ({
        ...m,
        [submissionId]: data.submission.feedbackReleased
          ? "Saved and released to student."
          : "Grade saved (not released).",
      }));
      toast(
        data.submission.feedbackReleased
          ? "Grade saved and released."
          : "Grade saved.",
        "success",
      );
    } catch {
      setGradeError("Network error while saving grade");
      toast("Could not save grade", "error");
    } finally {
      setGradeBusyId(null);
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
      "trainer_score",
      "trainer_passed",
      "trainer_comment",
      "feedback_released",
      "updated_at",
      "time_spent_ms",
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
          s.trainerScore ?? "",
          s.trainerPassed == null ? "" : String(s.trainerPassed),
          s.trainerComment ?? "",
          s.feedbackReleased ? "true" : "false",
          s.updatedAt,
          s.timeSpentMs ?? 0,
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

  function exportPdf() {
    window.print();
  }

  async function sendProgressEmail() {
    if (studentFilter === "all") {
      setEmailError("Select one student before sending a progress email.");
      return;
    }
    setEmailBusy(true);
    setEmailError("");
    setEmailMessage("");
    try {
      const res = await fetch(`/api/users/${studentFilter}/progress-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error ?? "Could not send email");
        return;
      }
      setEmailMessage(`Progress email sent to ${data.to}.`);
      toast(`Progress email sent to ${data.to}.`, "success");
    } catch {
      setEmailError("Network error");
      toast("Could not send email", "error");
    } finally {
      setEmailBusy(false);
    }
  }

  const selectedStudent = students.find((s) => s.id === studentFilter);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="no-print">
        <AppHeader
          title="Student Assessment Platform"
          subtitle="Student answers compared with ideal solutions"
          badge="Trainer"
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-8">
        <div className="no-print">
          <TrainerNav active="submissions" />
        </div>

        <div className="print-only mb-4">
          <h1 className="text-xl font-bold">
            Submissions export
            {selectedStudent
              ? ` — ${selectedStudent.displayName}`
              : " — all students"}
          </h1>
          <p className="text-sm text-slate-600">
            Generated {new Date().toLocaleString()} · {filtered.length} row(s)
          </p>
        </div>

        <div className="no-print flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 mr-2">Filter student:</span>
            <button
              type="button"
              onClick={() => setFilter("all")}
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
                onClick={() => setFilter(s.id)}
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
          <div className="flex flex-wrap gap-2">
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
            <button
              type="button"
              onClick={exportPdf}
              disabled={loading || filtered.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-sky-500/40 hover:text-sky-300 disabled:opacity-40"
              title="Print / save as PDF (browser print dialog)"
            >
              <i className="fa-solid fa-file-pdf mr-1.5" />
              Export PDF
            </button>
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2 items-center">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(
                e.target.value as "all" | "FREE_TEXT" | "MULTIPLE_CHOICE",
              )
            }
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            <option value="FREE_TEXT">Free text only</option>
            <option value="MULTIPLE_CHOICE">Multiple choice only</option>
          </select>
          <label className="inline-flex items-center gap-2 text-xs text-slate-400 px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyMissingAi}
              onChange={(e) => setOnlyMissingAi(e.target.checked)}
            />
            Missing AI review
          </label>
          <span className="text-[11px] text-slate-500">
            Showing {filtered.length} / {submissions.length}
          </span>
        </div>

        {studentFilter !== "all" ? (
          <form
            className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendProgressEmail();
            }}
          >
            <label className="space-y-1 block flex-1 min-w-[14rem]">
              <span className="text-xs text-slate-400">
                Email progress for {selectedStudent?.displayName ?? "student"}
              </span>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                required
                placeholder="recipient@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </label>
            <button
              type="submit"
              disabled={emailBusy}
              className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs"
            >
              {emailBusy ? "Sending…" : "Send progress email"}
            </button>
            {emailMessage ? (
              <span className="text-xs text-emerald-400">{emailMessage}</span>
            ) : null}
            {emailError ? (
              <span className="text-xs text-rose-400">{emailError}</span>
            ) : null}
          </form>
        ) : null}

        {aiError ? (
          <p className="no-print text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            {aiError}
          </p>
        ) : null}
        {gradeError ? (
          <p className="no-print text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {gradeError}
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
            {filtered.map((s) => {
              const draft = gradeDrafts[s.id];
              return (
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
                        <span className="text-slate-300">{s.user.displayName}</span>{" "}
                        (@{s.user.username}) •{" "}
                        {new Date(s.updatedAt).toLocaleString()}
                        {(s.timeSpentMs ?? 0) > 0 ? (
                          <>
                            {" "}
                            •{" "}
                            <span className="tabular-nums">
                              {formatDuration(s.timeSpentMs ?? 0)} on task
                            </span>
                          </>
                        ) : null}
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
                    ) : s.feedbackReleased ? (
                      <span className="text-xs px-3 py-1.5 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Feedback released
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

                  {s.question.type === "FREE_TEXT" && draft ? (
                    <div className="no-print bg-slate-950 border border-amber-500/20 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-amber-300">
                        Trainer grade
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="space-y-1 block">
                          <span className="text-[11px] text-slate-500">
                            Score (0–100)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={draft.trainerScore}
                            onChange={(e) =>
                              setGradeDrafts((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...draft,
                                  trainerScore: e.target.value,
                                },
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                          />
                        </label>
                        <label className="space-y-1 block">
                          <span className="text-[11px] text-slate-500">
                            Pass / fail
                          </span>
                          <select
                            value={draft.trainerPassed}
                            onChange={(e) =>
                              setGradeDrafts((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...draft,
                                  trainerPassed: e.target.value as GradeDraft["trainerPassed"],
                                },
                              }))
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                          >
                            <option value="">Not set</option>
                            <option value="true">Pass</option>
                            <option value="false">Needs work</option>
                          </select>
                        </label>
                        <label className="flex items-end gap-2 pb-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.feedbackReleased}
                            onChange={(e) =>
                              setGradeDrafts((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...draft,
                                  feedbackReleased: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span className="text-xs text-slate-300">
                            Release feedback to student
                          </span>
                        </label>
                      </div>
                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-500">Comment</span>
                        <textarea
                          rows={3}
                          value={draft.trainerComment}
                          onChange={(e) =>
                            setGradeDrafts((prev) => ({
                              ...prev,
                              [s.id]: {
                                ...draft,
                                trainerComment: e.target.value,
                              },
                            }))
                          }
                          placeholder="Short note for the student…"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500 resize-y"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          disabled={gradeBusyId === s.id}
                          onClick={() => saveGrade(s.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white transition"
                        >
                          {gradeBusyId === s.id ? "Saving…" : "Save grade"}
                        </button>
                        {gradeMessage[s.id] ? (
                          <span className="text-xs text-emerald-400">
                            {gradeMessage[s.id]}
                          </span>
                        ) : null}
                        {s.trainerGradedAt ? (
                          <span className="text-[11px] text-slate-500">
                            Last graded{" "}
                            {new Date(s.trainerGradedAt).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {s.question.type === "FREE_TEXT" ? (
                    <div className="no-print bg-slate-950 border border-violet-500/20 rounded-xl p-4 space-y-3">
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
                          <code className="text-slate-400">AI_API_KEY</code>).
                          Suggestion only — it does not change the student answer.
                        </p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        )}

        <Link
          href="/trainer"
          className="no-print text-xs text-slate-500 hover:text-sky-300"
        >
          ← Back to overview
        </Link>
      </main>
    </div>
  );
}

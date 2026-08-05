"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { MathText } from "@/components/MathText";
import { categoryColors } from "@/lib/colors";
import type { ChoiceDto, QuestionListItem, SubmissionDto } from "@/lib/types";

type QuestionDetail = Omit<QuestionListItem, "answered"> & {
  submission: SubmissionDto | null;
  examMode?: boolean;
  mcLocked?: boolean;
};

function draftKey(questionId: string) {
  return `assessment-draft:${questionId}`;
}

export default function StudentQuestionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mcCorrect, setMcCorrect] = useState<boolean | null>(null);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [draftHint, setDraftHint] = useState("");
  const [mcLocked, setMcLocked] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const [progress, setProgress] = useState<{ answered: number; total: number } | null>(
    null,
  );
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setMessage("");
      setDraftHint("");
      try {
        const [detailRes, listRes] = await Promise.all([
          fetch(`/api/questions/${params.id}`),
          fetch("/api/questions"),
        ]);
        if (!detailRes.ok) throw new Error("Question not found");
        const data = await detailRes.json();
        if (cancelled) return;
        setQuestion(data);
        setSelectedChoiceId(data.submission?.selectedChoiceId ?? null);
        setMcCorrect(
          typeof data.mcCorrect === "boolean" ? data.mcCorrect : null,
        );
        setMcLocked(Boolean(data.mcLocked));
        setExamMode(Boolean(data.examMode));

        const saved = data.submission?.textAnswer ?? "";
        let initialText = saved;
        if (data.type === "FREE_TEXT" && !saved) {
          try {
            const draft = localStorage.getItem(draftKey(params.id));
            if (draft) {
              initialText = draft;
              setDraftHint("Restored local draft (not submitted yet).");
            }
          } catch {
            // localStorage may be unavailable
          }
        }
        setTextAnswer(initialText);
        loadedId.current = params.id;

        if (listRes.ok) {
          const list = await listRes.json();
          const ids: string[] = (list.questions ?? []).map(
            (q: QuestionListItem) => q.id,
          );
          const idx = ids.indexOf(params.id);
          setPrevId(idx > 0 ? ids[idx - 1] : null);
          setNextId(idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : null);
          if (list.progress) {
            setProgress({
              answered: list.progress.answered,
              total: list.progress.total,
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (!question || question.type !== "FREE_TEXT") return;
    if (loadedId.current !== question.id) return;
    if (question.submission?.textAnswer) return;

    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        const key = draftKey(question.id);
        if (!textAnswer.trim()) {
          localStorage.removeItem(key);
          setDraftHint("");
          return;
        }
        localStorage.setItem(key, textAnswer);
        setDraftHint("Draft saved locally");
      } catch {
        // ignore
      }
    }, 500);

    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [textAnswer, question]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`;
  }, [textAnswer, question?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!question || mcLocked || saving) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (question.type === "MULTIPLE_CHOICE") {
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        const n = Number(e.key);
        if (n >= 1 && n <= question.choices.length) {
          e.preventDefault();
          setSelectedChoiceId(question.choices[n - 1].id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, mcLocked, saving]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question || mcLocked) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          textAnswer:
            question.type === "FREE_TEXT" ? textAnswer : null,
          selectedChoiceId:
            question.type === "MULTIPLE_CHOICE" ? selectedChoiceId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      try {
        localStorage.removeItem(draftKey(question.id));
      } catch {
        // ignore
      }
      setDraftHint("");
      if (question.type === "MULTIPLE_CHOICE" && data.grading) {
        setMcCorrect(Boolean(data.grading.isCorrect));
        if (examMode || data.examMode) {
          setMcLocked(true);
          setMessage(
            data.grading.isCorrect
              ? "Saved — correct. Exam mode locks this answer."
              : "Saved — incorrect. Exam mode locks this answer.",
          );
        } else {
          setMessage(
            data.grading.isCorrect
              ? "Saved — correct."
              : "Saved — incorrect. You can change your answer and try again.",
          );
        }
      } else {
        setMessage("Answer saved.");
      }
      setQuestion((prev) =>
        prev
          ? {
              ...prev,
              mcLocked: examMode && question.type === "MULTIPLE_CHOICE",
              submission: {
                ...(prev.submission ?? {
                  id: data.submission?.id ?? "",
                  selectedChoiceId: null,
                  submittedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }),
                textAnswer:
                  question.type === "FREE_TEXT" ? textAnswer.trim() : null,
                selectedChoiceId:
                  question.type === "MULTIPLE_CHOICE" ? selectedChoiceId : null,
                trainerScore: null,
                trainerPassed: null,
                trainerComment: null,
                feedbackReleased: false,
              },
            }
          : prev,
      );
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader
          title="Student Assessment Platform"
          subtitle="Loading…"
          badge="Student"
          nav={[{ href: "/student", label: "My tasks", icon: "fa-list-check" }]}
        />
        <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8">
          <LoadingSkeleton rows={2} label="Loading question" />
        </div>
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="min-h-screen">
        <AppHeader
          title="Student Assessment Platform"
          subtitle="Error"
          badge="Student"
          nav={[{ href: "/student", label: "My tasks", icon: "fa-list-check" }]}
        />
        <p className="p-8 text-rose-400 text-sm">{error}</p>
        <Link href="/student" className="px-8 text-sky-400 text-sm">
          Back to questions
        </Link>
      </div>
    );
  }

  if (!question) return null;
  const colors = categoryColors(question.category.color);
  const feedback = question.submission?.feedbackReleased
    ? question.submission
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle={`${question.category.name} • ${question.tags}`}
        badge="Student"
        nav={[
          { href: "/student", label: "My tasks", icon: "fa-list-check" },
        ]}
        progress={progress}
      />

      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/student"
            className="text-xs text-slate-400 hover:text-sky-300 transition inline-flex items-center gap-2"
          >
            <i className="fa-solid fa-arrow-left" />
            Back to all questions
          </Link>
          <div className="flex items-center gap-2">
            {prevId ? (
              <Link
                href={`/student/questions/${prevId}`}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-600 transition"
              >
                <i className="fa-solid fa-chevron-left mr-1.5" />
                Previous
              </Link>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-900 text-slate-600">
                Previous
              </span>
            )}
            {nextId ? (
              <Link
                href={`/student/questions/${nextId}`}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-600 transition"
              >
                Next
                <i className="fa-solid fa-chevron-right ml-1.5" />
              </Link>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-lg border border-slate-900 text-slate-600">
                Next
              </span>
            )}
          </div>
        </div>

        <article className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`p-2 ${colors.bg} ${colors.text} border ${colors.border} rounded-lg text-xs font-bold`}
            >
              {question.roundLabel}
            </span>
            <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full border border-slate-700">
              {question.tags}
            </span>
            <span className="text-xs text-slate-500 border border-slate-800 px-2 py-1 rounded-full">
              {question.type === "FREE_TEXT" ? "Free text" : "Multiple choice"}
            </span>
            {examMode ? (
              <span className="text-xs px-2.5 py-1 rounded-full border border-amber-500/30 text-amber-300 bg-amber-500/10">
                Exam mode
              </span>
            ) : null}
            {question.type === "MULTIPLE_CHOICE" && mcCorrect != null ? (
              <span
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  mcCorrect
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {mcCorrect ? "Correct" : "Incorrect"}
              </span>
            ) : null}
          </div>

          <h2 className="text-xl font-bold text-slate-100">{question.title}</h2>

          <div className="text-sm text-slate-300 leading-relaxed">
            <MathText text={question.prompt} />
          </div>

          {question.codeSnippet ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/30 relative">
              <span className="absolute top-2 right-2 text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                Code snippet
              </span>
              <pre className="text-xs text-slate-300 overflow-x-auto pt-4">
                <code>{question.codeSnippet}</code>
              </pre>
            </div>
          ) : null}

          {feedback ? (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-emerald-300">
                Trainer feedback
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {feedback.trainerPassed != null ? (
                  <span
                    className={`px-2.5 py-1 rounded-lg border ${
                      feedback.trainerPassed
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {feedback.trainerPassed ? "Pass" : "Needs work"}
                  </span>
                ) : null}
                {feedback.trainerScore != null ? (
                  <span className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300">
                    Score: {feedback.trainerScore}/100
                  </span>
                ) : null}
              </div>
              {feedback.trainerComment ? (
                <p className="text-sm text-slate-200 whitespace-pre-wrap">
                  {feedback.trainerComment}
                </p>
              ) : (
                <p className="text-xs text-slate-500">No written comment.</p>
              )}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4 border-t border-slate-800 pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-sky-300">Your answer</h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                {draftHint ? <span>{draftHint}</span> : null}
                {question.type === "MULTIPLE_CHOICE" && !mcLocked ? (
                  <span>Keys 1–{question.choices.length} to select</span>
                ) : null}
                {question.type === "FREE_TEXT" ? (
                  <span>Ctrl/⌘+Enter to save</span>
                ) : null}
              </div>
            </div>

            {mcLocked ? (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                Exam mode locked this multiple-choice answer after your first
                submit.
              </p>
            ) : null}

            {question.type === "FREE_TEXT" ? (
              <textarea
                ref={textRef}
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={6}
                placeholder="Write your answer here…"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-sky-500 resize-none overflow-hidden min-h-40"
              />
            ) : (
              <div className="space-y-2">
                {question.choices.map((choice: ChoiceDto, idx) => (
                  <label
                    key={choice.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                      mcLocked
                        ? "cursor-not-allowed opacity-90"
                        : "cursor-pointer"
                    } ${
                      selectedChoiceId === choice.id
                        ? "border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-500/30"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700"
                    }`}
                  >
                    <span className="mt-0.5 text-[10px] font-bold text-slate-500 w-4">
                      {idx + 1}
                    </span>
                    <input
                      type="radio"
                      name="choice"
                      className="mt-1"
                      disabled={mcLocked}
                      checked={selectedChoiceId === choice.id}
                      onChange={() => setSelectedChoiceId(choice.id)}
                    />
                    <span className="text-sm text-slate-300">{choice.label}</span>
                  </label>
                ))}
              </div>
            )}

            {error ? (
              <p className="text-xs text-rose-400" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="text-xs text-emerald-400" aria-live="polite">
                {message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || mcLocked}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium transition"
              >
                {saving ? "Saving…" : mcLocked ? "Locked" : "Save answer"}
              </button>
              <Link
                href="/student"
                className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-sm hover:border-slate-600 transition"
              >
                Cancel
              </Link>
              {nextId && message ? (
                <Link
                  href={`/student/questions/${nextId}`}
                  className="px-4 py-2 rounded-lg bg-slate-950 border border-sky-500/30 text-sky-300 text-sm hover:border-sky-500/60 transition"
                >
                  Next question
                  <i className="fa-solid fa-arrow-right ml-2 text-xs" />
                </Link>
              ) : null}
            </div>
          </form>
        </article>
      </main>
    </div>
  );
}

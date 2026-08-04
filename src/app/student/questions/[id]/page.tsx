"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { MathText } from "@/components/MathText";
import { categoryColors } from "@/lib/colors";
import type { ChoiceDto, QuestionListItem, SubmissionDto } from "@/lib/types";

type QuestionDetail = Omit<QuestionListItem, "answered"> & {
  submission: SubmissionDto | null;
};

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/questions/${params.id}`);
        if (!res.ok) throw new Error("Question not found");
        const data = await res.json();
        if (cancelled) return;
        setQuestion(data);
        setTextAnswer(data.submission?.textAnswer ?? "");
        setSelectedChoiceId(data.submission?.selectedChoiceId ?? null);
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question) return;
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
      setMessage("Answer saved.");
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
        <AppHeader title="Student Assessment Platform" subtitle="Loading…" badge="Student" />
        <p className="p-8 text-slate-400 text-sm">Loading question…</p>
      </div>
    );
  }

  if (error && !question) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Student Assessment Platform" subtitle="Error" badge="Student" />
        <p className="p-8 text-rose-400 text-sm">{error}</p>
        <Link href="/student" className="px-8 text-sky-400 text-sm">
          Back to questions
        </Link>
      </div>
    );
  }

  if (!question) return null;
  const colors = categoryColors(question.category.color);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle={`${question.category.name} • ${question.tags}`}
        badge="Student"
      />

      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-6">
        <Link
          href="/student"
          className="text-xs text-slate-400 hover:text-sky-300 transition inline-flex items-center gap-2"
        >
          <i className="fa-solid fa-arrow-left" />
          Back to all questions
        </Link>

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

          <form onSubmit={onSubmit} className="space-y-4 border-t border-slate-800 pt-5">
            <h3 className="text-sm font-semibold text-sky-300">Your answer</h3>

            {question.type === "FREE_TEXT" ? (
              <textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                rows={8}
                placeholder="Write your answer here…"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-sky-500 resize-y"
              />
            ) : (
              <div className="space-y-2">
                {question.choices.map((choice: ChoiceDto) => (
                  <label
                    key={choice.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      selectedChoiceId === choice.id
                        ? "border-sky-500/50 bg-sky-500/10"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="choice"
                      className="mt-1"
                      checked={selectedChoiceId === choice.id}
                      onChange={() => setSelectedChoiceId(choice.id)}
                    />
                    <span className="text-sm text-slate-300">{choice.label}</span>
                  </label>
                ))}
              </div>
            )}

            {error ? (
              <p className="text-xs text-rose-400">{error}</p>
            ) : null}
            {message ? (
              <p className="text-xs text-emerald-400">{message}</p>
            ) : null}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium transition"
              >
                {saving ? "Saving…" : "Save answer"}
              </button>
              <Link
                href="/student"
                className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-sm hover:border-slate-600 transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </article>
      </main>
    </div>
  );
}

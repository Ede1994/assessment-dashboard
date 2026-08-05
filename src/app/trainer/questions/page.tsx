"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MathText } from "@/components/MathText";
import { TrainerNav } from "@/components/TrainerNav";
import { useToast } from "@/components/Toast";
import { categoryColors } from "@/lib/colors";
import type { CategoryDto, ChoiceDto, SolutionDto } from "@/lib/types";

type TrainerQuestion = {
  id: string;
  title: string;
  prompt: string;
  roundLabel: string;
  tags: string;
  type: "FREE_TEXT" | "MULTIPLE_CHOICE";
  codeSnippet: string | null;
  category: CategoryDto;
  choices: ChoiceDto[];
  solution: SolutionDto | null;
  _count: { submissions: number };
};

export default function TrainerQuestionsPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [questions, setQuestions] = useState<TrainerQuestion[]>([]);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TrainerQuestion | null>(
    null,
  );

  async function load() {
    const res = await fetch("/api/solutions");
    if (!res.ok) throw new Error("Failed to load solutions");
    const data = await res.json();
    setCategories(data.categories);
    setQuestions(data.questions);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
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

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id, title } = pendingDelete;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setPendingDelete(null);
      toast(`Deleted “${title}”.`, "success");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function cloneQuestion(id: string) {
    setCloningId(id);
    setError("");
    try {
      const res = await fetch(`/api/questions/${id}/clone`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Clone failed");
      toast("Question cloned.", "success");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Clone failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setCloningId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      const tabOk = tab === "all" || item.category.slug === tab;
      if (!tabOk) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.prompt.toLowerCase().includes(q) ||
        item.tags.toLowerCase().includes(q)
      );
    });
  }, [questions, tab, search]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Full question bank with ideal solutions"
        badge="Trainer"
      />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-8">
        <TrainerNav active="questions" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                tab === "all"
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-slate-900 text-slate-400 border-slate-800"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setTab(c.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  tab === c.slug
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-slate-900 text-slate-400 border-slate-800"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm flex-1 sm:w-56 focus:outline-none focus:border-sky-500"
            />
            <Link
              href="/trainer/questions/new"
              className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white whitespace-nowrap"
            >
              <i className="fa-solid fa-plus mr-1.5" />
              New question
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : (
          <section className="grid grid-cols-1 gap-6">
            {filtered.map((q) => {
              const colors = categoryColors(q.category.color);
              return (
                <article
                  key={q.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`p-2 ${colors.bg} ${colors.text} border ${colors.border} rounded-lg text-xs font-bold`}
                      >
                        {q.roundLabel}
                      </span>
                      <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full border border-slate-700">
                        {q.tags}
                      </span>
                      <h3 className="text-base font-bold text-slate-100">{q.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {q._count.submissions} submission
                        {q._count.submissions === 1 ? "" : "s"}
                      </span>
                      <Link
                        href={`/trainer/questions/${q.id}/edit`}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-sky-500/40"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        disabled={cloningId === q.id}
                        onClick={() => cloneQuestion(q.id)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-sky-500/40 disabled:opacity-50"
                      >
                        {cloningId === q.id ? "…" : "Clone"}
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === q.id}
                        onClick={() => setPendingDelete(q)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        {deletingId === q.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-slate-300">
                    <MathText text={q.prompt} />
                  </div>

                  {q.codeSnippet ? (
                    <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 overflow-x-auto">
                      <code>{q.codeSnippet}</code>
                    </pre>
                  ) : null}

                  {q.type === "MULTIPLE_CHOICE" ? (
                    <ul className="space-y-2 text-sm">
                      {q.choices.map((c) => (
                        <li
                          key={c.id}
                          className={`px-3 py-2 rounded-lg border text-xs ${
                            c.isCorrect
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-slate-800 bg-slate-950 text-slate-400"
                          }`}
                        >
                          {c.isCorrect ? (
                            <i className="fa-solid fa-check mr-2" />
                          ) : (
                            <i className="fa-solid fa-xmark mr-2 opacity-40" />
                          )}
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <details className="group bg-slate-950 border border-slate-800 rounded-xl overflow-hidden" open>
                    <summary className="p-4 text-xs font-semibold text-sky-400 cursor-pointer hover:bg-slate-800/40 flex items-center justify-between select-none">
                      <span>
                        <i className="fa-solid fa-comments text-sky-400 mr-2" />
                        Ideal answer & explanation
                      </span>
                      <i className="fa-solid fa-chevron-down group-open:rotate-180 transition-transform text-slate-500" />
                    </summary>
                    <div className="p-4 border-t border-slate-800 text-xs text-slate-300 space-y-3">
                      {q.solution ? (
                        <>
                          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                            <span className="font-bold text-emerald-400 block mb-1">
                              Ideal answer
                            </span>
                            <MathText text={q.solution.idealAnswer} />
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                            <span className="font-bold text-sky-400 block mb-1">
                              Explanation
                            </span>
                            <MathText text={q.solution.explanation} />
                          </div>
                          {q.solution.codeSolution ? (
                            <pre className="bg-slate-900 p-3 rounded-lg border border-emerald-500/20 text-xs overflow-x-auto">
                              <code>{q.solution.codeSolution}</code>
                            </pre>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-slate-500">No solution stored.</p>
                      )}
                    </div>
                  </details>
                </article>
              );
            })}
          </section>
        )}

        <Link href="/trainer" className="text-xs text-slate-500 hover:text-sky-300">
          ← Back to overview
        </Link>
      </main>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete question?"
        body={
          pendingDelete
            ? `Delete “${pendingDelete.title}”? This also removes its solution, choices, assignments, and submissions.`
            : ""
        }
        confirmLabel="Delete"
        danger
        busy={Boolean(deletingId)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

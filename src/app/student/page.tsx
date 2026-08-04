"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MathText } from "@/components/MathText";
import { categoryColors } from "@/lib/colors";
import type { CategoryDto, ProgressDto, QuestionListItem } from "@/lib/types";

export default function StudentDashboardPage() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [progress, setProgress] = useState<ProgressDto>({ answered: 0, total: 0 });
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/questions");
        if (!res.ok) throw new Error("Failed to load questions");
        const data = await res.json();
        if (cancelled) return;
        setCategories(data.categories);
        setQuestions(data.questions);
        setProgress(data.progress);
        setAssignmentMode(Boolean(data.assignmentMode));
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
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      const tabOk = tab === "all" || item.category.slug === tab;
      if (!tabOk) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.prompt.toLowerCase().includes(q) ||
        item.tags.toLowerCase().includes(q) ||
        item.category.name.toLowerCase().includes(q)
      );
    });
  }, [questions, tab, search]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Answer programming, medical imaging, and deep learning tasks"
        badge="Student"
      />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-8">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div className="flex flex-wrap gap-2">
            <TabButton
              active={tab === "all"}
              onClick={() => setTab("all")}
              icon="fa-layer-group"
              label="All topics"
            />
            {categories.map((c) => (
              <TabButton
                key={c.id}
                active={tab === c.slug}
                onClick={() => setTab(c.slug)}
                icon={c.icon}
                label={c.name}
                color={c.color}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <i className="fa-solid fa-search absolute left-3 top-2.5 text-slate-500 text-sm" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search (e.g. OOM, resampling, HU)…"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 transition"
              />
            </div>
            <div className="hidden sm:flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs whitespace-nowrap">
              <span className="text-slate-400">Answered:</span>
              <span className="font-bold text-emerald-400">{progress.answered}</span>
              <span className="text-slate-600">/</span>
              <span className="font-bold text-slate-300">{progress.total}</span>
              {progress.mcAnswered ? (
                <>
                  <span className="text-slate-700">|</span>
                  <span className="text-slate-400">MC:</span>
                  <span className="font-bold text-sky-300">
                    {progress.mcCorrect ?? 0}/{progress.mcAnswered}
                    {progress.mcScorePct != null ? ` (${progress.mcScorePct}%)` : ""}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 p-6 rounded-2xl border border-sky-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-base font-bold text-sky-300 flex items-center gap-2 mb-2">
            <i className="fa-solid fa-clipboard-list" />
            Assessment overview
          </h2>
          <p className="text-sm text-slate-400 max-w-3xl">
            Work through free-text and multiple-choice tasks covering PyTorch, Python,
            medical data processing, CT/MRI, DICOM, governance, and deep learning
            architectures. Solutions stay hidden until your trainer reviews submissions.
          </p>
          {assignmentMode ? (
            <p className="text-xs text-emerald-400 mt-3">
              <i className="fa-solid fa-filter mr-1.5" />
              Showing only tasks assigned to you by your trainer ({progress.total} tasks).
            </p>
          ) : (
            <p className="text-xs text-amber-400/90 mt-3">
              No curated assignment yet — showing the full question bank.
            </p>
          )}
        </section>

        {loading ? (
          <p className="text-sm text-slate-400">Loading questions…</p>
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : (
          <section className="grid grid-cols-1 gap-6">
            {filtered.map((q) => {
              const colors = categoryColors(q.category.color);
              return (
                <article
                  key={q.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition space-y-4"
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
                      <span className="text-xs text-slate-500 border border-slate-800 px-2 py-1 rounded-full">
                        {q.type === "FREE_TEXT" ? "Free text" : "Multiple choice"}
                      </span>
                      <h3 className="text-base font-bold text-slate-100">{q.title}</h3>
                    </div>
                    {q.answered ? (
                      q.type === "MULTIPLE_CHOICE" && q.mcCorrect != null ? (
                        <span
                          className={`text-xs px-3 py-1.5 rounded-lg border ${
                            q.mcCorrect
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          <i
                            className={`fa-solid ${q.mcCorrect ? "fa-circle-check" : "fa-circle-xmark"} mr-1`}
                          />
                          {q.mcCorrect ? "Correct" : "Incorrect"}
                        </span>
                      ) : (
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <i className="fa-solid fa-circle-check mr-1" />
                          Answered
                        </span>
                      )
                    ) : (
                      <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 text-slate-400 border border-slate-800">
                        Not answered
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-slate-300">
                    <strong className="text-slate-200">Question / scenario: </strong>
                    <MathText text={q.prompt} className="inline" />
                  </div>

                  {q.codeSnippet ? (
                    <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 overflow-x-auto">
                      <code>{q.codeSnippet}</code>
                    </pre>
                  ) : null}

                  <div className="flex justify-end">
                    <Link
                      href={`/student/questions/${q.id}`}
                      className="text-sm px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition"
                    >
                      {q.answered ? "Edit answer" : "Answer question"}
                      <i className="fa-solid fa-arrow-right ml-2 text-xs" />
                    </Link>
                  </div>
                </article>
              );
            })}
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500">No questions match your filters.</p>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  color?: string;
}) {
  const colors = color ? categoryColors(color) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 border ${
        active
          ? "bg-sky-600 text-white border-sky-600"
          : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
      }`}
    >
      <i
        className={`fa-solid ${icon} ${
          active ? "text-white" : colors?.text ?? "text-slate-400"
        }`}
      />
      {label}
    </button>
  );
}

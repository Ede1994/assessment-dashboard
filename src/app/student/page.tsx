"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { MathText } from "@/components/MathText";
import { listItemClass, useListKeyboard } from "@/hooks/useListKeyboard";
import { categoryColors } from "@/lib/colors";
import { formatDuration } from "@/lib/time";
import { questionTypeLabel } from "@/lib/questionTypes";
import type { CategoryDto, ProgressDto, QuestionListItem } from "@/lib/types";

type StatusFilter = "all" | "unanswered" | "answered" | "incorrect";
type SortMode = "default" | "category" | "recent";

export default function StudentDashboardPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [progress, setProgress] = useState<ProgressDto>({ answered: 0, total: 0 });
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");
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
        setDueAt(data.dueAt ?? null);
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

  const unansweredCount = useMemo(
    () => questions.filter((q) => !q.answered).length,
    [questions],
  );
  const incorrectCount = useMemo(
    () => questions.filter((q) => q.mcCorrect === false).length,
    [questions],
  );
  const nextUnanswered = useMemo(
    () => questions.find((q) => !q.answered) ?? null,
    [questions],
  );
  const pctComplete =
    progress.total > 0
      ? Math.round((progress.answered / progress.total) * 100)
      : 0;
  const dueDate = dueAt ? new Date(dueAt) : null;
  const dueOverdue =
    dueDate != null &&
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() < Date.now() &&
    unansweredCount > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = questions.filter((item) => {
      const tabOk = tab === "all" || item.category.slug === tab;
      if (!tabOk) return false;
      if (statusFilter === "unanswered" && item.answered) return false;
      if (statusFilter === "answered" && !item.answered) return false;
      if (statusFilter === "incorrect" && item.mcCorrect !== false) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.prompt.toLowerCase().includes(q) ||
        item.tags.toLowerCase().includes(q) ||
        item.category.name.toLowerCase().includes(q)
      );
    });

    if (sortMode === "category") {
      list = [...list].sort((a, b) => {
        const c = a.category.name.localeCompare(b.category.name);
        if (c !== 0) return c;
        return a.sortOrder - b.sortOrder;
      });
    } else if (sortMode === "recent") {
      list = [...list].sort((a, b) => {
        const at = a.submission?.updatedAt
          ? new Date(a.submission.updatedAt).getTime()
          : 0;
        const bt = b.submission?.updatedAt
          ? new Date(b.submission.updatedAt).getTime()
          : 0;
        if (bt !== at) return bt - at;
        return a.sortOrder - b.sortOrder;
      });
    }

    return list;
  }, [questions, tab, search, statusFilter, sortMode]);

  const hasActiveFilters =
    tab !== "all" || statusFilter !== "all" || search.trim() !== "";

  const activeIndex = useListKeyboard({
    itemCount: filtered.length,
    searchRef,
    onActivate: (index) => {
      const item = filtered[index];
      if (item) router.push(`/student/questions/${item.id}`);
    },
  });

  function clearFilters() {
    setTab("all");
    setStatusFilter("all");
    setSearch("");
    setSortMode("default");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Answer programming, medical imaging, and deep learning tasks"
        badge="Student"
        nav={[
          {
            href: "/student",
            label: "My tasks",
            icon: "fa-list-check",
            active: true,
          },
        ]}
        progress={
          progress.total > 0
            ? { answered: progress.answered, total: progress.total }
            : null
        }
      />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-8">
        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 p-6 rounded-2xl border border-sky-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-wrap items-start justify-between gap-4 relative">
            <div className="max-w-2xl">
              <h2 className="text-base font-bold text-sky-300 flex items-center gap-2 mb-2">
                <i className="fa-solid fa-clipboard-list" />
                Your progress
              </h2>
              <p className="text-sm text-slate-400">
                Work through free-text, multiple-choice, and coding exercises.
                Solutions stay hidden until your trainer releases feedback.
              </p>
              {assignmentMode ? (
                <p className="text-xs text-emerald-400 mt-3">
                  <i className="fa-solid fa-filter mr-1.5" />
                  Showing only tasks assigned to you ({progress.total} tasks).
                </p>
              ) : (
                <p className="text-xs text-amber-400/90 mt-3">
                  No curated assignment yet — showing the full question bank.
                </p>
              )}
              {dueDate && !Number.isNaN(dueDate.getTime()) ? (
                <p
                  className={`text-xs mt-2 ${
                    dueOverdue ? "text-rose-400" : "text-amber-300"
                  }`}
                >
                  <i className="fa-solid fa-calendar-day mr-1.5" />
                  {dueOverdue ? "Overdue since " : "Due "}
                  {dueDate.toLocaleDateString()}
                  {progress.total > 0
                    ? ` · ${pctComplete}% complete`
                    : null}
                </p>
              ) : null}
            </div>
            {nextUnanswered ? (
              <Link
                href={`/student/questions/${nextUnanswered.id}`}
                className="relative text-sm px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition whitespace-nowrap"
              >
                <i className="fa-solid fa-play mr-2 text-xs" />
                Resume next unanswered
              </Link>
            ) : progress.total > 0 && !loading ? (
              <span className="relative text-sm px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <i className="fa-solid fa-circle-check mr-2" />
                All tasks answered
              </span>
            ) : null}
          </div>

          {!loading && progress.total > 0 ? (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative">
              <ProgressStat
                label="Complete"
                value={`${pctComplete}%`}
                detail={`${progress.answered}/${progress.total}`}
              />
              <ProgressStat
                label="Unanswered"
                value={String(unansweredCount)}
                detail="still open"
              />
              <ProgressStat
                label="MC score"
                value={
                  progress.mcAnswered
                    ? `${progress.mcScorePct ?? 0}%`
                    : "—"
                }
                detail={
                  progress.mcAnswered
                    ? `${progress.mcCorrect ?? 0}/${progress.mcAnswered} correct`
                    : "no MC yet"
                }
              />
              <ProgressStat
                label="Free text"
                value={String(progress.freeTextAnswered ?? 0)}
                detail="submitted"
              />
              <ProgressStat
                label="Code score"
                value={
                  progress.codingAnswered
                    ? `${progress.codingScorePct ?? 0}%`
                    : "—"
                }
                detail={
                  progress.codingAnswered
                    ? `${progress.codingCorrect ?? 0}/${progress.codingAnswered} correct`
                    : "no code yet"
                }
              />
              <ProgressStat
                label="Time spent"
                value={formatDuration(progress.timeSpentMs ?? 0)}
                detail="on assigned tasks"
              />
            </div>
          ) : null}
        </section>

        <div className="sticky top-[4.75rem] z-30 -mx-4 px-4 py-3 bg-slate-950/90 backdrop-blur border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
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
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <i className="fa-solid fa-search absolute left-3 top-2.5 text-slate-500 text-sm" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search (e.g. OOM, resampling)…"
                aria-label="Search questions"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 transition"
              />
            </div>
            <span className="hidden lg:inline text-[10px] text-slate-600 whitespace-nowrap">
              / search · j/k · Enter
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
              aria-label="Filter by status"
            >
              <option value="all">All status</option>
              <option value="unanswered">Unanswered ({unansweredCount})</option>
              <option value="answered">Answered ({progress.answered})</option>
              <option value="incorrect">Incorrect MC ({incorrectCount})</option>
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
              aria-label="Sort questions"
            >
              <option value="default">Sort: default</option>
              <option value="category">Sort: category</option>
              <option value="recent">Sort: recently answered</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton rows={4} label="Loading questions" />
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : questions.length === 0 ? (
          <EmptyState
            icon="fa-inbox"
            title="No tasks assigned yet"
            body="Your trainer has not assigned any questions. Check back later, or ask them to open Assign tasks."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="fa-filter-circle-xmark"
            title="No questions match your filters"
            body="Try clearing the search or status filter to see your assigned tasks again."
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition"
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:gap-6">
            {filtered.map((q, index) => {
              const colors = categoryColors(q.category.color);
              return (
                <article
                  key={q.id}
                  data-list-index={index}
                  className={listItemClass(
                    activeIndex === index,
                    "bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 hover:border-slate-700 transition space-y-3 sm:space-y-4",
                  )}
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
                        {questionTypeLabel(q.type)}
                      </span>
                      {(q.timeSpentMs ?? 0) > 0 ? (
                        <span className="text-xs text-slate-500 border border-slate-800 px-2 py-1 rounded-full tabular-nums">
                          <i className="fa-regular fa-clock mr-1" />
                          {formatDuration(q.timeSpentMs ?? 0)}
                        </span>
                      ) : null}
                      <h3 className="text-base font-bold text-slate-100">{q.title}</h3>
                    </div>
                    {q.answered ? (
                      (q.type === "MULTIPLE_CHOICE" && q.mcCorrect != null) ||
                      (q.type === "CODING" && q.codingCorrect != null) ? (
                        <span
                          className={`text-xs px-3 py-1.5 rounded-lg border ${
                            (q.type === "CODING" ? q.codingCorrect : q.mcCorrect)
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              (q.type === "CODING" ? q.codingCorrect : q.mcCorrect)
                                ? "fa-circle-check"
                                : "fa-circle-xmark"
                            } mr-1`}
                          />
                          {(q.type === "CODING" ? q.codingCorrect : q.mcCorrect)
                            ? "Correct"
                            : "Incorrect"}
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
          </section>
        )}
      </main>
    </div>
  );
}

function ProgressStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5">
      <p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-slate-100 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
      <div className="inline-flex p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400">
        <i className={`fa-solid ${icon} text-xl`} />
      </div>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto">{body}</p>
      {action ? <div className="pt-2">{action}</div> : null}
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

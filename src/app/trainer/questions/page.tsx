"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
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

type ViewMode = "cards" | "list";

function todayFilename() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `question-bank-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

function QuestionPreviewModal({
  question,
  onClose,
}: {
  question: TrainerQuestion;
  onClose: () => void;
}) {
  const titleId = useId();
  const colors = categoryColors(question.category.color);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`p-1.5 ${colors.bg} ${colors.text} border ${colors.border} rounded-lg text-[10px] font-bold`}
              >
                {question.roundLabel}
              </span>
              <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-slate-700">
                {question.tags}
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                {question.type === "MULTIPLE_CHOICE"
                  ? "Multiple choice"
                  : "Free text"}
              </span>
            </div>
            <h2 id={titleId} className="text-lg font-bold text-slate-100">
              {question.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1"
            aria-label="Close preview"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="text-sm text-slate-300">
          <MathText text={question.prompt} />
        </div>

        {question.codeSnippet ? (
          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 overflow-x-auto">
            <code>{question.codeSnippet}</code>
          </pre>
        ) : null}

        {question.type === "MULTIPLE_CHOICE" ? (
          <ul className="space-y-2 text-sm">
            {question.choices.map((c) => (
              <li
                key={c.id}
                className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 text-xs"
              >
                {c.label}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-700 text-slate-300 hover:border-slate-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrainerQuestionsPage() {
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [questions, setQuestions] = useState<TrainerQuestion[]>([]);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TrainerQuestion | null>(
    null,
  );
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [preview, setPreview] = useState<TrainerQuestion | null>(null);

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
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  async function confirmBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/questions/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      setPendingBulkDelete(false);
      setSelected(new Set());
      toast(`Deleted ${data.deleted} question${data.deleted === 1 ? "" : "s"}.`, "success");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bulk delete failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBulkDeleting(false);
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

  async function exportBank() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch("/api/questions/export");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = todayFilename();
      a.click();
      URL.revokeObjectURL(url);
      toast("Question bank exported.", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setExporting(false);
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setError("");
    try {
      const text = await file.text();
      const body = JSON.parse(text);
      const res = await fetch("/api/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      const errCount = Array.isArray(data.errors) ? data.errors.length : 0;
      if (errCount > 0) {
        toast(
          `Imported ${data.created} created, ${data.skipped} skipped (${errCount} error${errCount === 1 ? "" : "s"}).`,
          "info",
        );
      } else {
        toast(
          `Imported ${data.created} created, ${data.skipped} skipped.`,
          "success",
        );
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setImporting(false);
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((q) => q.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((q) => selected.has(q.id));

  const actionBtn =
    "text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-sky-500/40 disabled:opacity-50";

  function renderActions(q: TrainerQuestion) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setPreview(q)}
          className={actionBtn}
        >
          Preview
        </button>
        <Link href={`/trainer/questions/${q.id}/edit`} className={actionBtn}>
          Edit
        </Link>
        <button
          type="button"
          disabled={cloningId === q.id}
          onClick={() => cloneQuestion(q.id)}
          className={actionBtn}
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
    );
  }

  function renderCard(q: TrainerQuestion) {
    const colors = categoryColors(q.category.color);
    return (
      <article
        key={q.id}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="checkbox"
              checked={selected.has(q.id)}
              onChange={() => toggleSelect(q.id)}
              className="rounded border-slate-700"
              aria-label={`Select ${q.title}`}
            />
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">
              {q._count.submissions} submission
              {q._count.submissions === 1 ? "" : "s"}
            </span>
            {renderActions(q)}
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

        <details
          className="group bg-slate-950 border border-slate-800 rounded-xl overflow-hidden"
          open
        >
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
  }

  function renderList() {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={() =>
                    allFilteredSelected ? clearSelection() : selectAllFiltered()
                  }
                  aria-label="Select all filtered"
                />
              </th>
              <th className="p-3 font-medium">Round</th>
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Submissions</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => {
              const colors = categoryColors(q.category.color);
              return (
                <tr
                  key={q.id}
                  className="border-b border-slate-800/80 hover:bg-slate-800/30"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      aria-label={`Select ${q.title}`}
                    />
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 ${colors.bg} ${colors.text} border ${colors.border} rounded text-[10px] font-bold`}
                    >
                      {q.roundLabel}
                    </span>
                  </td>
                  <td className="p-3 text-slate-200 font-medium max-w-xs truncate">
                    {q.title}
                  </td>
                  <td className="p-3 text-slate-400">{q.category.name}</td>
                  <td className="p-3 text-slate-400">
                    {q.type === "MULTIPLE_CHOICE" ? "MC" : "Free text"}
                  </td>
                  <td className="p-3 text-slate-500">{q._count.submissions}</td>
                  <td className="p-3">{renderActions(q)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Full question bank with ideal solutions"
        badge="Trainer"
      />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-6">
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
            <div className="flex rounded-lg border border-slate-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-2.5 py-1.5 text-xs ${
                  viewMode === "cards"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
                title="Card view"
              >
                <i className="fa-solid fa-grip" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`px-2.5 py-1.5 text-xs border-l border-slate-800 ${
                  viewMode === "list"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
                title="List view"
              >
                <i className="fa-solid fa-list" />
              </button>
            </div>
            <Link
              href="/trainer/questions/new"
              className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white whitespace-nowrap"
            >
              <i className="fa-solid fa-plus mr-1.5" />
              New question
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportBank()}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-sky-500/40 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export JSON"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onImportFile(e)}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-sky-500/40 disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import JSON"}
          </button>
          {selected.size > 0 ? (
            <>
              <span className="text-xs text-slate-500">
                {selected.size} selected
              </span>
              <button
                type="button"
                onClick={selectAllFiltered}
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                Select all filtered ({filtered.length})
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-slate-400 hover:text-slate-300"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setPendingBulkDelete(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              >
                Delete selected
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={selectAllFiltered}
              disabled={filtered.length === 0}
              className="text-xs text-slate-400 hover:text-sky-300 disabled:opacity-40"
            >
              Select all filtered
            </button>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton rows={4} label="Loading question bank" />
        ) : error ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-400">No questions match your filters.</p>
        ) : viewMode === "cards" ? (
          <section className="grid grid-cols-1 gap-6">
            {filtered.map(renderCard)}
          </section>
        ) : (
          renderList()
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

      <ConfirmDialog
        open={pendingBulkDelete}
        title="Delete selected questions?"
        body={`Delete ${selected.size} question${selected.size === 1 ? "" : "s"}? This also removes their solutions, choices, assignments, and submissions.`}
        confirmLabel="Delete all"
        danger
        busy={bulkDeleting}
        onCancel={() => setPendingBulkDelete(false)}
        onConfirm={() => void confirmBulkDelete()}
      />

      {preview ? (
        <QuestionPreviewModal
          question={preview}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

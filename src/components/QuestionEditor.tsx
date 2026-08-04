"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { TrainerNav } from "@/components/TrainerNav";
import type { CategoryDto } from "@/lib/types";

type ChoiceDraft = { label: string; isCorrect: boolean };

type QuestionEditorProps = {
  mode: "create" | "edit";
  questionId?: string;
};

const emptyChoice = (): ChoiceDraft => ({ label: "", isCorrect: false });

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500";

export function QuestionEditor({ mode, questionId }: QuestionEditorProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [roundLabel, setRoundLabel] = useState("Custom");
  const [tags, setTags] = useState("");
  const [type, setType] = useState<"FREE_TEXT" | "MULTIPLE_CHOICE">("FREE_TEXT");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [idealAnswer, setIdealAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [codeSolution, setCodeSolution] = useState("");
  const [choices, setChoices] = useState<ChoiceDraft[]>([
    emptyChoice(),
    emptyChoice(),
  ]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catRes = await fetch("/api/categories");
        if (!catRes.ok) throw new Error("Failed to load categories");
        const catData = await catRes.json();
        if (cancelled) return;
        setCategories(catData.categories);
        if (mode === "create" && catData.categories[0]) {
          setCategoryId(catData.categories[0].id);
        }

        if (mode === "edit" && questionId) {
          const qRes = await fetch(`/api/questions/${questionId}`);
          if (!qRes.ok) throw new Error("Failed to load question");
          const q = await qRes.json();
          if (cancelled) return;
          setCategoryId(q.categoryId ?? q.category?.id ?? "");
          setTitle(q.title ?? "");
          setPrompt(q.prompt ?? "");
          setRoundLabel(q.roundLabel ?? "Custom");
          setTags(q.tags ?? "");
          setType(q.type ?? "FREE_TEXT");
          setCodeSnippet(q.codeSnippet ?? "");
          setSortOrder(String(q.sortOrder ?? ""));
          setIdealAnswer(q.solution?.idealAnswer ?? "");
          setExplanation(q.solution?.explanation ?? "");
          setCodeSolution(q.solution?.codeSolution ?? "");
          if (q.choices?.length) {
            setChoices(
              q.choices.map((c: { label: string; isCorrect?: boolean }) => ({
                label: c.label,
                isCorrect: Boolean(c.isCorrect),
              })),
            );
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
  }, [mode, questionId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      categoryId,
      title,
      prompt,
      roundLabel,
      tags,
      type,
      codeSnippet: codeSnippet || null,
      sortOrder: sortOrder === "" ? undefined : Number(sortOrder),
      idealAnswer,
      explanation,
      codeSolution: codeSolution || null,
      choices: type === "MULTIPLE_CHOICE" ? choices : undefined,
    };

    try {
      const res = await fetch(
        mode === "create" ? "/api/questions" : `/api/questions/${questionId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      router.push("/trainer/questions");
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
          subtitle="Question editor"
          badge="Trainer"
        />
        <p className="p-8 text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle={mode === "create" ? "Create question" : "Edit question"}
        badge="Trainer"
      />
      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-6">
        <TrainerNav active="questions" />
        <Link
          href="/trainer/questions"
          className="text-xs text-slate-400 hover:text-sky-300 inline-flex items-center gap-2"
        >
          <i className="fa-solid fa-arrow-left" />
          Back to question bank
        </Link>

        <form
          onSubmit={onSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Category">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputClass}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "FREE_TEXT" | "MULTIPLE_CHOICE")
                }
                className={inputClass}
              >
                <option value="FREE_TEXT">Free text</option>
                <option value="MULTIPLE_CHOICE">Multiple choice</option>
              </select>
            </Field>
          </div>

          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Round label">
              <input
                value={roundLabel}
                onChange={(e) => setRoundLabel(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Tags">
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={inputClass}
                placeholder="e.g. PyTorch Memory"
              />
            </Field>
            <Field label="Sort order (optional)">
              <input
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={inputClass}
                type="number"
              />
            </Field>
          </div>

          <Field label="Prompt / scenario (KaTeX $...$ supported)">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className={`${inputClass} min-h-28`}
              required
            />
          </Field>

          <Field label="Code snippet shown to student (optional)">
            <textarea
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              className={`${inputClass} font-mono text-xs min-h-24`}
            />
          </Field>

          {type === "MULTIPLE_CHOICE" ? (
            <div className="space-y-2 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-sky-300">Choices</h3>
                <button
                  type="button"
                  onClick={() => setChoices((c) => [...c, emptyChoice()])}
                  className="text-xs text-slate-300 hover:text-sky-300"
                >
                  + Add choice
                </button>
              </div>
              {choices.map((ch, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={ch.isCorrect}
                    onChange={(e) =>
                      setChoices((prev) =>
                        prev.map((row, idx) =>
                          idx === i
                            ? { ...row, isCorrect: e.target.checked }
                            : row,
                        ),
                      )
                    }
                    title="Correct"
                    className="mt-2.5"
                  />
                  <input
                    value={ch.label}
                    onChange={(e) =>
                      setChoices((prev) =>
                        prev.map((row, idx) =>
                          idx === i ? { ...row, label: e.target.value } : row,
                        ),
                      )
                    }
                    className={`${inputClass} flex-1`}
                    placeholder={`Choice ${i + 1}`}
                    required
                  />
                  <button
                    type="button"
                    disabled={choices.length <= 2}
                    onClick={() =>
                      setChoices((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="text-xs text-rose-400 px-2 py-2 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <p className="text-[11px] text-slate-500">
                Check the box next to each correct answer.
              </p>
            </div>
          ) : null}

          <Field label="Ideal answer (trainer only)">
            <textarea
              value={idealAnswer}
              onChange={(e) => setIdealAnswer(e.target.value)}
              className={`${inputClass} min-h-24`}
              required
            />
          </Field>
          <Field label="Explanation (trainer only)">
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className={`${inputClass} min-h-20`}
              required
            />
          </Field>
          <Field label="Code solution (optional)">
            <textarea
              value={codeSolution}
              onChange={(e) => setCodeSolution(e.target.value)}
              className={`${inputClass} font-mono text-xs min-h-20`}
            />
          </Field>

          {error ? (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium"
            >
              {saving
                ? "Saving…"
                : mode === "create"
                  ? "Create question"
                  : "Save changes"}
            </button>
            <Link
              href="/trainer/questions"
              className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-sm"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

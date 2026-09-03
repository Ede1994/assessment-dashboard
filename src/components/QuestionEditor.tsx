"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { TrainerNav } from "@/components/TrainerNav";
import { useToast } from "@/components/Toast";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import {
  CODING_LANGUAGE_NAMES,
  codingMeta,
  countBlanks,
  isCodingLanguage,
  type CodingLanguageName,
} from "@/lib/coding";
import type { CategoryDto } from "@/lib/types";

type ChoiceDraft = { label: string; isCorrect: boolean };
type QuestionKind = "FREE_TEXT" | "MULTIPLE_CHOICE" | "CODING";
type CodingLang = CodingLanguageName;

type QuestionEditorProps = {
  mode: "create" | "edit";
  questionId?: string;
};

const emptyChoice = (): ChoiceDraft => ({ label: "", isCorrect: false });

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500";

const MEDIA_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm";

async function uploadMedia(file: File): Promise<{ markdown: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/media", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return { markdown: data.markdown as string, url: data.url as string };
}

function MediaUploadButton({
  onInserted,
  toast,
}: {
  onInserted: (markdown: string) => void;
  toast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { markdown } = await uploadMedia(file);
      onInserted(markdown);
      toast("Media inserted.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => void onFileChange(e)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="text-[11px] px-2 py-0.5 rounded-md border border-slate-700 text-slate-400 hover:text-sky-300 hover:border-sky-500/40 disabled:opacity-50 inline-flex items-center gap-1"
      >
        <i className="fa-solid fa-image" />
        {busy ? "Uploading…" : "Insert media"}
      </button>
    </>
  );
}

function snapshot(data: {
  categoryId: string;
  title: string;
  prompt: string;
  roundLabel: string;
  tags: string;
  type: string;
  codeSnippet: string;
  starterCode: string;
  codingLanguage: string;
  blankAnswers: string[];
  sortOrder: string;
  idealAnswer: string;
  explanation: string;
  codeSolution: string;
  choices: ChoiceDraft[];
}) {
  return JSON.stringify(data);
}

export function QuestionEditor({ mode, questionId }: QuestionEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [roundLabel, setRoundLabel] = useState("Custom");
  const [tags, setTags] = useState("");
  const [type, setType] = useState<QuestionKind>("FREE_TEXT");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [starterCode, setStarterCode] = useState("");
  const [codingLanguage, setCodingLanguage] = useState<CodingLang>("PYTHON");
  const [blankAnswers, setBlankAnswers] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState("");
  const [idealAnswer, setIdealAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [codeSolution, setCodeSolution] = useState("");
  const [choices, setChoices] = useState<ChoiceDraft[]>([
    emptyChoice(),
    emptyChoice(),
  ]);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentSnap = snapshot({
    categoryId,
    title,
    prompt,
    roundLabel,
    tags,
    type,
    codeSnippet,
    starterCode,
    codingLanguage,
    blankAnswers,
    sortOrder,
    idealAnswer,
    explanation,
    codeSolution,
    choices,
  });
  const dirty = Boolean(baseline) && currentSnap !== baseline;
  useUnsavedChangesWarning(dirty && !saving);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catRes = await fetch("/api/categories");
        if (!catRes.ok) throw new Error("Failed to load categories");
        const catData = await catRes.json();
        if (cancelled) return;
        setCategories(catData.categories);

        if (mode === "create") {
          const firstId = catData.categories[0]?.id ?? "";
          setCategoryId(firstId);
          setBaseline(
            snapshot({
              categoryId: firstId,
              title: "",
              prompt: "",
              roundLabel: "Custom",
              tags: "",
              type: "FREE_TEXT",
              codeSnippet: "",
              starterCode: "",
              codingLanguage: "PYTHON",
              blankAnswers: [],
              sortOrder: "",
              idealAnswer: "",
              explanation: "",
              codeSolution: "",
              choices: [emptyChoice(), emptyChoice()],
            }),
          );
        }

        if (mode === "edit" && questionId) {
          const qRes = await fetch(`/api/questions/${questionId}`);
          if (!qRes.ok) throw new Error("Failed to load question");
          const q = await qRes.json();
          if (cancelled) return;
          const nextCategoryId = q.categoryId ?? q.category?.id ?? "";
          const nextTitle = q.title ?? "";
          const nextPrompt = q.prompt ?? "";
          const nextRound = q.roundLabel ?? "Custom";
          const nextTags = q.tags ?? "";
          const nextType = (q.type ?? "FREE_TEXT") as QuestionKind;
          const nextCode = q.codeSnippet ?? "";
          const nextStarter = q.starterCode ?? "";
          const nextLang = isCodingLanguage(String(q.codingLanguage ?? ""))
            ? (q.codingLanguage as CodingLang)
            : "PYTHON";
          const nextBlanks: string[] = Array.isArray(q.solution?.blankAnswers)
            ? q.solution.blankAnswers.map((item: unknown) => String(item ?? ""))
            : [];
          const nextSort = String(q.sortOrder ?? "");
          const nextIdeal = q.solution?.idealAnswer ?? "";
          const nextExpl = q.solution?.explanation ?? "";
          const nextCodeSol = q.solution?.codeSolution ?? "";
          const nextChoices = q.choices?.length
            ? q.choices.map((c: { label: string; isCorrect?: boolean }) => ({
                label: c.label,
                isCorrect: Boolean(c.isCorrect),
              }))
            : [emptyChoice(), emptyChoice()];
          setCategoryId(nextCategoryId);
          setTitle(nextTitle);
          setPrompt(nextPrompt);
          setRoundLabel(nextRound);
          setTags(nextTags);
          setType(nextType);
          setCodeSnippet(nextCode);
          setStarterCode(nextStarter);
          setCodingLanguage(nextLang);
          setBlankAnswers(nextBlanks);
          setSortOrder(nextSort);
          setIdealAnswer(nextIdeal);
          setExplanation(nextExpl);
          setCodeSolution(nextCodeSol);
          setChoices(nextChoices);
          setBaseline(
            snapshot({
              categoryId: nextCategoryId,
              title: nextTitle,
              prompt: nextPrompt,
              roundLabel: nextRound,
              tags: nextTags,
              type: nextType,
              codeSnippet: nextCode,
              starterCode: nextStarter,
              codingLanguage: nextLang,
              blankAnswers: nextBlanks,
              sortOrder: nextSort,
              idealAnswer: nextIdeal,
              explanation: nextExpl,
              codeSolution: nextCodeSol,
              choices: nextChoices,
            }),
          );
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
      starterCode: type === "CODING" ? starterCode : null,
      codingLanguage: type === "CODING" ? codingLanguage : null,
      blankAnswers: type === "CODING" ? blankAnswers : undefined,
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
        toast(data.error ?? "Save failed", "error");
        return;
      }
      setBaseline(currentSnap);
      toast(
        mode === "create" ? "Question created." : "Question saved.",
        "success",
      );
      router.push("/trainer/questions");
      router.refresh();
    } catch {
      setError("Network error");
      toast("Network error", "error");
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
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/trainer/questions"
            className="text-xs text-slate-400 hover:text-sky-300 inline-flex items-center gap-2"
            onClick={(e) => {
              if (
                dirty &&
                !window.confirm("Discard unsaved changes and leave the editor?")
              ) {
                e.preventDefault();
              }
            }}
          >
            <i className="fa-solid fa-arrow-left" />
            Back to question bank
          </Link>
          {dirty ? (
            <span className="text-[11px] text-amber-400">Unsaved changes</span>
          ) : null}
        </div>

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
                onChange={(e) => {
                  const next = e.target.value as QuestionKind;
                  setType(next);
                  if (next === "CODING" && !starterCode.trim()) {
                    const meta = codingMeta(codingLanguage);
                    setStarterCode(meta.defaultStarter);
                    setBlankAnswers([...meta.defaultBlankAnswers]);
                  }
                }}
                className={inputClass}
              >
                <option value="FREE_TEXT">Free text</option>
                <option value="MULTIPLE_CHOICE">Multiple choice</option>
                <option value="CODING">Coding exercise</option>
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

          <Field
            label="Prompt / scenario (KaTeX $...$ supported)"
            labelAction={
              <MediaUploadButton
                toast={toast}
                onInserted={(markdown) =>
                  setPrompt((prev) =>
                    prev.trim() ? `${prev}\n\n${markdown}` : markdown,
                  )
                }
              />
            }
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className={`${inputClass} min-h-28`}
              required
            />
          </Field>
          <p className="text-[11px] text-slate-500 -mt-2">
            Images/videos insert as markdown{" "}
            <code className="text-slate-400">![alt](/uploads/…)</code> and render
            for students.
          </p>

          {type === "CODING" ? (
            <div className="space-y-3 border border-sky-500/20 rounded-xl p-4 bg-sky-500/5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-sky-300">
                  Coding exercise
                </h3>
                <Field label="Language">
                  <select
                    value={codingLanguage}
                    onChange={(e) =>
                      setCodingLanguage(e.target.value as CodingLang)
                    }
                    className={inputClass}
                  >
                    {CODING_LANGUAGE_NAMES.map((lang) => (
                      <option key={lang} value={lang}>
                        {codingMeta(lang).label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Starter code — use ____ for each blank the student must fill">
                <textarea
                  value={starterCode}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStarterCode(next);
                    const n = countBlanks(next);
                    setBlankAnswers((prev) => {
                      if (prev.length === n) return prev;
                      if (prev.length < n) {
                        return [...prev, ...Array(n - prev.length).fill("")];
                      }
                      return prev.slice(0, n);
                    });
                  }}
                  className={`${inputClass} font-mono text-xs min-h-40`}
                  required
                />
              </Field>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400">
                  Expected answers ({countBlanks(starterCode)} blank
                  {countBlanks(starterCode) === 1 ? "" : "s"})
                </p>
                {blankAnswers.length === 0 ? (
                  <p className="text-[11px] text-amber-300">
                    Add at least one ____ in the starter code.
                  </p>
                ) : (
                  blankAnswers.map((answer, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 w-16 shrink-0">
                        Blank {i + 1}
                      </span>
                      <input
                        value={answer}
                        onChange={(e) =>
                          setBlankAnswers((prev) =>
                            prev.map((row, idx) =>
                              idx === i ? e.target.value : row,
                            ),
                          )
                        }
                        className={`${inputClass} font-mono text-xs`}
                        placeholder="Expected code for this blank"
                        required
                      />
                    </div>
                  ))
                )}
                <p className="text-[11px] text-slate-500">
                  Separate acceptable alternatives with{" "}
                  <code className="text-slate-400">|</code>, e.g.{" "}
                  <code className="text-slate-400">len|__len__</code>.
                </p>
              </div>
            </div>
          ) : (
            <Field label="Code snippet shown to student (optional)">
              <textarea
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                className={`${inputClass} font-mono text-xs min-h-24`}
              />
            </Field>
          )}

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

          <Field
            label="Ideal answer (trainer only)"
            labelAction={
              <MediaUploadButton
                toast={toast}
                onInserted={(markdown) =>
                  setIdealAnswer((prev) =>
                    prev.trim() ? `${prev}\n\n${markdown}` : markdown,
                  )
                }
              />
            }
          >
            <textarea
              value={idealAnswer}
              onChange={(e) => setIdealAnswer(e.target.value)}
              className={`${inputClass} min-h-24`}
              required
            />
          </Field>
          <Field
            label="Explanation (trainer only)"
            labelAction={
              <MediaUploadButton
                toast={toast}
                onInserted={(markdown) =>
                  setExplanation((prev) =>
                    prev.trim() ? `${prev}\n\n${markdown}` : markdown,
                  )
                }
              />
            }
          >
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
              onClick={(e) => {
                if (
                  dirty &&
                  !window.confirm("Discard unsaved changes and leave the editor?")
                ) {
                  e.preventDefault();
                }
              }}
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
  labelAction,
  children,
}: {
  label: string;
  labelAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        {labelAction}
      </span>
      {children}
    </label>
  );
}

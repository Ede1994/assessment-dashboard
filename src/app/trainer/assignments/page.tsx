"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TrainerNav } from "@/components/TrainerNav";
import { useToast } from "@/components/Toast";
import { listItemClass, useListKeyboard } from "@/hooks/useListKeyboard";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import {
  ASSIGNMENT_PRESETS,
  questionIdsForPreset,
} from "@/lib/assignmentPresets";
import { categoryColors } from "@/lib/colors";
import { questionTypeLabel } from "@/lib/questionTypes";

type Student = {
  id: string;
  username: string;
  displayName: string;
  assignedCount: number;
  totalQuestions: number;
  dueAt: string | null;
  examMode?: boolean;
};

type Category = {
  id: string;
  slug: string;
  name: string;
  color: string;
  icon: string;
};

type QuestionRow = {
  id: string;
  title: string;
  prompt: string;
  roundLabel: string;
  tags: string;
  type: string;
  categoryId: string;
  category: { slug: string; name: string; color: string };
};

type SavedTemplate = {
  id: string;
  name: string;
  description: string;
  questionIds: string[];
  questionCount: number;
};

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setEquals(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export default function TrainerAssignmentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedSelected, setSavedSelected] = useState<Set<string>>(new Set());
  const [dueAt, setDueAt] = useState("");
  const [savedDueAt, setSavedDueAt] = useState("");
  const [examMode, setExamMode] = useState(false);
  const [savedExamMode, setSavedExamMode] = useState(false);
  const [cohortIds, setCohortIds] = useState<Set<string>>(new Set());
  const [copyFromId, setCopyFromId] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] =
    useState<SavedTemplate | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<SavedTemplate | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const dirty =
    !setEquals(selected, savedSelected) ||
    dueAt !== savedDueAt ||
    examMode !== savedExamMode;

  useUnsavedChangesWarning(dirty);

  async function load(studentId?: string) {
    const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
    const res = await fetch(`/api/assignments${qs}`);
    if (!res.ok) throw new Error("Failed to load assignments");
    const data = await res.json();
    setStudents(data.students);
    setCategories(data.categories);
    setQuestions(data.questions);

    const sid = studentId || data.students[0]?.id || "";
    setSelectedStudentId(sid);

    const mine = (data.assignments as { userId: string; questionId: string; dueAt: string | null }[])
      .filter((a) => a.userId === sid)
      .map((a) => a.questionId);
    const nextSelected = new Set(mine);
    setSelected(nextSelected);
    setSavedSelected(new Set(mine));

    const due =
      (data.assignments as { userId: string; dueAt: string | null }[]).find(
        (a) => a.userId === sid && a.dueAt,
      )?.dueAt ??
      data.students.find((s: Student) => s.id === sid)?.dueAt ??
      null;
    const dueInput = toDateInputValue(due);
    setDueAt(dueInput);
    setSavedDueAt(dueInput);
    const exam =
      Boolean(
        (data.assignments as { userId: string; examMode?: boolean }[]).find(
          (a) => a.userId === sid,
        )?.examMode,
      ) || Boolean(data.students.find((s: Student) => s.id === sid)?.examMode);
    setExamMode(exam);
    setSavedExamMode(exam);
    setCohortIds(new Set());
    await loadTemplates();
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/api/assignment-templates");
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      // templates are optional chrome; assignment page still works
    }
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

  async function onSelectStudent(id: string) {
    if (id === selectedStudentId) return;
  if (dirty && !window.confirm(
        "You have unsaved assignment changes. Discard them and switch student?",
      )) {
      return;
    }
    setError("");
    try {
      const res = await fetch(
        `/api/assignments?studentId=${encodeURIComponent(id)}`,
      );
      const data = await res.json();
      setSelectedStudentId(id);
      const mine = (data.assignments as { questionId: string; dueAt: string | null }[]).map(
        (a) => a.questionId,
      );
      setSelected(new Set(mine));
      setSavedSelected(new Set(mine));
      const due =
        data.assignments.find((a: { dueAt: string | null }) => a.dueAt)?.dueAt ??
        data.students.find((s: Student) => s.id === id)?.dueAt ??
        null;
      const dueInput = toDateInputValue(due);
      setDueAt(dueInput);
      setSavedDueAt(dueInput);
      const exam =
        Boolean(
          (data.assignments as { examMode?: boolean }[]).find((a) => a.examMode)
            ?.examMode,
        ) || Boolean(data.students.find((s: Student) => s.id === id)?.examMode);
      setExamMode(exam);
      setSavedExamMode(exam);
      setStudents(data.students);
      setCohortIds(new Set());
    } catch {
      setError("Could not load student assignments");
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (filterCat !== "all" && item.category.slug !== filterCat) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.tags.toLowerCase().includes(q) ||
        item.roundLabel.toLowerCase().includes(q)
      );
    });
  }, [questions, filterCat, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeIndex = useListKeyboard({
    itemCount: visible.length,
    searchRef,
    enabled: !pendingDeleteTemplate && !pendingOverwrite,
    onActivate: (index) => {
      const item = visible[index];
      if (item) toggle(item.id);
    },
  });

  function selectVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of visible) {
        if (on) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  function selectCategory(slug: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of questions) {
        if (item.category.slug !== slug) continue;
        if (on) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  function applyPreset(presetId: string) {
    const ids = questionIdsForPreset(presetId, questions);
    if (!ids) return;
    setSelected(new Set(ids));
    setError("");
  }

  function applySavedTemplate(template: SavedTemplate) {
    const known = new Set(questions.map((q) => q.id));
    const ids = template.questionIds.filter((id) => known.has(id));
    setSelected(new Set(ids));
    setError("");
    const dropped = template.questionIds.length - ids.length;
    toast(
      dropped > 0
        ? `Applied “${template.name}” (${ids.length} tasks; ${dropped} missing from bank).`
        : `Applied “${template.name}” (${ids.length} tasks). Save to assign.`,
      "info",
    );
  }

  async function persistTemplate(overwriteId?: string) {
    const name = templateName.trim();
    if (!name) {
      toast("Name the template first.", "error");
      return;
    }
    setSavingTemplate(true);
    setError("");
    try {
      const questionIds = [...selected];
      const res = overwriteId
        ? await fetch(`/api/assignment-templates/${overwriteId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, questionIds }),
          })
        : await fetch("/api/assignment-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, questionIds }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save template");
      toast(
        overwriteId
          ? `Updated template “${name}”.`
          : `Saved template “${name}”.`,
        "success",
      );
      setTemplateName("");
      setPendingOverwrite(null);
      await loadTemplates();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save template";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function saveCurrentAsTemplate() {
    const name = templateName.trim();
    if (!name) {
      toast("Name the template first.", "error");
      return;
    }
    const existing = templates.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      setPendingOverwrite(existing);
      return;
    }
    await persistTemplate();
  }

  async function confirmDeleteTemplate() {
    if (!pendingDeleteTemplate) return;
    const { id, name } = pendingDeleteTemplate;
    try {
      const res = await fetch(`/api/assignment-templates/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setPendingDeleteTemplate(null);
      toast(`Deleted template “${name}”.`, "success");
      await loadTemplates();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast(msg, "error");
    }
  }

  async function copyFromStudent(sourceId: string) {
    if (!sourceId) return;
    try {
      const res = await fetch(
        `/api/assignments?studentId=${encodeURIComponent(sourceId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Copy failed");
      const mine = (data.assignments as { questionId: string; dueAt: string | null }[]).map(
        (a) => a.questionId,
      );
      setSelected(new Set(mine));
      const due =
        data.assignments.find((a: { dueAt: string | null }) => a.dueAt)?.dueAt ??
        null;
      if (due) setDueAt(toDateInputValue(due));
      toast(
        `Loaded ${mine.length} tasks from ${
          students.find((s) => s.id === sourceId)?.displayName ?? "student"
        }. Save to apply.`,
        "info",
      );
    } catch {
      setError("Could not copy assignments");
      toast("Could not copy assignments", "error");
    }
  }

  function toggleCohort(id: string) {
    if (id === selectedStudentId) return;
    setCohortIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!selectedStudentId) return;
    setSaving(true);
    setError("");
    try {
      const targets = [selectedStudentId, ...cohortIds];
      const res = await fetch("/api/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: targets,
          questionIds: [...selected],
          dueAt: dueAt ? new Date(`${dueAt}T23:59:59`).toISOString() : null,
          examMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        toast(data.error ?? "Save failed", "error");
        return;
      }
      const msg =
        targets.length > 1
          ? `Assigned ${data.assignedCount} tasks to ${data.studentCount} students.`
          : `Saved ${data.assignedCount} assigned tasks.`;
      toast(msg, "success");
      setCohortIds(new Set());
      await load(selectedStudentId);
    } catch {
      setError("Network error");
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  const student = students.find((s) => s.id === selectedStudentId);
  const pct =
    questions.length > 0
      ? Math.round((selected.size / questions.length) * 100)
      : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Assign tasks to each student"
        badge="Trainer"
      />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-6">
        <TrainerNav active="assignments" />

        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/30 p-5 rounded-2xl border border-sky-500/20">
          <h2 className="text-sm font-bold text-sky-300 mb-1">
            Per-student task selection
          </h2>
          <p className="text-xs text-slate-400 max-w-3xl">
            Choose questions, set an optional due date, copy from another
            student, or apply the current set to a cohort. Save a named template
            to reuse a custom set beyond the built-in CT/MRI/PyTorch presets.
            Empty assignment = student temporarily sees the full bank.
          </p>
        </section>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error && students.length === 0 ? (
          <p className="text-sm text-rose-400">{error}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-500">Student:</span>
              {students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectStudent(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    selectedStudentId === s.id
                      ? "bg-sky-600 text-white border-sky-600"
                      : "bg-slate-900 text-slate-400 border-slate-800"
                  }`}
                >
                  {s.displayName} ({s.assignedCount}/{s.totalQuestions})
                </button>
              ))}
              {dirty ? (
                <span className="text-[11px] text-amber-400 ml-1">
                  Unsaved changes
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <label className="space-y-1 block">
                <span className="text-xs text-slate-400">Due date (optional)</span>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={examMode}
                  onChange={(e) => setExamMode(e.target.checked)}
                />
                <span className="text-xs text-slate-300">
                  Exam mode (lock MC after first submit)
                </span>
              </label>
              <label className="space-y-1 block">
                <span className="text-xs text-slate-400">
                  Copy selection from student
                </span>
                <div className="flex gap-2">
                  <select
                    value={copyFromId}
                    onChange={(e) => setCopyFromId(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="">Choose…</option>
                    {students
                      .filter((s) => s.id !== selectedStudentId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.displayName} ({s.assignedCount})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!copyFromId}
                    onClick={() => copyFromStudent(copyFromId)}
                    className="px-3 py-2 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-sky-500/40 disabled:opacity-40"
                  >
                    Load
                  </button>
                </div>
              </label>
              <div className="space-y-1">
                <span className="text-xs text-slate-400">
                  Also apply to cohort ({cohortIds.size})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {students
                    .filter((s) => s.id !== selectedStudentId)
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleCohort(s.id)}
                        className={`px-2 py-1 rounded-lg text-[11px] border ${
                          cohortIds.has(s.id)
                            ? "bg-violet-600/30 text-violet-200 border-violet-500/40"
                            : "bg-slate-950 text-slate-500 border-slate-800"
                        }`}
                      >
                        {s.displayName}
                      </button>
                    ))}
                  {students.length <= 1 ? (
                    <span className="text-[11px] text-slate-600">
                      No other students yet
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="sticky top-[4.75rem] z-30 -mx-4 px-4 py-3 bg-slate-950/90 backdrop-blur border-b border-slate-800/80 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilterCat("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    filterCat === "all"
                      ? "bg-slate-700 text-white border-slate-600"
                      : "bg-slate-900 text-slate-400 border-slate-800"
                  }`}
                >
                  All categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFilterCat(c.slug)}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${
                      filterCat === c.slug
                        ? "bg-slate-700 text-white border-slate-600"
                        : "bg-slate-900 text-slate-400 border-slate-800"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  aria-label="Search tasks"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm w-full sm:w-56 focus:outline-none focus:border-sky-500"
                />
                <span className="hidden sm:inline text-[10px] text-slate-600 whitespace-nowrap">
                  / search · j/k · Enter
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs items-center">
              <span className="text-slate-500 mr-1">Built-in:</span>
              {ASSIGNMENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  title={p.description}
                  className="px-3 py-1.5 rounded-lg bg-sky-950/60 border border-sky-500/30 text-sky-300 hover:bg-sky-900/50"
                >
                  {p.label}
                </button>
              ))}
              {templates.length > 0 ? (
                <>
                  <span className="text-slate-700 mx-1">|</span>
                  <span className="text-slate-500 mr-1">Saved:</span>
                  {templates.map((t) => (
                    <span key={t.id} className="inline-flex items-stretch">
                      <button
                        type="button"
                        onClick={() => applySavedTemplate(t)}
                        title={`${t.questionCount} tasks`}
                        className="px-3 py-1.5 rounded-l-lg bg-violet-950/50 border border-violet-500/30 text-violet-200 hover:bg-violet-900/40"
                      >
                        {t.name} ({t.questionCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteTemplate(t)}
                        className="px-2 py-1.5 rounded-r-lg bg-violet-950/50 border border-l-0 border-violet-500/30 text-violet-400/80 hover:text-rose-300"
                        aria-label={`Delete template ${t.name}`}
                        title="Delete template"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </>
              ) : null}
              <span className="text-slate-700 mx-1">|</span>
              <button
                type="button"
                onClick={() => selectVisible(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300"
              >
                Select visible
              </button>
              <button
                type="button"
                onClick={() => selectVisible(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300"
              >
                Clear visible
              </button>
              {categories.map((c) => (
                <span key={c.id} className="inline-flex gap-1">
                  <button
                    type="button"
                    onClick={() => selectCategory(c.slug, true)}
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400"
                    title={`Select all in ${c.name}`}
                  >
                    + {c.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectCategory(c.slug, false)}
                    className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-500"
                    title={`Clear all in ${c.name}`}
                  >
                    −
                  </button>
                </span>
              ))}
            </div>

            <p className="text-xs text-slate-400">
              {student?.displayName ?? "Student"}:{" "}
              <span className="text-emerald-400 font-semibold">
                {selected.size}
              </span>{" "}
              / {questions.length} selected ({pct}%)
              {dueAt ? (
                <>
                  {" "}
                  · due{" "}
                  <span className="text-amber-300">
                    {new Date(`${dueAt}T23:59:59`).toLocaleDateString()}
                  </span>
                </>
              ) : null}
              {cohortIds.size > 0 ? (
                <>
                  {" "}
                  · +{cohortIds.size} cohort student
                  {cohortIds.size === 1 ? "" : "s"}
                </>
              ) : null}
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 max-h-[28rem] overflow-y-auto custom-scrollbar">
              {visible.map((q, index) => {
                const colors = categoryColors(q.category.color);
                const on = selected.has(q.id);
                return (
                  <label
                    key={q.id}
                    data-list-index={index}
                    className={listItemClass(
                      activeIndex === index,
                      `flex items-start gap-3 px-4 py-2.5 sm:py-3 cursor-pointer hover:bg-slate-800/40 ${
                        on ? "bg-sky-500/5" : ""
                      }`,
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={on}
                      onChange={() => toggle(q.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}
                        >
                          {q.roundLabel}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {q.category.name}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {questionTypeLabel(q.type, true)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200">{q.title}</p>
                      <p className="text-xs text-slate-500">{q.tags}</p>
                    </div>
                  </label>
                );
              })}
              {visible.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No tasks match.</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={saving || !selectedStudentId}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-medium"
              >
                {saving
                  ? "Saving…"
                  : cohortIds.size > 0
                    ? `Save for ${1 + cohortIds.size} students`
                    : "Save assignments"}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                  aria-label="New template name"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 w-40 focus:outline-none focus:border-violet-500"
                />
                <button
                  type="button"
                  onClick={() => void saveCurrentAsTemplate()}
                  disabled={savingTemplate || !templateName.trim()}
                  className="px-3 py-2 rounded-lg text-xs border border-violet-500/40 text-violet-200 hover:bg-violet-950/40 disabled:opacity-40"
                >
                  {savingTemplate ? "Saving…" : "Save as template"}
                </button>
              </div>
              {error ? <span className="text-xs text-rose-400">{error}</span> : null}
            </div>
          </>
        )}
      </main>
      <ConfirmDialog
        open={pendingDeleteTemplate != null}
        title="Delete assignment template?"
        body={
          pendingDeleteTemplate
            ? `Remove “${pendingDeleteTemplate.name}”? This does not change anyone’s current assignments.`
            : ""
        }
        confirmLabel="Delete template"
        danger
        onConfirm={() => void confirmDeleteTemplate()}
        onCancel={() => setPendingDeleteTemplate(null)}
      />
      <ConfirmDialog
        open={pendingOverwrite != null}
        title="Overwrite existing template?"
        body={
          pendingOverwrite
            ? `A template named “${pendingOverwrite.name}” already exists. Replace it with the current ${selected.size} selected task${selected.size === 1 ? "" : "s"}?`
            : ""
        }
        confirmLabel="Overwrite"
        busy={savingTemplate}
        onConfirm={() =>
          pendingOverwrite ? void persistTemplate(pendingOverwrite.id) : undefined
        }
        onCancel={() => setPendingOverwrite(null)}
      />
    </div>
  );
}

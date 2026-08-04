"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TrainerNav } from "@/components/TrainerNav";
import {
  ASSIGNMENT_PRESETS,
  questionIdsForPreset,
} from "@/lib/assignmentPresets";
import { categoryColors } from "@/lib/colors";

type Student = {
  id: string;
  username: string;
  displayName: string;
  assignedCount: number;
  totalQuestions: number;
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

export default function TrainerAssignmentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

    const mine = (data.assignments as { userId: string; questionId: string }[])
      .filter((a) => a.userId === sid)
      .map((a) => a.questionId);
    setSelected(new Set(mine));
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
    setSelectedStudentId(id);
    setMessage("");
    setError("");
    try {
      const res = await fetch(
        `/api/assignments?studentId=${encodeURIComponent(id)}`,
      );
      const data = await res.json();
      const mine = (data.assignments as { questionId: string }[]).map(
        (a) => a.questionId,
      );
      setSelected(new Set(mine));
      setStudents(data.students);
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
    setMessage("");
    setError("");
  }

  async function save() {
    if (!selectedStudentId) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          questionIds: [...selected],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setMessage(`Saved ${data.assignedCount} assigned tasks.`);
      await load(selectedStudentId);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const student = students.find((s) => s.id === selectedStudentId);

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
            Choose which questions each student must answer. Use presets
            (CT-track, MRI-track, PyTorch-only) or category +/- buttons, then
            Save. Students only see their assigned set.
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
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-between">
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
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm w-full sm:w-56 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs items-center">
              <span className="text-slate-500 mr-1">Presets:</span>
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
              / {questions.length} selected
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 max-h-[28rem] overflow-y-auto custom-scrollbar">
              {visible.map((q) => {
                const colors = categoryColors(q.category.color);
                const on = selected.has(q.id);
                return (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/40 ${
                      on ? "bg-sky-500/5" : ""
                    }`}
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
                          {q.type === "FREE_TEXT" ? "Free text" : "MC"}
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
                {saving ? "Saving…" : "Save assignments"}
              </button>
              {message ? (
                <span className="text-xs text-emerald-400">{message}</span>
              ) : null}
              {error ? <span className="text-xs text-rose-400">{error}</span> : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

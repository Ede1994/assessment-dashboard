"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TrainerNav } from "@/components/TrainerNav";
import { useToast } from "@/components/Toast";
import { colorMap } from "@/lib/colors";

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  _count: { questions: number };
};

const inputClass =
  "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500";

const colorKeys = Object.keys(colorMap);

function emptyDraft() {
  return {
    name: "",
    slug: "",
    icon: "fa-folder",
    color: "sky",
    sortOrder: "",
  };
}

export default function TrainerCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CategoryRow | null>(null);

  async function load() {
    const res = await fetch("/api/categories");
    if (!res.ok) throw new Error("Failed to load categories");
    const data = await res.json();
    setCategories(data.categories);
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

  function startEdit(c: CategoryRow) {
    setEditingId(c.id);
    setDraft({
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      sortOrder: String(c.sortOrder),
    });
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: draft.name,
        slug: draft.slug,
        icon: draft.icon,
        color: draft.color,
        sortOrder: draft.sortOrder === "" ? undefined : Number(draft.sortOrder),
      };
      const res = await fetch(
        editingId ? `/api/categories/${editingId}` : "/api/categories",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save category");
        return;
      }
      setMessage(
        editingId
          ? `Updated ${data.category.name}.`
          : `Created ${data.category.name}.`,
      );
      toast(
        editingId
          ? `Updated ${data.category.name}.`
          : `Created ${data.category.name}.`,
        "success",
      );
      cancelEdit();
      await load();
    } catch {
      setError("Network error");
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const c = pendingDelete;
    setBusyId(c.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete category");
        toast(data.error ?? "Could not delete category", "error");
        return;
      }
      setPendingDelete(null);
      setMessage(`Deleted ${c.name}.`);
      toast(`Deleted ${c.name}.`, "success");
      if (editingId === c.id) cancelEdit();
      await load();
    } catch {
      setError("Network error");
      toast("Network error", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Student Assessment Platform"
        subtitle="Create and rename question categories"
        badge="Trainer"
      />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-1 w-full space-y-6">
        <TrainerNav active="categories" />

        <form
          onSubmit={onSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-2xl"
        >
          <h2 className="text-sm font-semibold text-slate-100">
            {editingId ? "Edit category" : "New category"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 block sm:col-span-2">
              <span className="text-xs text-slate-400">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputClass}
                required
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-slate-400">Slug</span>
              <input
                value={draft.slug}
                onChange={(e) =>
                  setDraft({ ...draft, slug: e.target.value.toLowerCase() })
                }
                className={inputClass}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="lowercase letters, numbers, hyphens"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-slate-400">Sort order</span>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({ ...draft, sortOrder: e.target.value })
                }
                className={inputClass}
                placeholder="auto"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-slate-400">
                Icon (Font Awesome class)
              </span>
              <input
                value={draft.icon}
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                className={inputClass}
                placeholder="fa-folder"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-slate-400">Color</span>
              <select
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className={inputClass}
              >
                {colorKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
          {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Create category"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        {loading ? (
          <p className="text-sm text-slate-400">Loading categories…</p>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 text-xs font-semibold text-slate-400">
              Categories ({categories.length})
            </div>
            <div className="divide-y divide-slate-800">
              {categories.map((c) => {
                const colors = colorMap[c.color] ?? colorMap.sky;
                return (
                  <div
                    key={c.id}
                    className="px-5 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        <i className={`fa-solid ${c.icon}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-100">{c.name}</p>
                        <p className="text-xs text-slate-500">
                          {c.slug} · sort {c.sortOrder} · {c._count.questions}{" "}
                          question{c._count.questions === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:border-sky-500/40 hover:text-sky-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.id || c._count.questions > 0}
                        title={
                          c._count.questions > 0
                            ? "Reassign or delete questions first"
                            : "Delete category"
                        }
                        onClick={() => setPendingDelete(c)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete category?"
        body={
          pendingDelete
            ? `Delete category “${pendingDelete.name}”? Only empty categories can be removed.`
            : ""
        }
        confirmLabel="Delete"
        danger
        busy={Boolean(busyId)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

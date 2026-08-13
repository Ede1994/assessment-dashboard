"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * `/` focuses search, `j`/`k` (and arrows) move the highlighted list item,
 * Enter activates it. Ignores shortcuts while typing in form fields.
 */
export function useListKeyboard({
  itemCount,
  searchRef,
  enabled = true,
  onActivate,
}: {
  itemCount: number;
  searchRef: RefObject<HTMLInputElement | null>;
  enabled?: boolean;
  onActivate?: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeRef = useRef(-1);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    if (activeIndex >= itemCount) {
      const next = itemCount > 0 ? itemCount - 1 : -1;
      activeRef.current = next;
      setActiveIndex(next);
    }
  }, [itemCount, activeIndex]);

  const move = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => {
        if (itemCount <= 0) return -1;
        const start = prev < 0 ? (delta > 0 ? -1 : itemCount) : prev;
        const next = Math.min(itemCount - 1, Math.max(0, start + delta));
        activeRef.current = next;
        return next;
      });
    },
    [itemCount],
  );

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const editable = isEditableTarget(e.target);

      if (e.key === "/" && !editable) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (editable) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        const idx = activeRef.current;
        if (idx >= 0 && idx < itemCount) {
          e.preventDefault();
          onActivateRef.current?.(idx);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, itemCount, move, searchRef]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const el = document.querySelector(`[data-list-index="${activeIndex}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return activeIndex;
}

export function listItemClass(active: boolean, extra = "") {
  return `${extra} ${active ? "ring-1 ring-sky-500/70 bg-sky-500/10" : ""}`.trim();
}

"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Trap Tab inside an open dialog and restore focus on close. */
export function useFocusTrap(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const root = containerRef.current;
    if (!root) return;
    const trapRoot = root;

    const prev =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    function focusables() {
      return [...trapRoot.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute("disabled"),
      );
    }

    const initial = initialFocusRef?.current ?? focusables()[0];
    initial?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    trapRoot.addEventListener("keydown", onKey);
    return () => {
      trapRoot.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, containerRef, initialFocusRef]);
}

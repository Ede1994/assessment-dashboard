"use client";

import { useEffect, useRef, useState } from "react";

const FLUSH_EVERY_MS = 15_000;
const MAX_DELTA_MS = 120_000;

function postDelta(questionId: string, deltaMs: number) {
  if (deltaMs < 1000) return;
  const body = JSON.stringify({
    questionId,
    deltaMs: Math.min(Math.round(deltaMs), MAX_DELTA_MS),
  });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        "/api/time-spent",
        new Blob([body], { type: "application/json" }),
      );
      if (ok) return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch("/api/time-spent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // ignore network errors on heartbeat
  });
}

/** Tracks visible time on a question page and heartbeats it to the server. */
export function useTimeSpent(questionId: string | undefined, initialMs = 0) {
  const [displayMs, setDisplayMs] = useState(initialMs);
  const pendingRef = useRef(0);
  const lastTickRef = useRef(
    typeof performance !== "undefined" ? performance.now() : Date.now(),
  );

  useEffect(() => {
    setDisplayMs(initialMs);
  }, [questionId, initialMs]);

  useEffect(() => {
    if (!questionId) return;
    lastTickRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    pendingRef.current = 0;

    function now() {
      return typeof performance !== "undefined" ? performance.now() : Date.now();
    }

    function accumulate(force = false) {
      const t = now();
      const delta = t - lastTickRef.current;
      lastTickRef.current = t;
      if (
        !force &&
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (delta <= 0 || delta > MAX_DELTA_MS * 2) return;
      pendingRef.current += delta;
      setDisplayMs((prev) => prev + delta);
    }

    function flush() {
      accumulate(true);
      const delta = pendingRef.current;
      if (delta < 1000 || !questionId) return;
      pendingRef.current = 0;
      postDelta(questionId, delta);
    }

    const displayInterval = window.setInterval(() => {
      accumulate();
    }, 1000);
    const flushInterval = window.setInterval(flush, FLUSH_EVERY_MS);

    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
      else lastTickRef.current = now();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      window.clearInterval(displayInterval);
      window.clearInterval(flushInterval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [questionId]);

  return displayMs;
}

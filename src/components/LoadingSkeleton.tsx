"use client";

export function LoadingSkeleton({
  rows = 3,
  label = "Loading…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3"
        >
          <div className="h-3 w-1/3 rounded bg-slate-800" />
          <div className="h-3 w-full rounded bg-slate-800/80" />
          <div className="h-3 w-5/6 rounded bg-slate-800/60" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Cap a single heartbeat so a stuck tab cannot dump hours at once. */
export const MAX_TIME_DELTA_MS = 120_000;
export const MIN_TIME_DELTA_MS = 1_000;

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

export function parseTimeDelta(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < MIN_TIME_DELTA_MS || rounded > MAX_TIME_DELTA_MS) return null;
  return rounded;
}

import { DEFAULT_EXPIRY, EXPIRIES, type ExpiryId } from "./config";

export function isExpiryId(value: unknown): value is ExpiryId {
  return typeof value === "string" && EXPIRIES.some((e) => e.id === value);
}

export function expirySeconds(id: ExpiryId): number | null {
  return EXPIRIES.find((e) => e.id === id)?.seconds ?? null;
}

/** Absolute expiry timestamp (ms) for a paste created `now`, or null for never. */
export function expiresAt(id: ExpiryId, now = Date.now()): number | null {
  const s = expirySeconds(id);
  return s === null ? null : now + s * 1000;
}

export function normalizeExpiry(value: unknown): ExpiryId {
  return isExpiryId(value) ? value : DEFAULT_EXPIRY;
}

/** Human-friendly relative durations, e.g. "in 3 hours", "2 days ago". */
export function formatRelative(target: number, now = Date.now()): string {
  const diff = target - now;
  const abs = Math.abs(diff);
  const units: Array<[number, string]> = [
    [1000, "second"],
    [60_000, "minute"],
    [3_600_000, "hour"],
    [86_400_000, "day"],
    [604_800_000, "week"],
    [2_592_000_000, "month"],
    [31_536_000_000, "year"],
  ];
  let value = Math.round(abs / 1000);
  let unit = "second";
  for (let i = units.length - 1; i >= 0; i--) {
    if (abs >= units[i][0]) {
      value = Math.round(abs / units[i][0]);
      unit = units[i][1];
      break;
    }
  }
  if (abs < 5000) return diff >= 0 ? "now" : "just now";
  const label = `${value} ${unit}${value === 1 ? "" : "s"}`;
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

/** Compact duration like "3h 12m" or "2d". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

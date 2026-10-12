/**
 * Central, environment-driven configuration.
 * Everything here is safe to import from both server and client code
 * EXCEPT the values read from process.env at the bottom (server only).
 */

export const SITE = {
  name: "paster",
  tagline: "Paste it. Share it. Gone when you say so.",
  description:
    "A fast, clean pastebin with syntax highlighting, client-side encryption, expiry and burn-after-read.",
  repo: "https://github.com/mehermankar/paster",
  url: "https://paster.meher.tech",
} as const;

/** Expiry presets exposed to the UI and API. `null` seconds means "never". */
export const EXPIRIES = [
  { id: "10m", label: "10 minutes", seconds: 10 * 60 },
  { id: "1h", label: "1 hour", seconds: 60 * 60 },
  { id: "1d", label: "1 day", seconds: 24 * 60 * 60 },
  { id: "7d", label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { id: "30d", label: "30 days", seconds: 30 * 24 * 60 * 60 },
  { id: "never", label: "Never", seconds: null },
] as const;

export type ExpiryId = (typeof EXPIRIES)[number]["id"];
export const DEFAULT_EXPIRY: ExpiryId = "7d";

/**
 * Operator policy: MAX_EXPIRY caps how long a paste may live ("30d" disables "never").
 * Unset = everything allowed. Server-only; pages pass the allowed list to the editor.
 */
export function allowedExpiries(): ExpiryId[] {
  const max = process.env.MAX_EXPIRY;
  const cap = EXPIRIES.find((e) => e.id === max);
  if (!cap || cap.seconds === null) return EXPIRIES.map((e) => e.id);
  return EXPIRIES.filter((e) => e.seconds !== null && e.seconds <= cap.seconds).map((e) => e.id);
}

function bytesFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const LIMITS = {
  /**
   * Maximum size of the stored content field, in bytes (UTF-8 / ciphertext).
   * The server reads MAX_PASTE_BYTES; the client bundle only sees NEXT_PUBLIC_ vars, so pages
   * pass the server value down to the editor as a prop.
   */
  maxBytes: bytesFromEnv(process.env.MAX_PASTE_BYTES ?? process.env.NEXT_PUBLIC_MAX_PASTE_BYTES, 1024 * 1024),
  /**
   * Decoded size cap for image pastes. Images are stored base64 inside the same record, and the
   * whole record must fit Upstash's 1 MB request limit on the free tier: 700 KB * 4/3 leaves room.
   */
  maxImageBytes: 700 * 1024,
  maxTitle: 120,
  maxReportReason: 500,
  idLength: 8,
} as const;

export const RATE_LIMITS = {
  create: { limit: 20, window: "1 m" },
  read: { limit: 120, window: "1 m" },
  mutate: { limit: 30, window: "1 m" },
  report: { limit: 5, window: "10 m" },
} as const;

/** Server-only environment access. */
export const env = {
  get siteUrl(): string | undefined {
    return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  },
  get reportWebhookUrl(): string | undefined {
    return process.env.REPORT_WEBHOOK_URL || undefined;
  },
  get adminToken(): string | undefined {
    return process.env.ADMIN_TOKEN || undefined;
  },
  get redisUrl(): string | undefined {
    return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || undefined;
  },
  get redisToken(): string | undefined {
    return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || undefined;
  },
};

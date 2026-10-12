import { z } from "zod";
import { EXPIRIES, LIMITS } from "./config";
import { byteLength } from "./bytes";
import { normalizeLang } from "./langs";

const expiryIds = EXPIRIES.map((e) => e.id) as [string, ...string[]];

/** Lenient boolean for query strings and forms: "true"/"1"/"yes"/"on" → true, "false"/"0"/"no"/"off"/"" → false. */
export const looseBoolean = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (v === undefined) return false;
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(s)) return true;
    if (["false", "0", "no", "off", ""].includes(s)) return false;
    ctx.addIssue({ code: "custom", message: "expected true or false" });
    return false;
  });

const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/, "must be base64url");

export const encryptionSchema = z.object({
  alg: z.literal("AES-GCM"),
  kdf: z.enum(["fragment", "password"]),
  iv: base64url.min(16).max(24),
  salt: base64url.min(16).max(32).optional(),
  iterations: z.number().int().min(100_000).max(5_000_000).optional(),
});

const contentSchema = z
  .string()
  .min(1, "content is required")
  .refine((s) => s.trim().length > 0, "content is required")
  .refine((s) => byteLength(s) <= LIMITS.maxBytes, `content exceeds ${LIMITS.maxBytes} bytes`);

const titleSchema = z
  .string()
  .trim()
  .max(LIMITS.maxTitle, `title exceeds ${LIMITS.maxTitle} characters`)
  .optional()
  .transform((t) => (t ? t : undefined));

export const createPasteSchema = z.object({
  content: contentSchema,
  title: titleSchema,
  lang: z.unknown().optional().transform(normalizeLang),
  expires: z.enum(expiryIds).optional(),
  burn: looseBoolean,
  enc: encryptionSchema.optional(),
});
export type CreatePasteInput = z.infer<typeof createPasteSchema>;

/** On update an empty string (or null) clears the title. */
const updateTitleSchema = z
  .string()
  .trim()
  .max(LIMITS.maxTitle, `title exceeds ${LIMITS.maxTitle} characters`)
  .nullable()
  .optional()
  .transform((t) => (t === null ? "" : t));

export const updatePasteSchema = z
  .object({
    content: contentSchema.optional(),
    title: updateTitleSchema,
    lang: z.unknown().optional().transform((v) => (v === undefined ? undefined : normalizeLang(v))),
    enc: encryptionSchema.optional(),
  })
  .refine((o) => o.content !== undefined || o.title !== undefined || o.lang !== undefined, {
    message: "nothing to update",
  });
export type UpdatePasteInput = z.infer<typeof updatePasteSchema>;

export const reportSchema = z.object({
  reason: z.string().trim().min(3, "reason is too short").max(LIMITS.maxReportReason),
});

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "invalid request";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

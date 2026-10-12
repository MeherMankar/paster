import { DEFAULT_EXPIRY, EXPIRIES, LIMITS, SITE, allowedExpiries } from "@/lib/config";
import { LANGS } from "@/lib/langs";
import { json, options } from "@/lib/http";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function OPTIONS() {
  return options();
}

/** Capabilities + limits, for clients and the docs page. */
export async function GET() {
  const store = getStore();
  const stats = await store.stats().catch(() => ({ created: 0, views: 0 }));
  return json(
    {
      name: SITE.name,
      version: process.env.npm_package_version ?? "0.1.0",
      limits: { maxBytes: LIMITS.maxBytes, maxTitle: LIMITS.maxTitle },
      expiries: EXPIRIES.filter((e) => allowedExpiries().includes(e.id)).map((e) => ({ id: e.id, label: e.label, seconds: e.seconds })),
      defaultExpiry: allowedExpiries().includes(DEFAULT_EXPIRY) ? DEFAULT_EXPIRY : allowedExpiries().at(-1),
      languages: LANGS.map((l) => ({ id: l.id, label: l.label, ext: l.ext[0] ?? null })),
      features: { encryption: true, burnAfterRead: true, hastebin: true, reports: true },
      stats,
      storage: store.kind,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}

import { env } from "./config";

/** Absolute origin for building share URLs. Prefers the configured site URL. */
export function originFrom(req: Request): string {
  if (env.siteUrl) return env.siteUrl;
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Canonical link is just /{id}; the stored record already knows the language (`/{id}.{lang}` still resolves). */
export function pasteUrl(origin: string, id: string): string {
  return `${origin}/${id}`;
}

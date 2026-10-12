import { imageMime } from "./langs";
import type { PublicPaste } from "./paste";

/** Longest URL we turn into a short link. */
const MAX_LINK = 2048;

/**
 * If the whole paste is a single http(s) URL, return it normalised; otherwise null.
 * Such pastes act as short links: /{id} redirects, /{id}+ shows the preview page.
 */
export function extractLink(content: string): string | null {
  const s = content.trim();
  if (!s || s.length > MAX_LINK || /\s/.test(s) || !/^https?:\/\//i.test(s)) return null;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") || url.username || url.password) return null;
  return url.href;
}

/** Display form of a link target: host plus a shortened path. */
export function linkLabel(href: string): string {
  try {
    const u = new URL(href);
    const path = u.pathname === "/" && !u.search ? "" : `${u.pathname}${u.search}`;
    return `${u.host}${path.length > 40 ? path.slice(0, 37) + "…" : path}`;
  } catch {
    return href;
  }
}

export function linkHost(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

export type PasteKind = "text" | "image" | "link";

/** What a paste is, for API consumers and previews. Encrypted pastes are opaque, so "text". */
export function pasteKind(paste: Pick<PublicPaste, "content" | "lang" | "enc">): PasteKind {
  if (paste.enc) return "text";
  if (imageMime(paste.lang)) return "image";
  return extractLink(paste.content) ? "link" : "text";
}

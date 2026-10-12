import type { NextRequest } from "next/server";
import { clientIp, errorResponse, headFromPeek, text } from "@/lib/http";
import { extensionFor, imageMime, splitIdAndLang } from "@/lib/langs";
import { enforceRateLimit } from "@/lib/ratelimit";
import { readPaste } from "@/lib/service";

export const runtime = "nodejs";

/** HEAD never counts a view or burns: it only reports whether the paste exists. */
export async function HEAD(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return headFromPeek(splitIdAndLang((await params).id).id, { "Content-Type": "text/plain; charset=utf-8" });
}

/** ASCII fallback for the legacy `filename=` form. */
function asciiFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 100) || "paste";
}
/** Full UTF-8 name for `filename*=` (RFC 5987); only path separators, quotes and control chars are stripped. */
function utf8Filename(name: string): string {
  return name.replace(/[\\/"\u0000-\u001f]+/g, "_").slice(0, 150) || "paste";
}

/**
 * GET /:id/raw          → text/plain body (the ciphertext for encrypted pastes)
 * GET /:id/raw?dl=1     → download with a filename derived from the title/language
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: segment } = await params;
    const { id } = splitIdAndLang(segment);
    await enforceRateLimit("read", clientIp(req));
    const paste = await readPaste(id);
    const url = new URL(req.url);
    const download = url.searchParams.has("dl") || url.searchParams.has("download");
    const name = paste.title
      ? paste.title.includes(".")
        ? paste.title
        : `${paste.title}.${extensionFor(paste.lang)}`
      : `${paste.id}.${paste.enc ? "enc.txt" : extensionFor(paste.lang)}`;
    const disposition = download ? "attachment" : "inline";
    // Image pastes are stored base64; serve the bytes with their real media type.
    const mime = paste.enc ? undefined : imageMime(paste.lang);
    return text(mime ? Buffer.from(paste.content, "base64") : paste.content, {
      headers: {
        ...(mime ? { "Content-Type": mime } : {}),
        "Content-Disposition": `${disposition}; filename="${asciiFilename(name)}"; filename*=UTF-8''${encodeURIComponent(utf8Filename(name))}`,
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
        ...(paste.enc ? { "X-Encrypted": "1", "X-Encryption-Meta": JSON.stringify(paste.enc) } : {}),
      },
    });
  } catch (err) {
    return errorResponse(err, true);
  }
}

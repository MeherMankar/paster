import type { NextRequest } from "next/server";
import { clientIp, errorResponse, headFromPeek, text } from "@/lib/http";
import { imageMime, splitIdAndLang } from "@/lib/langs";
import { enforceRateLimit } from "@/lib/ratelimit";
import { readPaste } from "@/lib/service";

export const runtime = "nodejs";

/** HEAD never counts a view or burns: it only reports whether the paste exists. */
export async function HEAD(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return headFromPeek(splitIdAndLang((await params).id).id, { "Content-Type": "text/plain; charset=utf-8" });
}

/** hastebin-style alias: GET /raw/:key → text/plain */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = splitIdAndLang((await params).id);
    await enforceRateLimit("read", clientIp(req));
    const paste = await readPaste(id);
    const mime = paste.enc ? undefined : imageMime(paste.lang);
    return text(mime ? Buffer.from(paste.content, "base64") : paste.content, { headers: { "X-Robots-Tag": "noindex", ...(mime ? { "Content-Type": mime } : {}) } });
  } catch (err) {
    return errorResponse(err, true);
  }
}

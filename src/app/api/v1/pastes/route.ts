import type { NextRequest } from "next/server";
import { LIMITS } from "@/lib/config";
import { errorResponse, json, options, prefersText, readBody, text, clientIp } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { createPaste } from "@/lib/service";
import { originFrom, pasteUrl } from "@/lib/url";
import { extractLink, pasteKind } from "@/lib/links";

export const runtime = "nodejs";

/** A plain HTML <form> submission (JavaScript disabled) — send the browser to the new paste. */
function isBrowserForm(req: Request): boolean {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  const accept = req.headers.get("accept") ?? "";
  return (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) && accept.includes("text/html");
}

export async function OPTIONS() {
  return options();
}

/**
 * Create a paste.
 *   JSON:      curl -H 'content-type: application/json' -d '{"content":"hi","lang":"go"}' /api/v1/pastes
 *   raw body:  curl --data-binary @main.go '/api/v1/pastes?name=main.go&expires=1d'
 *   form:      curl -F 'content=@main.go' -F expires=1h /api/v1/pastes
 * Terminal clients get the URL back as plain text; everyone else gets JSON.
 */
export async function POST(req: NextRequest) {
  const wantsText = prefersText(req);
  try {
    await enforceRateLimit("create", clientIp(req));
    const body = await readBody(req, LIMITS.maxBytes);
    const { paste, editToken } = await createPaste(body);
    const origin = originFrom(req);
    const url = pasteUrl(origin, paste.id);
    const rawUrl = `${origin}/${paste.id}/raw`;
    const headers = { Location: url, "X-Edit-Token": editToken };
    if (wantsText) return text(`${url}\n`, { status: 201, headers });
    if (isBrowserForm(req)) return Response.redirect(url, 303);
    const kind = pasteKind(paste);
    return json({ ...paste, kind, ...(kind === "link" && !paste.burn ? { link: extractLink(paste.content) } : {}), url, rawUrl, editToken }, { status: 201, headers });
  } catch (err) {
    return errorResponse(err, wantsText);
  }
}

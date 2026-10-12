import type { NextRequest } from "next/server";
import { LIMITS } from "@/lib/config";
import { CORS_HEADERS, bearerToken, clientIp, errorResponse, headFromPeek, json, options, readBody } from "@/lib/http";
import { splitIdAndLang } from "@/lib/langs";
import { enforceRateLimit } from "@/lib/ratelimit";
import { deletePaste, readPaste, updatePaste } from "@/lib/service";
import { originFrom, pasteUrl } from "@/lib/url";
import { extractLink, pasteKind } from "@/lib/links";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS() {
  return options();
}

/** HEAD never counts a view or burns: it only reports whether the paste exists. */
export async function HEAD(_req: NextRequest, { params }: Ctx) {
  return headFromPeek(splitIdAndLang((await params).id).id, { "Content-Type": "application/json" });
}

/** Read a paste. Counts a view; burn-after-read pastes are destroyed by this call. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = splitIdAndLang((await params).id);
    await enforceRateLimit("read", clientIp(req));
    const paste = await readPaste(id);
    const origin = originFrom(req);
    const kind = pasteKind(paste);
    return json({
      ...paste,
      kind,
      ...(kind === "link" ? { link: extractLink(paste.content) } : {}),
      url: pasteUrl(origin, paste.id),
      rawUrl: `${origin}/${paste.id}/raw`,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Update content/title/lang. Requires `Authorization: Bearer <editToken>`. Keeps the original expiry. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = splitIdAndLang((await params).id);
    await enforceRateLimit("mutate", clientIp(req));
    const body = await readBody(req, LIMITS.maxBytes);
    const paste = await updatePaste(id, bearerToken(req), body);
    return json(paste);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Delete. Requires `Authorization: Bearer <editToken>`. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = splitIdAndLang((await params).id);
    await enforceRateLimit("mutate", clientIp(req));
    await deletePaste(id, bearerToken(req));
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  } catch (err) {
    return errorResponse(err);
  }
}

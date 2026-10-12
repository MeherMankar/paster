import type { NextRequest } from "next/server";
import { LIMITS } from "@/lib/config";
import { clientIp, errorResponse, json, options, readBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { createPaste } from "@/lib/service";

export const runtime = "nodejs";

export async function OPTIONS() {
  return options();
}

/**
 * hastebin-compatible create endpoint so existing CLIs keep working:
 *   cat file | haste
 *   curl --data-binary @file https://host/documents   → {"key":"abc123"}
 */
export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit("create", clientIp(req));
    const body = await readBody(req, LIMITS.maxBytes);
    const content = typeof body.content === "string" ? body.content : typeof body.data === "string" ? body.data : "";
    const { paste, editToken } = await createPaste({ content, expires: "30d" });
    return json({ key: paste.id, editToken }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

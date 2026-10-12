import type { NextRequest } from "next/server";
import { clientIp, errorResponse, json, options, readBody } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { reportPaste } from "@/lib/service";
import { splitIdAndLang } from "@/lib/langs";
import { originFrom } from "@/lib/url";

export const runtime = "nodejs";

export async function OPTIONS() {
  return options();
}

/** Report abusive content. Stored in Redis and optionally forwarded to REPORT_WEBHOOK_URL. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = splitIdAndLang((await params).id);
    const ip = clientIp(req);
    await enforceRateLimit("report", ip);
    const body = await readBody(req, 8 * 1024);
    const result = await reportPaste(id, body, ip, originFrom(req));
    return json({ ...result, message: "Thanks — this paste has been flagged for review." });
  } catch (err) {
    return errorResponse(err);
  }
}

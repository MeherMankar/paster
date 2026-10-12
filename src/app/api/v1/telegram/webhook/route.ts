import type { NextRequest } from "next/server";
import { removePaste } from "@/lib/service";
import { handleUpdate, telegramConfig, verifySecret } from "@/lib/telegram";

export const runtime = "nodejs";

/**
 * Telegram calls this when someone presses "Remove" under a report notification.
 * Guarded by the secret token Telegram echoes back; always answers 200 so Telegram stops retrying.
 */
export async function POST(req: NextRequest) {
  const cfg = telegramConfig();
  if (!cfg) return new Response("telegram is not configured", { status: 404 });
  if (!(await verifySecret(cfg.token, req.headers.get("x-telegram-bot-api-secret-token")))) {
    return new Response("forbidden", { status: 403 });
  }
  let update: { callback_query?: Parameters<typeof handleUpdate>[1]["callback_query"] };
  try {
    update = (await req.json()) as typeof update;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  try {
    const result = await handleUpdate(cfg, update, removePaste);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[telegram] update handling failed", err);
    return Response.json({ ok: false });
  }
}

import type { NextRequest } from "next/server";
import { env } from "@/lib/config";
import { HttpError, bearerToken, errorResponse, json, options } from "@/lib/http";
import { registerWebhook, telegramConfig, webhookInfo } from "@/lib/telegram";
import { safeEqual } from "@/lib/tokens";
import { originFrom } from "@/lib/url";

export const runtime = "nodejs";

export async function OPTIONS() {
  return options();
}

function authorize(req: NextRequest) {
  const admin = env.adminToken;
  const token = bearerToken(req);
  if (!admin) throw new HttpError(404, "not_found", "admin API is disabled (set ADMIN_TOKEN)");
  if (!token || !safeEqual(token, admin)) throw new HttpError(403, "forbidden", "admin token required");
  const cfg = telegramConfig();
  if (!cfg) throw new HttpError(404, "not_found", "telegram is not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)");
  return cfg;
}

/** GET → current webhook status from Telegram. */
export async function GET(req: NextRequest) {
  try {
    const cfg = authorize(req);
    return json({ chatId: cfg.chatId, webhook: await webhookInfo(cfg) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST → (re)register the webhook for this deployment's origin so the Remove button works. */
export async function POST(req: NextRequest) {
  try {
    const cfg = authorize(req);
    const origin = originFrom(req);
    const result = await registerWebhook(cfg, origin);
    return json({ ok: true, url: `${origin}/api/v1/telegram/webhook`, result });
  } catch (err) {
    return errorResponse(err);
  }
}

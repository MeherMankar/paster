import "server-only";
import { env } from "./config";
import { formatBytes } from "./bytes";
import { getLang } from "./langs";
import { pasteKind } from "./links";
import type { PublicPaste } from "./paste";
import { safeEqual } from "./tokens";

/**
 * Telegram notifications for abuse reports.
 * Off unless TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set. Each report becomes a message with an
 * "Open" link and a "Remove" button; the button calls back into /api/v1/telegram/webhook, which
 * deletes the paste. The webhook is registered automatically the first time a report is sent
 * (needs NEXT_PUBLIC_SITE_URL) or manually via POST /api/v1/admin/telegram.
 */
export type TelegramConfig = { token: string; chatId: string };

export function telegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

/** Secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token; derived so no extra env var is needed. */
export async function webhookSecret(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${token}|pastr-telegram-webhook`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

export type ReportNotice = {
  paste: PublicPaste;
  origin: string;
  reason: string;
  count: number;
  reporter: string;
};

/** Where an operator should look: short links get the preview page so the click doesn't redirect. */
export function pasteLink(origin: string, paste: PublicPaste): string {
  return `${origin}/${paste.id}${pasteKind(paste) === "link" ? "+" : ""}`;
}

/** HTML message body (Telegram parse_mode=HTML). Exported for tests. */
export function formatReportMessage(n: ReportNotice): string {
  const { paste, origin, reason, count, reporter } = n;
  const kind = pasteKind(paste);
  const what = paste.enc ? "encrypted" : kind === "link" ? "short link" : kind === "image" ? (getLang(paste.lang)?.label ?? "image") : (getLang(paste.lang)?.label ?? "text");
  const flags = [paste.burn && "burn after read", paste.expires === null && "never expires"].filter(Boolean).join(" · ");
  const url = pasteLink(origin, paste);
  const lines = [
    `🚩 <b>Paste reported</b> (report #${count})`,
    `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`,
    escapeHtml([what, formatBytes(paste.size), `${paste.views} views`, flags].filter(Boolean).join(" · ")),
    paste.title ? `title: ${escapeHtml(paste.title.slice(0, 120))}` : "",
    `reporter: <code>${escapeHtml(reporter)}</code>`,
    "",
    `<pre>${escapeHtml(reason.slice(0, 1500))}</pre>`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

async function api(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; description?: string; result?: unknown } | null;
  if (!res.ok || !data?.ok) throw new Error(`telegram ${method} failed: ${data?.description ?? res.status}`);
  return data.result;
}

declare global {
  var __telegramWebhookFor: string | undefined;
}

/** Point the bot's webhook at this deployment. Idempotent; remembers the origin per server instance. */
export async function registerWebhook(cfg: TelegramConfig, origin: string): Promise<unknown> {
  const result = await api(cfg.token, "setWebhook", {
    url: `${origin}/api/v1/telegram/webhook`,
    secret_token: await webhookSecret(cfg.token),
    allowed_updates: ["callback_query"],
    drop_pending_updates: false,
  });
  globalThis.__telegramWebhookFor = origin;
  return result;
}

export async function webhookInfo(cfg: TelegramConfig): Promise<unknown> {
  return api(cfg.token, "getWebhookInfo", {});
}

/** Send the report; registers the webhook first when a public origin is configured and it isn't done yet. */
export async function notifyReport(cfg: TelegramConfig, n: ReportNotice): Promise<void> {
  const publicOrigin = env.siteUrl;
  if (publicOrigin && globalThis.__telegramWebhookFor !== publicOrigin) {
    await registerWebhook(cfg, publicOrigin).catch((err) => console.error("[telegram] webhook registration failed", err));
  }
  await api(cfg.token, "sendMessage", {
    chat_id: cfg.chatId,
    text: formatReportMessage(n),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Open", url: pasteLink(n.origin, n.paste) },
          { text: "🗑 Remove", callback_data: `rm:${n.paste.id}` },
        ],
      ],
    },
  });
}

type CallbackQuery = {
  id: string;
  data?: string;
  from?: { id: number; first_name?: string; username?: string };
  message?: { message_id: number; chat: { id: number | string }; text?: string };
};

/**
 * Handle an update from Telegram. Only "Remove" presses from the configured chat do anything.
 * `remove` performs the deletion (admin authority: whoever can press the button is an operator).
 */
export async function handleUpdate(
  cfg: TelegramConfig,
  update: { callback_query?: CallbackQuery },
  remove: (id: string) => Promise<boolean>,
): Promise<{ handled: boolean; note: string }> {
  const q = update.callback_query;
  if (!q?.data?.startsWith("rm:")) return { handled: false, note: "ignored" };
  const answer = (text: string) => api(cfg.token, "answerCallbackQuery", { callback_query_id: q.id, text }).catch(() => {});
  if (String(q.message?.chat.id) !== String(cfg.chatId)) {
    await answer("Not allowed from this chat.");
    return { handled: false, note: "wrong chat" };
  }
  const id = q.data.slice(3);
  if (!/^[A-Za-z0-9]{4,32}$/.test(id)) {
    await answer("Bad paste id.");
    return { handled: false, note: "bad id" };
  }
  const removed = await remove(id);
  const who = q.from?.username ? `@${q.from.username}` : (q.from?.first_name ?? "operator");
  await answer(removed ? `Removed ${id}` : `${id} was already gone`);
  if (q.message) {
    await api(cfg.token, "editMessageText", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      text: `${q.message.text ?? `Paste ${id}`}\n\n${removed ? "✅ Removed" : "ℹ️ Already gone"} by ${who}`,
      parse_mode: undefined,
      reply_markup: { inline_keyboard: [] },
    }).catch((err) => console.error("[telegram] editMessageText failed", err));
  }
  return { handled: true, note: removed ? "removed" : "already gone" };
}

/** Constant-time check of the secret header Telegram sends with every webhook call. */
export async function verifySecret(token: string, header: string | null): Promise<boolean> {
  if (!header) return false;
  return safeEqual(header, await webhookSecret(token));
}

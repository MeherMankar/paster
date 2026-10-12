import type { NextRequest } from "next/server";
import { env } from "@/lib/config";
import { HttpError, bearerToken, errorResponse, json, options } from "@/lib/http";
import { getStore } from "@/lib/store";
import { safeEqual } from "@/lib/tokens";

export const runtime = "nodejs";

export async function OPTIONS() {
  return options();
}

/**
 * Operator listing (Authorization: Bearer ADMIN_TOKEN):
 *   GET /api/v1/admin/pastes?limit=50            newest pastes with size/lang/flags/report counts
 *   GET /api/v1/admin/pastes?sort=reports        most-reported first
 * Delete anything with the normal DELETE endpoint and the admin token.
 * Content is never included — fetch a suspicious paste explicitly by id.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = env.adminToken;
    const token = bearerToken(req);
    if (!admin) throw new HttpError(404, "not_found", "admin API is disabled (set ADMIN_TOKEN)");
    if (!token || !safeEqual(token, admin)) throw new HttpError(403, "forbidden", "admin token required");

    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
    const sort = url.searchParams.get("sort") === "reports" ? "reports" : "recent";
    const store = getStore();
    const ids = sort === "reports" ? (await store.mostReported(limit)).map((r) => r.id) : (await store.recent(limit)).map((r) => r.id);
    const reportCounts = new Map((await store.mostReported(500)).map((r) => [r.id, r.reports]));

    const items = [];
    for (const id of ids) {
      const res = await store.peek(id);
      if (!res) continue;
      const { record, views } = res;
      items.push({
        id,
        title: record.title,
        lang: record.lang,
        size: record.size,
        encrypted: !!record.enc,
        burn: record.burn,
        created: record.created,
        expires: record.expires,
        views,
        reports: reportCounts.get(id) ?? 0,
      });
    }
    return json({ sort, count: items.length, items, stats: await store.stats() });
  } catch (err) {
    return errorResponse(err);
  }
}

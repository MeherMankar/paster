import { NextResponse } from "next/server";
import { langFromFilename, langFromMime } from "./langs";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  "Access-Control-Expose-Headers": "Location, X-Edit-Token, X-Encrypted, X-Encryption-Meta, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining",
  "Access-Control-Max-Age": "86400",
};

const NO_STORE: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function json<T>(data: T, init: ResponseInit & { headers?: Record<string, string> } = {}) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...CORS_HEADERS, ...NO_STORE, ...(init.headers ?? {}) },
  });
}

export function text(body: BodyInit, init: ResponseInit & { headers?: Record<string, string> } = {}) {
  return new NextResponse(body, {
    ...init,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...CORS_HEADERS,
      ...NO_STORE,
      ...(init.headers ?? {}),
    },
  });
}

export function errorResponse(err: unknown, wantsText = false) {
  const e =
    err instanceof HttpError
      ? err
      : new HttpError(500, "internal_error", "something went wrong");
  if (e.status >= 500) console.error(err);
  if (wantsText) return text(`error: ${e.message} (${e.code})\n`, { status: e.status, headers: { "X-Error-Code": e.code, ...(e.headers ?? {}) } });
  return json({ error: { code: e.code, message: e.message } }, { status: e.status, headers: e.headers });
}

/** Shared HEAD handler: existence + headers only, no view counting, no burning. */
export async function headFromPeek(id: string, extra: Record<string, string> = {}) {
  const { peekPaste } = await import("./service");
  const p = await peekPaste(id);
  if (!p) return new Response(null, { status: 404, headers: { ...CORS_HEADERS, ...NO_STORE } });
  return new Response(null, {
    status: 200,
    headers: { ...CORS_HEADERS, ...NO_STORE, ...(p.enc ? { "X-Encrypted": "1" } : {}), ...extra },
  });
}

export function options() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Client IP for rate limiting.
 * On Vercel the platform rewrites X-Forwarded-For to the real client, so the first entry is trusted.
 * Elsewhere, TRUSTED_PROXY_HOPS (default 1) says how many proxies appended to the chain; we take the
 * entry that the outermost trusted proxy saw, so clients cannot spoof their way past the limiter.
 */
export function clientIp(req: Request): string {
  return ipFromHeaders(req.headers);
}

export function ipFromHeaders(h: Headers): string {
  const xff = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (xff.length) {
    const raw = Number(process.env.TRUSTED_PROXY_HOPS ?? (process.env.VERCEL ? 0 : 1));
    const hops = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 1;
    if (hops === 0) return xff[0];
    // Chain shorter than the trusted depth means the header was client-supplied: share one bucket.
    if (xff.length < hops) return "untrusted";
    return xff[xff.length - hops];
  }
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "0.0.0.0";
}

/**
 * Decide between a bare-URL text response and JSON.
 * JSON in → JSON out. Otherwise terminal clients (curl, wget, httpie, …) get plain text
 * unless they explicitly ask for JSON; browsers and SDKs get JSON.
 */
export function prefersText(req: Request): boolean {
  const url = new URL(req.url);
  if (url.searchParams.has("plain")) return true;
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json")) return false;
  if (accept.includes("text/plain")) return true;
  if ((req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return false;
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  return /^(curl|wget|httpie|xh)\b/.test(ua);
}

export function bearerToken(req: Request): string | undefined {
  const auth = req.headers.get("authorization") ?? "";
  const [scheme, token] = auth.split(/\s+/, 2);
  if (scheme?.toLowerCase() === "bearer" && token) return token.trim();
  return undefined;
}

/** Read the body with a hard byte cap, regardless of Content-Length (chunked uploads included). */
async function readCapped(req: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared && declared > maxBytes) throw new HttpError(413, "too_large", "request body too large");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, "too_large", "request body too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Accepts JSON, HTML forms / multipart (curl -F), and raw text bodies so the
 * API is pleasant from a terminal: `curl --data-binary @file host/api/v1/pastes`.
 * `maxBytes` is the content cap; the wire cap allows for base64 ciphertext and form overhead.
 */
export async function readBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  const bytes = await readCapped(req, maxBytes * 2 + 64 * 1024);
  const text = () => new TextDecoder().decode(bytes);

  if (ct.includes("application/json")) {
    try {
      const parsed = JSON.parse(text()) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new HttpError(400, "bad_request", "JSON body must be an object");
      }
      return withQueryOptions(req, normalizeFields(parsed as Record<string, unknown>));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, "bad_request", "invalid JSON body");
    }
  }
  if (ct.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await new Response(bytes, { headers: { "content-type": req.headers.get("content-type")! } }).formData();
    } catch {
      throw new HttpError(400, "bad_request", "invalid multipart body");
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") out[k] = v;
      else {
        const img = langFromMime(v.type) ?? langFromFilename(v.name ?? "");
        out[k] = img?.mime ? Buffer.from(await v.arrayBuffer()).toString("base64") : await v.text();
        if (img?.mime) out.lang = img.id;
        if (v.name && v.name !== "-" && !out.filename) out.filename = v.name;
      }
    }
    return withQueryOptions(req, normalizeFields(out));
  }
  // Binary image body (curl --data-binary @shot.png with an image content type, or ?name=shot.png).
  const url = new URL(req.url);
  const img = langFromMime(ct) ?? langFromFilename(url.searchParams.get("name") ?? url.searchParams.get("filename") ?? "");
  if (img?.mime) return withQueryOptions(req, { content: Buffer.from(bytes).toString("base64"), lang: img.id });
  if (ct.includes("application/x-www-form-urlencoded")) {
    // curl's default content type for --data / --data-binary. If it doesn't look like a form
    // (no `content=` field) treat the whole body as the paste text, like hastebin does.
    // A real form encoder never emits raw newlines, so anything multi-line is treated as text.
    const body = text();
    if (FORM_SHAPED.test(body) && /(^|&)(content|data|file|text)=/.test(body)) {
      const params = new URLSearchParams(body);
      const out: Record<string, unknown> = {};
      for (const [k, v] of params.entries()) out[k] = v;
      return withQueryOptions(req, normalizeFields(out));
    }
    return withQueryOptions(req, { content: body });
  }
  // Raw body (text/plain, application/octet-stream, …): the body is the content.
  return withQueryOptions(req, { content: text() });
}

const FORM_SHAPED = /^[\w.\-]+=[^&\n\r]*(?:&[\w.\-]+=[^&\n\r]*)*$/;

/** Accept the common aliases clients use for the content and file name fields. */
function normalizeFields(out: Record<string, unknown>): Record<string, unknown> {
  if (out.content === undefined) {
    const alt = out.data ?? out.file ?? out.text;
    if (typeof alt === "string") out.content = alt;
  }
  if (out.filename === undefined && typeof out.name === "string" && out.name) out.filename = out.name;
  return out;
}

/** Query-string options (?lang=go&expires=1d&name=main.go&burn) complement any body. */
function withQueryOptions(req: Request, out: Record<string, unknown>): Record<string, unknown> {
  const url = new URL(req.url);
  for (const key of ["title", "lang", "expires", "burn", "name", "filename"]) {
    let v = url.searchParams.get(key);
    if (v === null) continue;
    if (key === "burn" && v === "") v = "true";
    const target = key === "name" ? "filename" : key;
    if (out[target] === undefined) out[target] = v;
  }
  return out;
}

import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers + a nonce-based Content Security Policy for every response.
 * Next.js picks the nonce up from the CSP request header for its own inline scripts;
 * our ThemeScript reads it from the `x-nonce` request header.
 * Inline *styles* stay allowed because shiki emits per-token style attributes.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

const PASTE_PATH = /^\/[A-Za-z0-9]{4,32}(\.[A-Za-z0-9+#-]+)?$/;

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const path = request.nextUrl.pathname;
  // Only paste pages may be framed, and only when explicitly embedded.
  const embeddable = PASTE_PATH.test(path) && request.nextUrl.searchParams.get("embed") === "1";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-inline' 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${embeddable ? "*" : "'none'"}`,
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v);
  if (!embeddable) response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", csp);
  // Paste pages must never be indexed; the home/docs pages may be.
  if (path !== "/" && !path.startsWith("/docs") && !path.startsWith("/api")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icons/|robots.txt|manifest.webmanifest|opengraph-image|twitter-image).*)"],
};

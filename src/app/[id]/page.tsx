import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { extractLink, linkHost } from "@/lib/links";
import { headers } from "next/headers";
import { SITE } from "@/lib/config";
import { getLang, imageMime, splitIdAndLang } from "@/lib/langs";
import { highlightLines } from "@/lib/highlight";
import { getView } from "@/lib/view";
import { formatBytes } from "@/lib/bytes";
import { Shell } from "@/components/shell";
import { enforceRateLimit } from "@/lib/ratelimit";
import { HttpError, ipFromHeaders } from "@/lib/http";
import { PasteView } from "@/components/paste/paste-view";

export const dynamic = "force-dynamic";

/** Cheap content fingerprint (FNV-1a) for the remount key; not security-relevant. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

type Props = PageProps<"/[id]">;

async function resolve(props: Props) {
  const { id: raw } = await props.params;
  // A trailing "+" (like bit.ly) asks for the preview page of a short link instead of the redirect.
  // The segment may arrive percent-encoded ("%2B") depending on which render pass asks, so decode first.
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* keep as is */
  }
  const preview = /[+ ]$/.test(decoded);
  const segment = decoded.replace(/[+ ]+$/, "");
  const { id, lang: suffix } = splitIdAndLang(segment);
  await limitPageReads();
  const view = await getView(id);
  if (!view) notFound();
  // A URL suffix picks the highlighter; it cannot turn text into an image or an image into text.
  const suffixLang = suffix ? getLang(suffix)?.id : undefined;
  const override = suffixLang && !imageMime(suffixLang) && !imageMime(view.paste.lang) ? suffixLang : undefined;
  // Plain pastes that are exactly one URL act as short links (never encrypted or burn pastes).
  const link = view.mode === "plain" && !imageMime(view.paste.lang) ? extractLink(view.paste.content) : null;
  return { id, view, override, link, preview };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  let resolved: Awaited<ReturnType<typeof resolve>>;
  try {
    resolved = await resolve(props);
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) return { title: "Slow down", robots: { index: false } };
    throw err;
  }
  const { id, view, link } = resolved;
  const { paste } = view;
  const origin = await requestOrigin();
  const title = paste.title ?? (link ? `Short link to ${linkHost(link)}` : view.mode === "encrypted" ? "Encrypted paste" : view.mode === "burn" ? "Burn-after-read paste" : `Paste ${id}`);
  const description =
    view.mode === "plain"
      ? link
        ? `${origin.replace(/^https?:\/\//, "")}/${id} redirects to ${link.slice(0, 120)}`
        : imageMime(paste.lang)
          ? `${getLang(paste.lang)?.label}, ${formatBytes(paste.size)}`
          : paste.content.split("\n").slice(0, 3).join(" ").slice(0, 160) || SITE.description
      : view.mode === "burn"
        ? "This paste self-destructs after it is viewed once."
        : "This paste is end-to-end encrypted. Only someone with the key can read it.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "article", url: `${origin}/${id}`, images: [{ url: `${origin}/${id}/opengraph-image`, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [{ url: `${origin}/${id}/opengraph-image`, alt: title }] },
    alternates: { canonical: `${origin}/${id}` },
  };
}

/** Public origin for absolute URLs: NEXT_PUBLIC_SITE_URL, else the forwarded host. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `${proto}://${host}`;
}

/** Same per-IP read budget as the API; a limited request renders a small notice instead of the paste. */
async function limitPageReads() {
  await enforceRateLimit("read", ipFromHeaders(await headers()));
}

function RateLimited() {
  return (
    <Shell>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="font-mono text-[12px] text-fg-faint">429</p>
        <h1 className="text-[18px] font-semibold tracking-tight">Slow down</h1>
        <p className="max-w-sm text-[13px] text-fg-muted">Too many requests from your network. Try again in a minute.</p>
      </div>
    </Shell>
  );
}

export default async function PastePage(props: Props) {
  let resolved: Awaited<ReturnType<typeof resolve>>;
  try {
    resolved = await resolve(props);
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) return <RateLimited />;
    throw err;
  }
  const { view, override, link, preview } = resolved;
  const search = await props.searchParams;
  const embed = search.embed === "1"; // must match proxy.ts, which only lifts framing rules for embed=1
  // Short link: send the visitor on (the read above already counted this visit). "+" or ?preview shows the page.
  if (link && !preview && search.preview === undefined && !embed) redirect(link);
  const origin = await requestOrigin();

  const lang = override ?? view.paste.lang;
  const highlighted = view.mode === "plain" && !imageMime(lang) ? await highlightLines(view.paste.content, lang) : null;

  // Remount the client view whenever the stored paste changes (e.g. after an edit + router.refresh()).
  const versionKey = `${view.paste.id}:${view.paste.size}:${view.paste.lang}:${view.paste.title ?? ""}:${fnv1a(view.paste.content)}`;

  const content = (
    <PasteView
      key={versionKey}
      mode={view.mode}
      paste={{ ...view.paste, lang }}
      lines={highlighted?.lines ?? null}
      origin={origin}
      embed={embed}
      sizeLabel={formatBytes(view.paste.size)}
      link={link ?? undefined}
    />
  );

  if (embed) return <div className="p-2">{content}</div>;
  return (
    <Shell wide mobile="viewer">
      {content}
    </Shell>
  );
}

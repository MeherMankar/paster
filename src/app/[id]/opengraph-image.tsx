import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { formatBytes } from "@/lib/bytes";
import { HttpError, ipFromHeaders } from "@/lib/http";
import { getLang, imageMime, splitIdAndLang } from "@/lib/langs";
import { extractLink, linkHost } from "@/lib/links";
import { Card, Chip, OG } from "@/lib/og";
import { enforceRateLimit } from "@/lib/ratelimit";
import { getPeek } from "@/lib/view";

export const alt = "Paste preview";
export const size = OG.size;
export const contentType = "image/png";

/** Formats the renderer can decode; others fall back to a generic card. */
const RENDERABLE = new Set(["image/png", "image/jpeg", "image/gif"]);
/** Largest image (decoded bytes) we composite into a card; bigger ones get the generic card. */
const MAX_PREVIEW_IMAGE = 3 * 1024 * 1024;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = splitIdAndLang((await params).id.replace(/\+$/, ""));
  try {
    await enforceRateLimit("read", ipFromHeaders(await headers()));
  } catch (err) {
    if (err instanceof HttpError) return new Response(err.message, { status: err.status, headers: err.headers });
    throw err;
  }
  const paste = await getPeek(id);
  const hidden = !paste || !!paste.enc || paste.burn;
  const mime = paste && !hidden ? imageMime(paste.lang) : undefined;
  const link = paste && !hidden && !mime ? extractLink(paste.content) : null;
  const title = !paste ? "Paste not found" : paste.enc ? "Encrypted paste" : paste.burn ? "Burn-after-read paste" : (paste.title ?? (link ? "Short link" : mime ? "Image" : `Paste ${id}`));
  const langLabel = paste && !hidden ? (getLang(paste.lang)?.label ?? "Plain text") : "";
  const meta = paste ? [langLabel || (paste.enc ? "encrypted" : "burn after read"), formatBytes(paste.size), paste.expires ? "expires" : "never expires"] : [];

  // ---- image pastes: the picture is the preview ----
  const imageBytes = mime ? Math.floor((paste!.content.length * 3) / 4) : 0;
  if (mime && RENDERABLE.has(mime) && imageBytes <= MAX_PREVIEW_IMAGE) {
    return new ImageResponse(
      (
        <Card right={meta.map((m) => <Chip key={m}>{m}</Chip>)}>
          <div style={{ display: "flex", flex: 1, marginTop: 28, alignItems: "center", justifyContent: "center", background: OG.surface, border: `2px solid ${OG.line}`, borderRadius: 20, overflow: "hidden" }}>
            <img src={`data:${mime};base64,${paste!.content}`} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
        </Card>
      ),
      { ...size },
    );
  }

  // ---- short links ----
  if (link) {
    return new ImageResponse(
      (
        <Card right={[<Chip key="k" color={OG.accent}>short link</Chip>]}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 20 }}>
            <div style={{ display: "flex", fontSize: 30, color: OG.text3, fontFamily: "monospace" }}>{`/${id} →`}</div>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 600, letterSpacing: -2, lineHeight: 1.1 }}>{linkHost(link)}</div>
            <div style={{ display: "flex", fontSize: 28, color: OG.text2, fontFamily: "monospace", wordBreak: "break-all" }}>{link.length > 110 ? link.slice(0, 107) + "…" : link}</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: OG.text3, fontFamily: "monospace" }}>{`add + to the link to preview it before visiting`}</div>
        </Card>
      ),
      { ...size },
    );
  }

  // ---- text, or a generic card for encrypted / burn / unrenderable images ----
  const preview = paste && !hidden && !mime ? paste.content.split("\n").slice(0, 11) : [];
  return new ImageResponse(
    (
      <Card right={meta.map((m) => <Chip key={m}>{m}</Chip>)}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 600, marginTop: 28, letterSpacing: -1 }}>{title.slice(0, 60)}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, flex: 1, background: OG.surface, border: `2px solid ${OG.line}`, borderRadius: 16, padding: 28, fontFamily: "monospace", fontSize: 22, lineHeight: 1.5, color: OG.text2, overflow: "hidden" }}>
          {hidden || mime ? (
            <div style={{ color: OG.text3 }}>
              {paste?.enc ? "Content is end-to-end encrypted." : paste?.burn ? "Content is revealed once, then destroyed." : mime ? `${langLabel} image, ${formatBytes(paste!.size)}` : ""}
            </div>
          ) : (
            preview.map((line, i) => (
              <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
                <span style={{ width: 48, color: OG.text3 }}>{i + 1}</span>
                <span>{line.slice(0, 90)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    ),
    { ...size },
  );
}

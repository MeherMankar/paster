import { ImageResponse } from "next/og";
import { SITE } from "./config";

/** Palette shared by every social card (dark, engram tokens). */
export const OG = {
  bg: "#0f1114",
  surface: "#171a1f",
  line: "#272a30",
  text: "#edeff2",
  text2: "#a3a9b3",
  text3: "#828996",
  accent: "#7b96ff",
  size: { width: 1200, height: 630 },
};

/** The brand mark drawn with boxes (satori has no SVG paths for this shape). */
export function Mark({ size = 34, color = OG.text2 }: { size?: number; color?: string }) {
  const r = size / 34;
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size }}>
      <div style={{ position: "absolute", left: 4 * r, top: 0, width: 18 * r, height: 24 * r, border: `${3 * r}px solid ${color}`, borderRadius: 6 * r }} />
      <div style={{ position: "absolute", left: 12 * r, top: 8 * r, width: 18 * r, height: 24 * r, border: `${3 * r}px solid ${color}`, borderRadius: 6 * r, background: OG.bg }} />
    </div>
  );
}

export function Chip({ children, color = OG.text2 }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", border: `2px solid ${OG.line}`, borderRadius: 999, fontSize: 22, color, fontFamily: "monospace" }}>
      {children}
    </div>
  );
}

/** Common frame: brand row on top, `children` fill the rest. */
export function Card({ right, children }: { right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.bg, color: OG.text, padding: 56, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: OG.text2 }}>
        <Mark />
        <span style={{ fontWeight: 600, color: OG.text }}>{SITE.name}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>{right}</div>
      </div>
      {children}
    </div>
  );
}

/** The site-wide card used for /, /docs and any page without its own preview. */
export function brandCard() {
  return new ImageResponse(
    (
      <Card right={[<Chip key="a">no accounts</Chip>, <Chip key="b">no ads</Chip>]}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 22 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 600, letterSpacing: -3, lineHeight: 1 }}>{SITE.name}</div>
          <div style={{ display: "flex", fontSize: 38, color: OG.text2, letterSpacing: -0.5 }}>{SITE.tagline}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <Chip>expiry you choose</Chip>
            <Chip>burn after read</Chip>
            <Chip>encrypted in your browser</Chip>
            <Chip>short links</Chip>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, color: OG.text3, fontFamily: "monospace" }}>paste text, code, images or a link · curl-friendly · open source</div>
      </Card>
    ),
    { ...OG.size },
  );
}

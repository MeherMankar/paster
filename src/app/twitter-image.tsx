import { brandCard, OG } from "@/lib/og";

export const alt = "paster — paste it, share it, gone when you say so";
export const size = OG.size;
export const contentType = "image/png";

/** Site-wide link preview (home, docs and any page without a specific card). */
export default function Image() {
  return brandCard();
}

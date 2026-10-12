import type { ThemedToken } from "@shikijs/core";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Convert shiki's token lines into per-line HTML with inline CSS variables (dual theme). */
export function tokensToLines(tokens: ThemedToken[][]): string[] {
  return tokens.map((line) =>
    line
      .map((t) => {
        const style = t.htmlStyle
          ? Object.entries(t.htmlStyle)
              .map(([k, v]) => `${k}:${v}`)
              .join(";")
          : "";
        return style ? `<span style="${style}">${escapeHtml(t.content)}</span>` : escapeHtml(t.content);
      })
      .join(""),
  );
}

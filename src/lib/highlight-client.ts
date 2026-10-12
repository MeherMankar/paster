"use client";

/**
 * Browser-side highlighting for content the server never sees in clear text
 * (encrypted pastes) or must not read (burn-after-read). Everything is loaded
 * lazily so ordinary pastes ship no highlighter code.
 */
import type { HighlighterCore } from "@shikijs/core";
import { getLang } from "./langs";
import { GRAMMARS } from "./grammars";
import { escapeHtml, tokensToLines } from "./highlight-shared";

let highlighterPromise: Promise<HighlighterCore> | undefined;

async function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("@shikijs/themes/github-light"),
      import("@shikijs/themes/github-dark-dimmed"),
    ]);
    return createHighlighterCore({
      themes: [light.default, dark.default],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  })();
  return highlighterPromise;
}

export async function highlightLinesClient(code: string, langId: string): Promise<{ lines: string[]; highlighted: boolean }> {
  const shikiId = getLang(langId)?.shiki;
  const plain = () => ({ lines: code.split("\n").map(escapeHtml), highlighted: false });
  const loader = shikiId ? GRAMMARS[shikiId] : undefined;
  if (!shikiId || !loader) return plain();
  if (new TextEncoder().encode(code).length > 200 * 1024) return plain();
  try {
    const hl = await getHighlighter();
    if (!hl.getLoadedLanguages().includes(shikiId)) await hl.loadLanguage((await loader()).default);
    const { tokens } = hl.codeToTokens(code, {
      lang: shikiId,
      themes: { light: "github-light", dark: "github-dark-dimmed" },
      defaultColor: false,
    });
    return { lines: tokensToLines(tokens), highlighted: true };
  } catch (err) {
    console.warn("[highlight] client highlighting failed", err);
    return plain();
  }
}

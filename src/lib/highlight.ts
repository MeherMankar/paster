import "server-only";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubLight from "@shikijs/themes/github-light";
import githubDark from "@shikijs/themes/github-dark-dimmed";
import { getLang } from "./langs";
import { GRAMMARS } from "./grammars";
import { escapeHtml, tokensToLines } from "./highlight-shared";

export const THEMES = { light: "github-light", dark: "github-dark-dimmed" } as const;

/** Above this size the server skips highlighting to keep TTFB low; the page still renders. */
export const HIGHLIGHT_MAX_BYTES = 200 * 1024;

declare global {
  var __highlighter: Promise<HighlighterCore> | undefined;
}

function getHighlighter(): Promise<HighlighterCore> {
  globalThis.__highlighter ??= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return globalThis.__highlighter;
}

const loading = new Map<string, Promise<void>>();

async function ensureLang(hl: HighlighterCore, shikiId: string): Promise<boolean> {
  if (hl.getLoadedLanguages().includes(shikiId)) return true;
  const loader = GRAMMARS[shikiId];
  if (!loader) return false;
  let p = loading.get(shikiId);
  if (!p) {
    p = loader()
      .then((mod) => hl.loadLanguage(mod.default))
      .catch((err) => console.warn(`[highlight] failed to load grammar ${shikiId}`, err));
    loading.set(shikiId, p);
  }
  await p;
  return hl.getLoadedLanguages().includes(shikiId);
}

/**
 * Returns one HTML string per source line so the viewer renders its own gutter,
 * line anchors and range selection. Falls back to escaped plain text.
 */
export async function highlightLines(code: string, langId: string): Promise<{ lines: string[]; highlighted: boolean }> {
  const shikiId = getLang(langId)?.shiki;
  const plain = () => ({ lines: code.split("\n").map(escapeHtml), highlighted: false });
  if (!shikiId) return plain();
  if (Buffer.byteLength(code, "utf8") > HIGHLIGHT_MAX_BYTES) return plain();
  const hl = await getHighlighter();
  if (!(await ensureLang(hl, shikiId))) return plain();
  const { tokens } = hl.codeToTokens(code, { lang: shikiId, themes: THEMES, defaultColor: false });
  return { lines: tokensToLines(tokens), highlighted: true };
}

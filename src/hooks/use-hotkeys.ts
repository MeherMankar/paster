"use client";

import { useEffect } from "react";

export type Hotkey = {
  /** e.g. "mod+s", "mod+enter", "escape", "mod+shift+c" — mod = ⌘ on macOS, Ctrl elsewhere */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** allow while typing in inputs (default true for mod combos, false for bare keys) */
  inInputs?: boolean;
};

function matches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));
  const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);
  const modPressed = isMac ? e.metaKey : e.ctrlKey;
  if (mods.has("mod") !== modPressed) return false;
  if (mods.has("shift") !== e.shiftKey) return false;
  if (mods.has("alt") !== e.altKey) return false;
  const k = e.key.toLowerCase();
  if (key === "escape") return k === "escape";
  if (key === "enter") return k === "enter";
  if (key === "slash") return k === "/";
  return k === key;
}

export function useHotkeys(hotkeys: Hotkey[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("dialog[open]")) return;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      for (const h of hotkeys) {
        if (!h.combo.includes("+") && (e.ctrlKey || e.metaKey || e.altKey)) continue;
        if (!matches(e, h.combo)) continue;
        const allowInInputs = h.inInputs ?? h.combo.includes("mod+");
        if (typing && !allowInInputs) continue;
        e.preventDefault();
        h.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys]);
}

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);
}

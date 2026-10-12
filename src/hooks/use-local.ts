"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, onLocalChange, type LocalPaste, type Prefs } from "@/lib/local";

const PASTES_KEY = "paster:pastes";
const PREFS_KEY = "paster:prefs";

function readRaw(key: string, legacyKey?: string): string {
  try {
    const current = localStorage.getItem(key);
    const legacy = !current && legacyKey ? localStorage.getItem(legacyKey) : null;
    const raw = current ?? legacy ?? "";
    if (legacy && legacyKey) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(legacyKey);
    }
    return raw;
  } catch {
    return "";
  }
}

/** Hydration-safe "are we on the client yet" flag. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Snapshot of the live (unexpired) pastes as a canonical string so useSyncExternalStore can compare it. */
function livePastesSnapshot(): string {
  const raw = readRaw(PASTES_KEY, "pastr:pastes");
  if (!raw) return "";
  try {
    const now = Date.now();
    const live = (JSON.parse(raw) as LocalPaste[]).filter((p) => p.expires === null || p.expires > now);
    return live.length ? JSON.stringify(live) : "";
  } catch {
    return "";
  }
}

/** Live list of pastes remembered in this browser (empty during SSR). */
export function useLocalPastes(): LocalPaste[] {
  const raw = useSyncExternalStore(onLocalChange, livePastesSnapshot, () => "");
  return useMemo(() => (raw ? (JSON.parse(raw) as LocalPaste[]) : []), [raw]);
}

export function useLocalPaste(id: string): LocalPaste | undefined {
  const list = useLocalPastes();
  return useMemo(() => list.find((p) => p.id === id), [list, id]);
}

export function usePrefs(): Prefs {
  const raw = useSyncExternalStore(onLocalChange, () => readRaw(PREFS_KEY, "pastr:prefs"), () => "");
  return useMemo(() => {
    try {
      return { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
    } catch {
      return DEFAULT_PREFS;
    }
  }, [raw]);
}

import { env } from "../config";
import { MemoryStore } from "./memory";
import { RedisStore } from "./redis";
import type { PasteStore } from "./types";

export type { PasteStore, ReadResult } from "./types";

declare global {
  // Survive HMR in development so the memory store keeps its pastes.
  var __pasteStore: PasteStore | undefined;
}

let warned = false;

export function getStore(): PasteStore {
  if (globalThis.__pasteStore) return globalThis.__pasteStore;
  const url = env.redisUrl;
  const token = env.redisToken;
  let store: PasteStore;
  if (url && token) {
    store = RedisStore.fromEnv(url, token);
  } else {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "1") {
      throw new Error(
        "No Redis configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL / KV_REST_API_TOKEN).",
      );
    }
    if (!warned) {
      warned = true;
      console.warn("[store] No Upstash credentials found — using in-memory store (dev only).");
    }
    store = new MemoryStore();
  }
  globalThis.__pasteStore = store;
  return store;
}

/**
 * Client-side encryption. Runs only in the browser (Web Crypto) but is written
 * against the standard API so it also works in Node ≥ 20 for tests.
 *
 * Envelope: the whole paste (title, lang, content) is JSON-encoded and encrypted with
 * AES-256-GCM so the server learns nothing but the ciphertext size.
 *
 * Key transport:
 *  - "fragment": a random key, base64url-encoded in the URL hash (never sent to the server).
 *  - "password": key derived with PBKDF2-SHA256 from a user password + random salt.
 */
import type { EncryptionMeta } from "./paste";

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i += 0x8000) bin += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type Envelope = { title?: string; lang: string; content: string };

export const PBKDF2_ITERATIONS = 600_000;

export async function generateKey(): Promise<{ key: CryptoKey; fragment: string }> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = await crypto.subtle.exportKey("raw", key);
  return { key, fragment: toBase64Url(raw) };
}

export async function importFragmentKey(fragment: string): Promise<CryptoKey> {
  const raw = fromBase64Url(fragment);
  if (raw.length !== 32) throw new Error("invalid key");
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function deriveKey(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptEnvelope(
  envelope: Envelope,
  opts: { mode: "fragment" } | { mode: "password"; password: string },
): Promise<{ ciphertext: string; meta: EncryptionMeta; fragment?: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(envelope));
  if (opts.mode === "fragment") {
    const { key, fragment } = await generateKey();
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return { ciphertext: toBase64Url(ct), meta: { alg: "AES-GCM", kdf: "fragment", iv: toBase64Url(iv) }, fragment };
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(opts.password, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    ciphertext: toBase64Url(ct),
    meta: { alg: "AES-GCM", kdf: "password", iv: toBase64Url(iv), salt: toBase64Url(salt), iterations: PBKDF2_ITERATIONS },
  };
}

export async function decryptEnvelope(
  ciphertext: string,
  meta: EncryptionMeta,
  secret: { fragment: string } | { password: string },
): Promise<Envelope> {
  let key: CryptoKey;
  if ("fragment" in secret) {
    key = await importFragmentKey(secret.fragment);
  } else {
    if (!meta.salt) throw new Error("missing salt");
    key = await deriveKey(secret.password, fromBase64Url(meta.salt), meta.iterations ?? PBKDF2_ITERATIONS);
  }
  const iv = fromBase64Url(meta.iv);
  const ct = fromBase64Url(ciphertext);
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer as ArrayBuffer }, key, ct.buffer as ArrayBuffer);
  } catch {
    throw new Error("wrong key or corrupted data");
  }
  const parsed = JSON.parse(dec.decode(pt)) as Envelope;
  if (typeof parsed.content !== "string") throw new Error("invalid envelope");
  return { title: parsed.title, lang: parsed.lang || "text", content: parsed.content };
}

/**
 * Re-encrypt with an existing key (used when editing an encrypted paste so the link keeps working).
 */
export async function reencryptEnvelope(
  envelope: Envelope,
  meta: EncryptionMeta,
  secret: { fragment: string } | { password: string },
): Promise<{ ciphertext: string; meta: EncryptionMeta }> {
  const key =
    "fragment" in secret
      ? await importFragmentKey(secret.fragment)
      : await deriveKey(secret.password, fromBase64Url(meta.salt!), meta.iterations ?? PBKDF2_ITERATIONS);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(envelope)));
  return { ciphertext: toBase64Url(ct), meta: { ...meta, iv: toBase64Url(iv) } };
}

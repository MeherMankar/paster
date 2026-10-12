/** Shared paste types used by the store, the API and the UI. */

export type EncryptionMeta = {
  /** Always AES-256-GCM in v1. */
  alg: "AES-GCM";
  /** "fragment": key travels in the URL hash. "password": key derived from a password with PBKDF2. */
  kdf: "fragment" | "password";
  /** base64url 12-byte IV. */
  iv: string;
  /** base64url 16-byte salt (password mode only). */
  salt?: string;
  /** PBKDF2 iterations (password mode only). */
  iterations?: number;
};

export type PasteRecord = {
  v: 1;
  id: string;
  /** Plain text, or base64url ciphertext of the encrypted envelope when `enc` is set. */
  content: string;
  /** Absent for encrypted pastes (the title lives inside the envelope). */
  title?: string;
  /** Language id (see langs.ts). Encrypted pastes store "text". */
  lang: string;
  enc?: EncryptionMeta;
  burn: boolean;
  /** ms since epoch */
  created: number;
  /** ms since epoch, null = never */
  expires: number | null;
  /** SHA-256 hex of the edit token. */
  editHash: string;
  /** Stored content size in bytes. */
  size: number;
};

/** What the API returns to readers. Never includes editHash. */
export type PublicPaste = Omit<PasteRecord, "editHash" | "v"> & {
  views: number;
};

export function toPublic(record: PasteRecord, views: number): PublicPaste {
  const { editHash: _editHash, v: _v, ...rest } = record;
  void _editHash;
  void _v;
  return { ...rest, views };
}

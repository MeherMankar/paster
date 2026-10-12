import { customAlphabet } from "nanoid";
import { LIMITS } from "./config";

/** Unambiguous, URL-safe alphabet (no 0/O, 1/l/I). 55 symbols → 8 chars ≈ 2^46 ids. */
export const ID_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

const generate = customAlphabet(ID_ALPHABET, LIMITS.idLength);

export function newId(): string {
  return generate();
}

const ID_RE = new RegExp(`^[${ID_ALPHABET}]{${LIMITS.idLength}}$`);
/** Loose check used by routes: also accepts legacy 6-char ids so imports keep working. */
const LOOSE_ID_RE = /^[A-Za-z0-9]{4,32}$/;

export function isValidId(id: string): boolean {
  return ID_RE.test(id) || LOOSE_ID_RE.test(id);
}

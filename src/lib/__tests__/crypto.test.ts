import { describe, expect, it } from "vitest";
import { decryptEnvelope, encryptEnvelope, fromBase64Url, reencryptEnvelope, toBase64Url } from "../crypto";

describe("crypto envelope", () => {
  it("base64url round-trips", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
  });
  it("fragment mode encrypts and decrypts", async () => {
    const env = { title: "t", lang: "go", content: "package main" };
    const { ciphertext, meta, fragment } = await encryptEnvelope(env, { mode: "fragment" });
    expect(meta.kdf).toBe("fragment");
    expect(fragment).toHaveLength(43);
    expect(ciphertext).not.toContain("package");
    expect(await decryptEnvelope(ciphertext, meta, { fragment: fragment! })).toEqual(env);
    await expect(decryptEnvelope(ciphertext, meta, { fragment: fragment!.slice(0, 42) + "A" })).rejects.toThrow();
  });
  it("password mode encrypts and decrypts", async () => {
    const env = { lang: "text", content: "secret" };
    const { ciphertext, meta } = await encryptEnvelope(env, { mode: "password", password: "hunter2" });
    expect(meta.kdf).toBe("password");
    expect(meta.salt).toBeDefined();
    expect(await decryptEnvelope(ciphertext, meta, { password: "hunter2" })).toEqual({ ...env, title: undefined });
    await expect(decryptEnvelope(ciphertext, meta, { password: "wrong" })).rejects.toThrow(/wrong key/);
  }, 20_000);
  it("re-encrypts with the same key and a fresh iv", async () => {
    const { ciphertext, meta, fragment } = await encryptEnvelope({ lang: "text", content: "v1" }, { mode: "fragment" });
    const next = await reencryptEnvelope({ lang: "text", content: "v2" }, meta, { fragment: fragment! });
    expect(next.meta.iv).not.toBe(meta.iv);
    expect(next.ciphertext).not.toBe(ciphertext);
    expect((await decryptEnvelope(next.ciphertext, next.meta, { fragment: fragment! })).content).toBe("v2");
  });
});

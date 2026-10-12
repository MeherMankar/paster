import { describe, expect, it } from "vitest";
import { isValidId, newId, ID_ALPHABET } from "../ids";
import { hashToken, newEditToken, safeEqual, verifyToken } from "../tokens";
import { expiresAt, expirySeconds, formatDuration, formatRelative, normalizeExpiry } from "../expiry";
import { getLang, imageMime, langFromFilename, langFromMime, normalizeLang, splitIdAndLang, extensionFor } from "../langs";
import { detectLang } from "../detect";
import { BASE64, base64Bytes, byteLength, formatBytes } from "../bytes";
import { createPasteSchema, updatePasteSchema } from "../validation";
import { extractLink, linkLabel, pasteKind } from "../links";

describe("ids", () => {
  it("generates 8-char ids from the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const id = newId();
      expect(id).toHaveLength(8);
      for (const c of id) expect(ID_ALPHABET).toContain(c);
      expect(isValidId(id)).toBe(true);
    }
  });
  it("rejects garbage ids", () => {
    expect(isValidId("")).toBe(false);
    expect(isValidId("a")).toBe(false);
    expect(isValidId("../etc")).toBe(false);
    expect(isValidId("abc def")).toBe(false);
    expect(isValidId("legacy6")).toBe(true);
  });
});

describe("tokens", () => {
  it("round-trips hash verification", async () => {
    const t = newEditToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    const h = await hashToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyToken(t, h)).toBe(true);
    expect(await verifyToken(t + "x", h)).toBe(false);
  });
  it("safeEqual compares strictly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});

describe("expiry", () => {
  it("maps presets", () => {
    expect(expirySeconds("10m")).toBe(600);
    expect(expirySeconds("never")).toBeNull();
    expect(expiresAt("1h", 1000)).toBe(1000 + 3_600_000);
    expect(expiresAt("never", 1000)).toBeNull();
    expect(normalizeExpiry("bogus")).toBe("7d");
    expect(normalizeExpiry("1d")).toBe("1d");
  });
  it("formats", () => {
    expect(formatRelative(Date.now() + 3_600_000 * 3)).toBe("in 3 hours");
    expect(formatRelative(Date.now() - 86_400_000 * 2)).toBe("2 days ago");
    expect(formatDuration(3_720_000)).toBe("1h 2m");
    expect(formatDuration(90_000_000)).toBe("1d 1h");
  });
});

describe("langs", () => {
  it("resolves aliases and filenames", () => {
    expect(getLang("py")?.id).toBe("python");
    expect(getLang("TS")?.id).toBe("typescript");
    expect(normalizeLang("nope")).toBe("text");
    expect(langFromFilename("main.rs")?.id).toBe("rust");
    expect(langFromFilename("Dockerfile")?.id).toBe("dockerfile");
    expect(langFromFilename(".env.local")?.id).toBe("dotenv");
    expect(langFromFilename("README")).toBeUndefined();
    expect(splitIdAndLang("abc123.ts")).toEqual({ id: "abc123", lang: "ts" });
    expect(splitIdAndLang("abc123")).toEqual({ id: "abc123" });
    expect(extensionFor("go")).toBe("go");
    expect(extensionFor("text")).toBe("txt");
  });
});

describe("detectLang", () => {
  it("guesses common languages conservatively", () => {
    expect(detectLang('{"a": 1}')).toBe("json");
    expect(detectLang("#!/bin/bash\necho hi")).toBe("shellscript");
    expect(detectLang("package main\n\nfunc main() {}")).toBe("go");
    expect(detectLang("def foo():\n    return 1")).toBe("python");
    expect(detectLang("fn main() {\n let x = 1;\n}")).toBe("rust");
    expect(detectLang("SELECT * FROM users;")).toBe("sql");
    expect(detectLang("# Title\n\nSome *text*")).toBe("markdown");
    expect(detectLang("hello there, just some prose.")).toBe("text");
    expect(detectLang("")).toBe("text");
  });
});

describe("bytes", () => {
  it("counts utf-8 bytes", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("é")).toBe(2);
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("measures and recognises base64 image content", () => {
    const b64 = Buffer.from("hello").toString("base64"); // aGVsbG8=
    expect(BASE64.test(b64)).toBe(true);
    expect(BASE64.test("not base64!")).toBe(false);
    expect(base64Bytes(b64)).toBe(5);
    expect(base64Bytes("aGk=")).toBe(2);
    expect(langFromMime("image/png")?.id).toBe("png");
    expect(langFromMime("image/jpeg; charset=x")?.id).toBe("jpeg");
    expect(langFromMime("text/plain")).toBeUndefined();
    expect(imageMime("webp")).toBe("image/webp");
    expect(imageMime("typescript")).toBeUndefined();
  });
});

describe("validation", () => {
  it("accepts a minimal paste and normalizes", () => {
    const r = createPasteSchema.parse({ content: "hi", lang: "py", burn: "true" });
    expect(r.lang).toBe("python");
    expect(r.burn).toBe(true);
    expect(r.title).toBeUndefined();
  });
  it("parses loose booleans from forms and query strings", () => {
    expect(createPasteSchema.parse({ content: "x", burn: "false" }).burn).toBe(false);
    expect(createPasteSchema.parse({ content: "x", burn: "0" }).burn).toBe(false);
    expect(createPasteSchema.parse({ content: "x", burn: "" }).burn).toBe(false);
    expect(createPasteSchema.parse({ content: "x", burn: "yes" }).burn).toBe(true);
    expect(createPasteSchema.parse({ content: "x", burn: "1" }).burn).toBe(true);
    expect(createPasteSchema.parse({ content: "x", burn: true }).burn).toBe(true);
    expect(createPasteSchema.parse({ content: "x" }).burn).toBe(false);
    expect(createPasteSchema.safeParse({ content: "x", burn: "maybe" }).success).toBe(false);
  });
  it("update can clear the title", () => {
    expect(updatePasteSchema.parse({ title: "" }).title).toBe("");
    expect(updatePasteSchema.parse({ title: null }).title).toBe("");
    expect(updatePasteSchema.parse({ title: " keep " }).title).toBe("keep");
  });
  it("rejects empty and oversized content", () => {
    expect(createPasteSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(createPasteSchema.safeParse({ content: "x".repeat(1024 * 1024 + 1) }).success).toBe(false);
  });
  it("validates encryption meta", () => {
    const ok = createPasteSchema.safeParse({ content: "abc", enc: { alg: "AES-GCM", kdf: "fragment", iv: "AAAAAAAAAAAAAAAA" } });
    expect(ok.success).toBe(true);
    const bad = createPasteSchema.safeParse({ content: "abc", enc: { alg: "AES-CBC", kdf: "fragment", iv: "AAAAAAAAAAAAAAAA" } });
    expect(bad.success).toBe(false);
  });
  it("update requires a field", () => {
    expect(updatePasteSchema.safeParse({}).success).toBe(false);
    expect(updatePasteSchema.safeParse({ title: "x" }).success).toBe(true);
  });
});

describe("links", () => {
  it("accepts exactly one http(s) url", () => {
    expect(extractLink("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(extractLink("  http://example.com \n")).toBe("http://example.com/");
    expect(extractLink("https://example.com/x\nsecond line")).toBeNull();
    expect(extractLink("see https://example.com")).toBeNull();
    expect(extractLink("ftp://example.com/f")).toBeNull();
    expect(extractLink("https://localhost/x")).toBeNull();
    expect(extractLink("https://user:pw@example.com/")).toBeNull();
    expect(extractLink("https://example.com/" + "a".repeat(3000))).toBeNull();
    expect(extractLink("not a url")).toBeNull();
  });
  it("labels and classifies", () => {
    expect(linkLabel("https://example.com/")).toBe("example.com");
    expect(linkLabel("https://example.com/path?q=1")).toBe("example.com/path?q=1");
    expect(pasteKind({ content: "https://example.com", lang: "text" })).toBe("link");
    expect(pasteKind({ content: "hello", lang: "text" })).toBe("text");
    expect(pasteKind({ content: "https://example.com", lang: "text", enc: { alg: "AES-GCM", kdf: "fragment", iv: "AAAAAAAAAAAAAAAA" } })).toBe("text");
    expect(pasteKind({ content: "iVBORw0KGgo=", lang: "png" })).toBe("image");
  });
});

describe("telegram report messages", () => {
  it("formats an escaped HTML message with the paste link", async () => {
    const { formatReportMessage, pasteLink, webhookSecret } = await import("../telegram");
    const paste = { id: "AbCd1234", content: "<b>x</b>", lang: "go", burn: true, created: 0, expires: null, size: 10, views: 3 };
    const msg = formatReportMessage({ paste, origin: "https://p.example", reason: "spam <script>", count: 2, reporter: "ab12" });
    expect(msg).toContain("report #2");
    expect(msg).toContain('href="https://p.example/AbCd1234"');
    expect(msg).toContain("burn after read");
    expect(msg).toContain("never expires");
    expect(msg).toContain("&lt;script&gt;");
    expect(msg).not.toContain("<script>");
    expect(pasteLink("https://p.example", { ...paste, content: "https://example.com/x", lang: "text" })).toBe("https://p.example/AbCd1234+");
    const secret = await webhookSecret("123:abc");
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(await webhookSecret("123:abc")).toBe(secret);
  });
});

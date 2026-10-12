import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store/memory";
import type { PasteRecord } from "../paste";

function rec(id: string, extra: Partial<PasteRecord> = {}): PasteRecord {
  return { v: 1, id, content: "hello", lang: "text", burn: false, created: 0, expires: null, editHash: "h", size: 5, ...extra };
}

describe("MemoryStore", () => {
  it("creates, reads (counting views), peeks, updates and deletes", async () => {
    const s = new MemoryStore();
    expect(await s.create(rec("a"), null)).toBe(true);
    expect(await s.create(rec("a"), null)).toBe(false);
    expect((await s.read("a"))?.views).toBe(1);
    expect((await s.read("a"))?.views).toBe(2);
    expect((await s.peek("a"))?.views).toBe(2);
    expect(await s.update(rec("a", { content: "bye" }))).toBe(true);
    expect((await s.peek("a"))?.record.content).toBe("bye");
    expect(await s.delete("a")).toBe(true);
    expect(await s.read("a")).toBeNull();
    expect(await s.update(rec("a"))).toBe(false);
  });
  it("burns after first read", async () => {
    const s = new MemoryStore();
    await s.create(rec("b", { burn: true }), null);
    expect(await s.peek("b")).not.toBeNull();
    expect((await s.read("b"))?.record.content).toBe("hello");
    expect(await s.read("b")).toBeNull();
  });
  it("expires by ttl", async () => {
    let now = 1000;
    const s = new MemoryStore(() => now);
    await s.create(rec("c"), 10);
    expect(await s.peek("c")).not.toBeNull();
    now += 10_001;
    expect(await s.peek("c")).toBeNull();
  });
  it("tracks reports and stats", async () => {
    const s = new MemoryStore();
    await s.create(rec("d"), null);
    expect(await s.report("d", "spam", "1.1.1.1")).toBe(1);
    expect(await s.report("d", "spam", "1.1.1.1")).toBe(2);
    await s.incrStat("created");
    expect((await s.stats()).created).toBe(1);
  });
});

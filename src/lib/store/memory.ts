import type { PasteRecord } from "../paste";
import type { PasteStore, ReadResult } from "./types";

type Entry = { record: PasteRecord; views: number; expiresAt: number | null };

/**
 * In-memory store used for local development (no Upstash credentials) and tests.
 * Not shared across serverless instances — never use in production.
 */
export class MemoryStore implements PasteStore {
  readonly kind = "memory" as const;
  private pastes = new Map<string, Entry>();
  private reports = new Map<string, Array<{ reason: string; reporter: string; at: number }>>();
  private counters = { created: 0, views: 0 };

  constructor(private now: () => number = () => Date.now()) {}

  private live(id: string): Entry | null {
    const e = this.pastes.get(id);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= this.now()) {
      this.pastes.delete(id);
      return null;
    }
    return e;
  }

  async create(record: PasteRecord, ttlSeconds: number | null): Promise<boolean> {
    if (this.live(record.id)) return false;
    this.pastes.set(record.id, {
      record: structuredClone(record),
      views: 0,
      expiresAt: ttlSeconds === null ? null : this.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async read(id: string): Promise<ReadResult> {
    const e = this.live(id);
    if (!e) return null;
    e.views += 1;
    this.counters.views += 1;
    const out = { record: structuredClone(e.record), views: e.views };
    if (e.record.burn) this.pastes.delete(id);
    return out;
  }

  async peek(id: string): Promise<ReadResult> {
    const e = this.live(id);
    return e ? { record: structuredClone(e.record), views: e.views } : null;
  }

  async update(record: PasteRecord): Promise<boolean> {
    const e = this.live(record.id);
    if (!e) return false;
    e.record = structuredClone(record);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const existed = !!this.live(id);
    this.pastes.delete(id);
    this.reports.delete(id);
    return existed;
  }

  async report(id: string, reason: string, reporter: string): Promise<number> {
    const list = this.reports.get(id) ?? [];
    list.push({ reason, reporter, at: this.now() });
    this.reports.set(id, list);
    return list.length;
  }

  async incrStat(name: "created" | "views"): Promise<void> {
    this.counters[name] += 1;
  }

  async stats() {
    return { ...this.counters };
  }

  async recent(limit: number) {
    return [...this.pastes.entries()]
      .filter(([id]) => this.live(id))
      .map(([id, e]) => ({ id, created: e.record.created }))
      .sort((a, b) => b.created - a.created)
      .slice(0, limit);
  }

  async mostReported(limit: number) {
    return [...this.reports.entries()]
      .map(([id, list]) => ({ id, reports: list.length }))
      .sort((a, b) => b.reports - a.reports)
      .slice(0, limit);
  }

  async ping() {
    return true;
  }

  /** Test helper. */
  _size() {
    return this.pastes.size;
  }
}

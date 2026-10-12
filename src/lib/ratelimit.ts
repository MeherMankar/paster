import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RATE_LIMITS, env } from "./config";
import { HttpError } from "./http";

type Bucket = keyof typeof RATE_LIMITS;

type Limiter = { limit(id: string): Promise<{ success: boolean; reset: number; remaining: number; limit: number }> };

const limiters = new Map<Bucket, Limiter>();
let redis: Redis | undefined;

function durationMs(d: string): number {
  const [n, unit] = d.split(" ");
  const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1000;
  return Number(n) * mult;
}

/** Fixed-window limiter for dev/test when Redis isn't configured. */
class MemoryLimiter implements Limiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(private max: number, private windowMs: number) {}
  async limit(id: string) {
    const now = Date.now();
    let h = this.hits.get(id);
    if (!h || h.reset <= now) {
      h = { count: 0, reset: now + this.windowMs };
      this.hits.set(id, h);
    }
    h.count += 1;
    return { success: h.count <= this.max, reset: h.reset, remaining: Math.max(0, this.max - h.count), limit: this.max };
  }
}

function getLimiter(bucket: Bucket): Limiter {
  const existing = limiters.get(bucket);
  if (existing) return existing;
  const cfg = RATE_LIMITS[bucket];
  let limiter: Limiter;
  if (env.redisUrl && env.redisToken) {
    redis ??= new Redis({ url: env.redisUrl, token: env.redisToken, enableTelemetry: false });
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.limit, cfg.window as Duration),
      prefix: `rl:${bucket}`,
      analytics: false, // telemetry is disabled on the Redis client above
    });
  } else {
    limiter = new MemoryLimiter(cfg.limit, durationMs(cfg.window));
  }
  limiters.set(bucket, limiter);
  return limiter;
}

/** Throws a 429 HttpError when the caller is over the limit. */
export async function enforceRateLimit(bucket: Bucket, identifier: string): Promise<void> {
  if (process.env.DISABLE_RATE_LIMIT === "1") return;
  const res = await getLimiter(bucket).limit(identifier);
  if (!res.success) {
    const retry = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    throw new HttpError(429, "rate_limited", "too many requests, slow down", {
      "Retry-After": String(retry),
      "X-RateLimit-Limit": String(res.limit),
      "X-RateLimit-Remaining": String(res.remaining),
    });
  }
}

/**
 * Per-source token-bucket rate limiter shared across an ingest worker process.
 *
 * Each source declares its sustained rate (req/s); calls to `throttle(source)`
 * await as needed before returning. Single-process scope is fine for the
 * cron-driven worker because only one tick runs at a time.
 */

type Bucket = {
  rate: number;            // tokens added per ms
  capacity: number;        // bucket size
  tokens: number;
  lastRefillMs: number;
};

const BUCKETS = new Map<string, Bucket>();

/** GBIF: ≤ 4 req/s. iNat: ≤ 2 req/s. Burst up to 2× sustained. */
const LIMITS: Record<string, { rps: number; burst: number }> = {
  gbif: { rps: 4, burst: 8 },
  inat: { rps: 2, burst: 4 },
};

function bucketFor(source: string): Bucket {
  let b = BUCKETS.get(source);
  if (!b) {
    const limit = LIMITS[source];
    if (!limit) throw new Error(`unknown rate-limit source: ${source}`);
    b = {
      rate: limit.rps / 1000,
      capacity: limit.burst,
      tokens: limit.burst,
      lastRefillMs: Date.now(),
    };
    BUCKETS.set(source, b);
  }
  return b;
}

function refill(b: Bucket): void {
  const now = Date.now();
  const elapsed = now - b.lastRefillMs;
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.rate);
  b.lastRefillMs = now;
}

export async function throttle(source: string): Promise<void> {
  const b = bucketFor(source);
  refill(b);
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return;
  }
  const needed = 1 - b.tokens;
  const waitMs = Math.ceil(needed / b.rate);
  await new Promise((r) => setTimeout(r, waitMs));
  refill(b);
  b.tokens = Math.max(0, b.tokens - 1);
}

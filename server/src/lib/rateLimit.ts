interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: limit - 1,
    };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterMs: current.resetAt - now,
      remaining: 0,
    };
  }
  current.count += 1;
  buckets.set(key, current);
  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, limit - current.count),
  };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

export function clearAllRateLimits() {
  buckets.clear();
}

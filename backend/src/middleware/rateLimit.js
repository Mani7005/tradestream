/**
 * Lightweight token-bucket rate limiter, no external dependency required.
 * Keyed by authenticated user id (falls back to IP for unauthenticated routes).
 */
const buckets = new Map();

export function rateLimit({ windowMs = 10_000, max = 20 } = {}) {
  return (req, res, next) => {
    const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: "Rate limit exceeded", retryAfterSec });
    }

    next();
  };
}

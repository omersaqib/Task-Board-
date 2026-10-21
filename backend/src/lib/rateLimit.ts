import type { NextFunction, Request, Response } from 'express';

/**
 * Minimal fixed-window, in-memory rate limiter keyed by the socket address (X-Forwarded-For is
 * deliberately ignored so clients cannot spoof it). Disabled when `limit` is 0.
 */
export function rateLimit(limit: number, windowMs = 60_000, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (limit <= 0) return next();

    const time = now();
    if (hits.size > 10_000) {
      for (const [key, entry] of hits) if (entry.resetAt <= time) hits.delete(key);
    }

    const key = req.socket.remoteAddress ?? 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - time) / 1000))));
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
      });
      return;
    }
    next();
  };
}

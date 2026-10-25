import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const store: RateLimitStore = {};
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? env.RATE_LIMIT_MAX_REQUESTS;
  const message = options.message ?? 'Too many requests, please try again later.';

  // Periodic cleanup of stale IP records based on windowMs
  setInterval(() => {
    const now = Date.now();
    for (const ip in store) {
      if (store[ip].resetTime < now) {
        delete store[ip];
      }
    }
  }, Math.max(60000, windowMs));

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();

    if (!store[ip] || store[ip].resetTime < now) {
      store[ip] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    store[ip].count += 1;

    if (store[ip].count > maxRequests) {
      const retryAfterSec = Math.ceil((store[ip].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: message,
        retryAfter: `${retryAfterSec} seconds`,
      });
    }

    next();
  };
}

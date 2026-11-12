import { createHmac } from 'node:crypto';
import { rateLimits, type RateLimitName } from '@tilawah/contracts';
import type { Models } from '@tilawah/db';
import type { Clock } from '../clock';
import { DomainError } from '../errors';

/** Keyed hash of an IP address. Raw IPs are never stored. */
export const hashIp = (ip: string, secret: string): string =>
  `ip:${createHmac('sha256', secret).update(ip).digest('base64url').slice(0, 22)}`;

/** Fixed-window counter in MongoDB, so it stays correct across several app instances. */
export class RateLimiter {
  constructor(
    private readonly models: Models,
    private readonly clock: Clock,
  ) {}

  async consume(name: RateLimitName, subject: string): Promise<void> {
    const { limit, windowSec } = rateLimits[name];
    const result = await this.hit(`${name}:${subject}`, windowSec, limit);
    if (!result.allowed) {
      throw new DomainError('RATE_LIMITED', 'Too many requests', {
        retryAfterSec: result.retryAfterSec,
      });
    }
  }

  /** Counts one request against `key`; also backs Better Auth's sign-in limiter. */
  async hit(
    key: string,
    windowSec: number,
    limit: number,
  ): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const now = this.clock.now().getTime();
    const windowMs = windowSec * 1000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const doc = await this.models.RateLimit.findOneAndUpdate(
      { _id: `${key}:${windowStart}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs) } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    const retryAfterSec = Math.ceil((windowStart + windowMs - now) / 1000);
    return { allowed: doc.count <= limit, retryAfterSec };
  }
}

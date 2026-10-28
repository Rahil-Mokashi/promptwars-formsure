import { MAX_REQUESTS_PER_WINDOW, RATE_WINDOW_MS, SECOND_MS } from '../core/constants';
import { sleep as realSleep } from './sleep';

/** Sliding-window limiter for Gemini calls. */
export interface RateLimiter {
  /** Resolves when a call may be made, waiting if the window is full. `onWait` receives the seconds left. */
  acquire(onWait?: (secondsLeft: number) => void): Promise<void>;
}

/** Options for {@link createRateLimiter}; every field is injectable for tests. */
export interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Creates a limiter that allows at most `maxRequests` calls in any rolling `windowMs`
 * (default 8 per minute, to stay inside the free tier). Every attempt counts, retries included.
 */
export function createRateLimiter({
  maxRequests = MAX_REQUESTS_PER_WINDOW,
  windowMs = RATE_WINDOW_MS,
  now = Date.now,
  sleep = realSleep,
}: RateLimiterOptions = {}): RateLimiter {
  const calls: number[] = [];

  return {
    async acquire(onWait) {
      for (;;) {
        const t = now();
        while (calls.length > 0 && t - (calls[0] ?? t) >= windowMs) calls.shift();
        const oldest = calls[0];
        if (calls.length < maxRequests || oldest === undefined) {
          calls.push(t);
          return;
        }
        const waitMs = windowMs - (t - oldest);
        onWait?.(Math.ceil(waitMs / SECOND_MS));
        await sleep(Math.min(waitMs, SECOND_MS));
      }
    },
  };
}

/** The limiter shared by every live read in this page. */
export const geminiLimiter: RateLimiter = createRateLimiter();

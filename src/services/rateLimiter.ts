import { DAY_MS, MAX_REQUESTS_PER_DAY, MAX_REQUESTS_PER_WINDOW, RATE_WINDOW_MS, SECOND_MS } from '../core/constants';
import { RateLimitError } from '../core/errors';
import { sleep as realSleep } from './sleep';

/** Sliding-window limiter for Gemini calls. */
export interface RateLimiter {
  /**
   * Resolves when a call may be made, waiting if the short window is full. `onWait` receives the seconds left.
   * @throws {RateLimitError} when the daily cap is used up (waiting would take hours)
   */
  acquire(onWait?: (secondsLeft: number) => void): Promise<void>;
}

/** Options for {@link createRateLimiter}; every field is injectable for tests. */
export interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
  /** Hard cap over a longer window, such as 60 a day. Exceeding it throws instead of waiting. */
  dailyMax?: number;
  dailyWindowMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const DAILY_MESSAGE = 'This device has used today’s limit of Gemini reads. Try again tomorrow, or use the sample applicant.';

/** Drops timestamps older than `windowMs`. */
function trim(calls: number[], now: number, windowMs: number): void {
  while (calls.length > 0 && now - (calls[0] ?? now) >= windowMs) calls.shift();
}

/**
 * Creates a limiter that allows at most `maxRequests` calls in any rolling `windowMs` (default 8 a minute) and at most
 * `dailyMax` in any rolling day (default 60). Every attempt counts, retries included. State is kept in memory only:
 * nothing is written to browser storage, so reloading the page resets it. App Check and the project's quotas are the
 * real protection; this keeps one honest tab from hammering the free tier.
 */
export function createRateLimiter({
  maxRequests = MAX_REQUESTS_PER_WINDOW,
  windowMs = RATE_WINDOW_MS,
  dailyMax = MAX_REQUESTS_PER_DAY,
  dailyWindowMs = DAY_MS,
  now = Date.now,
  sleep = realSleep,
}: RateLimiterOptions = {}): RateLimiter {
  const recent: number[] = [];
  const today: number[] = [];

  return {
    async acquire(onWait) {
      for (;;) {
        const t = now();
        trim(today, t, dailyWindowMs);
        if (today.length >= dailyMax) throw new RateLimitError(DAILY_MESSAGE);
        trim(recent, t, windowMs);
        const oldest = recent[0];
        if (recent.length < maxRequests || oldest === undefined) {
          recent.push(t);
          today.push(t);
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

import { DAY_MS, LIMITER_STORAGE_KEY, MAX_REQUESTS_PER_DAY, MAX_REQUESTS_PER_WINDOW, RATE_WINDOW_MS, SECOND_MS } from '../core/constants';
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

/** The part of `Storage` the limiter needs. `sessionStorage` fits. */
export type LimiterStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Options for {@link createRateLimiter}; every field is injectable for tests. */
export interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
  /** Hard cap over a longer window, such as 60 a day. Exceeding it throws instead of waiting. */
  dailyMax?: number;
  dailyWindowMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /**
   * Where call timestamps are kept so a reload does not reset the quota. Default: nowhere (memory only).
   * Only numbers are stored, never document data; entries older than the daily window are dropped on every read and write.
   */
  storage?: LimiterStorage | null;
  storageKey?: string;
}

const DAILY_MESSAGE = 'This device has used today’s limit of Gemini reads. Try again tomorrow, or use the sample applicant.';

/** Drops timestamps older than `windowMs`. */
function trim(calls: number[], now: number, windowMs: number): void {
  while (calls.length > 0 && now - (calls[0] ?? now) >= windowMs) calls.shift();
}

/** Reads stored timestamps, ignoring anything that is not a plain list of finite numbers. */
function load(storage: LimiterStorage | null, key: string, now: number, windowMs: number, cap: number): number[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const calls = parsed.filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t <= now).sort((a, b) => a - b).slice(-cap);
    trim(calls, now, windowMs);
    return calls;
  } catch {
    return [];
  }
}

/** Writes the timestamps (or removes the key when there are none). Storage errors are ignored: the limiter then works in memory. */
function save(storage: LimiterStorage | null, key: string, calls: readonly number[]): void {
  if (!storage) return;
  try {
    if (calls.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(calls));
  } catch {
    /* private mode or quota: keep going in memory */
  }
}

/**
 * Creates a limiter that allows at most `maxRequests` calls in any rolling `windowMs` (default 8 a minute) and at most
 * `dailyMax` in any rolling day (default 60). Every attempt counts, retries included.
 * With `storage` the timestamps survive a page reload, so reloading does not reset the quota.
 */
export function createRateLimiter({
  maxRequests = MAX_REQUESTS_PER_WINDOW,
  windowMs = RATE_WINDOW_MS,
  dailyMax = MAX_REQUESTS_PER_DAY,
  dailyWindowMs = DAY_MS,
  now = Date.now,
  sleep = realSleep,
  storage = null,
  storageKey = LIMITER_STORAGE_KEY,
}: RateLimiterOptions = {}): RateLimiter {
  // Always kept in memory too, so the limit holds even if storage is unavailable or fails.
  let memory: number[] = [];

  return {
    async acquire(onWait) {
      for (;;) {
        const t = now();
        // Reloaded from storage on every attempt, so another tab of the same session is respected too.
        const stored = load(storage, storageKey, t, dailyWindowMs, dailyMax + 1);
        const mine = memory.filter((c) => t - c < dailyWindowMs);
        const today = stored.length >= mine.length ? stored : mine; // storage wins when another tab added calls
        if (today.length >= dailyMax) throw new RateLimitError(DAILY_MESSAGE);
        const recent = today.filter((c) => t - c < windowMs);
        const oldest = recent[0];
        if (recent.length < maxRequests || oldest === undefined) {
          today.push(t);
          memory = today;
          save(storage, storageKey, today);
          return;
        }
        const waitMs = windowMs - (t - oldest);
        onWait?.(Math.ceil(waitMs / SECOND_MS));
        await sleep(Math.min(waitMs, SECOND_MS));
      }
    },
  };
}

/** `sessionStorage` when the browser allows it, else null (the limiter then works in memory only). */
function browserSessionStorage(): LimiterStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The limiter shared by every live read in this tab. Its timestamps live in `sessionStorage`, so a reload does not reset it. */
export const geminiLimiter: RateLimiter = createRateLimiter({ storage: browserSessionStorage() });

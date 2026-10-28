import { describe, expect, it, vi } from 'vitest';
import { RateLimitError } from '../core/errors';
import { createRateLimiter } from './rateLimiter';

/** A fake clock: `sleep` advances time instead of waiting. */
function fakeClock() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    advance: (ms: number) => void (t += ms),
    sleeps,
  };
}

describe('createRateLimiter (max calls per minute)', () => {
  it('lets calls through immediately while the window has room', async () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxRequests: 8, windowMs: 60_000, ...clock });
    for (let i = 0; i < 8; i++) await limiter.acquire();
    expect(clock.sleeps).toEqual([]);
  });

  it('makes the 9th call wait until the oldest call leaves the window', async () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxRequests: 8, windowMs: 60_000, ...clock });
    for (let i = 0; i < 8; i++) await limiter.acquire();
    clock.advance(10_000);
    await limiter.acquire();
    expect(clock.now()).toBeGreaterThanOrEqual(60_000);
    expect(clock.sleeps.length).toBeGreaterThan(0);
    expect(clock.sleeps.every((ms) => ms <= 1000)).toBe(true);
  });

  it('reports the seconds left while it waits', async () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 5_000, ...clock });
    await limiter.acquire();
    const seen: number[] = [];
    await limiter.acquire((s) => seen.push(s));
    expect(seen[0]).toBe(5);
    expect(seen.at(-1)).toBe(1);
  });

  it('frees slots as time passes, so a steady slow pace never waits', async () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 10_000, ...clock });
    for (let i = 0; i < 6; i++) {
      await limiter.acquire();
      clock.advance(6_000);
    }
    expect(clock.sleeps).toEqual([]);
  });

  it('uses the real clock and timers by default', async () => {
    const limiter = createRateLimiter();
    await expect(limiter.acquire()).resolves.toBeUndefined();
  });
});

describe('createRateLimiter: daily cap (in memory only)', () => {
  it('allows 60 calls in a day and then refuses, without waiting for hours', async () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ maxRequests: 100, windowMs: 1000, dailyMax: 60, ...clock });
    for (let i = 0; i < 60; i++) await limiter.acquire();
    await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimitError);
    await expect(limiter.acquire()).rejects.toThrow(/today’s limit/);
    expect(clock.sleeps).toEqual([]);
  });
  it('frees the daily budget after 24 hours', async () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ dailyMax: 2, ...clock });
    await limiter.acquire();
    await limiter.acquire();
    await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimitError);
    clock.advance(24 * 60 * 60 * 1000);
    await expect(limiter.acquire()).resolves.toBeUndefined();
  });
  it('writes nothing to browser storage', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    await createRateLimiter({ now: () => 0, sleep: async () => undefined }).acquire();
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });
});

/** A tiny in-memory Storage, so tests can "reload" by building a new limiter on the same storage. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('createRateLimiter: timestamps persist across a reload (sessionStorage)', () => {
  const KEY = 'formsure.limiter.v1';

  it('a reload does not reset the 8-calls-per-minute limit', async () => {
    const storage = fakeStorage();
    const clock = fakeClock();
    const first = createRateLimiter({ storage, ...clock });
    for (let i = 0; i < 8; i++) await first.acquire();
    expect(JSON.parse(storage.data.get(KEY) ?? '[]')).toHaveLength(8);

    const afterReload = createRateLimiter({ storage, ...clock }); // new page, same tab session
    await afterReload.acquire();
    expect(clock.sleeps.length).toBeGreaterThan(0); // had to wait for the window to free up
    expect(clock.now()).toBeGreaterThanOrEqual(60_000);
  });

  it('a reload does not reset the daily cap', async () => {
    const storage = fakeStorage();
    const clock = fakeClock();
    const first = createRateLimiter({ storage, maxRequests: 100, dailyMax: 5, ...clock });
    for (let i = 0; i < 5; i++) await first.acquire();
    const afterReload = createRateLimiter({ storage, maxRequests: 100, dailyMax: 5, ...clock });
    await expect(afterReload.acquire()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('stores only numbers, under one key', async () => {
    const storage = fakeStorage();
    await createRateLimiter({ storage, now: () => 1234, sleep: async () => undefined }).acquire();
    expect([...storage.data.keys()]).toEqual([KEY]);
    expect(JSON.parse(storage.data.get(KEY) ?? 'null')).toEqual([1234]);
  });

  it('expires entries automatically: old timestamps are dropped on read and write', async () => {
    const day = 24 * 60 * 60 * 1000;
    const storage = fakeStorage({ [KEY]: JSON.stringify([0, 1000, 2000]) });
    const limiter = createRateLimiter({ storage, dailyMax: 3, now: () => day + 5000, sleep: async () => undefined });
    await expect(limiter.acquire()).resolves.toBeUndefined(); // the three old calls no longer count
    expect(JSON.parse(storage.data.get(KEY) ?? 'null')).toEqual([day + 5000]);
  });

  it('only entries inside the window count: a minute later the short limit is free again', async () => {
    const storage = fakeStorage();
    const clock = fakeClock();
    const limiter = createRateLimiter({ storage, maxRequests: 2, ...clock });
    await limiter.acquire();
    await limiter.acquire();
    clock.advance(60_000);
    await limiter.acquire();
    expect(clock.sleeps).toEqual([]);
  });

  it('ignores corrupt, non-numeric and future entries instead of failing', async () => {
    for (const junk of ['not json', '{"a":1}', '["x",null,{}]', '[1e999]', 'null']) {
      const storage = fakeStorage({ [KEY]: junk });
      await expect(createRateLimiter({ storage, now: () => 10, sleep: async () => undefined }).acquire()).resolves.toBeUndefined();
      expect(JSON.parse(storage.data.get(KEY) ?? 'null')).toEqual([10]);
    }
    const future = fakeStorage({ [KEY]: JSON.stringify([999_999_999_999]) });
    await createRateLimiter({ storage: future, now: () => 10, sleep: async () => undefined }).acquire();
    expect(JSON.parse(future.data.get(KEY) ?? 'null')).toEqual([10]);
  });

  it('keeps limiting in memory when storage throws (private mode, quota)', async () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const limiter = createRateLimiter({ storage: broken, maxRequests: 100, dailyMax: 2, now: () => 0, sleep: async () => undefined });
    await limiter.acquire();
    await limiter.acquire();
    await expect(limiter.acquire()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('works without storage and writes nothing by default', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    await createRateLimiter({ now: () => 0, sleep: async () => undefined }).acquire();
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });

  it('the shared limiter uses the real sessionStorage and the key holds only call times', async () => {
    sessionStorage.clear();
    const { geminiLimiter } = await import('./rateLimiter');
    await geminiLimiter.acquire();
    const stored: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    expect(Array.isArray(stored) && stored.every((n) => typeof n === 'number')).toBe(true);
    expect(sessionStorage.length).toBe(1);
    sessionStorage.clear();
  });
});

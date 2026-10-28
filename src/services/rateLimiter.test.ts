import { describe, expect, it } from 'vitest';
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

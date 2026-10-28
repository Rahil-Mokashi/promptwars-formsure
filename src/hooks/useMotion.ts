import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/** How long the ring's number takes to count up from 0, in milliseconds. */
const COUNT_UP_MS = 900;

/** True when the user asks for reduced motion: every animation in the app becomes a no-op. */
export const useReduce = (): boolean => !!useReducedMotion();

/**
 * Counts from 0 to `target` (the ring number). Jumps straight to `target` when motion is off.
 * @param target the final number
 * @param reduce skip the animation
 */
export function useCountUp(target: number, reduce: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      setValue(Math.round(target * (1 - (1 - t) ** 3))); // ease-out
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, reduce]);
  return reduce ? target : value;
}

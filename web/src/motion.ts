import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const EASE = [0.22, 1, 0.36, 1] as const;

/** True when the user asks for reduced motion: every animation below becomes a no-op. */
export const useReduce = (): boolean => !!useReducedMotion();

/** Props for a fade-up entrance (the design's fadeUp keyframes). Empty object when motion is off. */
export const fadeUp = (reduce: boolean, delay = 0, duration = 0.45) =>
  reduce
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration, delay, ease: EASE },
      };

/** Counts 0 -> target (the ring number). Jumps straight to target when motion is off. */
export function useCountUp(target: number, reduce: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, target, { duration: 0.9, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) });
    return () => controls.stop();
  }, [target, reduce]);
  return reduce ? target : n;
}

import { m } from 'framer-motion';
import { useId } from 'react';
import { useCountUp, useReduce } from '../hooks/useMotion';
import { EASE } from './motionProps';

/** Circumference of the ring (2 * pi * r with r = 54). */
const CIRCUMFERENCE = 339.29;
const DRAW_S = 1.3;
const FULL = 100;
const FULL_FONT_PX = 38; // "100%" is wider than "57%"

/** Gradient stops: amber while something is left to fix, green when ready. */
const GRADIENT = {
  amber: ['#FBBF24', '#D97706'],
  green: ['#6EE7B7', '#059669'],
} as const;

/** How many checks passed, failed and could not be verified; read out by screen readers. */
export interface RingCounts {
  passed: number;
  failed: number;
  needsReview: number;
}

/** Props of {@link Ring}. */
export interface RingProps {
  pct: number;
  counts?: RingCounts;
}

/** Readiness ring: the arc draws in with a gradient stroke and the number counts up (both off with reduced motion). */
export function Ring({ pct, counts }: RingProps) {
  const reduce = useReduce();
  const count = useCountUp(pct, reduce);
  const id = useId().replace(/:/g, '');
  const gradientId = `ring-${id}`;
  const descriptionId = `ring-desc-${id}`;
  const full = pct >= FULL;
  const [from, to] = full ? GRADIENT.green : GRADIENT.amber;

  return (
    <div className="ring" role="img" aria-label={`${pct}% ready`} aria-describedby={counts ? descriptionId : undefined}>
      <svg width="180" height="180" viewBox="0 0 132 132" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle className="ring-bg" cx="66" cy="66" r="54" />
        <m.circle
          className="ring-fg" cx="66" cy="66" r="54" stroke={`url(#${gradientId})`}
          initial={reduce ? false : { strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - pct / FULL) }}
          transition={{ duration: reduce ? 0 : DRAW_S, ease: EASE }}
        />
      </svg>
      {counts && (
        <span className="sr-only" id={descriptionId}>
          {counts.passed} passed, {counts.failed} failed, {counts.needsReview} could not be verified.
        </span>
      )}
      <div className="ringnum" aria-hidden="true" style={full ? { fontSize: FULL_FONT_PX } : undefined}>
        <div>
          {count}%<small>Ready</small>
        </div>
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { EASE, useCountUp, useReduce } from '../motion';

const CIRC = 339.29; // 2 * pi * 54

/** Readiness ring: the arc draws in and the number counts up (both off with reduced motion). */
export function Ring({ pct }: { pct: number }) {
  const reduce = useReduce();
  const count = useCountUp(pct, reduce);
  const offset = CIRC * (1 - pct / 100);
  return (
    <div className="ring" role="img" aria-label={`${pct}% ready`}>
      <svg width="180" height="180" viewBox="0 0 132 132" aria-hidden="true">
        <circle className="ring-bg" cx="66" cy="66" r="54" />
        <motion.circle
          className="ring-fg"
          cx="66"
          cy="66"
          r="54"
          style={{ stroke: pct >= 100 ? '#059669' : '#D97706' }}
          initial={reduce ? false : { strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 1.3, ease: EASE }}
        />
      </svg>
      <div className="ringnum" aria-hidden="true">
        <div>
          {count}%<small>Ready</small>
        </div>
      </div>
    </div>
  );
}

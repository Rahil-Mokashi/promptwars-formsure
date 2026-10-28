import { motion } from 'framer-motion';
import { useId } from 'react';
import { EASE, useCountUp, useReduce } from '../motion';

const CIRC = 339.29; // 2 * pi * 54

/** Readiness ring: the arc draws in and the number counts up (both off with reduced motion). */
export function Ring({ pct }: { pct: number }) {
  const reduce = useReduce();
  const count = useCountUp(pct, reduce);
  const gid = useId().replace(/:/g, "");
  const full = pct >= 100;
  const offset = CIRC * (1 - pct / 100);
  return (
    <div className="ring" role="img" aria-label={`${pct}% ready`}>
      <svg width="180" height="180" viewBox="0 0 132 132" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={full ? '#6EE7B7' : '#FBBF24'} />
            <stop offset="100%" stopColor={full ? '#059669' : '#D97706'} />
          </linearGradient>
        </defs>
        <circle className="ring-bg" cx="66" cy="66" r="54" />
        <motion.circle
          className="ring-fg"
          cx="66"
          cy="66"
          r="54"
          stroke={`url(#${gid})`}
          initial={reduce ? false : { strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 1.3, ease: EASE }}
        />
      </svg>
      <div className="ringnum" aria-hidden="true" style={full ? { fontSize: 38 } : undefined}>
        <div>
          {count}%<small>Ready</small>
        </div>
      </div>
    </div>
  );
}

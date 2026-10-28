import { m } from 'framer-motion';
import type { ReadProgress } from '../../core/types';
import { EASE } from '../motionProps';

const PERCENT = 100;
const BAR_S = 0.5;
const DEFAULT_TOTAL = 8;

/** Props of {@link AuditProgress}. */
export interface AuditProgressProps {
  /** Reading progress, while documents are still being read. */
  reading: ReadProgress | null;
  /** How many checks are revealed, out of `total`. */
  step: number;
  total: number;
  reduce: boolean;
}

/** The progress bar: documents read while reading, then checks revealed. */
export function AuditProgress({ reading, step, total, reduce }: AuditProgressProps) {
  const now = reading ? reading.index - 1 : step;
  const max = reading ? reading.total : total || DEFAULT_TOTAL;
  const percent = max > 0 && (reading || total) ? Math.round((now / max) * PERCENT) : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={reading ? 'Documents read' : 'Checks completed'}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={now}
    >
      <m.div
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={{ duration: reduce ? 0 : BAR_S, ease: EASE }}
      />
    </div>
  );
}

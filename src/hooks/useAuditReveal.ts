import { useEffect, useState } from 'react';
import type { AuditReport, ReadProgress, SlotDef } from '../core/types';

/** One check is revealed this often, in milliseconds (the design's pace). */
const CHECK_REVEAL_MS = 650;

/** While documents are being read and nothing is known yet, the scanner moves to the next slot this often. */
const SCAN_CYCLE_MS = 900;

/** What {@link useAuditReveal} returns. */
export interface AuditReveal {
  /** How many checks have been revealed. */
  step: number;
  total: number;
  /** Every check is revealed. */
  done: boolean;
  /** Skip the animation and reveal everything now. */
  skip: () => void;
}

/**
 * Reveals the report's checks one at a time. With reduced motion, or after `skip`, everything shows at once.
 * @param report the finished report, or null while documents are still being read
 * @param reduce true when the user asked for reduced motion
 */
export function useAuditReveal(report: AuditReport | null, reduce: boolean): AuditReveal {
  const [tick, setTick] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const total = report?.checks.length ?? 0;
  const step = report ? (reduce || skipped ? total : Math.min(tick, total)) : 0;
  const done = !!report && step >= total;

  useEffect(() => {
    if (!report || reduce || skipped || done) return;
    const timer = setInterval(() => {
      setTick((n) => n + 1);
    }, CHECK_REVEAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [report, reduce, skipped, done]);

  return {
    step,
    total,
    done,
    skip: () => {
      setSkipped(true);
    },
  };
}

/** Inputs of {@link useScanIndex}. */
export interface ScanInputs {
  slots: readonly SlotDef[];
  report: AuditReport | null;
  progress: ReadProgress | null | undefined;
  reveal: AuditReveal;
  reduce: boolean;
}

/**
 * Which slot the scanner is on: the file being read, then the slot matching the check being revealed,
 * finishing on the income certificate. Before anything is known it cycles through the slots.
 */
export function useScanIndex({ slots, report, progress, reveal, reduce }: ScanInputs): number {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (report || reduce || progress) return;
    const timer = setInterval(() => {
      setCycle((n) => n + 1);
    }, SCAN_CYCLE_MS);
    return () => {
      clearInterval(timer);
    };
  }, [report, reduce, progress]);

  const incomeIndex = Math.max(
    0,
    slots.findIndex((s) => s.id === 'income_certificate'),
  );
  const reading = progress ? slots.findIndex((s) => s.id === progress.slotId) : -1;
  if (reading >= 0 && !report) return reading;
  if (reveal.done || reduce) return incomeIndex;
  if (report) return Math.min(slots.length - 1, Math.floor((reveal.step / reveal.total) * slots.length));
  return cycle % slots.length;
}

import { useCallback, useMemo, useRef, useState } from 'react';
import { READ_GAP_MS, UNAVAILABLE_MESSAGE } from '../core/constants';
import { ExtractionError, UnavailableError } from '../core/errors';
import { maskAadhaar } from '../core/mask';
import type { DocumentsBySlot, ReadProgress, SlotId, SlotReadState } from '../core/types';
import { extract, pack } from '../services/api';
import { readFiles, type ReadCache, type ReadOutcome } from '../services/readFiles';
import { sleep } from '../services/sleep';

type SlotStates = Partial<Record<SlotId, SlotReadState>>;
type Files = Partial<Record<SlotId, File>>;

/** What {@link useDocumentReader} gives back. */
export interface DocumentReader {
  /** Progress of the batch being read, or null. */
  progress: ReadProgress | null;
  /** Per-slot reading / failed state (for the "Retry this file" buttons). */
  slotStates: SlotStates;
  /** Documents read so far, keyed by slot. */
  docs: DocumentsBySlot;
  /** True while any single-file retry is running. */
  retrying: boolean;
  /** Reads every selected file that is not already cached. */
  readAll: () => Promise<ReadOutcome>;
  /** Reads one file again, for example after a failure. */
  retry: (slotId: SlotId) => Promise<void>;
  /** Forgets everything known about one slot (its file was replaced or removed). */
  invalidate: (slotId: SlotId) => void;
  /** Stops following the batch in progress; results already read stay cached. */
  cancel: () => void;
  /** Cancels and forgets everything. */
  reset: () => void;
}

const SLOT_ORDER: readonly SlotId[] = pack.slots.map((s) => s.id);

/** Reads the selected files with Gemini: one at a time, cached, retryable per file. */
export function useDocumentReader(files: Files): DocumentReader {
  const cache = useRef<ReadCache>(new Map());
  const token = useRef(0);
  const [progress, setProgress] = useState<ReadProgress | null>(null);
  const [slotStates, setSlotStates] = useState<SlotStates>({});
  const [docs, setDocs] = useState<DocumentsBySlot>({});

  const setSlot = useCallback((slotId: SlotId, state: SlotReadState | undefined) => {
    setSlotStates((prev) => {
      const { [slotId]: _old, ...rest } = prev;
      void _old;
      return state ? { ...rest, [slotId]: state } : rest;
    });
  }, []);

  const readAll = useCallback(async (): Promise<ReadOutcome> => {
    const me = ++token.current;
    setProgress(null);
    setSlotStates({});
    return readFiles({
      order: SLOT_ORDER,
      files,
      cache: cache.current,
      extract: (file, options) => extract(file, options),
      pause: sleep,
      gapMs: READ_GAP_MS,
      onProgress: setProgress,
      onSlotDone: (slotId, message) => {
        const doc = cache.current.get(slotId)?.doc;
        if (doc) setDocs((d) => ({ ...d, [slotId]: doc }));
        setSlot(slotId, message ? { status: 'failed', message } : undefined);
      },
      isCancelled: () => token.current !== me,
    });
  }, [files, setSlot]);

  const retry = useCallback(
    async (slotId: SlotId) => {
      const file = files[slotId];
      if (!file) return;
      setSlot(slotId, { status: 'reading', message: 'Reading…' });
      try {
        const doc = await extract(file, {
          onBusy: (left) => setSlot(slotId, { status: 'reading', message: left > 0 ? `Gemini is busy, retrying in ${left}s…` : 'Reading…' }),
        });
        cache.current.set(slotId, { file, doc });
        setDocs((d) => ({ ...d, [slotId]: doc }));
        setSlot(slotId, undefined);
      } catch (err) {
        const message = err instanceof UnavailableError ? UNAVAILABLE_MESSAGE : err instanceof ExtractionError ? err.message : `Could not read ${maskAadhaar(file.name)}.`;
        setSlot(slotId, { status: 'failed', message });
      }
    },
    [files, setSlot],
  );

  const invalidate = useCallback(
    (slotId: SlotId) => {
      cache.current.delete(slotId);
      setSlot(slotId, undefined);
      setDocs((prev) => {
        const { [slotId]: _gone, ...rest } = prev;
        void _gone;
        return rest;
      });
    },
    [setSlot],
  );

  const cancel = useCallback(() => {
    token.current++;
    setProgress(null);
  }, []);

  const reset = useCallback(() => {
    token.current++;
    cache.current.clear();
    setProgress(null);
    setSlotStates({});
    setDocs({});
  }, []);

  const retrying = useMemo(() => Object.values(slotStates).some((s) => s.status === 'reading'), [slotStates]);
  return { progress, slotStates, docs, retrying, readAll, retry, invalidate, cancel, reset };
}

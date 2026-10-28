import { useCallback, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { omit } from '../core/object';
import { READ_CONCURRENCY, READ_STAGGER_MS, UNAVAILABLE_MESSAGE } from '../core/constants';
import { ExtractionError, UnavailableError } from '../core/errors';
import { maskAadhaar } from '../core/mask';
import type { DocumentsBySlot, ExtractedDocument, ReadProgress, SlotId } from '../core/types';
import { extract } from '../services/api';
import { readFiles, type ReadCache, type ReadOutcome } from '../services/readFiles';
import { sleep } from '../services/sleep';
import { useSlotStates, type SlotSetter, type SlotStates } from './useSlotStates';

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

/** The words shown under a file that could not be read. */
function failureOf(err: unknown, file: File): string {
  if (err instanceof UnavailableError) return UNAVAILABLE_MESSAGE;
  return err instanceof ExtractionError ? err.message : `Could not read ${maskAadhaar(file.name)}.`;
}

/** Reads one file; `onBusy` hears the seconds left while Gemini asks us to wait. */
async function readOne(
  file: File,
  onBusy: (left: number) => void,
): Promise<{ doc: ExtractedDocument } | { message: string }> {
  try {
    return { doc: await extract(file, { onBusy }) };
  } catch (err) {
    return { message: failureOf(err, file) };
  }
}

/** Reads one file again, showing "Reading…" (or the wait while Gemini is busy) and then the document or the failure. */
function useRetry(
  files: Files,
  cache: RefObject<ReadCache>,
  setSlot: SlotSetter,
  setDocs: Dispatch<SetStateAction<DocumentsBySlot>>,
) {
  return useCallback(
    async (slotId: SlotId) => {
      const file = files[slotId];
      if (!file) return;
      setSlot(slotId, { status: 'reading', message: 'Reading…' });
      const result = await readOne(file, (left) => {
        setSlot(slotId, {
          status: 'reading',
          message: left > 0 ? `Gemini is busy, retrying in ${left}s…` : 'Reading…',
        });
      });
      if ('message' in result) {
        setSlot(slotId, { status: 'failed', message: result.message });
        return;
      }
      cache.current.set(slotId, { file, doc: result.doc });
      setDocs((d) => ({ ...d, [slotId]: result.doc }));
      setSlot(slotId, undefined);
    },
    [files, cache, setSlot, setDocs],
  );
}

/**
 * Reads the selected files with Gemini: cached, retryable per file.
 * @param order slot ids of the chosen scheme pack, in reading order
 */
export function useDocumentReader(files: Files, order: readonly SlotId[]): DocumentReader {
  const cache = useRef<ReadCache>(new Map());
  const token = useRef(0);
  const [progress, setProgress] = useState<ReadProgress | null>(null);
  const [docs, setDocs] = useState<DocumentsBySlot>({});
  const { slotStates, setSlot, clearSlots, retrying } = useSlotStates();

  const readAll = useCallback(async (): Promise<ReadOutcome> => {
    const me = ++token.current;
    setProgress(null);
    clearSlots();
    return readFiles({
      order,
      files,
      cache: cache.current,
      extract: (file, options) => extract(file, options),
      pause: sleep,
      concurrency: READ_CONCURRENCY,
      staggerMs: READ_STAGGER_MS,
      onProgress: setProgress,
      onSlotDone: (slotId, message) => {
        const doc = cache.current.get(slotId)?.doc;
        if (doc) setDocs((d) => ({ ...d, [slotId]: doc }));
        setSlot(slotId, message ? { status: 'failed', message } : undefined);
      },
      isCancelled: () => token.current !== me,
    });
  }, [files, order, setSlot, clearSlots]);

  const retry = useRetry(files, cache, setSlot, setDocs);

  const invalidate = useCallback(
    (slotId: SlotId) => {
      cache.current.delete(slotId);
      setSlot(slotId, undefined);
      setDocs((prev) => omit(prev, slotId));
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
    clearSlots();
    setDocs({});
  }, [clearSlots]);

  return { progress, slotStates, docs, retrying, readAll, retry, invalidate, cancel, reset };
}

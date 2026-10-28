import { ExtractionError, RateLimitError, UnavailableError } from '../core/errors';
import { maskAadhaar } from '../core/mask';
import type { DocumentsBySlot, ExtractedDocument, ReadProgress, SlotId } from '../core/types';
import type { ExtractOptions } from './extraction';

/** Documents already read, keyed by slot. A cached entry is reused only while the same file is still selected. */
export type ReadCache = Map<SlotId, { file: File; doc: ExtractedDocument }>;

/** Everything {@link readFiles} needs from the outside world. */
export interface ReadDeps {
  /** Slots in the order they should be read. */
  order: readonly SlotId[];
  files: Partial<Record<SlotId, File>>;
  cache: ReadCache;
  extract: (file: File, options: ExtractOptions) => Promise<ExtractedDocument>;
  pause: (ms: number) => Promise<void>;
  gapMs: number;
  onProgress: (progress: ReadProgress) => void;
  /** Called when a file finishes: `message` is set when it failed. */
  onSlotDone: (slotId: SlotId, message?: string) => void;
  isCancelled: () => boolean;
}

/** Result of reading a batch of files. */
export interface ReadOutcome {
  documents: DocumentsBySlot;
  /** Safe-to-show message per slot that could not be read. */
  failures: Partial<Record<SlotId, string>>;
  /** True when reading stopped early (rate limit) or was cancelled. */
  stopped: boolean;
}

/**
 * Reads the selected files one at a time, with a gap between network reads.
 * Files that were already read (same file object) come from the cache and cost no quota.
 * A bad scan is recorded and reading continues; a rate limit that outlasts every backoff stops the batch.
 * @throws {UnavailableError} live reading is not configured
 */
export async function readFiles(deps: ReadDeps): Promise<ReadOutcome> {
  const documents: DocumentsBySlot = {};
  const failures: Partial<Record<SlotId, string>> = {};
  const slots = deps.order.filter((id) => deps.files[id]);
  let networkReads = 0;

  for (const [i, slotId] of slots.entries()) {
    const file = deps.files[slotId];
    if (!file) continue;
    const cached = deps.cache.get(slotId);
    if (cached && cached.file === file) {
      documents[slotId] = cached.doc;
      continue;
    }

    const base = { index: i + 1, total: slots.length, slotId };
    if (networkReads > 0) {
      deps.onProgress({ ...base, detail: 'Pausing briefly to stay within the free quota…' });
      await deps.pause(deps.gapMs);
      if (deps.isCancelled()) return { documents, failures, stopped: true };
    }
    deps.onProgress({ ...base, detail: maskAadhaar(file.name) });
    networkReads++;

    try {
      const doc = await deps.extract(file, {
        onBusy: (left) => {
          if (!deps.isCancelled()) deps.onProgress({ ...base, detail: left > 0 ? `Gemini is busy, retrying in ${left}s…` : maskAadhaar(file.name) });
        },
      });
      if (deps.isCancelled()) return { documents, failures, stopped: true };
      deps.cache.set(slotId, { file, doc });
      documents[slotId] = doc;
      deps.onSlotDone(slotId);
    } catch (err) {
      if (err instanceof UnavailableError) throw err;
      if (deps.isCancelled()) return { documents, failures, stopped: true };
      const message = err instanceof ExtractionError ? err.message : `Could not read ${maskAadhaar(file.name)}.`;
      failures[slotId] = message;
      deps.onSlotDone(slotId, message);
      if (err instanceof RateLimitError) return { documents, failures, stopped: true };
    }
  }
  return { documents, failures, stopped: false };
}

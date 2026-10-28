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
  /** Files read at the same time (2). */
  concurrency: number;
  /** Time between the start of one read and the start of the next (2 s). */
  staggerMs: number;
  /**
   * Progress for the screen: the most recently started read, or a "Gemini is busy, retrying in Ns…" countdown when any
   * read is waiting to retry. One steady "Reading n of N…" line even with two reads in flight.
   */
  onProgress: (progress: ReadProgress) => void;
  /** Called when a file finishes: `message` is set when it failed. */
  onSlotDone: (slotId: SlotId, message?: string) => void;
  isCancelled: () => boolean;
}

/** Result of reading a batch of files. */
export interface ReadOutcome {
  /** Documents read, in slot order. */
  documents: DocumentsBySlot;
  /** Safe-to-show message per slot that could not be read. */
  failures: Partial<Record<SlotId, string>>;
  /** True when reading stopped early (rate limit) or was cancelled. */
  stopped: boolean;
}

interface Job {
  slotId: SlotId;
  file: File;
  /** 1-based position among the selected files. */
  index: number;
}

/**
 * Reads the selected files, up to `concurrency` at a time, starting them `staggerMs` apart.
 * - Files already read (same file object) come from the cache and cost no quota.
 * - A failure is isolated to its slot: the other reads carry on.
 * - A rate limit that outlasts every backoff stops new reads from starting; reads already running finish.
 * - Cancelling stops new reads and discards the results of those still running.
 * @throws {UnavailableError} live reading is not configured (raised after reads in flight have finished)
 */
export async function readFiles(deps: ReadDeps): Promise<ReadOutcome> {
  const slots = deps.order.filter((id) => deps.files[id]);
  const results = new Map<SlotId, ExtractedDocument>();
  const failures: Partial<Record<SlotId, string>> = {};
  const jobs: Job[] = [];

  slots.forEach((slotId, i) => {
    const file = deps.files[slotId];
    if (!file) return;
    const cached = deps.cache.get(slotId);
    if (cached && cached.file === file) results.set(slotId, cached.doc);
    else jobs.push({ slotId, file, index: i + 1 });
  });

  let stopped = false;
  let fatal: unknown;
  let latest: Job | undefined; // the most recently started read
  const busy = new Map<SlotId, number>(); // reads waiting to retry after a 429, with seconds left

  /** Shows a busy countdown if any read is waiting; otherwise the most recently started read. */
  const report = (): void => {
    if (deps.isCancelled()) return;
    const [slotId, left] = [...busy.entries()][0] ?? [];
    const job = jobs.find((j) => j.slotId === slotId);
    if (job && left !== undefined) deps.onProgress({ index: job.index, total: slots.length, slotId: job.slotId, detail: `Gemini is busy, retrying in ${left}s…` });
    else if (latest) deps.onProgress({ index: latest.index, total: slots.length, slotId: latest.slotId, detail: maskAadhaar(latest.file.name) });
  };

  const run = async (job: Job): Promise<void> => {
    const name = maskAadhaar(job.file.name);
    try {
      const doc = await deps.extract(job.file, {
        onBusy: (left) => {
          if (left > 0) busy.set(job.slotId, left);
          else busy.delete(job.slotId);
          report();
        },
      });
      if (deps.isCancelled()) return;
      deps.cache.set(job.slotId, { file: job.file, doc });
      results.set(job.slotId, doc);
      deps.onSlotDone(job.slotId);
    } catch (err) {
      busy.delete(job.slotId);
      if (err instanceof UnavailableError) {
        fatal ??= err;
        stopped = true;
        return;
      }
      if (deps.isCancelled()) return;
      const message = err instanceof ExtractionError ? err.message : `Could not read ${name}.`;
      failures[job.slotId] = message;
      deps.onSlotDone(job.slotId, message);
      if (err instanceof RateLimitError) stopped = true;
    }
  };

  const running = new Set<Promise<void>>();
  let started = 0;
  for (const job of jobs) {
    if (running.size >= deps.concurrency) await Promise.race(running);
    if (stopped || deps.isCancelled()) break;
    if (started > 0) {
      deps.onProgress({ index: job.index, total: slots.length, slotId: job.slotId, detail: 'Pausing briefly to stay within the free quota…' });
      await deps.pause(deps.staggerMs);
      if (stopped || deps.isCancelled()) break;
    }
    latest = job;
    report();
    const promise: Promise<void> = run(job).finally(() => running.delete(promise));
    running.add(promise);
    started++;
  }
  await Promise.all(running);

  if (fatal !== undefined) throw fatal;
  const documents: DocumentsBySlot = {};
  for (const slotId of slots) {
    const doc = results.get(slotId);
    if (doc) documents[slotId] = doc;
  }
  return { documents, failures, stopped: stopped || deps.isCancelled() };
}

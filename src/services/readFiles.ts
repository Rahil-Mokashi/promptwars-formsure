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

/** Mutable state shared by the reads of one batch. */
interface Batch {
  deps: ReadDeps;
  total: number;
  jobs: Job[];
  results: Map<SlotId, ExtractedDocument>;
  failures: Partial<Record<SlotId, string>>;
  /** Reads waiting to retry after a 429, with seconds left. */
  busy: Map<SlotId, number>;
  stopped: boolean;
  fatal: UnavailableError | undefined;
  /** The most recently started read. */
  latest: Job | undefined;
}

/** Splits the selected files into cached results and the jobs that still need a network read. */
function plan(deps: ReadDeps): { slots: SlotId[]; jobs: Job[]; results: Map<SlotId, ExtractedDocument> } {
  const slots = deps.order.filter((id) => deps.files[id]);
  const results = new Map<SlotId, ExtractedDocument>();
  const jobs: Job[] = [];
  slots.forEach((slotId, i) => {
    const file = deps.files[slotId];
    if (!file) return;
    const cached = deps.cache.get(slotId);
    if (cached?.file === file) results.set(slotId, cached.doc);
    else jobs.push({ slotId, file, index: i + 1 });
  });
  return { slots, jobs, results };
}

const progressOf = (batch: Batch, job: Job, detail: string): ReadProgress => ({
  index: job.index,
  total: batch.total,
  slotId: job.slotId,
  detail,
});

/** Shows a busy countdown if any read is waiting; otherwise the most recently started read. */
function report(batch: Batch): void {
  if (batch.deps.isCancelled()) return;
  const [slotId, left] = [...batch.busy.entries()][0] ?? [];
  const waiting = batch.jobs.find((j) => j.slotId === slotId);
  if (waiting && left !== undefined) {
    batch.deps.onProgress(progressOf(batch, waiting, `Gemini is busy, retrying in ${left}s…`));
  } else if (batch.latest) {
    batch.deps.onProgress(progressOf(batch, batch.latest, maskAadhaar(batch.latest.file.name)));
  }
}

/** Records a failed read, isolating it to its slot. A rate limit that outlasts every backoff stops new reads. */
function fail(batch: Batch, job: Job, err: unknown): void {
  batch.busy.delete(job.slotId);
  if (err instanceof UnavailableError) {
    batch.fatal ??= err;
    batch.stopped = true;
    return;
  }
  if (batch.deps.isCancelled()) return;
  const message = err instanceof ExtractionError ? err.message : `Could not read ${maskAadhaar(job.file.name)}.`;
  batch.failures[job.slotId] = message;
  batch.deps.onSlotDone(job.slotId, message);
  if (err instanceof RateLimitError) batch.stopped = true;
}

/** Reads one file; results that arrive after cancelling are discarded. */
async function run(batch: Batch, job: Job): Promise<void> {
  const { deps } = batch;
  try {
    const doc = await deps.extract(job.file, {
      onBusy: (left) => {
        if (left > 0) batch.busy.set(job.slotId, left);
        else batch.busy.delete(job.slotId);
        report(batch);
      },
    });
    if (deps.isCancelled()) return;
    deps.cache.set(job.slotId, { file: job.file, doc });
    batch.results.set(job.slotId, doc);
    deps.onSlotDone(job.slotId);
  } catch (err) {
    fail(batch, job, err);
  }
}

/** True when no more reads should start. */
const mustStop = (batch: Batch): boolean => batch.stopped || batch.deps.isCancelled();

/** Starts the jobs: at most `concurrency` at a time, each `staggerMs` after the previous start. */
async function launch(batch: Batch): Promise<void> {
  const { deps } = batch;
  const running = new Set<Promise<void>>();
  let started = 0;
  for (const job of batch.jobs) {
    if (running.size >= deps.concurrency) await Promise.race(running);
    if (mustStop(batch)) break;
    if (started > 0) {
      deps.onProgress(progressOf(batch, job, 'Pausing briefly to stay within the free quota…'));
      await deps.pause(deps.staggerMs);
      if (mustStop(batch)) break;
    }
    batch.latest = job;
    report(batch);
    const promise: Promise<void> = run(batch, job).finally(() => running.delete(promise));
    running.add(promise);
    started++;
  }
  await Promise.all(running);
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
  const { slots, jobs, results } = plan(deps);
  const batch: Batch = {
    deps,
    total: slots.length,
    jobs,
    results,
    failures: {},
    busy: new Map(),
    stopped: false,
    fatal: undefined,
    latest: undefined,
  };
  await launch(batch);

  if (batch.fatal) throw batch.fatal;
  const documents: DocumentsBySlot = {};
  for (const slotId of slots) {
    const doc = batch.results.get(slotId);
    if (doc) documents[slotId] = doc;
  }
  return { documents, failures: batch.failures, stopped: batch.stopped || deps.isCancelled() };
}

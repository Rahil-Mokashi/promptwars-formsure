import { describe, expect, it, vi } from 'vitest';
import { ExtractionError, RateLimitError, UnavailableError } from '../core/errors';
import type { ExtractedDocument, ReadProgress, SlotId } from '../core/types';
import { pdfFile } from '../test/files';
import { readFiles, type ReadCache, type ReadDeps } from './readFiles';

const doc = (name: string): ExtractedDocument => ({
  documentTypes: ['marksheet'], language: 'en', applicantName: { original: name, english: name },
  dateOfBirth: null, issueDate: null, issuingAuthority: null, category: null, annualIncome: null, pageCount: 1, legible: true,
});
const ORDER: SlotId[] = ['aadhaar', 'caste_certificate', 'income_certificate', 'domicile'];

/** A promise you resolve or reject by hand, to control when a read finishes. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(overrides: Partial<ReadDeps> = {}, selected: SlotId[] = ['aadhaar', 'caste_certificate', 'income_certificate']) {
  const files = Object.fromEntries(selected.map((s) => [s, pdfFile(`${s}.pdf`)])) as Partial<Record<SlotId, File>>;
  const cache: ReadCache = new Map();
  const progress: ReadProgress[] = [];
  const done: [SlotId, string | undefined][] = [];
  const pause = vi.fn<ReadDeps['pause']>(async () => undefined);
  const extract = vi.fn<ReadDeps['extract']>(async (file) => doc(file.name));
  const deps: ReadDeps = {
    order: ORDER, files, cache, extract, pause, concurrency: 2, staggerMs: 2000,
    onProgress: (p) => progress.push(p), onSlotDone: (s, m) => done.push([s, m]), isCancelled: () => false,
    ...overrides,
  };
  return { deps, files, cache, progress, done, pause, extract };
}

describe('readFiles: two at a time, started 2 seconds apart', () => {
  it('runs at most two reads at once and starts the third when one finishes', async () => {
    const { deps, extract } = setup();
    const gates = ORDER.map(() => deferred<ExtractedDocument>());
    let calls = 0;
    extract.mockImplementation(() => (gates[calls++] as ReturnType<typeof deferred<ExtractedDocument>>).promise);

    const reading = readFiles(deps);
    await tick();
    expect(extract).toHaveBeenCalledTimes(2); // the third waits for a free slot
    gates[0]?.resolve(doc('a'));
    await tick();
    expect(extract).toHaveBeenCalledTimes(3);
    gates[1]?.resolve(doc('b'));
    gates[2]?.resolve(doc('c'));
    const out = await reading;
    expect(Object.keys(out.documents)).toEqual(['aadhaar', 'caste_certificate', 'income_certificate']);
    expect(out.stopped).toBe(false);
  });

  it('never exceeds the concurrency, however many files there are', async () => {
    const { deps, extract } = setup({}, ['aadhaar', 'caste_certificate', 'income_certificate', 'domicile']);
    let running = 0;
    let most = 0;
    extract.mockImplementation(async (file) => {
      most = Math.max(most, ++running);
      await tick();
      running--;
      return doc(file.name);
    });
    await readFiles(deps);
    expect(most).toBe(2);
  });

  it('waits the stagger before every start except the first, and only for network reads', async () => {
    const { deps, pause, cache, files } = setup();
    cache.set('aadhaar', { file: files.aadhaar as File, doc: doc('cached') });
    await readFiles(deps);
    expect(pause).toHaveBeenCalledTimes(1); // two network reads: one stagger between them
    expect(pause).toHaveBeenCalledWith(2000);
  });

  it('reuses cached documents for unchanged files and re-reads a replaced file', async () => {
    const { deps, cache, files, extract } = setup();
    cache.set('aadhaar', { file: files.aadhaar as File, doc: doc('cached') });
    cache.set('caste_certificate', { file: pdfFile('old.pdf'), doc: doc('old') });
    const out = await readFiles(deps);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(out.documents.aadhaar?.applicantName?.english).toBe('cached');
  });

  it('returns documents in slot order even when reads finish out of order', async () => {
    const { deps, extract } = setup();
    const first = deferred<ExtractedDocument>();
    extract.mockImplementationOnce(() => first.promise);
    const reading = readFiles(deps);
    await tick();
    await tick();
    first.resolve(doc('late'));
    const out = await reading;
    expect(Object.keys(out.documents)).toEqual(['aadhaar', 'caste_certificate', 'income_certificate']);
  });

  it('skips slots with no file', async () => {
    const { deps, extract } = setup({}, ['income_certificate']);
    await readFiles(deps);
    expect(extract).toHaveBeenCalledTimes(1);
  });
});

describe('readFiles: progress', () => {
  it('reports "n of N" for the most recently started read, with the stagger pause before the next', async () => {
    const { deps, progress } = setup();
    await readFiles(deps);
    const starts = progress.filter((p) => p.detail.endsWith('.pdf')).map((p) => `${p.index} of ${p.total}`);
    expect(starts).toEqual(['1 of 3', '2 of 3', '3 of 3']);
    expect(progress.some((p) => p.detail === 'Pausing briefly to stay within the free quota…')).toBe(true);
  });

  it('shows a busy countdown from either read, even an older one, then goes back to the latest file', async () => {
    const { deps, extract, progress } = setup({}, ['aadhaar', 'caste_certificate']);
    const gate = deferred<void>();
    extract.mockImplementation(async (file, options) => {
      if (file.name.startsWith('aadhaar')) {
        await gate.promise; // by now the second read has started
        options.onBusy?.(10);
        options.onBusy?.(0);
        return doc(file.name);
      }
      gate.resolve();
      return doc(file.name);
    });
    await readFiles(deps);
    const lines = progress.map((p) => `${p.slotId}: ${p.detail}`);
    expect(lines).toContain('aadhaar: Gemini is busy, retrying in 10s…');
    expect(lines.at(-1)).toBe('caste_certificate: caste_certificate.pdf');
  });
});

describe('readFiles: errors stay with their slot', () => {
  it('a bad scan fails only its own slot; the others are read and kept', async () => {
    const { deps, extract, done } = setup();
    extract.mockImplementation(async (file) => {
      if (file.name.startsWith('caste')) throw new ExtractionError('Could not read caste_certificate.pdf. Try a clearer scan or a different file.');
      return doc(file.name);
    });
    const out = await readFiles(deps);
    expect(out.failures).toEqual({ caste_certificate: 'Could not read caste_certificate.pdf. Try a clearer scan or a different file.' });
    expect(Object.keys(out.documents)).toEqual(['aadhaar', 'income_certificate']);
    expect(out.stopped).toBe(false);
    expect(done.find(([s]) => s === 'caste_certificate')?.[1]).toMatch(/Could not read/);
  });

  it('a rate limit that outlasts every backoff stops new reads but lets the running one finish', async () => {
    const { deps, extract } = setup({}, ['aadhaar', 'caste_certificate', 'income_certificate', 'domicile']);
    const slow = deferred<ExtractedDocument>();
    extract.mockImplementation((file) => {
      if (file.name.startsWith('aadhaar')) return slow.promise;
      if (file.name.startsWith('caste')) return Promise.reject(new RateLimitError('Gemini is still busy'));
      return Promise.resolve(doc(file.name));
    });
    const reading = readFiles(deps);
    await tick();
    slow.resolve(doc('aadhaar'));
    const out = await reading;
    expect(out.stopped).toBe(true);
    expect(out.failures.caste_certificate).toBe('Gemini is still busy');
    expect(Object.keys(out.documents)).toEqual(['aadhaar']); // the one already running was kept
    expect(extract).toHaveBeenCalledTimes(2); // income and domicile never started
  });

  it('turns an unknown error into a safe message', async () => {
    const { deps, extract } = setup({}, ['aadhaar']);
    extract.mockRejectedValue(new Error('internal detail 1234 5678 9012'));
    const out = await readFiles(deps);
    expect(out.failures.aadhaar).toBe('Could not read aadhaar.pdf.');
  });

  it('"live reading unavailable" stops new reads and is rethrown once the running reads finish', async () => {
    const { deps, extract } = setup({}, ['aadhaar', 'caste_certificate', 'income_certificate']);
    extract.mockRejectedValue(new UnavailableError());
    await expect(readFiles(deps)).rejects.toBeInstanceOf(UnavailableError);
    expect(extract.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('readFiles: cancelling', () => {
  it('stops before launching more reads when cancelled during the stagger pause', async () => {
    let cancelled = false;
    const { deps, extract } = setup({ isCancelled: () => cancelled, pause: async () => void (cancelled = true) });
    const out = await readFiles(deps);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(out.stopped).toBe(true);
  });

  it('discards results and failures that arrive after cancelling, and caches nothing', async () => {
    let cancelled = false;
    const { deps, extract, cache, done } = setup({ isCancelled: () => cancelled }, ['aadhaar', 'caste_certificate']);
    extract.mockImplementation(async (file) => {
      cancelled = true;
      if (file.name.startsWith('caste')) throw new ExtractionError('late');
      return doc(file.name);
    });
    const out = await readFiles(deps);
    expect(out.stopped).toBe(true);
    expect(out.failures).toEqual({});
    expect(cache.size).toBe(0);
    expect(done).toEqual([]);
  });

  it('does not report busy countdowns once cancelled', async () => {
    let cancelled = false;
    const { deps, extract, progress } = setup({ isCancelled: () => cancelled }, ['aadhaar']);
    extract.mockImplementation(async (file, options) => {
      cancelled = true;
      options.onBusy?.(5);
      return doc(file.name);
    });
    await readFiles(deps);
    expect(progress.some((p) => p.detail.includes('busy'))).toBe(false);
  });
});

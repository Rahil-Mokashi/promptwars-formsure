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

function setup(overrides: Partial<ReadDeps> = {}, selected: SlotId[] = ['aadhaar', 'caste_certificate', 'income_certificate']) {
  const files = Object.fromEntries(selected.map((s) => [s, pdfFile(`${s}.pdf`)])) as Partial<Record<SlotId, File>>;
  const cache: ReadCache = new Map();
  const progress: ReadProgress[] = [];
  const done: [SlotId, string | undefined][] = [];
  const pause = vi.fn(async () => undefined);
  const extract = vi.fn<ReadDeps['extract']>(async (file) => doc(file.name));
  const deps: ReadDeps = {
    order: ORDER, files, cache, extract, pause, gapMs: 4000,
    onProgress: (p) => progress.push(p), onSlotDone: (s, m) => done.push([s, m]), isCancelled: () => false,
    ...overrides,
  };
  return { deps, files, cache, progress, done, pause, extract };
}

describe('readFiles: one file at a time with a gap', () => {
  it('reads files in slot order, one after another, pausing 4 s between network reads only', async () => {
    const { deps, pause, extract, progress } = setup();
    let running = 0;
    let most = 0;
    extract.mockImplementation(async (file: File) => {
      most = Math.max(most, ++running);
      await Promise.resolve();
      running--;
      return doc(file.name);
    });
    const out = await readFiles(deps);

    expect(most).toBe(1);
    expect(Object.keys(out.documents)).toEqual(['aadhaar', 'caste_certificate', 'income_certificate']);
    expect(pause).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(4000);
    expect(progress.filter((p) => p.detail.endsWith('.pdf')).map((p) => `${p.index} of ${p.total}`)).toEqual(['1 of 3', '2 of 3', '3 of 3']);
    expect(out.stopped).toBe(false);
  });

  it('reuses cached documents for unchanged files and spends no quota on them', async () => {
    const { deps, cache, files, extract, pause } = setup();
    cache.set('aadhaar', { file: files.aadhaar as File, doc: doc('cached') });
    const out = await readFiles(deps);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(out.documents.aadhaar?.applicantName?.english).toBe('cached');
  });

  it('re-reads a slot when its file was replaced', async () => {
    const { deps, cache, extract } = setup();
    cache.set('aadhaar', { file: pdfFile('old.pdf'), doc: doc('old') });
    await readFiles(deps);
    expect(extract).toHaveBeenCalledTimes(3);
  });

  it('skips slots with no file', async () => {
    const { deps, extract } = setup({}, ['income_certificate']);
    await readFiles(deps);
    expect(extract).toHaveBeenCalledTimes(1);
  });
});

describe('readFiles: failures', () => {
  it('records a bad scan, keeps reading the rest, and says which file failed', async () => {
    const { deps, extract, done } = setup();
    extract.mockImplementation(async (file: File) => {
      if (file.name.startsWith('caste')) throw new ExtractionError('Could not read caste_certificate.pdf. Try a clearer scan or a different file.');
      return doc(file.name);
    });
    const out = await readFiles(deps);
    expect(out.failures).toEqual({ caste_certificate: 'Could not read caste_certificate.pdf. Try a clearer scan or a different file.' });
    expect(Object.keys(out.documents)).toEqual(['aadhaar', 'income_certificate']);
    expect(out.stopped).toBe(false);
    expect(done.find(([s]) => s === 'caste_certificate')?.[1]).toMatch(/Could not read/);
  });

  it('stops the batch when Gemini stays rate-limited, keeping what was already read', async () => {
    const { deps, extract } = setup();
    extract.mockImplementation(async (file: File) => {
      if (file.name.startsWith('caste')) throw new RateLimitError('Gemini is still busy');
      return doc(file.name);
    });
    const out = await readFiles(deps);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(out.stopped).toBe(true);
    expect(Object.keys(out.documents)).toEqual(['aadhaar']);
    expect(out.failures.caste_certificate).toBe('Gemini is still busy');
  });

  it('turns an unknown error into a safe message', async () => {
    const { deps, extract } = setup({}, ['aadhaar']);
    extract.mockRejectedValue(new Error('internal detail 1234 5678 9012'));
    const out = await readFiles(deps);
    expect(out.failures.aadhaar).toBe('Could not read aadhaar.pdf.');
  });

  it('lets "live reading unavailable" through so the screen can explain it', async () => {
    const { deps, extract } = setup();
    extract.mockRejectedValue(new UnavailableError());
    await expect(readFiles(deps)).rejects.toBeInstanceOf(UnavailableError);
  });

  it('shows the busy countdown through onProgress and goes back to the file name', async () => {
    const { deps, extract, progress } = setup({}, ['aadhaar']);
    extract.mockImplementation(async (file: File, options) => {
      options.onBusy?.(10);
      options.onBusy?.(0);
      return doc(file.name);
    });
    await readFiles(deps);
    expect(progress.map((p) => p.detail)).toEqual(['aadhaar.pdf', 'Gemini is busy, retrying in 10s…', 'aadhaar.pdf']);
  });
});

describe('readFiles: cancelling', () => {
  it('stops without recording results when the run is cancelled during the pause', async () => {
    let cancelled = false;
    const { deps, extract } = setup({ isCancelled: () => cancelled, pause: async () => void (cancelled = true) });
    const out = await readFiles(deps);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(out.stopped).toBe(true);
  });

  it('ignores a result that arrives after cancelling', async () => {
    let cancelled = false;
    const { deps, extract, cache } = setup({ isCancelled: () => cancelled });
    extract.mockImplementation(async (file: File) => {
      cancelled = true;
      return doc(file.name);
    });
    const out = await readFiles(deps);
    expect(out.stopped).toBe(true);
    expect(cache.size).toBe(0);
  });

  it('ignores a failure that arrives after cancelling', async () => {
    let cancelled = false;
    const { deps, extract } = setup({ isCancelled: () => cancelled });
    extract.mockImplementation(async () => {
      cancelled = true;
      throw new ExtractionError('late');
    });
    const out = await readFiles(deps);
    expect(out.failures).toEqual({});
    expect(out.stopped).toBe(true);
  });

  it('does not report busy countdowns once cancelled', async () => {
    let cancelled = false;
    const { deps, extract, progress } = setup({ isCancelled: () => cancelled }, ['aadhaar']);
    extract.mockImplementation(async (file: File, options) => {
      cancelled = true;
      options.onBusy?.(5);
      return doc(file.name);
    });
    await readFiles(deps);
    expect(progress.some((p) => p.detail.includes('busy'))).toBe(false);
  });
});

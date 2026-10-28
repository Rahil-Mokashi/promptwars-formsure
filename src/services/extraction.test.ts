import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtractionError, RateLimitError } from '../core/errors';
import { MARKSHEET_JSON, pngFile, tooManyRequests } from '../test/files';
import { extractDocument, isRateLimit, isTimeout, type Generate } from './extraction';

const noSleep = { sleep: () => Promise.resolve(undefined) };
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('extractDocument: reading a document', () => {
  it('returns the validated document', async () => {
    const doc = await extractDocument(() => Promise.resolve(MARKSHEET_JSON), pngFile());
    expect(doc.applicantName?.english).toBe('Aarav Sunil Patil');
  });

  it('sends the file as base64 with its MIME type and the instruction', async () => {
    const generate = vi.fn<Generate>().mockResolvedValue(MARKSHEET_JSON);
    await extractDocument(generate, pngFile());
    const request = generate.mock.calls[0]?.[0];
    expect(request?.mimeType).toBe('image/png');
    expect(request?.data).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(request?.prompt).toContain('Return JSON');
  });

  it('masks a 12-digit number in the model output', async () => {
    const leaky = JSON.stringify({ ...JSON.parse(MARKSHEET_JSON), issuingAuthority: 'ID 1234 5678 9012 UIDAI' });
    const doc = await extractDocument(() => Promise.resolve(leaky), pngFile());
    expect(doc.issuingAuthority).toBe('ID XXXX XXXX 9012 UIDAI');
  });

  it('does not call the model for an invalid file', async () => {
    const generate = vi.fn<Generate>();
    await expect(extractDocument(generate, new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toBeInstanceOf(
      ExtractionError,
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it('asks the rate limiter before every call, retries included', async () => {
    quiet();
    const beforeRequest = vi.fn(() => Promise.resolve(undefined));
    const generate = vi.fn<Generate>().mockRejectedValueOnce(tooManyRequests()).mockResolvedValueOnce(MARKSHEET_JSON);
    await extractDocument(generate, pngFile(), { ...noSleep, beforeRequest });
    expect(beforeRequest).toHaveBeenCalledTimes(2);
  });
});

describe('extractDocument: failures that must not be retried', () => {
  it.each([
    ['bad JSON', 'not json'],
    ['a schema mismatch', '{"documentTypes":"x"}'],
  ])('does not retry %s (that would only waste quota)', async (_name, answer) => {
    quiet();
    const generate = vi.fn<Generate>().mockResolvedValue(answer);
    const err = await extractDocument(generate, pngFile('scan.png'), noSleep).catch((e: unknown) => e);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(ExtractionError);
    expect((err as Error).message).toBe('Could not read scan.png. Try a clearer scan or a different file.');
  });

  it('does not retry other errors, such as a 401, and logs only the error name, never the provider message', async () => {
    const spy = quiet();
    const generate = vi
      .fn<Generate>()
      .mockRejectedValue(new Error('Firebase App Check token is invalid, id 1234 5678 9012'));
    await expect(extractDocument(generate, pngFile(), noSleep)).rejects.toBeInstanceOf(ExtractionError);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Gemini request failed:', 'Error');
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/App Check|1234/);
  });

  it('never logs the file content or the request', async () => {
    const spy = quiet();
    await extractDocument(vi.fn<Generate>().mockRejectedValue(new Error('boom')), pngFile(), noSleep).catch(
      () => undefined,
    );
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/prompt|data|base64/i);
  });
});

describe('extractDocument: timeouts', () => {
  it('retries a timeout once, then succeeds', async () => {
    quiet();
    const generate = vi
      .fn<Generate>()
      .mockRejectedValueOnce(new Error('Request timed out'))
      .mockResolvedValueOnce(MARKSHEET_JSON);
    await expect(extractDocument(generate, pngFile(), noSleep)).resolves.toBeTruthy();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('retries a timeout only once, then fails with a friendly typed error', async () => {
    quiet();
    const generate = vi.fn<Generate>().mockRejectedValue(new Error('timeout'));
    const err = await extractDocument(generate, pngFile(), noSleep).catch((e: unknown) => e);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(ExtractionError);
    expect(err).not.toBeInstanceOf(RateLimitError);
  });

  it('recognises timeouts by name and by message', () => {
    expect(isTimeout(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isTimeout(new Error('deadline exceeded'))).toBe(true);
    expect(isTimeout(new Error('bad request'))).toBe(false);
    expect(isTimeout(null)).toBe(false);
  });
});

describe('extractDocument: 429 backoff', () => {
  it('recognises 429, RESOURCE_EXHAUSTED and quota errors, and nothing else', () => {
    expect(isRateLimit(tooManyRequests())).toBe(true);
    expect(isRateLimit({ customErrorData: { status: 429 } })).toBe(true);
    expect(isRateLimit(new Error('RESOURCE_EXHAUSTED: try later'))).toBe(true);
    expect(isRateLimit(new Error('You exceeded your current quota'))).toBe(true);
    expect(isRateLimit(new Error('Too Many Requests'))).toBe(true);
    expect(isRateLimit(new Error('bad request 4290'))).toBe(false);
    expect(isRateLimit(new Error('Firebase App Check token is invalid'))).toBe(false);
    expect(isRateLimit(null)).toBe(false);
  });

  it('waits 10 s then 20 s, retries, and reports the countdown for the screen', async () => {
    const spy = quiet();
    const generate = vi
      .fn<Generate>()
      .mockRejectedValueOnce(tooManyRequests())
      .mockRejectedValueOnce(tooManyRequests())
      .mockResolvedValueOnce(MARKSHEET_JSON);
    const sleeps: number[] = [];
    const busy: number[] = [];
    const doc = await extractDocument(generate, pngFile(), {
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      onBusy: (s) => busy.push(s),
    });

    expect(doc.applicantName?.english).toBe('Aarav Sunil Patil');
    expect(generate).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(30);
    expect(sleeps.every((ms) => ms === 1000)).toBe(true);
    expect(busy).toEqual([
      ...Array.from({ length: 10 }, (_, i) => 10 - i),
      0,
      ...Array.from({ length: 20 }, (_, i) => 20 - i),
      0,
    ]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('backs off 10 s, 20 s, 40 s and then gives up with a RateLimitError, not a read failure', async () => {
    quiet();
    const generate = vi.fn<Generate>().mockRejectedValue(tooManyRequests());
    const starts: number[] = [];
    let current = 0;
    const err = await extractDocument(generate, pngFile(), {
      sleep: () => Promise.resolve(undefined),
      onBusy: (s) => {
        if (s > current) starts.push(s);
        current = s;
      },
    }).catch((e: unknown) => e);

    expect(generate).toHaveBeenCalledTimes(4);
    expect(starts).toEqual([10, 20, 40]);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as Error).message).toMatch(/Gemini is still busy/);
    expect((err as Error).message).not.toMatch(/Could not read/);
  });

  it('a 429 does not use up the timeout retry', async () => {
    quiet();
    const generate = vi
      .fn<Generate>()
      .mockRejectedValueOnce(tooManyRequests())
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(MARKSHEET_JSON);
    await expect(extractDocument(generate, pngFile(), noSleep)).resolves.toBeTruthy();
  });

  it('a schema error after a 429 is not retried', async () => {
    quiet();
    const generate = vi.fn<Generate>().mockRejectedValueOnce(tooManyRequests()).mockResolvedValueOnce('{"bad":true}');
    await expect(extractDocument(generate, pngFile(), noSleep)).rejects.toBeInstanceOf(ExtractionError);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('really waits when no sleep is injected', async () => {
    vi.useFakeTimers();
    quiet();
    const generate = vi.fn<Generate>().mockRejectedValueOnce(tooManyRequests()).mockResolvedValueOnce(MARKSHEET_JSON);
    const done = extractDocument(generate, pngFile());
    await vi.advanceTimersByTimeAsync(9_000);
    expect(generate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(done).resolves.toBeTruthy();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});

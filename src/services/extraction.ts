import { RATE_LIMIT_BACKOFF_SECONDS, SECOND_MS, TIMEOUT_RETRIES } from '../core/constants';
import { ExtractionError, RateLimitError } from '../core/errors';
import { extractedSchema } from '../core/extractSchema';
import { validateFile } from '../core/fileValidation';
import { describeError, maskDeep } from '../core/mask';
import type { ExtractedDocument } from '../core/types';
import { EXTRACTION_PROMPT } from './prompt';
import { sleep as realSleep } from './sleep';

/** One request to the model: the file as base64 plus the instruction. */
export interface GenerateRequest {
  mimeType: string;
  /** base64, no data: prefix */
  data: string;
  prompt: string;
}

/** Returns the model's raw JSON text. Injected so tests can mock Firebase AI. */
export type Generate = (req: GenerateRequest) => Promise<string>;

/** Options for {@link extractDocument}. */
export interface ExtractOptions {
  /** Called every second while waiting to retry after a 429 (seconds left), and with 0 when the wait is over. */
  onBusy?: (secondsLeft: number) => void;
  /** Runs before every model call (including retries), for example a rate limiter. */
  beforeRequest?: () => Promise<void>;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** True for 429 / RESOURCE_EXHAUSTED / quota errors from Firebase AI Logic (free-tier limits). */
export function isRateLimit(err: unknown): boolean {
  const e = err as { status?: unknown; code?: unknown; message?: unknown; customErrorData?: { status?: unknown } } | null;
  if (e?.status === 429 || e?.customErrorData?.status === 429) return true;
  return /\b429\b|RESOURCE_EXHAUSTED|too many requests|quota/i.test(`${String(e?.code ?? '')} ${String(e?.message ?? '')}`);
}

/** True for request timeouts and aborted requests. */
export function isTimeout(err: unknown): boolean {
  const e = err as { name?: unknown; message?: unknown } | null;
  return e?.name === 'AbortError' || e?.name === 'TimeoutError' || /timeout|timed out|deadline/i.test(String(e?.message ?? ''));
}

const toBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });

const unreadable = (file: File) => new ExtractionError(`Could not read ${file.name}. Try a clearer scan or a different file.`);

/** Counts down `seconds`, reporting each second through `onBusy`. */
async function waitWithCountdown(seconds: number, options: ExtractOptions): Promise<void> {
  const sleep = options.sleep ?? realSleep;
  for (let left = seconds; left > 0; left--) {
    options.onBusy?.(left);
    await sleep(SECOND_MS);
  }
  options.onBusy?.(0);
}

/**
 * Reads one document with the model.
 * - 429 / RESOURCE_EXHAUSTED / quota: not a read failure. Waits 10 s, 20 s, 40 s and retries, reporting the countdown.
 * - Timeout: retried once.
 * - Bad JSON or a schema mismatch: never retried (it would only burn quota).
 * The cause is logged with `console.error` (masked, without document content).
 * @throws {ExtractionError} the file or the answer is unusable
 * @throws {RateLimitError} still rate-limited after every backoff
 */
export async function extractDocument(generate: Generate, file: File, options: ExtractOptions = {}): Promise<ExtractedDocument> {
  const problem = validateFile(file);
  if (problem) throw new ExtractionError(problem);
  const data = await toBase64(file);

  let rateLimitRetries = 0;
  let timeoutRetries = 0;
  for (;;) {
    let text: string;
    try {
      await options.beforeRequest?.();
      text = await generate({ mimeType: file.type, data, prompt: EXTRACTION_PROMPT });
    } catch (err) {
      console.error('Gemini request failed:', describeError(err));
      if (isRateLimit(err)) {
        const wait = RATE_LIMIT_BACKOFF_SECONDS[rateLimitRetries++];
        if (wait === undefined) throw new RateLimitError('Gemini is still busy (free-tier limit). Wait a minute, then try again.');
        await waitWithCountdown(wait, options);
        continue;
      }
      if (isTimeout(err) && timeoutRetries++ < TIMEOUT_RETRIES) continue;
      throw unreadable(file);
    }
    try {
      return maskDeep(extractedSchema.parse(JSON.parse(text)));
    } catch (err) {
      console.error('Gemini returned unusable JSON:', describeError(err));
      throw unreadable(file);
    }
  }
}

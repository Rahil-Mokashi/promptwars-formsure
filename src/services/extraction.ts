import { MAX_PDF_PAGES, RATE_LIMIT_BACKOFF_SECONDS, SECOND_MS, TIMEOUT_RETRIES } from '../core/constants';
import { ExtractionError, RateLimitError } from '../core/errors';
import { extractedSchema } from '../core/extractSchema';
import { validateUpload } from '../core/fileValidation';
import { describeError, maskAadhaar, maskDeep } from '../core/mask';
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
  const e = err as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    customErrorData?: { status?: unknown };
  } | null;
  if (e?.status === 429 || e?.customErrorData?.status === 429) return true;
  return /\b429\b|RESOURCE_EXHAUSTED|too many requests|quota/i.test(`${text(e?.code)} ${text(e?.message)}`);
}

/** The value if it is a string, else an empty string. */
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** True for request timeouts and aborted requests. */
export function isTimeout(err: unknown): boolean {
  const e = err as { name?: unknown; message?: unknown } | null;
  return e?.name === 'AbortError' || e?.name === 'TimeoutError' || /timeout|timed out|deadline/i.test(text(e?.message));
}

const toBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(text(reader.result).split(',')[1] ?? '');
    };
    reader.onerror = () => {
      reject(new Error('Could not read the file'));
    };
    reader.readAsDataURL(file);
  });

const unreadable = (file: File): ExtractionError =>
  new ExtractionError(`Could not read ${maskAadhaar(file.name)}. Try a clearer scan or a different file.`);

/** Retries used so far for one document. */
interface Retries {
  rateLimit: number;
  timeout: number;
}

/** What to do after a failed model call. */
type Decision = { action: 'wait'; seconds: number } | { action: 'again' } | { action: 'fail'; error: Error };

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
 * Decides how to react to a failed call and counts the retry it uses. A 429 backs off 10 s, 20 s, 40 s and then gives
 * up; a timeout is retried once; anything else fails. The cause is logged without document content.
 */
function classify(err: unknown, file: File, retries: Retries): Decision {
  if (err instanceof RateLimitError) return { action: 'fail', error: err }; // the local daily cap: never retry
  console.error('Gemini request failed:', describeError(err));
  if (isRateLimit(err)) {
    const seconds = RATE_LIMIT_BACKOFF_SECONDS[retries.rateLimit++];
    if (seconds !== undefined) return { action: 'wait', seconds };
    return {
      action: 'fail',
      error: new RateLimitError('Gemini is still busy (free-tier limit). Wait a minute, then try again.'),
    };
  }
  if (isTimeout(err) && retries.timeout++ < TIMEOUT_RETRIES) return { action: 'again' };
  return { action: 'fail', error: unreadable(file) };
}

/** One model call, after the rate limiter has agreed to it. */
async function callModel(generate: Generate, file: File, data: string, options: ExtractOptions): Promise<string> {
  await options.beforeRequest?.();
  return generate({ mimeType: file.type, data, prompt: EXTRACTION_PROMPT });
}

/** The result of one attempt: the model's text, or what to do before trying again. */
type Attempt = { text: string } | { decision: Exclude<Decision, { action: 'fail' }> };

/** Calls the model once. A failure is classified; only retryable ones come back, the rest are thrown. */
async function attempt(
  generate: Generate,
  file: File,
  data: string,
  options: ExtractOptions,
  retries: Retries,
): Promise<Attempt> {
  try {
    return { text: await callModel(generate, file, data, options) };
  } catch (err) {
    const decision = classify(err, file, retries);
    if (decision.action === 'fail') throw decision.error;
    return { decision };
  }
}

/** Parses and validates the model's answer. Bad JSON or a schema mismatch is never retried: it would only burn quota. */
function parseAnswer(text: string, file: File): ExtractedDocument {
  try {
    const doc = maskDeep(extractedSchema.parse(JSON.parse(text)));
    if (file.type === 'application/pdf' && doc.pageCount > MAX_PDF_PAGES) {
      throw new ExtractionError(`${maskAadhaar(file.name)}: the PDF has more than ${MAX_PDF_PAGES} pages.`);
    }
    return doc;
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    console.error('Gemini returned unusable JSON:', describeError(err));
    throw unreadable(file);
  }
}

/**
 * Reads one document with the model: check the file, encode it, call, and parse the answer.
 * Retries only on a 429 (with countdown) or a timeout; the cause of each failure is logged without document content.
 * @throws {ExtractionError} the file or the answer is unusable
 * @throws {RateLimitError} still rate-limited after every backoff
 */
export async function extractDocument(
  generate: Generate,
  file: File,
  options: ExtractOptions = {},
): Promise<ExtractedDocument> {
  const problem = await validateUpload(file);
  if (problem) throw new ExtractionError(problem);
  const data = await toBase64(file);
  const retries: Retries = { rateLimit: 0, timeout: 0 };
  for (;;) {
    const result = await attempt(generate, file, data, options, retries);
    if ('text' in result) return parseAnswer(result.text, file);
    if (result.decision.action === 'wait') await waitWithCountdown(result.decision.seconds, options);
  }
}

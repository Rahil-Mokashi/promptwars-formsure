/** Matches a 12-digit number (Aadhaar) written plainly, with spaces or with dashes. */
const TWELVE_DIGITS = /(?<!\d)(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?!\d)/g;

/** Masks any 12-digit number so only the last four digits are ever displayed: `XXXX XXXX 1234`. */
export const maskAadhaar = (text: string): string => text.replace(TWELVE_DIGITS, 'XXXX XXXX $3');

/** Masks every string inside a JSON-serialisable value. */
export const maskDeep = <T>(value: T): T => JSON.parse(maskAadhaar(JSON.stringify(value))) as T;

/**
 * One-line, log-safe description of an error: its name, HTTP status and error code. It never includes the provider's
 * message, the request, the document or the model's answer, because any of those can contain personal data.
 */
export function describeError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'unknown error';
  const e = err as { name?: unknown; status?: unknown; code?: unknown; customErrorData?: { status?: unknown } };
  const parts = [typeof e.name === 'string' ? e.name : 'Error'];
  const status = typeof e.status === 'number' ? e.status : e.customErrorData?.status;
  if (typeof status === 'number') parts.push(`status ${status}`);
  if (typeof e.code === 'string') parts.push(`code ${maskAadhaar(e.code).slice(0, 60)}`);
  return parts.join(' ');
}

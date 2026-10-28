/** Matches a 12-digit number (Aadhaar) written plainly, with spaces or with dashes. */
const TWELVE_DIGITS = /(?<!\d)(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?!\d)/g;

/** Masks any 12-digit number so only the last four digits are ever displayed: `XXXX XXXX 1234`. */
export const maskAadhaar = (text: string): string => text.replace(TWELVE_DIGITS, 'XXXX XXXX $3');

/** Masks every string inside a JSON-serialisable value. */
export const maskDeep = <T>(value: T): T => JSON.parse(maskAadhaar(JSON.stringify(value))) as T;

/**
 * One-line, log-safe description of an error: its name, HTTP status when present and a masked message.
 * Never includes request or document content.
 */
export function describeError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'unknown error';
  const e = err as { name?: unknown; status?: unknown; message?: unknown };
  const parts = [typeof e.name === 'string' ? e.name : 'Error'];
  if (typeof e.status === 'number') parts.push(String(e.status));
  const message = typeof e.message === 'string' ? maskAadhaar(e.message).slice(0, 300) : '';
  return `${parts.join(' ')}: ${message}`;
}

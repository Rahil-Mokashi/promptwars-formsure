import { phonetic } from './names';

/** Result of comparing the name on a document with the name on the form. */
export type NameVerdict = 'match' | 'review' | 'mismatch';

/** Characters that separate or decorate name parts and carry no meaning: dots, commas, apostrophes, hyphens. */
const PUNCTUATION = /[.,'’`´\-_/\\]+/g;
/** Zero-width and directional marks that copy-and-paste or OCR can leave inside a name. */
const codePoints = (from: number, to: number): string => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`;
const INVISIBLE = new RegExp(`[${codePoints(0x200b, 0x200f)}${codePoints(0x202a, 0x202e)}${String.fromCharCode(0x2060, 0xfeff)}]`, 'g');

/**
 * Splits a name into comparable parts: Unicode NFC, lower case, punctuation and invisible marks removed,
 * whitespace collapsed. The original text is never changed; this is only for comparing.
 */
export function nameTokens(name: string): string[] {
  return name.normalize('NFC').replace(INVISIBLE, '').replace(PUNCTUATION, ' ').toLowerCase().split(/\s+/).filter(Boolean);
}

const sameLetters = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ');

/** True when one part is a single letter that starts the other (an initial). */
const isInitialOf = (a: string, b: string): boolean => (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

/** Same number of parts; each pair is equal or an initial of the other; at least one pair is an initial. */
const matchesWithInitials = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((t, i) => t === b[i] || isInitialOf(t, b[i] ?? '')) && a.some((t, i) => t !== b[i]);

/**
 * Compares a document's name with the form's name. There is no fuzzy auto-pass.
 * - identical after normalisation: `match`
 * - same parts in a different order, or initials in place of full parts: `review` (a person decides)
 * - anything else: `mismatch`
 * @param phoneticKey compare a phonetic key of each part (for the English transliteration of Devanagari names)
 */
export function compareNames(documentName: string, formName: string, phoneticKey: boolean): NameVerdict {
  const prepare = (n: string): string[] => (phoneticKey ? nameTokens(n).map(phonetic) : nameTokens(n));
  const doc = prepare(documentName);
  const form = prepare(formName);
  if (doc.length === 0 || form.length === 0) return 'mismatch';
  if (doc.length === form.length && doc.every((t, i) => t === form[i])) return 'match';
  if (sameLetters(doc, form) || matchesWithInitials(doc, form)) return 'review';
  return 'mismatch';
}

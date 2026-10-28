/** Lower-cases and collapses whitespace, so `"AARAV  patil "` equals `"aarav patil"`. */
const normaliseName = (name: string): string => name.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Phonetic key for the English transliteration of a Marathi or Hindi name:
 * `aa→a`, `ee→i`, `oo→u`, `w→v`. Transliterations of the same name often differ only in these.
 */
export const phonetic = (name: string): string =>
  normaliseName(name).replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/w/g, 'v');

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** Replaces ASCII digits with Devanagari digits (`2026` becomes `२०२६`). */
export const toDevanagari = (text: string): string => text.replace(/\d/g, (d) => DEVANAGARI_DIGITS[Number(d)] ?? d);

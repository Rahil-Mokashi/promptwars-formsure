import { z } from 'zod';
import type { ExtractedDocument } from './types';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
export const UNAVAILABLE_MESSAGE = 'Live reading unavailable, try the sample applicant';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Validates whatever Gemini returns: the model reads, this schema decides what is acceptable. */
export const extractedSchema = z.object({
  documentTypes: z.array(
    z
      .enum([
        'aadhaar', 'caste_certificate', 'income_certificate', 'non_creamy_layer',
        'domicile_certificate', 'bonafide_certificate', 'marksheet', 'bank_passbook', 'other',
      ])
      .catch('other'),
  ),
  language: z.enum(['en', 'mr', 'hi', 'other']).catch('other'),
  applicantName: z.object({ original: z.string().max(200), english: z.string().max(200) }).nullable(),
  dateOfBirth: isoDate.nullable().catch(null),
  issueDate: isoDate.nullable().catch(null),
  issuingAuthority: z.string().max(200).nullable(),
  category: z.string().max(40).nullable(),
  annualIncome: z.number().nonnegative().nullable().catch(null),
  pageCount: z.number().int().min(1).max(500),
  legible: z.boolean(),
}) satisfies z.ZodType<ExtractedDocument>;

/** Mask any 12-digit number (Aadhaar) so only the last four digits are ever displayed. */
export const maskAadhaar = (text: string): string =>
  text.replace(/(?<!\d)(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?!\d)/g, 'XXXX XXXX $3');

/** Masks every string inside a JSON-serialisable value. */
export const maskDeep = <T>(value: T): T => JSON.parse(maskAadhaar(JSON.stringify(value))) as T;

/** Browser-side file check, before anything leaves the device. Returns an error message or null. */
export function validateFile(file: { type: string; size: number; name: string }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: use a PNG, JPG, WebP or PDF file.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: the file is larger than 5 MB.`;
  if (file.size === 0) return `${file.name}: the file is empty.`;
  return null;
}

export const PROMPT = `You are reading one document uploaded for a Maharashtra (MahaDBT) scholarship application.
Only read what is printed; never guess, never judge whether the document is acceptable.
Return JSON with:
- documentTypes: every kind of document contained in the file, each one of: aadhaar, caste_certificate, income_certificate, non_creamy_layer, domicile_certificate, bonafide_certificate, marksheet, bank_passbook, other. A PDF may contain several.
- language: main language of the text: en, mr, hi or other.
- applicantName: the applicant's name exactly as printed (original) and its English transliteration (english, Latin letters, "Firstname Middlename Surname"). null if absent.
- dateOfBirth and issueDate as YYYY-MM-DD (convert from DD/MM/YYYY and from Devanagari digits), null if absent.
- issuingAuthority, category (for example OBC, SBC, VJNT, SC, ST, Open), annualIncome in rupees as a number, null if absent.
- pageCount: number of pages.
- legible: false if the scan is too blurry or cropped to read reliably.`;

export interface GenerateRequest {
  mimeType: string;
  /** base64, no data: prefix */
  data: string;
  prompt: string;
}
/** Returns the model's raw JSON text. Injected so tests can mock Firebase AI. */
export type Generate = (req: GenerateRequest) => Promise<string>;

export class UnavailableError extends Error {
  constructor() {
    super(UNAVAILABLE_MESSAGE);
  }
}
export class ExtractionError extends Error {}

const toBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });

/** Reads one document. One retry on bad JSON, schema mismatch or timeout, then a typed error. */
export async function extractDocument(generate: Generate, file: File): Promise<ExtractedDocument> {
  const problem = validateFile(file);
  if (problem) throw new ExtractionError(problem);
  const data = await toBase64(file);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await generate({ mimeType: file.type, data, prompt: PROMPT });
      return maskDeep(extractedSchema.parse(JSON.parse(text)));
    } catch (err) {
      lastError = err;
    }
  }
  void lastError;
  throw new ExtractionError(`Could not read ${file.name}. Try a clearer scan or a different file.`);
}

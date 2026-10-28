import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import type { ExtractedDocument } from '../../shared/types';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 30_000;

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

const nullableString = { type: Type.STRING, nullable: true } as const;
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    documentTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
    language: { type: Type.STRING },
    applicantName: {
      type: Type.OBJECT,
      nullable: true,
      properties: { original: { type: Type.STRING }, english: { type: Type.STRING } },
      required: ['original', 'english'],
    },
    dateOfBirth: nullableString,
    issueDate: nullableString,
    issuingAuthority: nullableString,
    category: nullableString,
    annualIncome: { type: Type.NUMBER, nullable: true },
    pageCount: { type: Type.INTEGER },
    legible: { type: Type.BOOLEAN },
  },
  required: ['documentTypes', 'language', 'applicantName', 'dateOfBirth', 'issueDate', 'issuingAuthority', 'category', 'annualIncome', 'pageCount', 'legible'],
};

const PROMPT = `You are reading one document uploaded for a Maharashtra (MahaDBT) scholarship application.
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
  data: Buffer;
  prompt: string;
}
/** Returns Gemini's raw JSON text. Injected so tests can mock it. */
export type Generate = (req: GenerateRequest) => Promise<string>;

export class NotConfiguredError extends Error {}
export class ExtractionError extends Error {}

export function createGeminiGenerate(apiKey: string, model: string): Generate {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ mimeType, data, prompt }) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: data.toString('base64') } }, { text: prompt }] }],
        config: { responseMimeType: 'application/json', responseSchema, temperature: 0, abortSignal: ctrl.signal },
      });
      return res.text ?? '';
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Reads one document. One retry on bad JSON, schema mismatch or timeout, then a typed error. */
export async function extractDocument(generate: Generate, file: { mimeType: string; data: Buffer }): Promise<ExtractedDocument> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await generate({ ...file, prompt: PROMPT });
      return extractedSchema.parse(JSON.parse(text));
    } catch (err) {
      lastError = err;
    }
  }
  throw new ExtractionError(`Could not read this document (${lastError instanceof Error ? lastError.name : 'error'}). Try a clearer scan.`);
}

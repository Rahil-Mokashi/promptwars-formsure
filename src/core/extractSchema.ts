import './zodConfig';
import { z } from 'zod';
import type { ExtractedDocument } from './types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const DOCUMENT_TYPES = [
  'aadhaar', 'caste_certificate', 'income_certificate', 'non_creamy_layer',
  'domicile_certificate', 'bonafide_certificate', 'marksheet', 'bank_passbook', 'other',
] as const;

const MAX_TEXT = 200;
const MAX_CATEGORY = 40;
const MAX_PAGES = 500;

/**
 * Validates whatever Gemini returns. The model reads; this schema decides what is acceptable:
 * unknown document types and dates become safe defaults, wrong shapes are rejected.
 */
export const extractedSchema = z.object({
  documentTypes: z.array(z.enum(DOCUMENT_TYPES).catch('other')),
  language: z.enum(['en', 'mr', 'hi', 'other']).catch('other'),
  applicantName: z.object({ original: z.string().max(MAX_TEXT), english: z.string().max(MAX_TEXT) }).nullable(),
  dateOfBirth: isoDate.nullable().catch(null),
  issueDate: isoDate.nullable().catch(null),
  issuingAuthority: z.string().max(MAX_TEXT).nullable(),
  category: z.string().max(MAX_CATEGORY).nullable(),
  annualIncome: z.number().nonnegative().nullable().catch(null),
  pageCount: z.number().int().min(1).max(MAX_PAGES),
  legible: z.boolean(),
}) satisfies z.ZodType<ExtractedDocument>;

import './zodConfig';
import { z } from 'zod';
import { isRealDate } from './dates';
import type { ExtractedDocument } from './types';

/** A real calendar date: `2026-99-99` and `2025-02-29` are rejected, which makes the field null (needs review). */
const isoDate = z.string().refine(isRealDate);

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

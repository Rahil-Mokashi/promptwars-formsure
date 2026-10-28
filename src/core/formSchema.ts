import './zodConfig';
import { z } from 'zod';
import { FIRST_BIRTH_YEAR, NAME_MAX_LENGTH } from './constants';
import { isRealDate } from './dates';
import type { ApplicationForm } from './types';

/** Categories the OBC scheme accepts. */
export const CATEGORIES = ['OBC', 'SBC', 'VJNT'] as const;
/** Application types on the MahaDBT form. */
export const APPLICATION_TYPES = ['Fresh', 'Renewal'] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date of birth as day, month and year.')
  .refine(isRealDate, 'Enter a real date.')
  .refine((s) => Number(s.slice(0, 4)) >= FIRST_BIRTH_YEAR, `Enter a date of birth from ${FIRST_BIRTH_YEAR} or later.`);

/** Letters in any script, combining marks, spaces and the punctuation names use. */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

/** Builds the Zod schema for the details the applicant types. Trims text, caps lengths, and limits the category to the scheme's. */
export function formSchemaFor(categories: readonly string[]) {
  return z.object({
    fullName: z
      .string()
      .trim()
      .min(1, 'Enter your full name.')
      .max(NAME_MAX_LENGTH, `Use at most ${NAME_MAX_LENGTH} characters.`)
      .regex(NAME_PATTERN, 'Use letters only, as on your documents.'),
    dateOfBirth: isoDate,
    category: z.string().refine((c) => categories.includes(c), `Choose ${categories.join(', ')}.`),
    academicYear: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Choose an academic year.'),
    applicationType: z.enum(APPLICATION_TYPES, { error: 'Choose Fresh or Renewal.' }),
  });
}

/** The schema for the OBC scheme (kept for callers that do not choose a scheme). */
export const applicationFormSchema = formSchemaFor(CATEGORIES);

/** Result of {@link validateForm}. */
export type FormValidation =
  | { ok: true; form: ApplicationForm }
  | { ok: false; errors: Partial<Record<keyof ApplicationForm, string>> };

/**
 * Validates the form before a check runs.
 * @param now used to reject a date of birth in the future
 * @param categories the categories the chosen scheme accepts
 * @returns the trimmed form, or one message per invalid field
 */
export function validateForm(form: ApplicationForm, now: Date = new Date(), categories: readonly string[] = CATEGORIES): FormValidation {
  const parsed = formSchemaFor(categories).safeParse(form);
  if (!parsed.success) {
    const errors: Partial<Record<keyof ApplicationForm, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ApplicationForm;
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  if (parsed.data.dateOfBirth > now.toISOString().slice(0, 10)) {
    return { ok: false, errors: { dateOfBirth: 'The date of birth cannot be in the future.' } };
  }
  return { ok: true, form: parsed.data };
}

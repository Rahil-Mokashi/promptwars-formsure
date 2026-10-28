import { UNAVAILABLE_MESSAGE } from '../core/constants';
import { UnavailableError } from '../core/errors';
import type { ReadOutcome } from '../services/readFiles';

/** What to tell the applicant when some files could not be read. */
export const failureMessage = (outcome: ReadOutcome): string => {
  const failures = Object.values(outcome.failures);
  const first = failures[0] ?? '';
  if (outcome.stopped && first) return `${first} Your other files are kept; use "Retry this file" below.`;
  return `${failures.length === 1 ? '1 file' : `${failures.length} files`} could not be read. Retry the file below or replace it.`;
};

/** A message safe to show for anything thrown while reading or checking. */
export const messageOf = (e: unknown): string =>
  e instanceof UnavailableError
    ? UNAVAILABLE_MESSAGE
    : e instanceof Error
      ? e.message
      : 'Something went wrong. Please try again.';

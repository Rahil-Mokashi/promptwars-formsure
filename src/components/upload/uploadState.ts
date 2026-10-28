import type { ApplicationForm } from '../../core/types';

/** What decides whether "Run FormSure check" is enabled. */
export interface RunInputs {
  /** A chosen file is still being checked. */
  validating: boolean;
  /** Sample mode: nothing to fill in. */
  isSample: boolean;
  form: ApplicationForm;
  fileCount: number;
  liveAvailable: boolean;
  consent: boolean;
}

/** True when a live applicant has typed a name and date of birth and chosen at least one file. */
export const isFilledIn = (form: ApplicationForm, fileCount: number): boolean =>
  form.fullName.trim() !== '' && form.dateOfBirth !== '' && fileCount > 0;

/**
 * Whether the check may start: the sample always can; a live check needs a filled-in form, available live reading and
 * consent, and must wait for file checks to finish.
 */
export function canRunCheck({ validating, isSample, form, fileCount, liveAvailable, consent }: RunInputs): boolean {
  if (validating) return false;
  return isSample || (isFilledIn(form, fileCount) && liveAvailable && consent);
}

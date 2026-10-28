import { describe, expect, it } from 'vitest';
import type { ApplicationForm } from '../../core/types';
import { canRunCheck, isFilledIn } from './uploadState';

const form: ApplicationForm = {
  fullName: 'Aarav Patil',
  dateOfBirth: '2006-03-14',
  category: 'OBC',
  academicYear: '2026-27',
  applicationType: 'Fresh',
};
const ready = { validating: false, isSample: false, form, fileCount: 1, liveAvailable: true, consent: true };

describe('isFilledIn', () => {
  it('needs a name, a date of birth and at least one file', () => {
    expect(isFilledIn(form, 1)).toBe(true);
    expect(isFilledIn({ ...form, fullName: '  ' }, 1)).toBe(false);
    expect(isFilledIn({ ...form, dateOfBirth: '' }, 1)).toBe(false);
    expect(isFilledIn(form, 0)).toBe(false);
  });
});

describe('canRunCheck', () => {
  it('allows a live check only when filled in, available and consented', () => {
    expect(canRunCheck(ready)).toBe(true);
    expect(canRunCheck({ ...ready, consent: false })).toBe(false);
    expect(canRunCheck({ ...ready, liveAvailable: false })).toBe(false);
    expect(canRunCheck({ ...ready, fileCount: 0 })).toBe(false);
  });
  it('always allows the sample, except while a file is being checked', () => {
    expect(canRunCheck({ ...ready, isSample: true, consent: false, fileCount: 0 })).toBe(true);
    expect(canRunCheck({ ...ready, isSample: true, validating: true })).toBe(false);
    expect(canRunCheck({ ...ready, validating: true })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { extractedSchema } from './extractSchema';
import { fyLabel, fyStartYear, isLeapYear, isRealDate, istDate, longDate, slashDate } from './dates';
import { MARKSHEET_JSON } from '../test/files';

describe('isRealDate: strict calendar dates', () => {
  it('accepts real dates, including 29 February in a leap year', () => {
    expect(isRealDate('2026-10-28')).toBe(true);
    expect(isRealDate('2024-02-29')).toBe(true);
    expect(isRealDate('2000-02-29')).toBe(true);
    expect(isRealDate('2026-12-31')).toBe(true);
  });
  it('rejects impossible dates and malformed text', () => {
    for (const bad of ['2026-99-99', '2026-00-10', '2026-13-01', '2026-04-31', '2025-02-29', '1900-02-29', '2026-02-00', '26-01-01', '2026/01/01', '2026-1-1', '', 'tomorrow']) {
      expect(isRealDate(bad), bad).toBe(false);
    }
  });
  it('follows the Gregorian leap-year rule', () => {
    expect([2024, 2000, 2028].every(isLeapYear)).toBe(true);
    expect([2025, 1900, 2100].some(isLeapYear)).toBe(false);
  });
});

describe('extraction schema turns an impossible date into null (so the rule needs review)', () => {
  const parse = (patch: object) => extractedSchema.parse({ ...JSON.parse(MARKSHEET_JSON), ...patch });
  it('keeps a real date', () => {
    expect(parse({ issueDate: '2026-04-02' }).issueDate).toBe('2026-04-02');
  });
  it('nulls 2026-99-99 and a non-leap 29 February in every date field', () => {
    expect(parse({ issueDate: '2026-99-99' }).issueDate).toBeNull();
    expect(parse({ dateOfBirth: '2025-02-29' }).dateOfBirth).toBeNull();
  });
});

describe('financial year and formatting helpers', () => {
  it('computes the financial year a date falls in', () => {
    expect(fyStartYear('2026-03-31')).toBe(2025);
    expect(fyStartYear('2026-04-01')).toBe(2026);
    expect(fyLabel(2099)).toBe('2099-00');
  });
  it('formats dates', () => {
    expect(longDate('2026-01-05')).toBe('5 Jan 2026');
    expect(slashDate('2026-01-05')).toBe('05/01/2026');
  });
  it('uses India time (UTC+5:30) for today', () => {
    expect(istDate(new Date('2026-03-31T18:29:59Z'))).toBe('2026-03-31');
    expect(istDate(new Date('2026-03-31T18:30:00Z'))).toBe('2026-04-01');
  });
});

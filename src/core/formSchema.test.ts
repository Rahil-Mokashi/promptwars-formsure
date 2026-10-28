import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validateForm } from './formSchema';
import './schema';
import type { ApplicationForm } from './types';

const NOW = new Date('2026-10-28T06:00:00Z');
const good: ApplicationForm = { fullName: 'Aarav Sunil Patil', dateOfBirth: '2006-03-14', category: 'OBC', academicYear: '2026-27', applicationType: 'Fresh' };
const errorsOf = (form: Partial<ApplicationForm>) => {
  const r = validateForm({ ...good, ...form }, NOW);
  return r.ok ? {} : r.errors;
};

describe('validateForm', () => {
  it('accepts the sample applicant', () => {
    expect(validateForm(good, NOW)).toEqual({ ok: true, form: good });
  });
  it('trims the name', () => {
    const r = validateForm({ ...good, fullName: '  Aarav  Patil ' }, NOW);
    expect(r.ok && r.form.fullName).toBe('Aarav  Patil');
  });
  it('accepts Devanagari names and names with dots, hyphens and apostrophes', () => {
    expect(errorsOf({ fullName: 'आरव सुनील पाटील' })).toEqual({});
    expect(errorsOf({ fullName: "Mary-Ann O'Neil Jr." })).toEqual({});
  });
  it('rejects an empty name, digits, symbols and markup', () => {
    expect(errorsOf({ fullName: '   ' }).fullName).toBe('Enter your full name.');
    expect(errorsOf({ fullName: 'Aarav 123' }).fullName).toBe('Use letters only, as on your documents.');
    expect(errorsOf({ fullName: '<b>Aarav</b>' }).fullName).toBe('Use letters only, as on your documents.');
  });
  it('caps the name at 100 characters', () => {
    expect(errorsOf({ fullName: 'a'.repeat(100) })).toEqual({});
    expect(errorsOf({ fullName: 'a'.repeat(101) }).fullName).toBe('Use at most 100 characters.');
  });
  it('rejects bad, impossible, ancient and future dates of birth', () => {
    expect(errorsOf({ dateOfBirth: '' }).dateOfBirth).toBe('Enter the date of birth as day, month and year.');
    expect(errorsOf({ dateOfBirth: '2006-02-30' }).dateOfBirth).toBe('Enter a real date.');
    expect(errorsOf({ dateOfBirth: '1850-01-01' }).dateOfBirth).toBe('Enter a date of birth from 1900 or later.');
    expect(errorsOf({ dateOfBirth: '2030-01-01' }).dateOfBirth).toBe('The date of birth cannot be in the future.');
  });
  it('rejects an unknown category, year or application type', () => {
    expect(errorsOf({ category: 'General' }).category).toBe('Choose OBC, SBC, VJNT.');
    expect(errorsOf({ academicYear: 'next year' }).academicYear).toBe('Choose an academic year.');
    expect(errorsOf({ applicationType: 'Other' }).applicationType).toBe('Choose Fresh or Renewal.');
  });
  it('reports every invalid field at once', () => {
    expect(Object.keys(errorsOf({ fullName: '', dateOfBirth: 'x', category: 'Z' })).sort()).toEqual(['category', 'dateOfBirth', 'fullName']);
  });
});

describe('Zod runs without code generation, so the CSP needs no unsafe-eval', () => {
  it('is configured jitless once any schema module is loaded', () => {
    expect(z.config().jitless).toBe(true);
  });
});

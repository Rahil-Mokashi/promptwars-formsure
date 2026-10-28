import { describe, expect, it } from 'vitest';
import { ALL_SLOTS, audit, checkOf, fixed, patchDoc, sample, statusOf } from '../test/docs';
import { compareNames, nameTokens } from './nameMatch';

describe('nameTokens: normalisation (the original name is never changed)', () => {
  it('lower-cases, collapses spaces and strips dots, commas, apostrophes and hyphens', () => {
    expect(nameTokens("  AARAV   S. Patil, ")).toEqual(['aarav', 's', 'patil']);
    expect(nameTokens("O'Neil-Smith")).toEqual(['o', 'neil', 'smith']);
  });
  it('uses Unicode NFC so composed and decomposed forms are the same', () => {
    expect(nameTokens('Amélie')).toEqual(nameTokens('Amélie'));
  });
  it('removes zero-width marks that copy and paste can leave in a name', () => {
    expect(nameTokens('Aarav​ Patil')).toEqual(['aarav', 'patil']);
  });
});

describe('compareNames: no fuzzy auto-pass', () => {
  it('matches the same name after normalisation', () => {
    expect(compareNames('  AARAV   sunil patil ', 'Aarav Sunil Patil', false)).toBe('match');
    expect(compareNames('Aarav S. Patil', 'Aarav S Patil', false)).toBe('match');
  });
  it('sends name-order swaps to review, never pass or fail', () => {
    expect(compareNames('Patil Aarav Sunil', 'Aarav Sunil Patil', false)).toBe('review');
  });
  it('sends initials to review', () => {
    expect(compareNames('A. S. Patil', 'Aarav Sunil Patil', false)).toBe('review');
    expect(compareNames('Aarav S Patil', 'Aarav Sunil Patil', false)).toBe('review');
  });
  it('fails a different spelling, a different name and a missing middle name', () => {
    expect(compareNames('Arav Sunil Patil', 'Aarav Sunil Patil', false)).toBe('mismatch');
    expect(compareNames('Rohan Sunil Patil', 'Aarav Sunil Patil', false)).toBe('mismatch');
    expect(compareNames('Aarav Patil', 'Aarav Sunil Patil', false)).toBe('mismatch');
  });
  it('an empty name is a mismatch', () => {
    expect(compareNames('', 'Aarav', false)).toBe('mismatch');
    expect(compareNames('Aarav', '  ', false)).toBe('mismatch');
  });
  it('compares a phonetic key of Devanagari transliterations: aa, ee, oo and w are not differences', () => {
    expect(compareNames('Arav Sunil Patil', 'Aarav Sunil Patil', true)).toBe('match');
    expect(compareNames('Dipak Wagh', 'Deepak Vagh', true)).toBe('match');
    expect(compareNames('Rohan Sunil Patil', 'Aarav Sunil Patil', true)).toBe('mismatch');
  });
  it('a swapped order is still review under the phonetic key', () => {
    expect(compareNames('Patil Arav', 'Aarav Patil', true)).toBe('review');
  });
});

describe('name rule across every required document', () => {
  it('an unreadable name on ANY of the seven documents needs review', () => {
    for (const slot of ALL_SLOTS) {
      expect(statusOf(patchDoc(fixed, slot, { applicantName: null }), 'name-match'), slot).toBe('needs_review');
    }
  });
  it('a clearly wrong name on any one document fails, even if others are unreadable', () => {
    const docs = patchDoc(patchDoc(fixed, 'bonafide', { applicantName: { original: 'Rohan Patil', english: 'Rohan Patil' } }), 'domicile', { applicantName: null });
    expect(statusOf(docs, 'name-match')).toBe('fail');
    expect(checkOf(audit(docs), 'name-match').evidence?.document).toBe('Bonafide');
  });
  it('swapped order or initials on a document needs review and keeps the original value in the evidence', () => {
    const swapped = patchDoc(fixed, 'marksheet', { applicantName: { original: 'Patil Aarav Sunil', english: 'Patil Aarav Sunil' } });
    const result = checkOf(audit(swapped), 'name-match');
    expect(result.status).toBe('needs_review');
    expect(result.evidence).toMatchObject({ document: 'Marksheet', found: 'Patil Aarav Sunil', needed: sample.form.fullName });
  });
  it('a Devanagari document passes on the phonetic key of its transliteration', () => {
    const docs = patchDoc(fixed, 'income_certificate', { applicantName: { original: 'आरव सुनील पाटील', english: 'Arav Sunil Patil' } });
    expect(statusOf(docs, 'name-match')).toBe('pass');
  });
  it('an English document with the same transliteration difference fails', () => {
    const docs = patchDoc(fixed, 'marksheet', { applicantName: { original: 'Arav Sunil Patil', english: 'Arav Sunil Patil' } });
    expect(statusOf(docs, 'name-match')).toBe('fail');
  });
  it('an empty English name is treated as unreadable', () => {
    expect(statusOf(patchDoc(fixed, 'aadhaar', { applicantName: { original: '', english: '  ' } }), 'name-match')).toBe('needs_review');
  });
});

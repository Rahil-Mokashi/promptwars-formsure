import { describe, expect, it, vi } from 'vitest';
import { audit, extract, getSample } from '../api';
import { ExtractionError, UnavailableError, extractDocument, maskAadhaar, maskDeep, validateFile, type Generate } from './extract';
import { createFirebaseGenerate, firebaseConfig } from './live';

const NOW = new Date('2026-10-28T06:00:00Z');
const goodJson = JSON.stringify({
  documentTypes: ['marksheet'], language: 'en',
  applicantName: { original: 'Aarav Sunil Patil', english: 'Aarav Sunil Patil' },
  dateOfBirth: null, issueDate: '2026-04-02', issuingAuthority: 'Fictional University', category: null,
  annualIncome: null, pageCount: 1, legible: true,
});
const png = (name = 'a.png') => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

describe('maskAadhaar', () => {
  it('masks spaced, dashed and plain 12-digit numbers but not other numbers', () => {
    expect(maskAadhaar('1234 5678 9012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('1234-5678-9012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('123456789012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('1234567890123')).toBe('1234567890123');
    expect(maskAadhaar('income 240000')).toBe('income 240000');
  });
  it('masks inside nested objects', () => {
    expect(maskDeep({ a: { b: ['ID 1111 2222 3333'] } })).toEqual({ a: { b: ['ID XXXX XXXX 3333'] } });
  });
});

describe('validateFile', () => {
  it('accepts png, jpg, webp and pdf up to 5 MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']) {
      expect(validateFile({ type, size: 1000, name: 'f' })).toBeNull();
    }
    expect(validateFile({ type: 'application/pdf', size: 5 * 1024 * 1024, name: 'f' })).toBeNull();
  });
  it('rejects other types, empty files and files over 5 MB', () => {
    expect(validateFile({ type: 'text/plain', size: 10, name: 'a.txt' })).toMatch(/PNG, JPG, WebP or PDF/);
    expect(validateFile({ type: 'image/gif', size: 10, name: 'a.gif' })).not.toBeNull();
    expect(validateFile({ type: 'image/png', size: 5 * 1024 * 1024 + 1, name: 'big.png' })).toMatch(/5 MB/);
    expect(validateFile({ type: 'image/png', size: 0, name: 'e.png' })).toMatch(/empty/);
  });
});

describe('extractDocument (Firebase AI mocked)', () => {
  it('returns the validated document', async () => {
    const doc = await extractDocument(async () => goodJson, png());
    expect(doc.applicantName?.english).toBe('Aarav Sunil Patil');
  });
  it('retries once on bad JSON, then succeeds', async () => {
    const generate = vi.fn<Generate>().mockResolvedValueOnce('not json').mockResolvedValueOnce(goodJson);
    await expect(extractDocument(generate, png())).resolves.toBeTruthy();
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('retries once on a timeout, then fails with a friendly typed error', async () => {
    const generate = vi.fn<Generate>().mockRejectedValue(new Error('timeout'));
    const err = await extractDocument(generate, png('scan.png')).catch((e: unknown) => e);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(ExtractionError);
    expect((err as Error).message).toBe('Could not read scan.png. Try a clearer scan or a different file.');
  });
  it('fails after two schema-invalid answers', async () => {
    const generate = vi.fn<Generate>().mockResolvedValue('{"documentTypes":"x"}');
    await expect(extractDocument(generate, png())).rejects.toBeInstanceOf(ExtractionError);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('does not call the model for an invalid file', async () => {
    const generate = vi.fn<Generate>();
    await expect(extractDocument(generate, new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toBeInstanceOf(ExtractionError);
    expect(generate).not.toHaveBeenCalled();
  });
  it('masks a 12-digit number in the model output', async () => {
    const leaky = JSON.stringify({ ...JSON.parse(goodJson), issuingAuthority: 'ID 1234 5678 9012 UIDAI' });
    const doc = await extractDocument(async () => leaky, png());
    expect(doc.issuingAuthority).toBe('ID XXXX XXXX 9012 UIDAI');
  });
});

describe('live reading availability', () => {
  it('is unavailable without Firebase config', async () => {
    expect(firebaseConfig({})).toBeNull();
    expect(createFirebaseGenerate({})).toBeNull();
    await expect(extract(png(), null)).rejects.toBeInstanceOf(UnavailableError);
    await expect(extract(png(), null)).rejects.toThrow('Live reading unavailable, try the sample applicant');
  });
  it('is available when the Firebase variables are set', () => {
    const env = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'formsure', VITE_FIREBASE_APP_ID: 'a' };
    expect(firebaseConfig(env)?.authDomain).toBe('formsure.firebaseapp.com');
    expect(createFirebaseGenerate(env)).toBeTypeOf('function');
  });
});

describe('audit on the sample (browser-side)', () => {
  it('gives 57% for the error documents and 100% for the fixed ones', () => {
    const s = getSample(NOW);
    const bad = audit(s.form, s.errorDocuments, NOW);
    expect([bad.readiness, bad.failed, bad.passed, bad.skipped]).toEqual([57, 3, 4, 1]);
    expect(audit(s.form, s.fixedDocuments, NOW).readiness).toBe(100);
  });
  it('masks 12-digit numbers in the report', () => {
    const s = getSample(NOW);
    s.errorDocuments.aadhaar = { ...s.errorDocuments.aadhaar!, applicantName: { original: 'x', english: 'Aarav 1234 5678 9012' } };
    expect(JSON.stringify(audit(s.form, s.errorDocuments, NOW))).not.toContain('1234 5678');
  });
});

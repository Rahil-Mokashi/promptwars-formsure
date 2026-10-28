import { describe, expect, it, vi } from 'vitest';
import { UnavailableError } from '../core/errors';
import { MARKSHEET_JSON, pngFile } from '../test/files';
import { audit, extract, getSample, pack } from './api';
import type { Generate } from './extraction';

const NOW = new Date('2026-10-28T06:00:00Z');

describe('audit on the sample applicant', () => {
  it('gives 50% with one failure for the error documents and 100% for the fixed ones', () => {
    const s = getSample(NOW);
    const bad = audit(s.form, s.errorDocuments, undefined, NOW);
    expect([bad.readiness, bad.failed, bad.passed, bad.notEvaluated]).toEqual([50, 1, 1, 6]);
    expect(audit(s.form, s.fixedDocuments, undefined, NOW).readiness).toBe(100);
  });

  it('masks 12-digit numbers in the report', () => {
    const s = getSample(NOW);
    const aadhaar = s.errorDocuments.aadhaar;
    if (!aadhaar) throw new Error('sample has no aadhaar');
    s.errorDocuments.aadhaar = { ...aadhaar, applicantName: { original: 'x', english: 'Aarav 1234 5678 9012' } };
    expect(JSON.stringify(audit(s.form, s.errorDocuments, undefined, NOW))).not.toContain('1234 5678');
  });

  it('exposes the MahaDBT pack with 7 slots and 8 rules', () => {
    expect(pack.slots).toHaveLength(7);
    expect(pack.rules).toHaveLength(8);
  });
});

describe('extract (live reading)', () => {
  it('is unavailable without Firebase config, with the message shown to the user', async () => {
    await expect(extract(pngFile(), {}, null)).rejects.toBeInstanceOf(UnavailableError);
    await expect(extract(pngFile(), {}, null)).rejects.toThrow('Live reading unavailable, try the sample applicant');
  });

  it('reads through the shared limiter and the given generate function', async () => {
    const generate = vi.fn<Generate>().mockResolvedValue(MARKSHEET_JSON);
    const doc = await extract(pngFile(), {}, generate);
    expect(doc.applicantName?.english).toBe('Aarav Sunil Patil');
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

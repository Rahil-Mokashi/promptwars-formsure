import { describe, expect, it } from 'vitest';
import type { DocumentsBySlot, ExtractedDocument } from './types';
import { fyStartYear, phonetic, runAudit } from './engine';
import { mahadbtPack, type Pack } from './schema';
import { buildSample } from './sample';

const NOW = new Date('2026-10-28T06:00:00Z');
const sample = buildSample(NOW);
const audit = (docs: DocumentsBySlot, now = NOW, pack: Pack = mahadbtPack, form = sample.form) =>
  runAudit(pack, form, docs, now);
const status = (r: ReturnType<typeof audit>, id: string) => r.checks.find((c) => c.ruleId === id)?.status;
const doc = (o: Partial<ExtractedDocument>): ExtractedDocument => ({
  documentTypes: [], language: 'en', applicantName: null, dateOfBirth: null, issueDate: null,
  issuingAuthority: null, category: null, annualIncome: null, pageCount: 1, legible: true, ...o,
});

describe('sample fixtures', () => {
  it('error fixture has exactly 3 failures and readiness 57', () => {
    const r = audit(sample.errorDocuments);
    expect(r.checks).toHaveLength(8);
    expect(r.checks.filter((c) => c.status === 'fail').map((c) => c.ruleId)).toEqual([
      'income-financial-year', 'income-ncl', 'name-match',
    ]);
    expect([r.passed, r.failed, r.skipped, r.readiness]).toEqual([4, 3, 1, 57]);
  });

  it('fixed fixture has 0 failures and readiness 100', () => {
    const r = audit(sample.fixedDocuments);
    expect([r.passed, r.failed, r.skipped, r.readiness]).toEqual([7, 0, 1, 100]);
  });

  it('produces the design copy for the failing checks', () => {
    const r = audit(sample.errorDocuments);
    const by = (id: string) => r.checks.find((c) => c.ruleId === id)!;
    expect(by('income-financial-year').detail).toBe('Issued 12 May 2025, FY 2025-26');
    expect(by('income-financial-year').evidence?.found).toBe('Issued 12/05/2025 (FY 2025-26)');
    expect(by('income-financial-year').evidence?.needed).toBe('Issued in FY 2026-27, on or after 1 April 2026');
    expect(by('income-financial-year').fix.mr).toContain('१ एप्रिल २०२६');
    expect(by('income-ncl').detail).toBe('1 page found, non-creamy layer page missing');
    expect(by('income-ncl').evidence?.found).toBe('1 page: income certificate only');
    expect(by('name-match').detail).toBe('Marksheet says Arav, not Aarav');
    expect(by('name-match').evidence).toMatchObject({
      foundLabel: 'Marksheet',
      found: 'Arav Sunil Patil',
      neededLabel: 'Income certificate (Marathi) and form',
      needed: 'आरव सुनील पाटील → Aarav Sunil Patil',
    });
  });
});

describe('required_document', () => {
  it('fails and names the missing slot', () => {
    const { bank_passbook: _omit, ...rest } = sample.fixedDocuments;
    void _omit;
    const r = audit(rest);
    expect(status(r, 'required-documents')).toBe('fail');
    expect(r.checks[0]?.detail).toBe('Missing: Bank passbook');
  });
});

describe('document_check', () => {
  it('fails when a slot holds the wrong document type', () => {
    const r = audit({ ...sample.fixedDocuments, marksheet: doc({ documentTypes: ['aadhaar'] }) });
    expect(status(r, 'right-document')).toBe('fail');
  });
  it('fails when a document is not legible', () => {
    const r = audit({ ...sample.fixedDocuments, domicile: { ...sample.fixedDocuments.domicile!, legible: false } });
    expect(status(r, 'right-document')).toBe('fail');
  });
});

describe('date_window (Indian financial year)', () => {
  const withIssue = (issueDate: string, now: string) =>
    audit({ ...sample.fixedDocuments, income_certificate: { ...sample.fixedDocuments.income_certificate!, issueDate } }, new Date(now));

  it('31 March belongs to the old financial year', () => {
    expect(fyStartYear('2026-03-31')).toBe(2025);
    expect(fyStartYear('2026-04-01')).toBe(2026);
  });
  it('certificate issued 31 March fails on 1 April', () => {
    expect(status(withIssue('2026-03-31', '2026-04-01T06:00:00Z'), 'income-financial-year')).toBe('fail');
  });
  it('certificate issued 1 April passes on 1 April', () => {
    expect(status(withIssue('2026-04-01', '2026-04-01T06:00:00Z'), 'income-financial-year')).toBe('pass');
  });
  it('certificate issued 31 March passes on 31 March', () => {
    expect(status(withIssue('2026-03-31', '2026-03-31T06:00:00Z'), 'income-financial-year')).toBe('pass');
  });
  it('uses India time: 20:00 UTC on 31 March is already 1 April in IST', () => {
    expect(status(withIssue('2026-03-31', '2026-03-31T20:00:00Z'), 'income-financial-year')).toBe('fail');
  });
  it('fails when no issue date was read', () => {
    const r = audit({ ...sample.fixedDocuments, income_certificate: { ...sample.fixedDocuments.income_certificate!, issueDate: null } });
    expect(status(r, 'income-financial-year')).toBe('fail');
  });
});

describe('conditional', () => {
  it('is skipped for a category outside OBC/SBC/VJNT', () => {
    const r = audit(sample.errorDocuments, NOW, mahadbtPack, { ...sample.form, category: 'Open' });
    expect(status(r, 'income-ncl')).toBe('skipped');
  });
});

describe('cross_document_match', () => {
  it('Marathi document passes via the phonetic key', () => {
    expect(phonetic('Aarav Sunil Patil')).toBe(phonetic('Arav Sunil Patil'));
    expect(status(audit(sample.fixedDocuments), 'name-match')).toBe('pass');
  });
  it('English document must match exactly (case and spaces normalised)', () => {
    const named = (english: string) =>
      audit({ ...sample.fixedDocuments, marksheet: doc({ documentTypes: ['marksheet'], applicantName: { original: english, english } }) });
    expect(status(named('  AARAV   sunil patil '), 'name-match')).toBe('pass');
    expect(status(named('Arav Sunil Patil'), 'name-match')).toBe('fail');
  });
  it('a Marathi document with a really different name still fails', () => {
    const r = audit({
      ...sample.fixedDocuments,
      income_certificate: { ...sample.fixedDocuments.income_certificate!, applicantName: { original: 'x', english: 'Rohan Sunil Patil' } },
    });
    expect(status(r, 'name-match')).toBe('fail');
  });
});

describe('field_consistency', () => {
  it('fails on a different date of birth', () => {
    const r = audit({ ...sample.fixedDocuments, aadhaar: { ...sample.fixedDocuments.aadhaar!, dateOfBirth: '2006-03-15' } });
    expect(status(r, 'dob-match')).toBe('fail');
  });
  it('fails on a different category', () => {
    const r = audit({ ...sample.fixedDocuments, caste_certificate: { ...sample.fixedDocuments.caste_certificate!, category: 'SBC' } });
    expect(status(r, 'category-match')).toBe('fail');
  });
});

describe('numeric_max and unverified rules', () => {
  const income = (annualIncome: number) => ({
    ...sample.fixedDocuments,
    income_certificate: { ...sample.fixedDocuments.income_certificate!, annualIncome },
  });
  const verified: Pack = {
    ...mahadbtPack,
    rules: mahadbtPack.rules.map((r) => (r.id === 'income-limit' ? { ...r, verified: true } : r)),
  };

  it('unverified rule is skipped even when the data would fail it', () => {
    const r = audit(income(9_000_000));
    expect(status(r, 'income-limit')).toBe('skipped');
    expect(r.failed).toBe(0);
  });
  it('verified rule applies the maximum', () => {
    expect(status(audit(income(9_000_000), NOW, verified), 'income-limit')).toBe('fail');
    expect(status(audit(income(800_000), NOW, verified), 'income-limit')).toBe('pass');
  });
});

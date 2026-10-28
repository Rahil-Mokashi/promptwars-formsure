import { describe, expect, it } from 'vitest';
import { fyLabel, longDate, runAudit } from './engine';
import { buildSample } from './sample';
import { mahadbtPack } from './schema';

const NOW = new Date('2026-10-28T06:00:00Z');
const s = buildSample(NOW);
const fixed = s.fixedDocuments;
const check = (docs: Parameters<typeof runAudit>[2], id: string) =>
  runAudit(mahadbtPack, s.form, docs, NOW).checks.find((c) => c.ruleId === id);

describe('rules engine: missing or unreadable data is skipped, not guessed', () => {
  it('with nothing uploaded: documents rule fails, AI rule skipped, readiness 0', () => {
    const r = runAudit(mahadbtPack, s.form, {}, NOW);
    expect(r.checks.find((c) => c.ruleId === 'right-document')?.status).toBe('skipped');
    expect(r.checks.find((c) => c.ruleId === 'required-documents')?.status).toBe('fail');
    expect(r.readiness).toBe(0);
  });
  it('skips date, conditional, consistency and numeric rules when their slot is missing', () => {
    for (const id of ['income-financial-year', 'income-ncl', 'dob-match', 'category-match', 'income-limit']) {
      expect(check({}, id)?.status).toBe('skipped');
    }
  });
  it('skips the name rule when no names could be read', () => {
    const docs = {
      ...fixed,
      aadhaar: { ...fixed.aadhaar!, applicantName: null },
      income_certificate: { ...fixed.income_certificate!, applicantName: null },
      marksheet: { ...fixed.marksheet!, applicantName: null },
    };
    expect(check(docs, 'name-match')?.status).toBe('skipped');
  });
  it('skips a field rule when the field is unreadable on the document', () => {
    const docs = { ...fixed, aadhaar: { ...fixed.aadhaar!, dateOfBirth: null } };
    expect(check(docs, 'dob-match')?.detail).toBe('Not readable on Aadhaar');
  });
});

describe('rules engine: evidence wording', () => {
  it('lists several missing documents and explains an unrecognised file', () => {
    const { aadhaar: a, marksheet: m, ...rest } = fixed;
    expect([a, m]).toBeTruthy();
    expect(check(rest, 'required-documents')?.detail).toBe('Missing: Aadhaar, Marksheet');
    const wrong = { ...fixed, domicile: { ...fixed.domicile!, documentTypes: [] } };
    expect(check(wrong, 'right-document')?.evidence?.found).toBe('unrecognised document');
  });
  it('conditional with no matching certificate says so', () => {
    const none = { ...fixed, income_certificate: { ...fixed.income_certificate!, documentTypes: [] } };
    expect(check(none, 'income-ncl')?.evidence?.found).toBe('2 pages: no matching certificate');
  });
  it('a name that differs in length falls back to the full names', () => {
    const longer = { ...fixed, marksheet: { ...fixed.marksheet!, applicantName: { original: 'x', english: 'Aarav Patil' } } };
    expect(check(longer, 'name-match')?.detail).toBe('Marksheet says Aarav Patil, not Aarav Sunil Patil');
  });
  it('with only English documents, the evidence lists the matching English documents', () => {
    const docs = {
      ...fixed,
      income_certificate: { ...fixed.income_certificate!, language: 'en' as const },
      marksheet: { ...fixed.marksheet!, applicantName: { original: 'Arav Sunil Patil', english: 'Arav Sunil Patil' } },
    };
    expect(check(docs, 'name-match')?.evidence?.neededLabel).toBe('Aadhaar, Income certificate and form');
  });
});

describe('helpers', () => {
  it('formats dates and financial-year labels', () => {
    expect(longDate('2025-05-12')).toBe('12 May 2025');
    expect(fyLabel(2026)).toBe('2026-27');
  });
  it('a verified income rule skips when the income is unreadable', () => {
    const verified = { ...mahadbtPack, rules: mahadbtPack.rules.map((r) => (r.id === 'income-limit' ? { ...r, verified: true } : r)) };
    const docs = { ...fixed, income_certificate: { ...fixed.income_certificate!, annualIncome: null } };
    expect(runAudit(verified, s.form, docs, NOW).checks.find((c) => c.ruleId === 'income-limit')?.status).toBe('skipped');
  });
});

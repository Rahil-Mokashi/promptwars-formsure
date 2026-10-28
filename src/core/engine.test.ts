import { describe, expect, it } from 'vitest';
import { ALL_SLOTS, NOW, allRulesPack, audit, checkOf, fixed, patchDoc, sample, shippedAudit, statusOf, verifying, withoutDoc } from '../test/docs';
import { assertNever } from './assertNever';
import { fyLabel, fyStartYear, longDate } from './dates';
import { mahadbtPack, mahadbtScPack } from './schema';

describe('sample fixtures with every verifiable rule applied (tests the evaluators)', () => {
  it('error set: exactly 3 failures and readiness 57', () => {
    const r = audit(sample.errorDocuments);
    expect(r.checks).toHaveLength(8);
    expect(r.checks.filter((c) => c.status === 'fail').map((c) => c.ruleId)).toEqual(['income-financial-year', 'income-ncl', 'name-match']);
    expect([r.passed, r.failed, r.needsReview, r.notEvaluated, r.readiness]).toEqual([4, 3, 0, 1, 57]);
  });

  it('fixed set: 100% only because every evaluated rule passed', () => {
    const r = audit(fixed);
    expect([r.passed, r.failed, r.needsReview, r.notEvaluated, r.readiness]).toEqual([7, 0, 0, 1, 100]);
  });

  it('produces the evidence and wording the report shows', () => {
    const r = audit(sample.errorDocuments);
    expect(checkOf(r, 'income-financial-year').detail).toBe('Issued 12 May 2025, FY 2025-26');
    expect(checkOf(r, 'income-financial-year').evidence).toMatchObject({ document: 'Income certificate', field: 'issueDate', found: 'Issued 12/05/2025 (FY 2025-26)', needed: 'Issued in FY 2026-27, on or after 1 April 2026' });
    expect(checkOf(r, 'income-financial-year').fix.mr).toContain('१ एप्रिल २०२६');
    expect(checkOf(r, 'income-ncl').detail).toBe('1 page found, non-creamy layer page missing');
    expect(checkOf(r, 'name-match').detail).toBe('Marksheet says Arav, not Aarav');
    expect(checkOf(r, 'name-match').evidence).toMatchObject({
      document: 'Marksheet', field: 'applicantName', foundLabel: 'Marksheet', found: 'Arav Sunil Patil',
      neededLabel: 'Income certificate (Marathi) and form', needed: 'आरव सुनील पाटील → Aarav Sunil Patil',
    });
  });

  it('every result carries rule id, rule version, academic year and source', () => {
    for (const c of audit(sample.errorDocuments).checks) {
      expect(c.ruleId).toMatch(/\S/);
      expect(c.ruleVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(c.academicYear).toBe(mahadbtPack.academicYear);
      expect(c.source.url).toMatch(/^https:\/\//);
      expect(['official', 'college-notice', 'secondary']).toContain(c.source.kind);
    }
  });

  it('every failing result names its document and field', () => {
    for (const c of audit(sample.errorDocuments).checks.filter((x) => x.status === 'fail')) {
      expect(c.evidence?.document).toMatch(/\S/);
      expect(c.evidence?.field).toMatch(/\S/);
    }
  });
});

describe('no false passes: anything that cannot be verified needs review', () => {
  it('a missing document fails the required-documents rule and every rule that needed it needs review', () => {
    const docs = withoutDoc(fixed, 'caste_certificate');
    expect(statusOf(docs, 'required-documents')).toBe('fail');
    expect(statusOf(docs, 'category-match')).toBe('needs_review');
    expect(statusOf(docs, 'name-match')).toBe('needs_review');
  });

  it('a document that is not legible makes each rule reading it need review, and readiness drops', () => {
    const docs = patchDoc(fixed, 'income_certificate', { legible: false });
    for (const id of ['income-financial-year', 'income-ncl', 'right-document', 'name-match']) expect(statusOf(docs, id)).toBe('needs_review');
    expect(audit(docs).readiness).toBeLessThan(100);
  });

  it('readiness counts needs_review against the score and is 100 only when every evaluated rule passes', () => {
    const docs = patchDoc(fixed, 'aadhaar', { dateOfBirth: null });
    const r = audit(docs);
    expect(checkOf(r, 'dob-match').status).toBe('needs_review');
    expect([r.passed, r.failed, r.needsReview, r.readiness]).toEqual([6, 0, 1, 86]);
  });

  it('a field the model could not read (null) needs review rather than failing or passing', () => {
    expect(statusOf(patchDoc(fixed, 'income_certificate', { issueDate: null }), 'income-financial-year')).toBe('needs_review');
    expect(statusOf(patchDoc(fixed, 'caste_certificate', { category: null }), 'category-match')).toBe('needs_review');
    expect(statusOf(patchDoc(fixed, 'aadhaar', { dateOfBirth: null }), 'dob-match')).toBe('needs_review');
  });

  });

describe('required_document and document_check', () => {
  it('names every missing document', () => {
    const docs = withoutDoc(withoutDoc(fixed, 'aadhaar'), 'marksheet');
    expect(checkOf(audit(docs), 'required-documents').detail).toBe('Missing: Aadhaar, Marksheet');
  });
  it('fails on the wrong kind of document in a slot', () => {
    const docs = patchDoc(fixed, 'marksheet', { documentTypes: ['aadhaar'] });
    expect(statusOf(docs, 'right-document')).toBe('fail');
  });
  it('needs review when nothing could be recognised in a file', () => {
    expect(statusOf(patchDoc(fixed, 'domicile', { documentTypes: [] }), 'right-document')).toBe('needs_review');
  });
  it('is not evaluated when no document was uploaded at all', () => {
    expect(statusOf({}, 'right-document')).toBe('not_evaluated');
  });
});

describe('date_window (Indian financial year)', () => {
  const issuedOn = (issueDate: string, now: string) =>
    checkOf(audit(patchDoc(fixed, 'income_certificate', { issueDate }), sample.form, new Date(now)), 'income-financial-year').status;

  it('31 March belongs to the old financial year, 1 April starts the new one', () => {
    expect(fyStartYear('2026-03-31')).toBe(2025);
    expect(fyStartYear('2026-04-01')).toBe(2026);
    expect(fyLabel(2026)).toBe('2026-27');
  });
  it('certificate issued 31 March fails on 1 April, passes on 31 March', () => {
    expect(issuedOn('2026-03-31', '2026-04-01T06:00:00Z')).toBe('fail');
    expect(issuedOn('2026-03-31', '2026-03-31T06:00:00Z')).toBe('pass');
  });
  it('certificate issued 1 April passes on 1 April', () => {
    expect(issuedOn('2026-04-01', '2026-04-01T06:00:00Z')).toBe('pass');
  });
  it('uses India time: 20:00 UTC on 31 March is already 1 April in IST', () => {
    expect(issuedOn('2026-03-31', '2026-03-31T20:00:00Z')).toBe('fail');
  });
  it('formats dates for the report', () => {
    expect(longDate('2025-05-12')).toBe('12 May 2025');
  });
});

describe('conditional (income + non-creamy layer)', () => {
  it('is not evaluated for a category outside OBC / SBC / VJNT', () => {
    expect(statusOf(sample.errorDocuments, 'income-ncl', { ...sample.form, category: 'Open' })).toBe('not_evaluated');
  });
  it('says there is no matching certificate when nothing was recognised in the file', () => {
    const docs = patchDoc(fixed, 'income_certificate', { documentTypes: ['other'] });
    expect(checkOf(audit(docs), 'income-ncl').evidence?.found).toBe('2 pages: no matching certificate');
  });
});

describe('field_consistency', () => {
  it('fails on a different date of birth or category', () => {
    expect(statusOf(patchDoc(fixed, 'aadhaar', { dateOfBirth: '2006-03-15' }), 'dob-match')).toBe('fail');
    expect(statusOf(patchDoc(fixed, 'caste_certificate', { category: 'SBC' }), 'category-match')).toBe('fail');
  });
  it('compares categories ignoring case', () => {
    expect(statusOf(patchDoc(fixed, 'caste_certificate', { category: ' obc ' }), 'category-match')).toBe('pass');
  });
});

describe('numeric_max', () => {
  const pack = verifying(['income-limit']);
  const statusFor = (annualIncome: number | null) =>
    checkOf(audit(patchDoc(fixed, 'income_certificate', { annualIncome }), sample.form, NOW, pack), 'income-limit').status;

  it('passes at the maximum, fails above it, needs review when unreadable', () => {
    expect(statusFor(800_000)).toBe('pass');
    expect(statusFor(9_000_000)).toBe('fail');
    expect(statusFor(null)).toBe('needs_review');
  });
});

describe('the shipped pack applies only rules backed by an official source or a college notice', () => {
  it('evaluates exactly the two verified rules and skips the rest', () => {
    const r = shippedAudit(sample.errorDocuments);
    const byStatus = (s: string) => r.checks.filter((c) => c.status === s).map((c) => c.ruleId);
    expect(byStatus('pass')).toEqual(['right-document']);
    expect(byStatus('fail')).toEqual(['income-ncl']);
    expect(byStatus('not_evaluated')).toEqual(['required-documents', 'income-financial-year', 'name-match', 'dob-match', 'category-match', 'income-limit']);
  });
  it('says why: sources conflict, or not verified yet', () => {
    const r = shippedAudit(sample.errorDocuments);
    expect(checkOf(r, 'income-financial-year').detail).toBe('Sources conflict, rule skipped');
    expect(checkOf(r, 'income-limit').detail).toBe('Sources conflict, rule skipped');
    expect(checkOf(r, 'name-match').detail).toBe('Rule not verified yet, skipped');
  });
  it('sample numbers: 50% with one issue, then 100%', () => {
    const bad = shippedAudit(sample.errorDocuments);
    expect([bad.passed, bad.failed, bad.needsReview, bad.notEvaluated, bad.readiness]).toEqual([1, 1, 0, 6, 50]);
    const good = shippedAudit(fixed);
    expect([good.passed, good.failed, good.needsReview, good.notEvaluated, good.readiness]).toEqual([2, 0, 0, 6, 100]);
  });
  it('a rule marked verified but backed only by secondary sources is still not evaluated', () => {
    const secondaryOnly = { ...allRulesPack, rules: allRulesPack.rules.map((r) => (r.id === 'name-match' ? { ...r, evidence: r.evidence.filter((e) => e.kind === 'secondary') } : r)) };
    expect(checkOf(audit(sample.errorDocuments, sample.form, NOW, secondaryOnly), 'name-match').status).toBe('not_evaluated');
  });
  it('a conflicting rule is not evaluated even when its data would fail it', () => {
    expect(checkOf(shippedAudit(patchDoc(fixed, 'income_certificate', { annualIncome: 9_000_000 })), 'income-limit').status).toBe('not_evaluated');
  });
  it('every result carries the evidence year of the pack', () => {
    expect(new Set(shippedAudit(fixed).checks.map((c) => c.academicYear))).toEqual(new Set(['2025-26']));
  });
});

describe('exhaustiveness', () => {
  it('throws on a rule type the dispatcher does not know', () => {
    expect(() => assertNever('mystery' as never)).toThrow('Unexpected value: "mystery"');
  });
  it('the shipped pack has all seven slots covered by the name rule', () => {
    const nameRule = mahadbtPack.rules.find((r) => r.type === 'cross_document_match');
    expect(nameRule && 'slots' in nameRule ? [...nameRule.slots].sort() : []).toEqual([...ALL_SLOTS].sort());
  });
});

describe('the SC pack evaluates its verified rules including income limit', () => {
  it('applies the verified income-limit rule (max 250,000)', () => {
    const r250 = audit(patchDoc(fixed, 'income_certificate', { annualIncome: 250_000 }), { ...sample.form, category: 'SC' }, NOW, mahadbtScPack);
    expect(checkOf(r250, 'income-limit').status).toBe('pass');

    const r251 = audit(patchDoc(fixed, 'income_certificate', { annualIncome: 250_001 }), { ...sample.form, category: 'SC' }, NOW, mahadbtScPack);
    expect(checkOf(r251, 'income-limit').status).toBe('fail');
  });
});

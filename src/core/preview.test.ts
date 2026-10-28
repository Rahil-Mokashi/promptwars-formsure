import { describe, expect, it } from 'vitest';
import { patchDoc, sample } from '../test/docs';
import { previewFor } from './preview';
import { mahadbtPack, toWirePack } from './schema';
import type { Check } from './types';

const pack = toWirePack(mahadbtPack);
const docs = patchDoc(sample.errorDocuments, 'income_certificate', { issueDate: '2025-02-01', issuingAuthority: 'Tehsildar' });
const check = (ruleId: string, foundLabel?: string): Check => ({ ruleId, evidence: foundLabel ? { foundLabel } : null }) as unknown as Check;
const highlighted = (ruleId: string, foundLabel?: string) => previewFor(check(ruleId, foundLabel), docs, pack)?.rows.find((r) => r.hl);

describe('previewFor: which field of which document an issue is about', () => {
  it('income financial year highlights the issue date (dd/mm/yyyy)', () => {
    expect(highlighted('income-financial-year')).toEqual({ label: 'Issue date', value: '01/02/2025', hl: true });
  });

  it('income + non-creamy layer highlights what the PDF contains', () => {
    expect(highlighted('income-ncl')?.label).toBe('Contains');
  });

  it('name match previews the document named in the evidence, and nothing for an unknown one', () => {
    const marksheet = pack.slots.find((s) => s.id === 'marksheet');
    expect(highlighted('name-match', marksheet?.short)?.label).toBe('Name');
    expect(previewFor(check('name-match', 'no such document'), docs, pack)).toBeNull();
  });

  it('date of birth and category highlight their fields', () => {
    expect(highlighted('dob-match')?.label).toBe('Date of birth');
    expect(highlighted('category-match')?.label).toBe('Category');
  });

  it('shows "not found" for a missing issue date, and null when the document or rule has no preview', () => {
    const noDate = patchDoc(docs, 'income_certificate', { issueDate: null });
    expect(previewFor(check('income-financial-year'), noDate, pack)?.rows[0]?.value).toBe('not found');
    expect(previewFor(check('income-financial-year'), {}, pack)).toBeNull();
    expect(previewFor(check('required-documents'), docs, pack)).toBeNull();
  });
});

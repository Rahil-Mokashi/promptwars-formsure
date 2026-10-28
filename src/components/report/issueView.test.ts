import { describe, expect, it } from 'vitest';
import { audit, checkOf, fixed, patchDoc, sample } from '../../test/docs';
import type { Check } from '../../core/types';
import { issueView } from './issueView';

const base = checkOf(audit(sample.errorDocuments), 'income-ncl');

describe('issueView', () => {
  it('a failed critical check shows its issue title and a Critical badge', () => {
    expect(issueView(base)).toEqual({ review: false, badge: 'Critical', title: base.issueTitle, note: null });
  });
  it('a non-critical failure shows a Warning badge', () => {
    expect(issueView({ ...base, severity: 'warning' }).badge).toBe('Warning');
  });
  it('a check that needs review is amber, says it could not be verified and names the rule', () => {
    const review: Check = checkOf(
      audit(patchDoc(fixed, 'income_certificate', { issueDate: null })),
      'income-financial-year',
    );
    expect(issueView(review)).toEqual({
      review: true,
      badge: 'Couldn’t verify',
      title: `Check manually: ${review.label}`,
      note: null,
    });
  });
  it('an advisory is amber, titled from its issue and explains that it is not scored', () => {
    const view = issueView({ ...base, advisory: true });
    expect(view).toMatchObject({ review: true, badge: 'Advisory', title: `Check manually: ${base.issueTitle}` });
    expect(view.note).toMatch(/Not counted in your score/);
  });
});

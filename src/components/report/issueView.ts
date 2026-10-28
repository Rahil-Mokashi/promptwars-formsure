import type { Check } from '../../core/types';

const ADVISORY_NOTE = ' · Not counted in your score: this rule’s sources are not official yet, or disagree on details.';

/** How an issue card describes a check. */
export interface IssueView {
  /** Shown in amber with a question mark: a person should check it. */
  review: boolean;
  /** The word on the badge (icon plus word, never colour alone). */
  badge: string;
  title: string;
  /** Extra text after the document line, or null. */
  note: string | null;
}

/** Derives the badge, title and note of an issue card from its check: failed, needs review, or advisory. */
export function issueView(check: Check): IssueView {
  if (check.advisory) {
    return { review: true, badge: 'Advisory', title: `Check manually: ${check.issueTitle}`, note: ADVISORY_NOTE };
  }
  if (check.status === 'needs_review') {
    return { review: true, badge: 'Couldn’t verify', title: `Check manually: ${check.label}`, note: null };
  }
  return {
    review: false,
    badge: check.severity === 'critical' ? 'Critical' : 'Warning',
    title: check.issueTitle,
    note: null,
  };
}

import {
  isOutcome,
  needsReview,
  readableDocument,
  shortName,
  type Outcome,
  type RuleContext,
  type RuleOf,
} from './context';

const rupees = (n: number): string => `₹${n.toLocaleString('en-IN')}`;

/** A number read from a document must not exceed the rule's maximum. */
export function numericMax(rule: RuleOf<'numeric_max'>, ctx: RuleContext): Outcome {
  const doc = readableDocument(ctx, rule.slot, rule.docField);
  if (isOutcome(doc)) return doc;
  const document = shortName(ctx, rule.slot);
  const needed = `Up to ${rupees(rule.max)}`;

  const value = doc[rule.docField];
  if (value === null) {
    return needsReview(`Income not readable on ${document}`, {
      document,
      field: rule.docField,
      foundLabel: 'Found on certificate',
      found: 'Not readable',
      neededLabel: 'Needed',
      needed,
    });
  }
  if (value <= rule.max) return { status: 'pass', detail: `${rupees(value)} is within ${rupees(rule.max)}` };
  return {
    status: 'fail',
    detail: `${rupees(value)} is above ${rupees(rule.max)}`,
    evidence: {
      document,
      field: rule.docField,
      foundLabel: 'Found on certificate',
      found: rupees(value),
      neededLabel: 'Needed',
      needed,
    },
  };
}

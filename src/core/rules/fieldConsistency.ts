import { longDate } from '../dates';
import {
  isOutcome,
  needsReview,
  readableDocument,
  shortName,
  type Outcome,
  type RuleContext,
  type RuleOf,
} from './context';

/** A field on the form must equal the same field on a document (dates exactly, text ignoring case). */
export function fieldConsistency(rule: RuleOf<'field_consistency'>, ctx: RuleContext): Outcome {
  const doc = readableDocument(ctx, rule.slot, rule.docField);
  if (isOutcome(doc)) return doc;
  const document = shortName(ctx, rule.slot);
  const formValue = ctx.form[rule.formField];
  const show = (v: string): string => (rule.format === 'date' ? longDate(v) : v);

  const docValue = doc[rule.docField];
  if (!docValue) {
    return needsReview(`Not readable on ${document}`, {
      document,
      field: rule.docField,
      foundLabel: document,
      found: 'Not readable',
      neededLabel: 'Form',
      needed: show(formValue),
    });
  }
  const same =
    rule.format === 'date' ? docValue === formValue : docValue.trim().toUpperCase() === formValue.trim().toUpperCase();
  if (same) return { status: 'pass', detail: `${show(docValue)} on both` };
  return {
    status: 'fail',
    detail: `Form says ${show(formValue)}, ${document} says ${show(docValue)}`,
    evidence: {
      document,
      field: rule.docField,
      foundLabel: document,
      found: show(docValue),
      neededLabel: 'Form',
      needed: show(formValue),
    },
  };
}

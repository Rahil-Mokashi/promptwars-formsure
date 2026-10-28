import type { DocumentType } from '../types';
import { isOutcome, notEvaluated, plural, readableDocument, shortName, type Outcome, type RuleContext, type RuleOf } from './context';

const DOCUMENT_NAMES: Partial<Record<DocumentType, string>> = {
  income_certificate: 'income certificate',
  non_creamy_layer: 'non-creamy layer certificate',
};
const documentName = (type: DocumentType): string => DOCUMENT_NAMES[type] ?? type.replace(/_/g, ' ');

/** If the form's category is in the rule's list, the slot must contain every required document type. */
export function conditional(rule: RuleOf<'conditional'>, ctx: RuleContext): Outcome {
  if (!rule.when.in.includes(ctx.form.category)) return notEvaluated(`Not required for ${ctx.form.category}`);
  const doc = readableDocument(ctx, rule.slot, 'documentTypes');
  if (isOutcome(doc)) return doc;

  const have = rule.mustContain.filter((t) => doc.documentTypes.includes(t));
  const missing = rule.mustContain.filter((t) => !doc.documentTypes.includes(t));
  if (missing.length === 0) return { status: 'pass', detail: 'Income and non-creamy layer both found' };

  const missingPages = missing.map((t) => `${documentName(t).replace(' certificate', '')} page`).join(', ');
  return {
    status: 'fail',
    detail: `${plural(doc.pageCount, 'page')} found, ${missingPages} missing`,
    evidence: {
      document: shortName(ctx, rule.slot),
      field: 'documentTypes',
      foundLabel: 'Found in file',
      found: `${plural(doc.pageCount, 'page')}: ${have.length ? `${have.map(documentName).join(' + ')} only` : 'no matching certificate'}`,
      neededLabel: 'Needed',
      needed: rule.needed,
    },
  };
}

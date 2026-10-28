import { needsReview, notEvaluated, type Outcome, type RuleContext, type RuleOf } from './context';

/**
 * Each uploaded file must be the kind of document its slot accepts.
 * A file that is not legible, or that nothing could be recognised in, needs a person to look at it.
 */
export function documentCheck(_rule: RuleOf<'document_check'>, ctx: RuleContext): Outcome {
  const present = ctx.pack.slots.flatMap((slot) => {
    const doc = ctx.docs[slot.id];
    return doc ? [{ slot, doc }] : [];
  });
  if (present.length === 0) return notEvaluated('No documents to check');

  const unreadable = present.find(({ doc }) => !doc.legible);
  const wrong = present.find(({ slot, doc }) => doc.legible && doc.documentTypes.length > 0 && !doc.documentTypes.some((t) => slot.accepts.includes(t)));
  if (wrong) {
    const { slot, doc } = wrong;
    return {
      status: 'fail',
      detail: `${slot.short} slot has the wrong file`,
      evidence: {
        document: slot.short, field: 'documentTypes', foundLabel: 'Found in file',
        found: doc.documentTypes.join(', ').replace(/_/g, ' '), neededLabel: 'Needed', needed: slot.label.en,
      },
    };
  }
  const unrecognised = present.find(({ doc }) => doc.legible && doc.documentTypes.length === 0);
  const review = unreadable ?? unrecognised;
  if (review) {
    const found = unreadable ? 'Not legible' : 'No document type recognised';
    return needsReview(`${review.slot.short}: ${found.toLowerCase()}`, {
      document: review.slot.short, field: unreadable ? 'legible' : 'documentTypes', foundLabel: 'Found in file',
      found, neededLabel: 'Needed', needed: review.slot.label.en,
    });
  }
  return { status: 'pass', detail: 'Each file matches its slot' };
}

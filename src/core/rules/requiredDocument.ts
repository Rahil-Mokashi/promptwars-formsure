import { shortName, slotLabel, type Outcome, type RuleContext, type RuleOf } from './context';

/** Every required slot must hold a file. */
export function requiredDocument(rule: RuleOf<'required_document'>, ctx: RuleContext): Outcome {
  const missing = rule.slots.filter((s) => !ctx.docs[s]);
  if (missing.length === 0) return { status: 'pass', detail: `All ${rule.slots.length} documents uploaded` };
  return {
    status: 'fail',
    detail: `Missing: ${missing.map((s) => shortName(ctx, s)).join(', ')}`,
    evidence: {
      document: 'Uploaded documents',
      field: 'slots',
      foundLabel: 'Found',
      found: `${rule.slots.length - missing.length} of ${rule.slots.length} documents uploaded`,
      neededLabel: 'Needed',
      needed: `All ${rule.slots.length} documents. Missing: ${missing.map((s) => slotLabel(ctx, s)).join(', ')}`,
    },
  };
}

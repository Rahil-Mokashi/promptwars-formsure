import type { Pack, Rule } from '../schema';
import type { ApplicationForm, Check, DocumentsBySlot, Evidence, ExtractedDocument, SlotId } from '../types';

/** What a rule decided, with a short detail and optional evidence. */
export interface Outcome {
  status: Check['status'];
  detail: string;
  evidence?: Evidence;
}

/** Everything a rule may look at. */
export interface RuleContext {
  pack: Pack;
  form: ApplicationForm;
  docs: DocumentsBySlot;
  /** Today in India, `YYYY-MM-DD`. */
  today: string;
}

/** The rule of one `type`, for example `RuleOf<'date_window'>`. */
export type RuleOf<T extends Rule['type']> = Extract<Rule, { type: T }>;

/** Short English name of a slot, such as "Marksheet". */
export const shortName = (ctx: RuleContext, id: SlotId): string => ctx.pack.slots.find((s) => s.id === id)?.short ?? id;

/** Full English label of a slot. */
export const slotLabel = (ctx: RuleContext, id: SlotId): string =>
  ctx.pack.slots.find((s) => s.id === id)?.label.en ?? id;

/** Not applied: the rule does not apply here or is not verified. */
export const notEvaluated = (detail: string): Outcome => ({ status: 'not_evaluated', detail });

/** Could not be verified: a person should check. */
export const needsReview = (detail: string, evidence?: Evidence): Outcome => ({
  status: 'needs_review',
  detail,
  ...(evidence ? { evidence } : {}),
});

/**
 * A document that rules may rely on: uploaded and legible.
 * @returns the document, or a `needs_review` outcome explaining why it cannot be used
 */
export function readableDocument(ctx: RuleContext, slotId: SlotId, field: string): ExtractedDocument | Outcome {
  const doc = ctx.docs[slotId];
  const name = shortName(ctx, slotId);
  const evidence = (found: string): Evidence => ({
    document: name,
    field,
    foundLabel: name,
    found,
    neededLabel: 'Needed',
    needed: 'A clear, readable document',
  });
  if (!doc) return needsReview(`${name} not uploaded`, evidence('Not uploaded'));
  if (!doc.legible) return needsReview(`${name} could not be read clearly`, evidence('Not legible'));
  return doc;
}

/** True when {@link readableDocument} returned an outcome instead of a document. */
export const isOutcome = (value: ExtractedDocument | Outcome): value is Outcome => 'status' in value;

/** `plural(2, 'page')` is `"2 pages"`. */
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

import { compareNames, type NameVerdict } from '../nameMatch';
import type { ExtractedDocument, SlotId } from '../types';
import { isOutcome, readableDocument, shortName, type Outcome, type RuleContext, type RuleOf } from './context';

const LANGUAGE_NAMES = { en: 'English', mr: 'Marathi', hi: 'Hindi', other: 'other language' } as const;

interface Compared {
  slot: SlotId;
  doc: ExtractedDocument;
  name: { original: string; english: string };
  verdict: NameVerdict;
}

/** What was gathered from the listed documents. */
interface Gathered {
  compared: Compared[];
  /** The first document whose name could not be read at all, as a ready-made outcome. */
  firstUnreadable: Outcome | undefined;
}

/** The first word that differs, as `[found, expected]`; whole names when the word counts differ. */
function firstDifference(found: string, expected: string): [string, string] {
  const a = found.trim().split(/\s+/);
  const b = expected.trim().split(/\s+/);
  const i = a.findIndex((word, k) => word.toLowerCase() !== (b[k] ?? '').toLowerCase());
  const gotWord = a[i];
  const wantWord = b[i];
  return a.length === b.length && gotWord !== undefined && wantWord !== undefined
    ? [gotWord, wantWord]
    : [found, expected];
}

/** Outcome for a document that is there and legible but has no readable name. */
function noName(ctx: RuleContext, slot: SlotId): Outcome {
  const document = shortName(ctx, slot);
  return {
    status: 'needs_review',
    detail: `No name could be read on ${document}`,
    evidence: {
      document,
      field: 'applicantName',
      foundLabel: document,
      found: 'No readable name',
      neededLabel: 'Form',
      needed: ctx.form.fullName,
    },
  };
}

/** Reads the name on every listed document and compares it with the form; unreadable ones are set aside for review. */
function gather(rule: RuleOf<'cross_document_match'>, ctx: RuleContext): Gathered {
  const compared: Compared[] = [];
  let firstUnreadable: Outcome | undefined;
  for (const slot of rule.slots) {
    const doc = readableDocument(ctx, slot, 'applicantName');
    const name = isOutcome(doc) ? undefined : doc.applicantName;
    if (isOutcome(doc) || !name || name.english.trim() === '') {
      firstUnreadable ??= isOutcome(doc) ? doc : noName(ctx, slot);
    } else {
      compared.push({ slot, doc, name, verdict: compareNames(name.english, ctx.form.fullName, doc.language !== 'en') });
    }
  }
  return { compared, firstUnreadable };
}

/** The "Marksheet (Marathi), Aadhaar and form" part of a mismatch's evidence: who agrees with the form. */
function agreeingLabel(ctx: RuleContext, compared: Compared[]): string {
  const good = compared.filter((c) => c.verdict === 'match');
  const foreign = good.filter((c) => c.doc.language !== 'en');
  const label = (c: Compared): string =>
    c.doc.language === 'en' ? shortName(ctx, c.slot) : `${shortName(ctx, c.slot)} (${LANGUAGE_NAMES[c.doc.language]})`;
  const names = [...(foreign.length > 0 ? foreign : good).map(label), 'form'];
  return names.join(', ').replace(/, ([^,]*)$/, ' and $1');
}

/** A clear difference: a `fail` that names the document, the differing word and who agrees with the form. */
function mismatch(ctx: RuleContext, bad: Compared, compared: Compared[]): Outcome {
  const [got, want] = firstDifference(bad.name.english, ctx.form.fullName);
  const firstForeign = compared.find((c) => c.verdict === 'match' && c.doc.language !== 'en');
  const document = shortName(ctx, bad.slot);
  return {
    status: 'fail',
    detail: `${document} says ${got}, not ${want}`,
    evidence: {
      document,
      field: 'applicantName',
      foundLabel: document,
      found: bad.name.english,
      neededLabel: agreeingLabel(ctx, compared),
      needed: firstForeign ? `${firstForeign.name.original} → ${firstForeign.name.english}` : ctx.form.fullName,
    },
  };
}

/** The same name in a different order or with initials: a person decides. */
function ambiguous(ctx: RuleContext, doc: Compared): Outcome {
  const document = shortName(ctx, doc.slot);
  return {
    status: 'needs_review',
    detail: `${document} has the same name in a different order or with initials`,
    evidence: {
      document,
      field: 'applicantName',
      foundLabel: document,
      found: doc.name.english,
      neededLabel: 'Form',
      needed: ctx.form.fullName,
    },
  };
}

/**
 * The applicant's name on every listed document must match the name on the form.
 * - an unreadable, missing or not-uploaded name makes the whole check `needs_review`
 * - a clear difference is a `fail`; name-order swaps and initials are `needs_review`, never a pass
 * - English documents compare the normalised English name; others compare a phonetic key of the transliteration
 */
export function crossDocumentMatch(rule: RuleOf<'cross_document_match'>, ctx: RuleContext): Outcome {
  const { compared, firstUnreadable } = gather(rule, ctx);
  const bad = compared.find((c) => c.verdict === 'mismatch');
  if (bad) return mismatch(ctx, bad, compared);
  const unsure = compared.find((c) => c.verdict === 'review');
  if (unsure) return ambiguous(ctx, unsure);
  if (firstUnreadable) return firstUnreadable;
  return { status: 'pass', detail: `Name matches on ${compared.length} documents and the form` };
}

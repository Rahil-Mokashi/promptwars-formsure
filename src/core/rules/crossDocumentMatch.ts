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

/** The first word that differs, as `[found, expected]`; whole names when the word counts differ. */
function firstDifference(found: string, expected: string): [string, string] {
  const a = found.trim().split(/\s+/);
  const b = expected.trim().split(/\s+/);
  const i = a.findIndex((word, k) => word.toLowerCase() !== (b[k] ?? '').toLowerCase());
  const gotWord = a[i];
  const wantWord = b[i];
  return a.length === b.length && gotWord !== undefined && wantWord !== undefined ? [gotWord, wantWord] : [found, expected];
}

/**
 * The applicant's name on every listed document must match the name on the form.
 * - an unreadable, missing or not-uploaded name makes the whole check `needs_review`
 * - a clear difference is a `fail`; name-order swaps and initials are `needs_review`, never a pass
 * - English documents compare the normalised English name; others compare a phonetic key of the transliteration
 */
export function crossDocumentMatch(rule: RuleOf<'cross_document_match'>, ctx: RuleContext): Outcome {
  const formName = ctx.form.fullName;
  const compared: Compared[] = [];
  let firstUnreadable: Outcome | undefined;

  for (const slot of rule.slots) {
    const doc = readableDocument(ctx, slot, 'applicantName');
    if (isOutcome(doc)) {
      firstUnreadable ??= doc;
      continue;
    }
    const name = doc.applicantName;
    if (!name || name.english.trim() === '') {
      const document = shortName(ctx, slot);
      firstUnreadable ??= {
        status: 'needs_review', detail: `No name could be read on ${document}`,
        evidence: { document, field: 'applicantName', foundLabel: document, found: 'No readable name', neededLabel: 'Form', needed: formName },
      };
      continue;
    }
    compared.push({ slot, doc, name, verdict: compareNames(name.english, formName, doc.language !== 'en') });
  }

  const bad = compared.find((c) => c.verdict === 'mismatch');
  if (bad) {
    const [got, want] = firstDifference(bad.name.english, formName);
    const good = compared.filter((c) => c.verdict === 'match');
    const foreign = good.filter((c) => c.doc.language !== 'en');
    const references = foreign.length > 0 ? foreign : good;
    const label = (c: Compared): string => (c.doc.language === 'en' ? shortName(ctx, c.slot) : `${shortName(ctx, c.slot)} (${LANGUAGE_NAMES[c.doc.language]})`);
    const firstForeign = foreign[0];
    return {
      status: 'fail',
      detail: `${shortName(ctx, bad.slot)} says ${got}, not ${want}`,
      evidence: {
        document: shortName(ctx, bad.slot), field: 'applicantName', foundLabel: shortName(ctx, bad.slot), found: bad.name.english,
        neededLabel: [...references.map(label), 'form'].join(', ').replace(/, ([^,]*)$/, ' and $1'),
        needed: firstForeign ? `${firstForeign.name.original} → ${firstForeign.name.english}` : formName,
      },
    };
  }

  const ambiguous = compared.find((c) => c.verdict === 'review');
  if (ambiguous) {
    const document = shortName(ctx, ambiguous.slot);
    return {
      status: 'needs_review',
      detail: `${document} has the same name in a different order or with initials`,
      evidence: { document, field: 'applicantName', foundLabel: document, found: ambiguous.name.english, neededLabel: 'Form', needed: formName },
    };
  }
  if (firstUnreadable) return firstUnreadable;
  return { status: 'pass', detail: `Name matches on ${compared.length} documents and the form` };
}

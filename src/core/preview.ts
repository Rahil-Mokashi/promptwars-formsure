import type { Check, DocumentsBySlot, ExtractedDocument, SchemePack, SlotDef } from './types';

/** One labelled value on the mini document; `hl` marks the problem field. */
interface PreviewRow {
  label: string;
  value: string;
  hl?: boolean;
}

/** A mini document to show next to the evidence of an issue. */
export interface Preview {
  slot: SlotDef;
  doc: ExtractedDocument;
  rows: PreviewRow[];
}

const dayMonthYear = (iso: string): string => iso.split('-').reverse().join('/');
const typeName = (type: string): string => type.replace(/_/g, ' ');

/**
 * Which document and field a failed rule is about, so the problem can be highlighted on a mini document.
 * @returns null for rules that are not about one field of one document
 */
export function previewFor(check: Check, docs: DocumentsBySlot, pack: SchemePack): Preview | null {
  const make = (slotId: string, rows: (d: ExtractedDocument) => PreviewRow[]): Preview | null => {
    const slot = pack.slots.find((s) => s.id === slotId);
    const doc = slot && docs[slot.id];
    return slot && doc ? { slot, doc, rows: rows(doc) } : null;
  };
  const name = (d: ExtractedDocument): PreviewRow => ({ label: 'Name', value: d.applicantName?.english ?? '-' });

  switch (check.ruleId) {
    case 'income-financial-year':
      return make('income_certificate', (d) => [
        { label: 'Issue date', value: d.issueDate ? dayMonthYear(d.issueDate) : 'not found', hl: true },
        { label: 'Authority', value: d.issuingAuthority ?? '-' },
        { label: 'Pages', value: String(d.pageCount) },
      ]);
    case 'income-ncl':
      return make('income_certificate', (d) => [
        { label: 'Pages', value: String(d.pageCount) },
        { label: 'Contains', value: d.documentTypes.map(typeName).join(', ') || '-', hl: true },
        { label: 'Issue date', value: d.issueDate ? dayMonthYear(d.issueDate) : '-' },
      ]);
    case 'name-match': {
      const slot = pack.slots.find((s) => s.short === check.evidence?.foundLabel);
      return slot
        ? make(slot.id, (d) => [
            { ...name(d), hl: true },
            { label: 'As printed', value: d.applicantName?.original ?? '-' },
            { label: 'Language', value: d.language },
          ])
        : null;
    }
    case 'dob-match':
      return make('aadhaar', (d) => [
        { label: 'Date of birth', value: d.dateOfBirth ? dayMonthYear(d.dateOfBirth) : '-', hl: true },
        name(d),
      ]);
    case 'category-match':
      return make('caste_certificate', (d) => [{ label: 'Category', value: d.category ?? '-', hl: true }, name(d)]);
    default:
      return null;
  }
}

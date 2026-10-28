import { runAudit } from '../core/engine';
import { buildSample } from '../core/sample';
import { mahadbtPack, type Pack } from '../core/schema';
import type { ApplicationForm, AuditReport, Check, DocumentsBySlot, ExtractedDocument, SlotId } from '../core/types';

/** The clock all engine tests use: 28 October 2026, inside Indian financial year 2026-27. */
export const NOW = new Date('2026-10-28T06:00:00Z');

/** The fictional sample applicant at {@link NOW}. */
export const sample = buildSample(NOW);

/** Documents that pass every rule. */
export const fixed: DocumentsBySlot = sample.fixedDocuments;

/** Returns `docs` with `patch` applied to one slot (the slot must exist). */
export function patchDoc(docs: DocumentsBySlot, slot: SlotId, patch: Partial<ExtractedDocument>): DocumentsBySlot {
  const doc = docs[slot];
  if (!doc) throw new Error(`no document in slot ${slot}`);
  return { ...docs, [slot]: { ...doc, ...patch } };
}

/** Returns `docs` without one slot. */
export function withoutDoc(docs: DocumentsBySlot, slot: SlotId): DocumentsBySlot {
  const copy = { ...docs };
  delete copy[slot];
  return copy;
}

/** Runs the audit of the shipped pack. */
export function audit(docs: DocumentsBySlot, form: ApplicationForm = sample.form, now: Date = NOW, pack: Pack = mahadbtPack): AuditReport {
  return runAudit(pack, form, docs, now);
}

/** One check of a report, by rule id (throws if the rule does not exist). */
export function checkOf(report: AuditReport, ruleId: string): Check {
  const check = report.checks.find((c) => c.ruleId === ruleId);
  if (!check) throw new Error(`no check ${ruleId}`);
  return check;
}

/** Status of one rule after auditing `docs`. */
export const statusOf = (docs: DocumentsBySlot, ruleId: string, form: ApplicationForm = sample.form): Check['status'] => checkOf(audit(docs, form), ruleId).status;

/** The seven required slots. */
export const ALL_SLOTS: readonly SlotId[] = ['aadhaar', 'caste_certificate', 'income_certificate', 'domicile', 'bonafide', 'marksheet', 'bank_passbook'];

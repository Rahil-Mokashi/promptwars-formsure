import { runAudit } from './core/engine';
import { extractDocument, maskDeep, UnavailableError, type Generate } from './core/extract';
import { createFirebaseGenerate } from './core/live';
import { buildSample } from './core/sample';
import { mahadbtPack, toWirePack } from './core/schema';
import type { ApplicationForm, AuditReport, DocumentsBySlot, ExtractedDocument, SampleResponse, SchemePack } from './core/types';

/** Everything runs in the browser: these are plain functions, not network calls (except live reading). */
export const pack: SchemePack = toWirePack(mahadbtPack);

export const getSample = (now = new Date()): SampleResponse => buildSample(now);

export const audit = (form: ApplicationForm, documents: DocumentsBySlot, now = new Date()): AuditReport =>
  maskDeep(runAudit(mahadbtPack, form, documents, now));

/** Reads one file with Gemini via Firebase AI Logic. `generate` is injectable for tests. */
export function extract(file: File, generate: Generate | null = createFirebaseGenerate()): Promise<ExtractedDocument> {
  if (!generate) return Promise.reject(new UnavailableError());
  return extractDocument(generate, file);
}

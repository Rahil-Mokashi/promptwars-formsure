import { runAudit } from '../core/engine';
import { UnavailableError } from '../core/errors';
import { maskDeep } from '../core/mask';
import { buildSample } from '../core/sample';
import { mahadbtPack, toWirePack } from '../core/schema';
import type { ApplicationForm, AuditReport, DocumentsBySlot, ExtractedDocument, SampleResponse, SchemePack } from '../core/types';
import { extractDocument, type ExtractOptions, type Generate } from './extraction';
import { createFirebaseGenerate } from './firebase';
import { geminiLimiter } from './rateLimiter';

/** Everything except live reading runs in the browser: these are plain functions, not network calls. */
export const pack: SchemePack = toWirePack(mahadbtPack);

/** Fictional sample applicant: the form plus an error set (57 %) and a fixed set (100 %). */
export const getSample = (now = new Date()): SampleResponse => buildSample(now);

/** Runs the rules engine and masks any 12-digit number in the result. */
export const audit = (form: ApplicationForm, documents: DocumentsBySlot, now = new Date()): AuditReport =>
  maskDeep(runAudit(mahadbtPack, form, documents, now));

/**
 * Reads one file with Gemini via Firebase AI Logic, through the shared client-side limiter.
 * `generate` is injectable for tests.
 * @throws {UnavailableError} when Firebase is not configured
 */
export function extract(
  file: File,
  options: ExtractOptions = {},
  generate: Generate | null = createFirebaseGenerate(),
): Promise<ExtractedDocument> {
  if (!generate) return Promise.reject(new UnavailableError());
  return extractDocument(generate, file, { beforeRequest: () => geminiLimiter.acquire(), ...options });
}

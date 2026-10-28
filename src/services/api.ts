import { runAudit } from '../core/engine';
import { UnavailableError } from '../core/errors';
import { maskDeep } from '../core/mask';
import { buildSample } from '../core/sample';
import { ALL_PACKS, DEFAULT_PACK_ID, getPack, toWirePack } from '../core/schema';
import type { ApplicationForm, AuditReport, DocumentsBySlot, ExtractedDocument, SampleResponse, SchemePack } from '../core/types';
import { extractDocument, type ExtractOptions, type Generate } from './extraction';
import { createFirebaseGenerate } from './firebase';
import { geminiLimiter } from './rateLimiter';

/** Every scheme pack, as the UI sees them. Everything except live reading runs in the browser. */
export const packs: readonly SchemePack[] = ALL_PACKS.map(toWirePack);

/** One pack by id, falling back to the default scheme. */
export const wirePack = (id: string): SchemePack => packs.find((p) => p.id === id) ?? packs[0] ?? toWirePack(ALL_PACKS[0] as (typeof ALL_PACKS)[number]);

/** The default pack (OBC). */
export const pack: SchemePack = wirePack(DEFAULT_PACK_ID);

/** Fictional sample applicant: the form plus an error set (50 %, one issue) and a fixed set (100 %). */
export const getSample = (now = new Date()): SampleResponse => buildSample(now);

/**
 * Runs the rules engine for one scheme and masks any 12-digit number in the result.
 * @param packId which scheme's rules to apply (default: OBC)
 */
export const audit = (form: ApplicationForm, documents: DocumentsBySlot, packId: string = DEFAULT_PACK_ID, now = new Date()): AuditReport => {
  const chosen = getPack(packId) ?? getPack(DEFAULT_PACK_ID);
  if (!chosen) throw new Error('no scheme pack');
  return maskDeep(runAudit(chosen, form, documents, now));
};

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

import './zodConfig';
import { z } from 'zod';
import raw from './schemes/mahadbt-postmatric-obc.2025-26.json';
import type { SchemePack } from './types';

const trio = z.object({ en: z.string(), mr: z.string(), hi: z.string() });
const slotId = z.enum(['aadhaar', 'caste_certificate', 'income_certificate', 'domicile', 'bonafide', 'marksheet', 'bank_passbook']);
const docType = z.enum([
  'aadhaar', 'caste_certificate', 'income_certificate', 'non_creamy_layer',
  'domicile_certificate', 'bonafide_certificate', 'marksheet', 'bank_passbook', 'other',
]);
const sourceKind = z.enum(['official', 'college-notice', 'secondary']);
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** One piece of evidence for a rule: where it was read, how trustworthy the source is, and the exact words. */
const evidence = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  kind: sourceKind,
  /** Verbatim text from the source. */
  quote: z.string().min(8),
});

/**
 * Register status of a rule:
 * - `verified`: backed by an official source or a college notice
 * - `pending`: only secondary sources so far
 * - `conflicting`: sources disagree
 */
const status = z.enum(['verified', 'pending', 'conflicting']);

const base = {
  id: z.string(),
  version,
  label: z.string(),
  severity: z.enum(['critical', 'warning']),
  why: trio,
  fix: trio,
  source: z.object({ label: z.string(), url: z.string().url(), kind: sourceKind }),
  status,
  lastChecked: isoDay,
  evidence: z.array(evidence).min(1),
  usesAi: z.boolean(),
  issueTitle: z.string(),
  issueDoc: z.string(),
};

/** Zod schema of one rule; the shape depends on `type`. */
export const ruleSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('required_document'), slots: z.array(slotId).min(1) }),
  z.object({ ...base, type: z.literal('document_check') }),
  z.object({ ...base, type: z.literal('date_window'), slot: slotId, field: z.literal('issueDate'), window: z.literal('indian_fy') }),
  z.object({
    ...base,
    type: z.literal('conditional'),
    when: z.object({ formField: z.literal('category'), in: z.array(z.string()).min(1) }),
    slot: slotId,
    mustContain: z.array(docType).min(1),
    needed: z.string(),
  }),
  z.object({ ...base, type: z.literal('cross_document_match'), formField: z.literal('fullName'), slots: z.array(slotId).min(2) }),
  z.object({
    ...base,
    type: z.literal('field_consistency'),
    formField: z.enum(['dateOfBirth', 'category']),
    slot: slotId,
    docField: z.enum(['dateOfBirth', 'category']),
    format: z.enum(['date', 'text']),
  }),
  z.object({ ...base, type: z.literal('numeric_max'), slot: slotId, docField: z.literal('annualIncome'), max: z.number().positive() }),
]);

export type Rule = z.infer<typeof ruleSchema>;

/** A rule is applied only when it is verified AND at least one piece of its evidence is official or a college notice. */
export const isEvaluable = (rule: Rule): boolean => rule.status === 'verified' && rule.evidence.some((e) => e.kind !== 'secondary');

/** Zod schema of a scheme pack, with the cross-checks that keep the register honest. */
export const packSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    portal: z.string(),
    version,
    academicYear: z.string().regex(/^\d{4}-\d{2}$/),
    slots: z.array(z.object({ id: slotId, short: z.string(), label: trio, accepts: z.array(docType).min(1) })).min(1),
    rules: z.array(ruleSchema).min(1),
  })
  .superRefine((pack, ctx) => {
    pack.rules.forEach((rule, i) => {
      const inEvidence = rule.evidence.find((e) => e.url === rule.source.url);
      if (!inEvidence || inEvidence.kind !== rule.source.kind) {
        ctx.addIssue({ code: 'custom', path: ['rules', i, 'source'], message: `rule ${rule.id}: source must be one of its evidence entries, with the same kind` });
      }
      if (rule.status === 'verified' && !rule.evidence.some((e) => e.kind !== 'secondary')) {
        ctx.addIssue({ code: 'custom', path: ['rules', i, 'status'], message: `rule ${rule.id}: verified needs an official or college-notice source` });
      }
    });
    if (new Set(pack.rules.map((r) => r.id)).size !== pack.rules.length) {
      ctx.addIssue({ code: 'custom', path: ['rules'], message: 'rule ids must be unique' });
    }
  });

export type Pack = z.infer<typeof packSchema>;

/** The shipped pack, parsed once at start-up: a malformed pack fails fast instead of at audit time. */
export const mahadbtPack: Pack = packSchema.parse(raw);

const packs: Record<string, Pack> = { [mahadbtPack.id]: mahadbtPack };

/** Looks a pack up by id. */
export const getPack = (id: string): Pack | undefined => packs[id];

/** The pack as the UI sees it (rules stay opaque there). */
export const toWirePack = (pack: Pack): SchemePack => pack as unknown as SchemePack;

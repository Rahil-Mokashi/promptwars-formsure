import { z } from 'zod';
import type { SchemePack } from '../../../shared/types';
import raw from '../schemes/mahadbt-postmatric-obc.json';

const trio = z.object({ en: z.string(), mr: z.string(), hi: z.string() });
const slotId = z.enum([
  'aadhaar',
  'caste_certificate',
  'income_certificate',
  'domicile',
  'bonafide',
  'marksheet',
  'bank_passbook',
]);
const docType = z.enum([
  'aadhaar',
  'caste_certificate',
  'income_certificate',
  'non_creamy_layer',
  'domicile_certificate',
  'bonafide_certificate',
  'marksheet',
  'bank_passbook',
  'other',
]);

const base = {
  id: z.string(),
  label: z.string(),
  severity: z.enum(['critical', 'warning']),
  why: trio,
  fix: trio,
  source: z.object({ label: z.string(), url: z.string().url(), kind: z.string() }),
  verified: z.boolean(),
  usesAi: z.boolean(),
  issueTitle: z.string(),
  issueDoc: z.string(),
};

export const ruleSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('required_document'), slots: z.array(slotId).min(1) }),
  z.object({ ...base, type: z.literal('document_check') }),
  z.object({
    ...base,
    type: z.literal('date_window'),
    slot: slotId,
    field: z.literal('issueDate'),
    window: z.literal('indian_fy'),
  }),
  z.object({
    ...base,
    type: z.literal('conditional'),
    when: z.object({ formField: z.literal('category'), in: z.array(z.string()).min(1) }),
    slot: slotId,
    mustContain: z.array(docType).min(1),
    needed: z.string(),
  }),
  z.object({
    ...base,
    type: z.literal('cross_document_match'),
    formField: z.literal('fullName'),
    slots: z.array(slotId).min(2),
  }),
  z.object({
    ...base,
    type: z.literal('field_consistency'),
    formField: z.enum(['dateOfBirth', 'category']),
    slot: slotId,
    docField: z.enum(['dateOfBirth', 'category']),
    format: z.enum(['date', 'text']),
  }),
  z.object({
    ...base,
    type: z.literal('numeric_max'),
    slot: slotId,
    docField: z.literal('annualIncome'),
    max: z.number().positive(),
  }),
]);

export const packSchema = z.object({
  id: z.string(),
  name: z.string(),
  portal: z.string(),
  slots: z
    .array(z.object({ id: slotId, short: z.string(), label: trio, accepts: z.array(docType).min(1) }))
    .min(1),
  rules: z.array(ruleSchema).min(1),
});

export type Rule = z.infer<typeof ruleSchema>;
export type Pack = z.infer<typeof packSchema>;

// Parsed once at start-up: a malformed pack fails fast instead of at audit time.
export const mahadbtPack: Pack = packSchema.parse(raw);

const packs: Record<string, Pack> = { [mahadbtPack.id]: mahadbtPack };
export const getPack = (id: string): Pack | undefined => packs[id];
export const toWirePack = (p: Pack): SchemePack => p as unknown as SchemePack;

import { must } from '../test/must';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_DOCS, renderRegister } from './register';
import { ALL_PACKS, isEvaluable, mahadbtPack, packSchema } from './schema';

const ROOT = resolve(__dirname, '../..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

describe('RULES.md is generated from the pack and in sync with it', () => {
  it('matches the generated register (run `npm run rules:register` to update)', () => {
    const generated = renderRegister(mahadbtPack);
    if (process.env.UPDATE_RULES_REGISTER === '1') writeFileSync(resolve(ROOT, 'RULES.md'), generated);
    expect(read('RULES.md')).toBe(generated);
  });

  it('lists every rule exactly once, with its status and every evidence quote verbatim', () => {
    const md = read('RULES.md');
    for (const rule of mahadbtPack.rules) {
      expect(md.split(`| \`${rule.id}\` |`).length - 1, rule.id).toBe(1);
      expect(md).toContain(`Status: **${rule.status}**`);
      for (const e of rule.evidence) expect(md).toContain(`“${e.quote}”`);
    }
  });

  it('every test named in the register exists in the named test file', () => {
    for (const [id, doc] of Object.entries(RULE_DOCS)) {
      expect(doc.tests.length, id).toBeGreaterThan(0);
      for (const t of doc.tests) expect(read(`src/${t.file}`), `${id}: ${t.title}`).toContain(t.title);
    }
    expect(Object.keys(RULE_DOCS).sort()).toEqual(mahadbtPack.rules.map((r) => r.id).sort());
  });
});

describe('scheme pack file', () => {
  it('is versioned in its file name by pack id and evidence year', () => {
    const expected = ALL_PACKS.map((p) => `${p.id}.${p.academicYear}.json`).sort();
    expect(readdirSync(resolve(ROOT, 'src/core/schemes'))).toEqual(expected);
  });

  it('only rules backed by an official source or a college notice are applied, and income limit stays conflicting', () => {
    const applied = mahadbtPack.rules.filter(isEvaluable).map((r) => r.id);
    expect(applied).toEqual(['right-document', 'income-ncl']);
    expect(mahadbtPack.rules.find((r) => r.id === 'income-limit')?.status).toBe('conflicting');
  });

  it('every rule has a dated, versioned register entry with verbatim evidence and a source kind', () => {
    for (const rule of mahadbtPack.rules) {
      expect(rule.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(rule.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(rule.evidence.every((e) => e.quote.length >= 8 && e.url.startsWith('https://'))).toBe(true);
      expect(['official', 'college-notice', 'secondary']).toContain(rule.source.kind);
    }
  });
});

describe('packSchema refuses an untrustworthy pack', () => {
  const clone = (): typeof mahadbtPack => JSON.parse(JSON.stringify(mahadbtPack)) as typeof mahadbtPack;

  it('accepts the shipped pack', () => {
    expect(packSchema.safeParse(clone()).success).toBe(true);
  });
  it('rejects a verified rule backed only by secondary sources', () => {
    const pack = clone();
    const rule = pack.rules.find((r) => r.id === 'name-match');
    if (rule) rule.status = 'verified';
    const result = packSchema.safeParse(pack);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/verified needs an official or college-notice source/);
  });
  it('rejects a source that is not one of the rule’s evidence entries', () => {
    const pack = clone();
    const rule = pack.rules[0];
    if (rule) rule.source = { label: 'x', url: 'https://example.org/other', kind: 'official' };
    expect(JSON.stringify(packSchema.safeParse(pack).error?.issues)).toMatch(
      /source must be one of its evidence entries/,
    );
  });
  it('rejects duplicate rule ids, a missing quote and a bad version', () => {
    const dup = clone();
    if (dup.rules[1] && dup.rules[0]) dup.rules[1].id = dup.rules[0].id;
    expect(packSchema.safeParse(dup).success).toBe(false);
    const noQuote = clone();
    const first = noQuote.rules[0];
    if (first) first.evidence = [{ ...must(first.evidence[0]), quote: '' }];
    expect(packSchema.safeParse(noQuote).success).toBe(false);
    const badVersion = clone();
    badVersion.version = 'one';
    expect(packSchema.safeParse(badVersion).success).toBe(false);
  });
});

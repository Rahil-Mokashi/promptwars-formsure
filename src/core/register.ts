import { SOURCE_KIND_LABEL } from './copy';
import { isEvaluable, type Pack } from './schema';

/** A test that covers a rule: the file under `src/` and a distinctive part of the test's title. */
interface RuleTest {
  file: string;
  title: string;
}

/** Hand-written register text for one rule. Everything else in RULES.md comes from the pack file. */
export interface RuleDoc {
  description: string;
  tests: readonly RuleTest[];
}

/** Descriptions and covering tests per rule id. */
export const RULE_DOCS: Readonly<Record<string, RuleDoc>> = {
  'required-documents': {
    description: 'Every required slot holds a file.',
    tests: [{ file: 'core/engine.test.ts', title: 'names every missing document' }],
  },
  'right-document': {
    description: 'Each file is legible and is the kind of document its slot accepts.',
    tests: [
      { file: 'core/engine.test.ts', title: 'fails on the wrong kind of document in a slot' },
      { file: 'core/engine.test.ts', title: 'needs review when nothing could be recognised in a file' },
    ],
  },
  'income-financial-year': {
    description: 'The income certificate was issued in the current Indian financial year (1 April to 31 March, IST).',
    tests: [
      { file: 'core/engine.test.ts', title: 'certificate issued 31 March fails on 1 April, passes on 31 March' },
      { file: 'core/engine.test.ts', title: 'uses India time: 20:00 UTC on 31 March is already 1 April in IST' },
    ],
  },
  'income-ncl': {
    description:
      'For OBC, SBC and VJNT applicants the income certificate slot holds the income certificate and the non-creamy-layer certificate in one PDF.',
    tests: [
      { file: 'core/engine.test.ts', title: 'is not evaluated for a category outside OBC / SBC / VJNT' },
      {
        file: 'core/engine.test.ts',
        title: 'says there is no matching certificate when nothing was recognised in the file',
      },
    ],
  },
  'name-match': {
    description:
      'The applicant name matches the form on all seven documents (English exactly after normalisation, Devanagari through a phonetic key; order swaps and initials need review).',
    tests: [
      { file: 'core/nameMatch.test.ts', title: 'an unreadable name on ANY of the seven documents needs review' },
      {
        file: 'core/nameMatch.test.ts',
        title: 'a Devanagari document passes on the phonetic key of its transliteration',
      },
    ],
  },
  'dob-match': {
    description: 'The date of birth on the form matches the Aadhaar.',
    tests: [{ file: 'core/engine.test.ts', title: 'fails on a different date of birth or category' }],
  },
  'category-match': {
    description: 'The category on the form matches the caste certificate.',
    tests: [{ file: 'core/engine.test.ts', title: 'fails on a different date of birth or category' }],
  },
  'income-limit': {
    description: 'Annual family income is within the scheme limit.',
    tests: [
      { file: 'core/engine.test.ts', title: 'passes at the maximum, fails above it, needs review when unreadable' },
      { file: 'core/engine.test.ts', title: 'a conflicting rule is not evaluated even when its data would fail it' },
    ],
  },
};

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * Renders RULES.md from the scheme pack, so every quote, URL, status and date in the register is the one the engine uses.
 * `npm run rules:register` rewrites the file; a test fails if it is out of date.
 */
export function renderRegister(pack: Pack): string {
  const lines: string[] = [
    '# Rules register',
    '',
    `Generated from \`src/core/schemes/${pack.id}.${pack.academicYear}.json\` (pack version ${pack.version}). Do not edit by hand: run \`npm run rules:register\`. A test fails if this file is out of date.`,
    '',
    '## How rules are trusted',
    '',
    '- **Source kinds:** `official` (a government page), `college-notice` (a notice published by a college) and `secondary` (guides and news).',
    '- **Status:** `verified` (backed by an official source or a college notice), `pending` (secondary sources only) and `conflicting` (sources disagree).',
    '- **Only rules that are `verified` with at least one `official` or `college-notice` source are applied.** `pending` and `conflicting` rules are reported as *not evaluated*, never as a pass or a fail.',
    `- **Evidence year:** the quotes below come from notices for academic year ${pack.academicYear}. Whether the same rule holds for another year is not verified.`,
    '- Quotes are verbatim from the sources, read on the "last checked" date. The college-notice PDFs were read as text with `pdftotext`; the official page and the guides were read through a web fetch tool, so re-check a quote against the live page before relying on it.',
    '',
    '## Summary',
    '',
    '| Rule id | Description | Applied | Status | Source (kind) | Evidence year | Version | Last checked | Tests |',
    '|---|---|---|---|---|---|---|---|---|',
  ];

  for (const rule of pack.rules) {
    const doc = RULE_DOCS[rule.id];
    const tests = (doc?.tests ?? []).map((t) => `\`${t.file}\` “${t.title}”`).join('<br>');
    lines.push(
      `| \`${rule.id}\` | ${cell(doc?.description ?? rule.label)} | ${isEvaluable(rule) ? 'yes' : 'no'} | ${rule.status} | [${cell(rule.source.label)}](${rule.source.url}) (${rule.source.kind}) | ${pack.academicYear} | ${rule.version} | ${rule.lastChecked} | ${cell(tests)} |`,
    );
  }

  lines.push('', '## Evidence', '');
  for (const rule of pack.rules) {
    lines.push(
      `### \`${rule.id}\` — ${rule.label}`,
      '',
      `Status: **${rule.status}**. ${isEvaluable(rule) ? 'Applied.' : 'Not evaluated.'} Last checked ${rule.lastChecked}.`,
      '',
    );
    for (const e of rule.evidence) {
      lines.push(`- **${SOURCE_KIND_LABEL[e.kind]}**, [${e.label}](${e.url}): “${e.quote}”`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

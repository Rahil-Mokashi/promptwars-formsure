import { fyStartYear, istDate } from './dates';
import { toDevanagari } from './names';
import { evaluateRule } from './rules';
import { notEvaluated, type Outcome, type RuleContext } from './rules/context';
import type { Pack } from './schema';
import type { ApplicationForm, AuditReport, Check, DocumentsBySlot, Lang, Trio } from './types';

export { fyLabel, fyStartYear, longDate } from './dates';
export { phonetic } from './names';

const PERCENT = 100;

/** Fills `{year}` in a fix text; Marathi gets Devanagari digits. */
const fillYear = (text: string, lang: Lang, year: string): string => text.replace('{year}', lang === 'mr' ? toDevanagari(year) : year);
const fillFix = (fix: Trio, year: string): Trio => ({ en: fillYear(fix.en, 'en', year), mr: fillYear(fix.mr, 'mr', year), hi: fillYear(fix.hi, 'hi', year) });

/**
 * Checks an application against a scheme pack.
 * Unverified rules are not evaluated, never applied. Readiness counts passes against failures and checks that
 * need review, so it is 100 only when every evaluated rule passed.
 * @param now used to decide which Indian financial year is current
 * @returns readiness (`passed ÷ (passed + failed + needing review) × 100`, rounded) and every check with evidence, why, fix and source
 */
export function runAudit(pack: Pack, form: ApplicationForm, documents: DocumentsBySlot, now: Date): AuditReport {
  const today = istDate(now);
  const year = String(fyStartYear(today));
  const ctx: RuleContext = { pack, form, docs: documents, today };

  const checks: Check[] = pack.rules.map((rule) => {
    const outcome: Outcome = rule.verified ? evaluateRule(rule, ctx) : notEvaluated('Rule not verified yet, skipped');
    return {
      ruleId: rule.id,
      label: rule.label,
      status: outcome.status,
      detail: outcome.detail,
      evidence: outcome.evidence ?? null,
      severity: rule.severity,
      usesAi: rule.usesAi,
      why: rule.why,
      fix: fillFix(rule.fix, year),
      source: rule.source,
      issueTitle: rule.issueTitle,
      issueDoc: rule.issueDoc,
      ruleVersion: rule.version,
      academicYear: pack.academicYear,
    };
  });

  const count = (status: Check['status']): number => checks.filter((c) => c.status === status).length;
  const passed = count('pass');
  const failed = count('fail');
  const needsReview = count('needs_review');
  const applied = passed + failed + needsReview;
  return {
    readiness: applied === 0 ? 0 : Math.round((passed / applied) * PERCENT),
    checks,
    passed,
    failed,
    needsReview,
    notEvaluated: count('not_evaluated'),
  };
}

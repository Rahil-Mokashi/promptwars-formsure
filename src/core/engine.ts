import { fyStartYear, istDate } from './dates';
import { toDevanagari } from './names';
import { evaluateRule } from './rules';
import { notEvaluated, type Outcome, type RuleContext } from './rules/context';
import { isEvaluable, type Pack, type Rule } from './schema';
import type { ApplicationForm, AuditReport, Check, DocumentsBySlot, Lang, Trio } from './types';

const PERCENT = 100;

/** Fills `{year}` in a fix text; Marathi gets Devanagari digits. */
const fillYear = (text: string, lang: Lang, year: string): string =>
  text.replace('{year}', lang === 'mr' ? toDevanagari(year) : year);
const fillFix = (fix: Trio, year: string): Trio => ({
  en: fillYear(fix.en, 'en', year),
  mr: fillYear(fix.mr, 'mr', year),
  hi: fillYear(fix.hi, 'hi', year),
});

/** Why a rule is not applied, in the words the report uses. */
const skipReason = (rule: Rule): string =>
  rule.status === 'conflicting' ? 'Sources conflict, rule skipped' : 'Rule not verified yet, skipped';

/**
 * A rule that is not verified still runs as an advisory warning that never affects the score, when its check itself is
 * not in doubt: pending rules (secondary sources only), and conflicting rules whose sources disagree only on details.
 * A conflicting numeric limit is never applied, because the threshold itself is unknown.
 */
const isAdvisory = (rule: Rule): boolean =>
  !isEvaluable(rule) && (rule.status === 'pending' || (rule.status === 'conflicting' && rule.type !== 'numeric_max'));

/**
 * Checks an application against a scheme pack.
 * Only rules that are verified by an official source or a college notice count towards readiness. Pending rules
 * (secondary sources only) run as advisory warnings that are shown but never scored; conflicting rules are skipped.
 * Readiness counts passes against failures and checks that need review, so it is 100 only when every scored rule passed.
 * @param now used to decide which Indian financial year is current
 * @returns readiness (`passed ÷ (passed + failed + needing review) × 100`, rounded) and every check with evidence, why, fix and source
 */
export function runAudit(pack: Pack, form: ApplicationForm, documents: DocumentsBySlot, now: Date): AuditReport {
  const today = istDate(now);
  const year = String(fyStartYear(today));
  const ctx: RuleContext = { pack, form, docs: documents, today };

  const checks: Check[] = pack.rules.map((rule) => {
    const advisory = isAdvisory(rule);
    const outcome: Outcome = isEvaluable(rule) || advisory ? evaluateRule(rule, ctx) : notEvaluated(skipReason(rule));
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
      advisory,
    };
  });

  const scored = checks.filter((c) => !c.advisory);
  const count = (status: Check['status'], from: readonly Check[] = scored): number =>
    from.filter((c) => c.status === status).length;
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
    notEvaluated: count('not_evaluated', checks),
    advisories: checks.filter((c) => c.advisory && (c.status === 'fail' || c.status === 'needs_review')).length,
  };
}

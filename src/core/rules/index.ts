import { assertNever } from '../assertNever';
import type { Rule } from '../schema';
import { conditional } from './conditional';
import type { Outcome, RuleContext } from './context';
import { crossDocumentMatch } from './crossDocumentMatch';
import { dateWindow } from './dateWindow';
import { documentCheck } from './documentCheck';
import { fieldConsistency } from './fieldConsistency';
import { numericMax } from './numericMax';
import { requiredDocument } from './requiredDocument';

/** Runs one rule. The switch is exhaustive: adding a rule type without handling it fails to compile. */
export function evaluateRule(rule: Rule, ctx: RuleContext): Outcome {
  switch (rule.type) {
    case 'required_document':
      return requiredDocument(rule, ctx);
    case 'document_check':
      return documentCheck(rule, ctx);
    case 'date_window':
      return dateWindow(rule, ctx);
    case 'conditional':
      return conditional(rule, ctx);
    case 'cross_document_match':
      return crossDocumentMatch(rule, ctx);
    case 'field_consistency':
      return fieldConsistency(rule, ctx);
    case 'numeric_max':
      return numericMax(rule, ctx);
    default:
      return assertNever(rule);
  }
}

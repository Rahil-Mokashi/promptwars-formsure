import { fyLabel, fyStartYear, longDate, slashDate } from '../dates';
import { isOutcome, needsReview, readableDocument, shortName, type Outcome, type RuleContext, type RuleOf } from './context';

/** The document's issue date must fall inside the current Indian financial year (1 April to 31 March). */
export function dateWindow(rule: RuleOf<'date_window'>, ctx: RuleContext): Outcome {
  const doc = readableDocument(ctx, rule.slot, rule.field);
  if (isOutcome(doc)) return doc;

  const start = fyStartYear(ctx.today);
  const needed = `Issued in FY ${fyLabel(start)}, on or after 1 April ${start}`;
  const document = shortName(ctx, rule.slot);
  if (!doc.issueDate) {
    return needsReview('Issue date not found or not a real date', { document, field: rule.field, foundLabel: 'Found on certificate', found: 'No readable issue date', neededLabel: 'Needed', needed });
  }

  const inWindow = doc.issueDate >= `${start}-04-01` && doc.issueDate <= `${start + 1}-03-31`;
  const fy = fyLabel(fyStartYear(doc.issueDate));
  if (inWindow) return { status: 'pass', detail: `Issued ${longDate(doc.issueDate)}, FY ${fy}` };
  return {
    status: 'fail',
    detail: `Issued ${longDate(doc.issueDate)}, FY ${fy}`,
    evidence: { document, field: rule.field, foundLabel: 'Found on certificate', found: `Issued ${slashDate(doc.issueDate)} (FY ${fy})`, neededLabel: 'Needed', needed },
  };
}

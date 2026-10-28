import type { AuditReport } from '../../core/types';
import { Ring } from '../Ring';

/** The ring, the three counts, and a note about rules that were not evaluated. */
export function ScoreCard({ report }: { report: AuditReport }) {
  const notEvaluated = report.checks.filter((c) => c.status === 'not_evaluated');
  return (
    <section className="card ringcard" aria-label="Readiness score">
      <Ring pct={report.readiness} />
      <div className="stats">
        <div className="stat"><b style={{ color: '#047857' }}>{report.passed}</b><span>Passed</span></div>
        <div className="stat"><b style={{ color: '#BE123C' }}>{report.failed}</b><span>To fix</span></div>
        <div className="stat"><b style={{ color: '#92400E' }}>{report.needsReview}</b><span>Couldn’t verify</span></div>
      </div>
      {notEvaluated.length > 0 && (
        <div className="skipnote">
          <b>Not evaluated ({notEvaluated.length}): {notEvaluated.map((c) => c.label.toLowerCase()).join('; ')}.</b>{' '}
          Their sources conflict or are not official yet, so FormSure never applies them. They do not count towards the score.
        </div>
      )}
    </section>
  );
}

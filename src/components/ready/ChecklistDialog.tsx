import { PRECHECK_DISCLAIMER } from '../../core/copy';
import type { ApplicationForm, AuditReport, CheckStatus } from '../../core/types';
import { Modal } from '../Modal';

const TEXT_MARK: Record<CheckStatus, string> = { pass: 'x', fail: '!', needs_review: '?', not_evaluated: '-' };

/** Plain-text copy of the checklist, built in the browser. Nothing is uploaded. */
function downloadText(report: AuditReport, form: ApplicationForm): void {
  const lines = [
    'FormSure checklist for college desk',
    `Applicant: ${form.fullName}`,
    `Readiness: ${report.readiness}%`,
    '',
    ...report.checks.map((c) => `[${TEXT_MARK[c.status]}] ${c.label}: ${c.detail}`),
    '',
    PRECHECK_DISCLAIMER,
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'formsure-checklist.txt';
  link.click();
  URL.revokeObjectURL(url);
}

/** Props of {@link ChecklistDialog}. */
export interface ChecklistDialogProps {
  report: AuditReport;
  form: ApplicationForm;
  onClose: () => void;
}

/** A clean, printable checklist for the college scholarship desk. */
export function ChecklistDialog({ report, form, onClose }: ChecklistDialogProps) {
  return (
    <Modal title="Checklist for college desk" onClose={onClose} printable>
      <div className="checklist">
        <h3>FormSure checklist · {form.fullName}</h3>
        <p className="pdesc" style={{ margin: 0 }}>
          Category {form.category} · Date of birth {form.dateOfBirth.split('-').reverse().join('/')} · Readiness {report.readiness}% · {new Date().toLocaleDateString('en-IN')}
        </p>
        <ul>
          {report.checks.map((c) => (
            <li key={c.ruleId}>
              <span className="box" aria-hidden="true">{c.status === 'pass' ? '✓' : c.status === 'needs_review' ? '?' : ''}</span>
              <span>
                <b>{c.label}</b>
                <br />
                <span style={{ color: '#5B6478' }}>
                  {c.status === 'not_evaluated' ? `Not evaluated: ${c.detail}` : c.status === 'needs_review' ? `Couldn’t verify, check manually: ${c.detail}` : c.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="disclaimer" style={{ marginTop: 8 }}>{PRECHECK_DISCLAIMER}</p>
      </div>
      <div className="row noprint" style={{ marginTop: 18 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Print or save as PDF</button>
        <button className="btn btn-ghost" onClick={() => downloadText(report, form)}>Download as text</button>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ApplicationForm, AuditReport } from '../core/types';
import { CalendarIcon, DownloadIcon } from '../icons';
import { fadeUp, useReduce } from '../motion';
import { Confetti } from './Confetti';
import { Modal } from './Modal';
import { Ring } from './Ring';

const mark = (s: string) => (s === 'pass' ? '✓' : s === 'fail' ? '!' : '–');

/** Plain-text copy of the checklist, built in the browser. Nothing is uploaded. */
function downloadText(report: AuditReport, form: ApplicationForm) {
  const lines = [
    'FormSure checklist for college desk',
    `Applicant: ${form.fullName}`,
    `Readiness: ${report.readiness}%`,
    '',
    ...report.checks.map((c) => `[${c.status === 'pass' ? 'x' : c.status === 'fail' ? '!' : '-'}] ${c.label}: ${c.detail}`),
    '',
    'FormSure flags likely problems before you submit. Final approval is always decided by MahaDBT and your college.',
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'formsure-checklist.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function ChecklistDialog({ report, form, onClose }: { report: AuditReport; form: ApplicationForm; onClose: () => void }) {
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
              <span className="box" aria-hidden="true">{c.status === 'pass' ? mark('pass') : ''}</span>
              <span>
                <b>{c.label}</b>
                <br />
                <span style={{ color: '#5B6478' }}>{c.status === 'skipped' ? `Skipped: ${c.detail}` : c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="disclaimer" style={{ marginTop: 8 }}>
          FormSure flags likely problems before you submit. Final approval is always decided by MahaDBT and your college.
        </p>
      </div>
      <div className="row noprint" style={{ marginTop: 18 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Print or save as PDF</button>
        <button className="btn btn-ghost" onClick={() => downloadText(report, form)}>Download as text</button>
      </div>
    </Modal>
  );
}

export function Ready({ report, form, onRestart }: { report: AuditReport; form: ApplicationForm; onRestart: () => void }) {
  const reduce = useReduce();
  const [open, setOpen] = useState(false);
  return (
    <main className="wrap page">
      {!reduce && <Confetti />}
      <section className="card ready" aria-labelledby="ready-h">
        <Ring pct={report.readiness} />
        <motion.h2 className="h2" id="ready-h" style={{ marginTop: 24 }} {...fadeUp(reduce, 0.3)}>Ready to submit</motion.h2>
        <p className="sub" style={{ margin: '10px auto 0' }}>
          All {report.passed} verified checks passed. {report.skipped} {report.skipped === 1 ? 'rule was' : 'rules were'} skipped because {report.skipped === 1 ? 'it isn’t' : 'they aren’t'} verified yet.
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 28 }}>
          <button className="btn btn-green" onClick={() => setOpen(true)}>
            <DownloadIcon />Download checklist for college desk
          </button>
          <a className="btn btn-ghost" href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=MahaDBT%20scholarship%20deadline" target="_blank" rel="noopener noreferrer">
            <CalendarIcon />Add deadline to Google Calendar
          </a>
        </div>
        <p className="disclaimer">FormSure flags likely problems before you submit. Final approval is always decided by MahaDBT and your college.</p>
        <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={onRestart}>Check another application</button>
      </section>
      {open && <ChecklistDialog report={report} form={form} onClose={() => setOpen(false)} />}
    </main>
  );
}

import { motion } from 'framer-motion';
import type { ApplicationForm, AuditReport } from '../core/types';
import { CalendarIcon, DownloadIcon } from '../icons';
import { EASE, fadeUp, useReduce } from '../motion';
import { Ring } from './Ring';

const COLORS = ['#4338CA', '#059669', '#D97706', '#E11D48', '#A5B4FC', '#6EE7B7'];
const CONFETTI = Array.from({ length: 14 }, (_, k) => {
  const ang = (k / 14) * Math.PI * 2;
  return { x: Math.round(Math.cos(ang) * 240), y: Math.round(Math.sin(ang) * 140 + 60), c: COLORS[k % COLORS.length], d: k * 0.025 };
});

/** Plain-text checklist for the college scholarship desk. Built in the browser; nothing is uploaded. */
function downloadChecklist(report: AuditReport, form: ApplicationForm) {
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

export function Ready({ report, form, onRestart }: { report: AuditReport; form: ApplicationForm; onRestart: () => void }) {
  const reduce = useReduce();
  return (
    <main className="wrap page">
      <section className="card ready" aria-labelledby="ready-h">
        {!reduce && (
          <div className="confetti" aria-hidden="true">
            {CONFETTI.map((p, i) => (
              <motion.i
                key={i}
                style={{ background: p.c }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                animate={{ x: p.x, y: p.y, rotate: 260, opacity: 0 }}
                transition={{ duration: 1.1, delay: p.d, ease: EASE }}
              />
            ))}
          </div>
        )}
        <Ring pct={report.readiness} />
        <motion.h2 className="h2" id="ready-h" style={{ marginTop: 24 }} {...fadeUp(reduce, 0.3)}>Ready to submit</motion.h2>
        <p className="sub" style={{ margin: '10px auto 0' }}>
          All {report.passed} verified checks passed. {report.skipped} {report.skipped === 1 ? 'rule was' : 'rules were'} skipped because {report.skipped === 1 ? 'it isn’t' : 'they aren’t'} verified yet.
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 28 }}>
          <button className="btn btn-green" onClick={() => downloadChecklist(report, form)}>
            <DownloadIcon />Download checklist for college desk
          </button>
          <a className="btn btn-ghost" href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=MahaDBT%20scholarship%20deadline" target="_blank" rel="noopener noreferrer">
            <CalendarIcon />Add deadline to Google Calendar
          </a>
        </div>
        <p className="disclaimer">FormSure flags likely problems before you submit. Final approval is always decided by MahaDBT and your college.</p>
        <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={onRestart}>Check another application</button>
      </section>
    </main>
  );
}

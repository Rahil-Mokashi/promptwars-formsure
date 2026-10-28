import { motion } from 'framer-motion';
import { useState } from 'react';
import { Confetti } from '../components/Confetti';
import { CalendarIcon, DownloadIcon } from '../components/icons';
import { fadeUp } from '../components/motionProps';
import { ChecklistDialog } from '../components/ready/ChecklistDialog';
import { Ring } from '../components/Ring';
import { PRECHECK_DISCLAIMER, precheckSummary } from '../core/copy';
import type { ApplicationForm, AuditReport } from '../core/types';
import { useReduce } from '../hooks/useMotion';

const CALENDAR_URL = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=MahaDBT%20scholarship%20deadline';

/** Props of {@link Ready}. */
export interface ReadyProps {
  report: AuditReport;
  form: ApplicationForm;
  onRestart: () => void;
}

/** Last screen, shown when every evaluated rule passed: confetti, the summary, the checklist and a calendar link. */
export function Ready({ report, form, onRestart }: ReadyProps) {
  const reduce = useReduce();
  const [open, setOpen] = useState(false);
  return (
    <main className="wrap page" id="main" tabIndex={-1}>
      {!reduce && <Confetti />}
      <section className="card ready" aria-labelledby="ready-h">
        <Ring pct={report.readiness} />
        <motion.h1 className="h2" id="ready-h" style={{ marginTop: 24 }} {...fadeUp(reduce, 0.3)}>Pre-check complete</motion.h1>
        <p className="sub" style={{ margin: '10px auto 0' }}>
          {precheckSummary(report.passed, report.failed, report.needsReview)} {report.notEvaluated > 0 && `${report.notEvaluated} ${report.notEvaluated === 1 ? 'rule was' : 'rules were'} not evaluated because ${report.notEvaluated === 1 ? 'its' : 'their'} sources are not official or conflict.`}
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 28 }}>
          <button className="btn btn-green" onClick={() => setOpen(true)}><DownloadIcon />Download checklist for college desk</button>
          <a className="btn btn-ghost" href={CALENDAR_URL} target="_blank" rel="noopener noreferrer"><CalendarIcon />Add deadline to Google Calendar</a>
        </div>
        <p className="disclaimer">{PRECHECK_DISCLAIMER} Final approval is always decided by MahaDBT and your college.</p>
        <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={onRestart}>Check another application</button>
      </section>
      {open && <ChecklistDialog report={report} form={form} onClose={() => setOpen(false)} />}
    </main>
  );
}

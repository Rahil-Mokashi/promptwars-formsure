import { motion } from 'framer-motion';
import type { AuditReport, Check, ReadProgress } from '../../core/types';
import { DashIcon, QuestionIcon, Spinner, Tick, XIcon } from '../icons';

const SHAKE_S = 0.4;
const SHAKE_PX = 4;

type RowState = Check['status'] | 'running' | 'pending';

const SPOKEN: Record<RowState, string> = {
  pass: ' Passed.', fail: ' Needs fixing.', needs_review: ' Couldn’t verify, check manually.', not_evaluated: ' Not evaluated.', running: '', pending: '',
};

function StatusIcon({ state, reduce }: { state: RowState; reduce: boolean }) {
  switch (state) {
    case 'pass':
      return <span className="cicon ci-pass"><Tick reduce={reduce} /></span>;
    case 'fail':
      return (
        <motion.span className="cicon ci-fail" animate={reduce ? undefined : { x: [0, -SHAKE_PX, SHAKE_PX, 0] }} transition={{ duration: SHAKE_S }}>
          <XIcon size={14} />
        </motion.span>
      );
    case 'needs_review':
      return <span className="cicon ci-review"><QuestionIcon size={14} /></span>;
    case 'not_evaluated':
      return <span className="cicon ci-skip"><DashIcon size={14} /></span>;
    case 'running':
      return <span className="cicon ci-run"><Spinner reduce={reduce} /></span>;
    case 'pending':
      return <span className="cicon ci-pend" />;
  }
}

/** Props of {@link CheckList}. */
export interface CheckListProps {
  report: AuditReport | null;
  /** How many checks have been revealed. */
  step: number;
  /** Live reading progress, shown while there is no report yet. */
  progress: ReadProgress | null | undefined;
  reduce: boolean;
}

/** The eight checks: pending, then running, then pass / fail / skipped. Before the report exists it shows reading progress. */
export function CheckList({ report, step, progress, reduce }: CheckListProps) {
  return (
    <section className="card" aria-label="Checks" aria-live="polite">
      <ul className="checks">
        {!report && (
          <li className="check running">
            <span className="cicon ci-run"><Spinner reduce={reduce} /></span>
            <div>
              <div className="clabel">{progress ? `Reading ${progress.index} of ${progress.total}…` : 'Reading your documents'}</div>
              <div className="cdetail">{progress ? progress.detail : 'Checking…'}</div>
            </div>
          </li>
        )}
        {report?.checks.map((c, i) => {
          const state: RowState = i < step ? c.status : i === step ? 'running' : 'pending';
          return (
            <li key={c.ruleId} className={`check ${state === 'running' ? 'running' : state === 'fail' ? 'fail' : ''}`}>
              <StatusIcon state={state} reduce={reduce} />
              <div>
                <div className="clabel">
                  {c.label}
                  {c.usesAi && <span className="ctag">AI</span>}
                  <span className="sr-only">{SPOKEN[state]}</span>
                </div>
                <div className="cdetail">{state === 'pending' ? 'Waiting' : state === 'running' ? 'Checking…' : c.detail}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import { m } from 'framer-motion';
import { ArrowIcon } from '../icons';
import { fadeUp } from '../motionProps';

const REPORT_FADE_S = 0.5;

/** Props of {@link AuditHeader}. */
export interface AuditHeaderProps {
  firstName: string;
  /** The report exists but the checks are still being revealed. */
  canSkip: boolean;
  /** Every check is revealed. */
  done: boolean;
  reduce: boolean;
  onSkip: () => void;
  onReport: () => void;
}

/** Title, the "Skip animation" button while checks are revealed, and "See readiness report" when they are all shown. */
export function AuditHeader({ firstName, canSkip, done, reduce, onSkip, onReport }: AuditHeaderProps) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div>
        <h1 className="h2">{firstName ? `Checking ${firstName}’s application` : 'Checking your application'}</h1>
        <p className="sub">Gemini reads each document. Then plain rules decide pass or fail.</p>
      </div>
      {canSkip && (
        <button className="btn btn-ghost" onClick={onSkip}>
          Skip animation
        </button>
      )}
      {done && (
        <m.button className="btn btn-primary" onClick={onReport} {...fadeUp(reduce, 0, REPORT_FADE_S)}>
          See readiness report
          <ArrowIcon />
        </m.button>
      )}
    </div>
  );
}

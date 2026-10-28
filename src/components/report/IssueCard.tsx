import { AnimatePresence, motion } from 'framer-motion';
import type { Preview } from '../../core/preview';
import type { Check, Lang } from '../../core/types';
import { ChevronIcon, QuestionIcon, WarnIcon } from '../icons';
import { fadeUp } from '../motionProps';
import { IssueBody } from './IssueBody';

const STAGGER_START_S = 0.2;
const STAGGER_STEP_S = 0.12;
const OPEN_S = 0.3;

/** Props of {@link IssueCard}. */
export interface IssueCardProps {
  check: Check;
  index: number;
  lang: Lang;
  open: boolean;
  preview: Preview | null;
  reduce: boolean;
  onToggle: () => void;
}

/** One issue: a failed check, or one that could not be verified (amber, with an icon and the words "Couldn't verify"). */
export function IssueCard({ check, index, lang, open, preview, reduce, onToggle }: IssueCardProps) {
  const review = check.status === 'needs_review';
  const body = <IssueBody check={check} lang={lang} preview={preview} reduce={reduce} />;
  return (
    <motion.article className={`card issue ${review ? 'issue-review' : ''}`} layout={!reduce} {...fadeUp(reduce, STAGGER_START_S + index * STAGGER_STEP_S)}>
      <button className="issue-head" onClick={onToggle} aria-expanded={open}>
        <span className={`sev ${review ? 'sev-review' : ''}`}>
          {review ? <QuestionIcon size={14} /> : <WarnIcon size={14} />}
          {review ? 'Couldn’t verify' : check.severity === 'critical' ? 'Critical' : 'Warning'}
        </span>
        <span>
          <span className="ititle" style={{ display: 'block' }}>{review ? `Check manually: ${check.label}` : check.issueTitle}</span>
          <span className="idoc" style={{ display: 'block' }}>{check.issueDoc}</span>
        </span>
        <ChevronIcon open={open} reduce={reduce} />
      </button>
      {reduce ? (
        open && body
      ) : (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div key="body" style={{ overflow: 'hidden' }} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: OPEN_S }}>
              {body}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.article>
  );
}

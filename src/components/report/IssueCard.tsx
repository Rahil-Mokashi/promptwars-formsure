import { AnimatePresence, m } from 'framer-motion';
import type { ReactNode } from 'react';
import type { Preview } from '../../core/preview';
import type { Check, Lang } from '../../core/types';
import { ChevronIcon, QuestionIcon, WarnIcon } from '../icons';
import { fadeUp } from '../motionProps';
import { IssueBody } from './IssueBody';
import { issueView } from './issueView';

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

/** The part of a card that opens and closes: animated in height, or simply shown or hidden with reduced motion. */
function Collapse({ open, reduce, children }: { open: boolean; reduce: boolean; children: ReactNode }) {
  if (reduce) return open ? children : null;
  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.div
          key="body"
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: OPEN_S }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** One issue: a failed check, or one that could not be verified (amber, with an icon and the words "Couldn't verify"). */
export function IssueCard({ check, index, lang, open, preview, reduce, onToggle }: IssueCardProps) {
  const view = issueView(check);
  return (
    <m.article
      className={`card issue ${view.review ? 'issue-review' : ''}`}
      layout={!reduce}
      {...fadeUp(reduce, STAGGER_START_S + index * STAGGER_STEP_S)}
    >
      <button className="issue-head" onClick={onToggle} aria-expanded={open}>
        <span className={`sev ${view.review ? 'sev-review' : ''}`}>
          {view.review ? <QuestionIcon size={14} /> : <WarnIcon size={14} />}
          {view.badge}
        </span>
        <span>
          <span className="ititle" style={{ display: 'block' }}>
            {view.title}
          </span>
          <span className="idoc" style={{ display: 'block' }}>
            {check.issueDoc}
            {view.note}
          </span>
        </span>
        <ChevronIcon open={open} reduce={reduce} />
      </button>
      <Collapse open={open} reduce={reduce}>
        <IssueBody check={check} lang={lang} preview={preview} reduce={reduce} />
      </Collapse>
    </m.article>
  );
}

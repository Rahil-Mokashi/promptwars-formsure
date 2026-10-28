import { NEEDS_REVIEW_FIX, NEEDS_REVIEW_WHY, SOURCE_KIND_LABEL } from '../../core/copy';
import type { Preview } from '../../core/preview';
import type { Check, Lang } from '../../core/types';
import { ExternalIcon, SparkIcon, WrenchIcon } from '../icons';
import { MiniDoc } from './MiniDoc';

/** Props of {@link IssueBody}. */
export interface IssueBodyProps {
  check: Check;
  lang: Lang;
  preview: Preview | null;
  reduce: boolean;
}

/** The open part of an issue: evidence, a mini document, why it matters, the fix and the source. */
export function IssueBody({ check, lang, preview, reduce }: IssueBodyProps) {
  const evidence = check.evidence;
  const review = check.status === 'needs_review';
  return (
    <div className="ibody">
      {review && <p className="reviewnote"><b>Couldn’t verify, check manually.</b> {check.detail}.</p>}
      <div className="evpreview">
        {evidence && (
          <div className="evidence" style={{ gridTemplateColumns: '1fr' }}>
            <div className={`ev ${review ? 'warn' : 'bad'}`}><div className="evlabel">{evidence.foundLabel}</div><div className="evval">{evidence.found}</div></div>
            <div className="ev good"><div className="evlabel">{evidence.neededLabel}</div><div className="evval">{evidence.needed}</div></div>
          </div>
        )}
        {preview && <MiniDoc preview={preview} reduce={reduce} />}
      </div>
      {check.usesAi && <span className="ainote"><SparkIcon size={14} />Matched by Gemini across Marathi and English</span>}
      <p className="why"><b>Why it matters.</b> {review ? NEEDS_REVIEW_WHY[lang] : check.why[lang]}</p>
      <div className="fix" lang={lang}>
        <WrenchIcon style={{ flex: 'none', marginTop: 3, color: '#4338CA' }} />
        <span className={lang === 'en' ? '' : 'dev'}>{review ? NEEDS_REVIEW_FIX[lang] : check.fix[lang]}</span>
      </div>
      <a className="src" href={check.source.url} target="_blank" rel="noopener noreferrer">
        Source: {check.source.label} ({SOURCE_KIND_LABEL[check.source.kind]})<ExternalIcon size={14} />
      </a>
      <p className="ruleid">Rule {check.ruleId} v{check.ruleVersion} · evidence year {check.academicYear}</p>
    </div>
  );
}

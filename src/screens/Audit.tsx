import { motion } from 'framer-motion';
import { CheckList } from '../components/audit/CheckList';
import { JsonPanel } from '../components/audit/JsonPanel';
import { ScanPaper } from '../components/audit/ScanPaper';
import { ArrowIcon } from '../components/icons';
import { EASE, fadeUp } from '../components/motionProps';
import type { AuditReport, DocumentsBySlot, ReadProgress, SchemePack, SlotDef, SlotId } from '../core/types';
import { useAuditReveal, useScanIndex } from '../hooks/useAuditReveal';
import { useReduce } from '../hooks/useMotion';

const PERCENT = 100;
const BAR_S = 0.5;
const DEFAULT_TOTAL = 8;

/** Props of {@link Audit}. */
export interface AuditProps {
  pack: SchemePack;
  /** null while documents are being read and checked. */
  report: AuditReport | null;
  progress?: ReadProgress | null;
  docs: DocumentsBySlot;
  fileNames: Partial<Record<SlotId, string>>;
  sample: boolean;
  firstName: string;
  onReport: () => void;
}

/** Fourth screen: the scanner moves through the documents while checks are revealed one by one. */
export function Audit({ pack, report, progress, docs, fileNames, sample, firstName, onReport }: AuditProps) {
  const reduce = useReduce();
  const reveal = useAuditReveal(report, reduce);
  const slots = pack.slots;
  const index = useScanIndex({ slots, report, progress, reveal, reduce });
  const slot = slots[index] as SlotDef;
  const doc = docs[slot.id];
  const reading = !report && !!progress;
  const pages = doc ? ` · ${doc.pageCount} ${doc.pageCount === 1 ? 'page' : 'pages'}` : '';
  const percent = reading
    ? Math.round(((progress.index - 1) / progress.total) * PERCENT)
    : reveal.total ? Math.round((reveal.step / reveal.total) * PERCENT) : 0;

  return (
    <main className="wrap page" id="main" tabIndex={-1}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 className="h2">{firstName ? `Checking ${firstName}’s application` : 'Checking your application'}</h1>
          <p className="sub">Gemini reads each document. Then plain rules decide pass or fail.</p>
        </div>
        {!reveal.done && report && <button className="btn btn-ghost" onClick={reveal.skip}>Skip animation</button>}
        {reveal.done && (
          <motion.button className="btn btn-primary" onClick={onReport} {...fadeUp(reduce, 0, 0.5)}>
            See readiness report<ArrowIcon />
          </motion.button>
        )}
      </div>
      <div
        className="progress" role="progressbar" aria-label={reading ? 'Documents read' : 'Checks completed'} aria-valuemin={0}
        aria-valuemax={reading ? progress.total : reveal.total || DEFAULT_TOTAL} aria-valuenow={reading ? progress.index - 1 : reveal.step}
      >
        <motion.div initial={false} animate={{ width: `${percent}%` }} transition={{ duration: reduce ? 0 : BAR_S, ease: EASE }} />
      </div>
      <div className="auditgrid">
        <div>
          <ul className="thumbs" aria-hidden="true">
            {slots.map((s, i) => (
              <li key={s.id} className={`thumb ${i === index ? 'on' : i < index || reveal.done ? 'done' : ''} ${docs[s.id] ? '' : 'absent'}`}>
                <i /><i /><i />
              </li>
            ))}
          </ul>
          <span className="sr-only" role="status">Scanning {slot.label.en}</span>
          <ScanPaper
            key={index} slot={slot} doc={doc} label={`${fileNames[slot.id] ?? slot.short}${pages}`}
            scanning={!reveal.done} designIncome={sample && slot.id === 'income_certificate'} reduce={reduce}
          />
          <JsonPanel key={`json-${index}`} doc={doc} active={!reveal.done} reduce={reduce} />
        </div>
        <CheckList report={report} step={reveal.step} progress={progress} reduce={reduce} />
      </div>
    </main>
  );
}

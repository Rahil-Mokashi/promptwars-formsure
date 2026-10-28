import { AuditHeader } from '../components/audit/AuditHeader';
import { AuditProgress } from '../components/audit/AuditProgress';
import { CheckList } from '../components/audit/CheckList';
import { JsonPanel } from '../components/audit/JsonPanel';
import { ScanPaper } from '../components/audit/ScanPaper';
import { ThumbStrip } from '../components/audit/ThumbStrip';
import type { AuditReport, DocumentsBySlot, ReadProgress, SchemePack, SlotId } from '../core/types';
import { useAuditReveal, useScanIndex } from '../hooks/useAuditReveal';
import { useReduce } from '../hooks/useMotion';

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

const pagesLabel = (count: number): string => ` · ${count} ${count === 1 ? 'page' : 'pages'}`;

/** Fourth screen: the scanner moves through the documents while checks are revealed one by one. */
export function Audit({ pack, report, progress, docs, fileNames, sample, firstName, onReport }: AuditProps) {
  const reduce = useReduce();
  const reveal = useAuditReveal(report, reduce);
  const index = useScanIndex({ slots: pack.slots, report, progress, reveal, reduce });
  const slot = pack.slots[index];
  if (!slot) return null;
  const doc = docs[slot.id];
  const reading = !report && progress ? progress : null;

  return (
    <main className="wrap page" id="main" tabIndex={-1}>
      <AuditHeader
        firstName={firstName}
        canSkip={!reveal.done && !!report}
        done={reveal.done}
        reduce={reduce}
        onSkip={reveal.skip}
        onReport={onReport}
      />
      <AuditProgress reading={reading} step={reveal.step} total={reveal.total} reduce={reduce} />
      <div className="auditgrid">
        <div>
          <ThumbStrip slots={pack.slots} docs={docs} index={index} allDone={reveal.done} />
          <span className="sr-only" role="status">
            Scanning {slot.label.en}
          </span>
          <ScanPaper
            key={index}
            slot={slot}
            doc={doc}
            label={`${fileNames[slot.id] ?? slot.short}${doc ? pagesLabel(doc.pageCount) : ''}`}
            scanning={!reveal.done}
            designIncome={sample && slot.id === 'income_certificate'}
            reduce={reduce}
          />
          <JsonPanel key={`json-${index}`} doc={doc} active={!reveal.done} reduce={reduce} />
        </div>
        <CheckList report={report} step={reveal.step} progress={progress} reduce={reduce} />
      </div>
    </main>
  );
}

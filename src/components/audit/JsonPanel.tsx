import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { ExtractedDocument } from '../../core/types';

const LINE_REVEAL_MS = 140;
const LINE_FLASH_S = 0.7;
const LINE_RISE_PX = 8;

/** The extracted fields as `[key, JSON value]` pairs, in the design's order. */
function jsonLines(d: ExtractedDocument): [string, string][] {
  return [
    ['documentType', JSON.stringify(d.documentTypes.length === 1 ? d.documentTypes[0] : d.documentTypes)],
    ['language', JSON.stringify(d.language)],
    ['applicantName.original', JSON.stringify(d.applicantName?.original ?? null)],
    ['applicantName.english', JSON.stringify(d.applicantName?.english ?? null)],
    ['issueDate', JSON.stringify(d.issueDate)],
    ['issuingAuthority', JSON.stringify(d.issuingAuthority)],
    ['pageCount', String(d.pageCount)],
    ['legible', String(d.legible)],
  ];
}

/** Props of {@link JsonPanel}. */
export interface JsonPanelProps {
  doc: ExtractedDocument | undefined;
  /** Still revealing lines one by one. */
  active: boolean;
  reduce: boolean;
}

/** What Gemini extracted: fields appear one by one and each new line flashes. Remounted for every document. */
export function JsonPanel({ doc, active, reduce }: JsonPanelProps) {
  const [shown, setShown] = useState(0);
  const lines = doc ? jsonLines(doc) : [];
  useEffect(() => {
    if (reduce || !active || !doc) return;
    const timer = setInterval(() => setShown((n) => n + 1), LINE_REVEAL_MS);
    return () => clearInterval(timer);
  }, [reduce, active, doc]);
  const count = reduce || !active ? lines.length : Math.min(lines.length, shown);

  return (
    <div className="json mono" aria-live="polite">
      <div style={{ color: '#8B93A7' }}>{doc ? '// extracted by Gemini' : '// no file for this slot'}</div>
      {lines.slice(0, count).map(([key, value]) => (
        <motion.div
          key={key}
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: LINE_RISE_PX, backgroundColor: 'rgba(165,180,252,.35)' },
                animate: { opacity: 1, y: 0, backgroundColor: 'rgba(165,180,252,0)' },
                transition: { duration: LINE_FLASH_S },
              })}
        >
          <span className="k">{key}</span>: <span className="v">{value}</span>
        </motion.div>
      ))}
    </div>
  );
}

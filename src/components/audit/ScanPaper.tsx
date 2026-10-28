import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { toDevanagari } from '../../core/names';
import type { ExtractedDocument, SlotDef } from '../../core/types';

const PULSE_S = 0.9;
const SCAN_PASS_S = 1.4;

const devanagariDate = (iso: string): string => toDevanagari(iso.split('-').reverse().join('/'));

/** A found field: pulses once when it appears. */
export function FoundField({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  if (reduce) return <span className="hl">{children}</span>;
  return (
    <motion.span className="hl" initial={{ backgroundColor: '#FCD34D', scale: 1.06 }} animate={{ backgroundColor: '#FEF3C7', scale: 1 }} transition={{ duration: PULSE_S }}>
      {children}
    </motion.span>
  );
}

/** Props of {@link ScanPaper}. */
export interface ScanPaperProps {
  slot: SlotDef;
  doc: ExtractedDocument | undefined;
  /** File name and page count shown in the corner. */
  label: string;
  /** The scan line is moving. */
  scanning: boolean;
  /** Show the design's exact Marathi income certificate (the sample's). */
  designIncome: boolean;
  reduce: boolean;
}

/** The document being scanned. The sample's income certificate keeps the design's exact Marathi text. */
export function ScanPaper({ slot, doc, label, scanning, designIncome, reduce }: ScanPaperProps) {
  return (
    <div className="paper">
      {scanning && <motion.div className="scan" animate={reduce ? undefined : { y: ['-100%', '375%'] }} transition={{ duration: SCAN_PASS_S, ease: 'linear', repeat: Infinity }} />}
      <div className="docbar">
        <span className="docsample dev" lang="mr">नमुना · SAMPLE</span>
        <span className="mono" style={{ fontSize: 12, color: '#5B6478' }}>{label}</span>
      </div>
      {designIncome ? (
        <>
          <p className="doctitle dev" lang="mr">उत्पन्न प्रमाणपत्र</p>
          <div className="docline w90" /><div className="docline w80" />
          <p className="docfield dev" lang="mr">अर्जदाराचे नाव: <FoundField reduce={reduce}>आरव सुनील पाटील</FoundField></p>
          <p className="docfield dev" lang="mr">दिनांक: <FoundField reduce={reduce}>१२/०५/२०२५</FoundField></p>
          <p className="docfield dev" lang="mr">तहसीलदार, हवेली</p>
        </>
      ) : (
        <>
          <p className="doctitle dev" lang="mr">{slot.label.mr}</p>
          <div className="docline w90" /><div className="docline w80" />
          {doc?.applicantName && <p className="docfield">Name: <FoundField reduce={reduce}>{doc.applicantName.original}</FoundField></p>}
          {doc?.issueDate && <p className="docfield">Date: <FoundField reduce={reduce}>{devanagariDate(doc.issueDate)}</FoundField></p>}
          {doc?.dateOfBirth && <p className="docfield">Date of birth: <FoundField reduce={reduce}>{devanagariDate(doc.dateOfBirth)}</FoundField></p>}
          {doc?.category && <p className="docfield">Category: <FoundField reduce={reduce}>{doc.category}</FoundField></p>}
          {doc?.issuingAuthority && <p className="docfield">{doc.issuingAuthority}</p>}
          {!doc && <p className="docfield" style={{ color: '#5B6478' }}>No file uploaded for this slot</p>}
        </>
      )}
      <div className="docline w60" style={{ marginTop: 16 }} /><div className="docline w40" />
    </div>
  );
}

import { m } from 'framer-motion';
import type { ReactNode } from 'react';
import { toDevanagari } from '../../core/names';
import type { ExtractedDocument, SlotDef } from '../../core/types';

const PULSE_S = 0.9;
const SCAN_PASS_S = 1.4;

const devanagariDate = (iso: string): string => toDevanagari(iso.split('-').reverse().join('/'));

/** A found field: pulses once when it appears. */
function FoundField({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  if (reduce) return <span className="hl">{children}</span>;
  return (
    <m.span
      className="hl"
      initial={{ backgroundColor: '#FCD34D', scale: 1.06 }}
      animate={{ backgroundColor: '#FEF3C7', scale: 1 }}
      transition={{ duration: PULSE_S }}
    >
      {children}
    </m.span>
  );
}

/** The sample income certificate, with the design's exact Marathi text. */
function DesignIncomeBody({ reduce }: { reduce: boolean }) {
  return (
    <>
      <p className="doctitle dev" lang="mr">
        उत्पन्न प्रमाणपत्र
      </p>
      <div className="docline w90" />
      <div className="docline w80" />
      <p className="docfield dev" lang="mr">
        अर्जदाराचे नाव: <FoundField reduce={reduce}>आरव सुनील पाटील</FoundField>
      </p>
      <p className="docfield dev" lang="mr">
        दिनांक: <FoundField reduce={reduce}>१२/०५/२०२५</FoundField>
      </p>
      <p className="docfield dev" lang="mr">
        तहसीलदार, हवेली
      </p>
    </>
  );
}

/** The fields found in a document, as label and value; fields that were not found are left out. */
function foundFields(doc: ExtractedDocument): [string, string][] {
  const rows: [string, string | undefined][] = [
    ['Name', doc.applicantName?.original],
    ['Date', doc.issueDate ? devanagariDate(doc.issueDate) : undefined],
    ['Date of birth', doc.dateOfBirth ? devanagariDate(doc.dateOfBirth) : undefined],
    ['Category', doc.category ?? undefined],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

/** Any other slot: its Marathi title and the fields read from the file. */
function ExtractedBody({ slot, doc, reduce }: { slot: SlotDef; doc: ExtractedDocument | undefined; reduce: boolean }) {
  return (
    <>
      <p className="doctitle dev" lang="mr">
        {slot.label.mr}
      </p>
      <div className="docline w90" />
      <div className="docline w80" />
      {doc &&
        foundFields(doc).map(([label, value]) => (
          <p className="docfield" key={label}>
            {label}: <FoundField reduce={reduce}>{value}</FoundField>
          </p>
        ))}
      {doc?.issuingAuthority && <p className="docfield">{doc.issuingAuthority}</p>}
      {!doc && (
        <p className="docfield" style={{ color: '#5B6478' }}>
          No file uploaded for this slot
        </p>
      )}
    </>
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
      {scanning && (
        <m.div
          className="scan"
          animate={reduce ? undefined : { y: ['-100%', '375%'] }}
          transition={{ duration: SCAN_PASS_S, ease: 'linear', repeat: Infinity }}
        />
      )}
      <div className="docbar">
        <span className="docsample dev" lang="mr">
          नमुना · SAMPLE
        </span>
        <span className="mono" style={{ fontSize: 12, color: '#5B6478' }}>
          {label}
        </span>
      </div>
      {designIncome ? <DesignIncomeBody reduce={reduce} /> : <ExtractedBody slot={slot} doc={doc} reduce={reduce} />}
      <div className="docline w60" style={{ marginTop: 16 }} />
      <div className="docline w40" />
    </div>
  );
}

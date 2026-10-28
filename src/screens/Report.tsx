import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { AuditReport, Check, DocumentsBySlot, ExtractedDocument, Lang, SchemePack, SlotDef } from '../core/types';
import { ChevronIcon, ExternalIcon, RefreshIcon, SparkIcon, Tick, WarnIcon, WrenchIcon } from '../icons';
import { fadeUp, useReduce } from '../motion';
import { LANGS } from './Header';
import { Ring } from './Ring';

interface Row {
  label: string;
  value: string;
  hl?: boolean;
}
interface Preview {
  slot: SlotDef;
  doc: ExtractedDocument;
  rows: Row[];
}

const dmy = (iso: string) => iso.split('-').reverse().join('/');
const typeName = (t: string) => t.replace(/_/g, ' ');

/** Which document and field a failed rule is about, so the problem can be highlighted on a mini document. */
export function previewFor(check: Check, docs: DocumentsBySlot, pack: SchemePack): Preview | null {
  const bySlot = (id: string) => pack.slots.find((s) => s.id === id);
  const make = (slotId: string, rows: (d: ExtractedDocument) => Row[]): Preview | null => {
    const slot = bySlot(slotId);
    const doc = slot && docs[slot.id];
    return slot && doc ? { slot, doc, rows: rows(doc) } : null;
  };
  switch (check.ruleId) {
    case 'income-financial-year':
      return make('income_certificate', (d) => [
        { label: 'Issue date', value: d.issueDate ? dmy(d.issueDate) : 'not found', hl: true },
        { label: 'Authority', value: d.issuingAuthority ?? '-' },
        { label: 'Pages', value: String(d.pageCount) },
      ]);
    case 'income-ncl':
      return make('income_certificate', (d) => [
        { label: 'Pages', value: String(d.pageCount) },
        { label: 'Contains', value: d.documentTypes.map(typeName).join(', ') || '-', hl: true },
        { label: 'Issue date', value: d.issueDate ? dmy(d.issueDate) : '-' },
      ]);
    case 'name-match': {
      const slot = pack.slots.find((s) => s.short === check.evidence?.foundLabel);
      return slot ? make(slot.id, (d) => [
        { label: 'Name', value: d.applicantName?.english ?? '-', hl: true },
        { label: 'As printed', value: d.applicantName?.original ?? '-' },
        { label: 'Language', value: d.language },
      ]) : null;
    }
    case 'dob-match':
      return make('aadhaar', (d) => [{ label: 'Date of birth', value: d.dateOfBirth ? dmy(d.dateOfBirth) : '-', hl: true }, { label: 'Name', value: d.applicantName?.english ?? '-' }]);
    case 'category-match':
      return make('caste_certificate', (d) => [{ label: 'Category', value: d.category ?? '-', hl: true }, { label: 'Name', value: d.applicantName?.english ?? '-' }]);
    default:
      return null;
  }
}

function MiniDoc({ preview, reduce }: { preview: Preview; reduce: boolean }) {
  return (
    <div className="minidoc" aria-label={`Preview of ${preview.slot.short}`} role="group">
      <div className="docbar"><span className="docsample">PREVIEW</span></div>
      <p className="doctitle">{preview.slot.short}</p>
      {preview.rows.map((r) => (
        <div className="minirow" key={r.label}>
          <span>{r.label}</span>
          {r.hl ? (
            <motion.span className="hl" {...(reduce ? {} : { initial: { backgroundColor: '#FCD34D' }, animate: { backgroundColor: '#FEF3C7' }, transition: { duration: 1 } })}>{r.value}</motion.span>
          ) : (
            <span>{r.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface Props {
  docs: DocumentsBySlot;
  pack: SchemePack;
  report: AuditReport;
  lang: Lang;
  canRecheck: boolean;
  onReupload: () => void;
  onRecheck: () => void;
}

function IssueBody({ check, lang, preview, reduce }: { check: Check; lang: Lang; preview: Preview | null; reduce: boolean }) {
  const ev = check.evidence;
  return (
    <div className="ibody">
      <div className="evpreview">
        {ev && (
          <div className="evidence" style={{ gridTemplateColumns: '1fr' }}>
            <div className="ev bad"><div className="evlabel">{ev.foundLabel}</div><div className="evval">{ev.found}</div></div>
            <div className="ev good"><div className="evlabel">{ev.neededLabel}</div><div className="evval">{ev.needed}</div></div>
          </div>
        )}
        {preview && <MiniDoc preview={preview} reduce={reduce} />}
      </div>
      {check.usesAi && (
        <span className="ainote"><SparkIcon size={14} />Matched by Gemini across Marathi and English</span>
      )}
      <p className="why"><b>Why it matters.</b> {check.why[lang]}</p>
      <div className="fix" lang={lang}>
        <WrenchIcon style={{ flex: 'none', marginTop: 3, color: '#4338CA' }} />
        <span className={lang === 'en' ? '' : 'dev'}>{check.fix[lang]}</span>
      </div>
      <a className="src" href={check.source.url} target="_blank" rel="noopener noreferrer">
        Source: {check.source.label}<ExternalIcon size={14} />
      </a>
    </div>
  );
}

export function Report({ docs, pack, report, lang, canRecheck, onReupload, onRecheck }: Props) {
  const reduce = useReduce();
  const failed = report.checks.filter((c) => c.status === 'fail');
  const passed = report.checks.filter((c) => c.status === 'pass');
  const [open, setOpen] = useState<string>(failed[0]?.ruleId ?? '');
  const langName = LANGS.find((l) => l.code === lang)?.name ?? 'English';

  return (
    <main className="wrap page">
      <h2 className="h2">{failed.length} {failed.length === 1 ? 'thing' : 'things'} to fix before you submit</h2>
      <p className="sub">Each issue shows what FormSure found, why it matters, and how to fix it. Fixes are shown in {langName}.</p>
      <div className="reportgrid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section className="card ringcard" aria-label="Readiness score">
            <Ring pct={report.readiness} />
            <div className="stats">
              <div className="stat"><b style={{ color: '#047857' }}>{report.passed}</b><span>Passed</span></div>
              <div className="stat"><b style={{ color: '#BE123C' }}>{report.failed}</b><span>To fix</span></div>
              <div className="stat"><b style={{ color: '#5B6478' }}>{report.skipped}</b><span>Skipped</span></div>
            </div>
            {report.checks.some((c) => c.ruleId === 'income-limit' && c.status === 'skipped') && (
              <div className="skipnote">
                <b>Skipped: family income limit.</b> Sources disagree on this scheme’s limit, so the rule isn’t verified yet. FormSure never applies an unverified rule.
              </div>
            )}
          </section>
          <section className="card panel" aria-labelledby="passed-h">
            <p className="ptitle" id="passed-h">Passed checks</p>
            <ul className="mini" style={{ marginTop: 12 }}>
              {passed.map((c) => (
                <li key={c.ruleId}>
                  <span className="cicon ci-pass" style={{ width: 22, height: 22 }}><Tick size={12} reduce={reduce} /></span>
                  {c.label}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="issues">
          {failed.map((c, i) => {
            const isOpen = open === c.ruleId;
            return (
              <motion.article key={c.ruleId} className="card issue" layout={!reduce} {...fadeUp(reduce, 0.2 + i * 0.12)}>
                <button className="issue-head" onClick={() => setOpen(isOpen ? '' : c.ruleId)} aria-expanded={isOpen}>
                  <span className="sev"><WarnIcon size={14} />{c.severity === 'critical' ? 'Critical' : 'Warning'}</span>
                  <span>
                    <span className="ititle" style={{ display: 'block' }}>{c.issueTitle}</span>
                    <span className="idoc" style={{ display: 'block' }}>{c.issueDoc}</span>
                  </span>
                  <ChevronIcon open={isOpen} reduce={reduce} />
                </button>
                {reduce ? (
                  isOpen && <IssueBody check={c} lang={lang} preview={previewFor(c, docs, pack)} reduce={reduce} />
                ) : (
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="body"
                        style={{ overflow: 'hidden' }}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <IssueBody check={c} lang={lang} preview={previewFor(c, docs, pack)} reduce={reduce} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.article>
            );
          })}
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={onReupload}>Re-upload documents</button>
            <button className="btn btn-primary" onClick={onRecheck}>
              {canRecheck ? 'I’ve fixed these, re-check' : 'I’ve fixed these, re-upload'}<RefreshIcon />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

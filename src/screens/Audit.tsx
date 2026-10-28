import { motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import type { AuditReport, DocumentsBySlot, ExtractedDocument, SchemePack, SlotDef, SlotId } from '../core/types';
import { ArrowIcon, DashIcon, Spinner, Tick, XIcon } from '../icons';
import { EASE, fadeUp, useReduce } from '../motion';

const STEP_MS = 650;
const DEV_DIGITS = '०१२३४५६७८९';
const devDate = (iso: string) => iso.split('-').reverse().join('/').replace(/\d/g, (d) => DEV_DIGITS[Number(d)] ?? d);

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

/** A found field: pulses once when it appears. */
function Hl({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  if (reduce) return <span className="hl">{children}</span>;
  return (
    <motion.span className="hl" initial={{ backgroundColor: '#FCD34D', scale: 1.06 }} animate={{ backgroundColor: '#FEF3C7', scale: 1 }} transition={{ duration: 0.9 }}>
      {children}
    </motion.span>
  );
}

/** The document being scanned. The income certificate of the sample keeps the design's exact Marathi text. */
function Paper({ slot, doc, label, running, staticIncome, reduce }: { slot: SlotDef; doc?: ExtractedDocument; label: string; running: boolean; staticIncome: boolean; reduce: boolean }) {
  return (
    <div className="paper">
      {running && (
        <motion.div className="scan" animate={reduce ? undefined : { y: ['-100%', '375%'] }} transition={{ duration: 1.4, ease: 'linear', repeat: Infinity }} />
      )}
      <div className="docbar">
        <span className="docsample dev" lang="mr">नमुना · SAMPLE</span>
        <span className="mono" style={{ fontSize: 12, color: '#5B6478' }}>{label}</span>
      </div>
      {staticIncome ? (
        <>
          <p className="doctitle dev" lang="mr">उत्पन्न प्रमाणपत्र</p>
          <div className="docline w90" /><div className="docline w80" />
          <p className="docfield dev" lang="mr">अर्जदाराचे नाव: <Hl reduce={reduce}>आरव सुनील पाटील</Hl></p>
          <p className="docfield dev" lang="mr">दिनांक: <Hl reduce={reduce}>१२/०५/२०२५</Hl></p>
          <p className="docfield dev" lang="mr">तहसीलदार, हवेली</p>
        </>
      ) : (
        <>
          <p className="doctitle dev" lang="mr">{slot.label.mr}</p>
          <div className="docline w90" /><div className="docline w80" />
          {doc?.applicantName && <p className="docfield">Name: <Hl reduce={reduce}>{doc.applicantName.original}</Hl></p>}
          {doc?.issueDate && <p className="docfield">Date: <Hl reduce={reduce}>{devDate(doc.issueDate)}</Hl></p>}
          {doc?.dateOfBirth && <p className="docfield">Date of birth: <Hl reduce={reduce}>{devDate(doc.dateOfBirth)}</Hl></p>}
          {doc?.category && <p className="docfield">Category: <Hl reduce={reduce}>{doc.category}</Hl></p>}
          {doc?.issuingAuthority && <p className="docfield">{doc.issuingAuthority}</p>}
          {!doc && <p className="docfield" style={{ color: '#5B6478' }}>No file uploaded for this slot</p>}
        </>
      )}
      <div className="docline w60" style={{ marginTop: 16 }} /><div className="docline w40" />
    </div>
  );
}

/** Extracted fields appear one by one; each new line flashes. Remounted for every document. */
function JsonPanel({ doc, active, reduce }: { doc?: ExtractedDocument; active: boolean; reduce: boolean }) {
  const [shown, setShown] = useState(0);
  const all = doc ? jsonLines(doc) : [];
  useEffect(() => {
    if (reduce || !active || !doc) return;
    const t = setInterval(() => setShown((n) => n + 1), 140);
    return () => clearInterval(t);
  }, [reduce, active, doc]);
  const count = reduce || !active ? all.length : Math.min(all.length, shown);
  return (
    <div className="json mono" aria-live="polite">
      <div style={{ color: '#5B6478' }}>{doc ? '// extracted by Gemini' : '// no file for this slot'}</div>
      {all.slice(0, count).map(([k, v]) => (
        <motion.div
          key={k}
          {...(reduce ? {} : { initial: { opacity: 0, y: 8, backgroundColor: 'rgba(165,180,252,.35)' }, animate: { opacity: 1, y: 0, backgroundColor: 'rgba(165,180,252,0)' }, transition: { duration: 0.7 } })}
        >
          <span className="k">{k}</span>: <span className="v">{v}</span>
        </motion.div>
      ))}
    </div>
  );
}

interface Props {
  pack: SchemePack;
  /** null while documents are being read and audited */
  report: AuditReport | null;
  docs: DocumentsBySlot;
  fileNames: Partial<Record<SlotId, string>>;
  sample: boolean;
  firstName: string;
  onReport: () => void;
}

export function Audit({ pack, report, docs, fileNames, sample, firstName, onReport }: Props) {
  const reduce = useReduce();
  const [tick, setTick] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const total = report?.checks.length ?? 0;
  const step = report ? (reduce || skipped ? total : Math.min(tick, total)) : 0;
  const done = !!report && step >= total;
  const running = !done;

  // One check is revealed every 650 ms; with reduced motion everything shows at once.
  useEffect(() => {
    if (!report || reduce || skipped || done) return;
    const t = setInterval(() => setTick((n) => n + 1), STEP_MS);
    return () => clearInterval(t);
  }, [report, reduce, skipped, done]);
  // While documents are still being read, the scanner cycles through the slots on its own.
  useEffect(() => {
    if (report || reduce) return;
    const t = setInterval(() => setCycle((n) => n + 1), 900);
    return () => clearInterval(t);
  }, [report, reduce]);

  const slots = pack.slots;
  const incomeIdx = Math.max(0, slots.findIndex((s) => s.id === 'income_certificate'));
  const idx = done || reduce ? incomeIdx : report ? Math.min(slots.length - 1, Math.floor((step / total) * slots.length)) : cycle % slots.length;
  const slot = slots[idx] as SlotDef;
  const doc = docs[slot.id];
  const pages = doc ? ` · ${doc.pageCount} ${doc.pageCount === 1 ? 'page' : 'pages'}` : '';
  const label = `${fileNames[slot.id] ?? slot.short}${pages}`;
  const pct = total ? Math.round((step / total) * 100) : 0;

  return (
    <main className="wrap page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 className="h2">{firstName ? `Checking ${firstName}’s application` : 'Checking your application'}</h2>
          <p className="sub">Gemini reads each document. Then plain rules decide pass or fail.</p>
        </div>
        {running && report && <button className="btn btn-ghost" onClick={() => setSkipped(true)}>Skip animation</button>}
        {done && (
          <motion.button className="btn btn-primary" onClick={onReport} {...fadeUp(reduce, 0, 0.5)}>
            See readiness report<ArrowIcon />
          </motion.button>
        )}
      </div>
      <div className="progress" role="progressbar" aria-label="Checks completed" aria-valuemin={0} aria-valuemax={total || 8} aria-valuenow={step}>
        <motion.div initial={false} animate={{ width: `${pct}%` }} transition={{ duration: reduce ? 0 : 0.5, ease: EASE }} />
      </div>
      <div className="auditgrid">
        <div>
          <ul className="thumbs" aria-hidden="true">
            {slots.map((s, i) => (
              <li key={s.id} className={`thumb ${i === idx ? 'on' : i < idx || done ? 'done' : ''} ${docs[s.id] ? '' : 'absent'}`}>
                <i /><i /><i />
              </li>
            ))}
          </ul>
          <span className="sr-only" role="status">Scanning {slot.label.en}</span>
          <Paper key={idx} slot={slot} doc={doc} label={label} running={running} staticIncome={sample && slot.id === 'income_certificate'} reduce={reduce} />
          <JsonPanel key={`j${idx}`} doc={doc} active={running} reduce={reduce} />
        </div>
        <section className="card" aria-label="Checks" aria-live="polite">
          <ul className="checks">
            {!report && (
              <li className="check running">
                <span className="cicon ci-run"><Spinner reduce={reduce} /></span>
                <div>
                  <div className="clabel">Reading your documents</div>
                  <div className="cdetail">Checking…</div>
                </div>
              </li>
            )}
            {report?.checks.map((c, i) => {
              const st = i < step ? c.status : i === step ? 'running' : 'pending';
              return (
                <li key={c.ruleId} className={`check ${st === 'running' ? 'running' : st === 'fail' ? 'fail' : ''}`}>
                  {st === 'pass' && <span className="cicon ci-pass"><Tick reduce={reduce} /></span>}
                  {st === 'fail' && (
                    <motion.span className="cicon ci-fail" animate={reduce ? undefined : { x: [0, -4, 4, 0] }} transition={{ duration: 0.4 }}>
                      <XIcon size={14} />
                    </motion.span>
                  )}
                  {st === 'skipped' && <span className="cicon ci-skip"><DashIcon size={14} /></span>}
                  {st === 'running' && <span className="cicon ci-run"><Spinner reduce={reduce} /></span>}
                  {st === 'pending' && <span className="cicon ci-pend" />}
                  <div>
                    <div className="clabel">
                      {c.label}
                      {c.usesAi && <span className="ctag">AI</span>}
                      <span className="sr-only">
                        {st === 'pass' ? ' Passed.' : st === 'fail' ? ' Needs fixing.' : st === 'skipped' ? ' Skipped.' : ''}
                      </span>
                    </div>
                    <div className="cdetail">{st === 'pending' ? 'Waiting' : st === 'running' ? 'Checking…' : c.detail}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}

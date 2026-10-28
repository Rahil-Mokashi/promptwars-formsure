import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { AuditReport, ExtractedDocument } from '../core/types';
import { ArrowIcon, DashIcon, Spinner, Tick, XIcon } from '../icons';
import { EASE, fadeUp, useReduce } from '../motion';

const STEP_MS = 650;

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

interface Props {
  /** null while documents are being read and audited */
  report: AuditReport | null;
  income: ExtractedDocument | undefined;
  fileLabel: string;
  firstName: string;
  onReport: () => void;
}

export function Audit({ report, income, fileLabel, firstName, onReport }: Props) {
  const reduce = useReduce();
  const [tick, setTick] = useState(0);
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

  const lines = income && report ? jsonLines(income).slice(0, Math.min(8, step + 1)) : [];
  const pct = total ? Math.round((step / total) * 100) : 0;

  return (
    <main className="wrap page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 className="h2">{firstName ? `Checking ${firstName}’s application` : "Checking your application"}</h2>
          <p className="sub">Gemini reads each document. Then plain rules decide pass or fail.</p>
        </div>
        {running && report && (
          <button className="btn btn-ghost" onClick={() => setSkipped(true)}>Skip animation</button>
        )}
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
          <div className="paper">
            {running && (
              <motion.div
                className="scan"
                animate={reduce ? undefined : { y: ['-100%', '375%'] }}
                transition={{ duration: 1.7, ease: 'linear', repeat: Infinity }}
              />
            )}
            <div className="docbar">
              <span className="docsample dev" lang="mr">नमुना · SAMPLE</span>
              <span className="mono" style={{ fontSize: 12, color: '#5B6478' }}>{fileLabel}</span>
            </div>
            <p className="doctitle dev" lang="mr">उत्पन्न प्रमाणपत्र</p>
            <div className="docline w90" /><div className="docline w80" />
            <p className="docfield dev" lang="mr">अर्जदाराचे नाव: <span className="hl">आरव सुनील पाटील</span></p>
            <p className="docfield dev" lang="mr">दिनांक: <span className="hl">१२/०५/२०२५</span></p>
            <p className="docfield dev" lang="mr">तहसीलदार, हवेली</p>
            <div className="docline w60" style={{ marginTop: 16 }} /><div className="docline w40" />
          </div>
          <div className="json mono" aria-live="polite">
            <div style={{ color: '#5B6478' }}>// extracted by Gemini</div>
            {lines.map(([k, v]) => (
              <motion.div key={k} {...fadeUp(reduce, 0, 0.35)}>
                <span className="k">{k}</span>: <span className="v">{v}</span>
              </motion.div>
            ))}
          </div>
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

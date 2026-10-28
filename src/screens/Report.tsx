import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { AuditReport, Check, Lang } from '../core/types';
import { ChevronIcon, ExternalIcon, RefreshIcon, SparkIcon, Tick, WarnIcon, WrenchIcon } from '../icons';
import { fadeUp, useReduce } from '../motion';
import { LANGS } from './Header';
import { Ring } from './Ring';

interface Props {
  report: AuditReport;
  lang: Lang;
  canRecheck: boolean;
  onReupload: () => void;
  onRecheck: () => void;
}

function IssueBody({ check, lang }: { check: Check; lang: Lang }) {
  const ev = check.evidence;
  return (
    <div className="ibody">
      {ev && (
        <div className="evidence">
          <div className="ev bad"><div className="evlabel">{ev.foundLabel}</div><div className="evval">{ev.found}</div></div>
          <div className="ev good"><div className="evlabel">{ev.neededLabel}</div><div className="evval">{ev.needed}</div></div>
        </div>
      )}
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

export function Report({ report, lang, canRecheck, onReupload, onRecheck }: Props) {
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
                  isOpen && <IssueBody check={c} lang={lang} />
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
                        <IssueBody check={c} lang={lang} />
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

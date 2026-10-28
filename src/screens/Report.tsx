import { useMemo, useState } from 'react';
import { IssueCard } from '../components/report/IssueCard';
import { PassedChecks } from '../components/report/PassedChecks';
import { ScoreCard } from '../components/report/ScoreCard';
import { RefreshIcon } from '../components/icons';
import { LANGS } from '../components/Header';
import { PRECHECK_DISCLAIMER, precheckSummary } from '../core/copy';
import { previewFor } from '../core/preview';
import type { AuditReport, DocumentsBySlot, Lang, SchemePack } from '../core/types';
import { useReduce } from '../hooks/useMotion';

/** Props of {@link Report}. */
export interface ReportProps {
  pack: SchemePack;
  docs: DocumentsBySlot;
  report: AuditReport;
  lang: Lang;
  /** Sample mode can re-check with the fixed documents; live mode goes back to upload. */
  canRecheck: boolean;
  onReupload: () => void;
  onRecheck: () => void;
}

/** Fifth screen: the score, every issue with evidence, why and the fix in the chosen language, and the passed checks. */
export function Report({ pack, docs, report, lang, canRecheck, onReupload, onRecheck }: ReportProps) {
  const reduce = useReduce();
  // Scored issues first, advisory warnings after them.
  const issues = useMemo(
    () =>
      report.checks
        .filter((c) => c.status === 'fail' || c.status === 'needs_review')
        .sort((a, b) => Number(a.advisory) - Number(b.advisory)),
    [report],
  );
  const passed = useMemo(() => report.checks.filter((c) => c.status === 'pass'), [report]);
  const [open, setOpen] = useState<string>(issues[0]?.ruleId ?? '');
  const langName = LANGS.find((l) => l.code === lang)?.name ?? 'English';

  return (
    <main className="wrap page" id="main" tabIndex={-1}>
      <h1 className="h2">{precheckSummary(report.passed, report.failed, report.needsReview)}</h1>
      <p className="sub">
        {PRECHECK_DISCLAIMER} Each issue shows what FormSure found, why it matters, and how to fix it. Fixes are shown
        in {langName}.
      </p>
      <div className="reportgrid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <ScoreCard report={report} />
          <PassedChecks checks={passed} reduce={reduce} />
        </div>
        <div className="issues">
          {issues.map((check, i) => (
            <IssueCard
              key={check.ruleId}
              check={check}
              index={i}
              lang={lang}
              open={open === check.ruleId}
              reduce={reduce}
              preview={previewFor(check, docs, pack)}
              onToggle={() => {
                setOpen(open === check.ruleId ? '' : check.ruleId);
              }}
            />
          ))}
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={onReupload}>
              Re-upload documents
            </button>
            <button className="btn btn-primary" onClick={onRecheck}>
              {canRecheck ? 'I’ve fixed these, re-check' : 'I’ve fixed these, re-upload'}
              <RefreshIcon />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

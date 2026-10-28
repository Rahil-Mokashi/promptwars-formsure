import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import type { ApplicationForm, AuditReport, DocumentsBySlot, Lang, SampleResponse, SchemePack, SlotId } from '../../shared/types';
import { ApiError, getPack, getSample, postAudit, postExtract } from './api';
import { EASE, useReduce } from './motion';
import { Audit } from './screens/Audit';
import { Header, type Screen } from './screens/Header';
import { Landing } from './screens/Landing';
import { Ready } from './screens/Ready';
import { Report } from './screens/Report';
import { Scheme } from './screens/Scheme';
import { Upload } from './screens/Upload';

const EMPTY_FORM: ApplicationForm = { fullName: '', dateOfBirth: '', category: 'OBC', academicYear: '2026-27', applicationType: 'Fresh' };
const UNAVAILABLE = 'Live reading unavailable, try the sample applicant';
const message = (e: unknown): string =>
  e instanceof ApiError ? (e.status === 503 ? UNAVAILABLE : e.message) : 'Something went wrong. Please try again.';

export function App() {
  const reduce = useReduce();
  const [screen, setScreen] = useState<Screen>('landing');
  const [lang, setLang] = useState<Lang>('en');
  const [pack, setPack] = useState<SchemePack | null>(null);
  const [sample, setSample] = useState<SampleResponse | null>(null);
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM);
  const [files, setFiles] = useState<Partial<Record<SlotId, File>>>({});
  const [docs, setDocs] = useState<DocumentsBySlot>({});
  const [report, setReport] = useState<AuditReport | null>(null);
  const [runId, setRunId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPack().then(setPack, () => undefined);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const go = (s: Screen) => {
    setError(null);
    setScreen(s);
  };

  const trySample = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await getSample();
      setSample(s);
      setForm(s.form);
      setFiles({});
      setScreen('scheme');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    setSample(null);
    setForm(EMPTY_FORM);
    setFiles({});
    go('scheme');
  };

  const run = async () => {
    setError(null);
    setReport(null);
    setRunId((n) => n + 1);
    setScreen('audit');
    try {
      let documents: DocumentsBySlot;
      if (sample) documents = sample.errorDocuments;
      else {
        const entries = await Promise.all(
          (Object.entries(files) as [SlotId, File][]).map(async ([slot, file]) => [slot, await postExtract(slot, file)] as const),
        );
        documents = Object.fromEntries(entries);
      }
      setDocs(documents);
      setReport(await postAudit(form, documents));
    } catch (e) {
      setError(message(e));
      setScreen('upload');
    }
  };

  const recheck = async () => {
    if (!sample) return go('upload');
    setBusy(true);
    try {
      const fixed = await postAudit(form, sample.fixedDocuments);
      setReport(fixed);
      setScreen(fixed.failed === 0 ? 'ready' : 'report');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setSample(null);
    setForm(EMPTY_FORM);
    setFiles({});
    setDocs({});
    setReport(null);
    go('landing');
  };

  const income = docs.income_certificate;
  const incomeFile = sample ? sample.files.income_certificate.name : files.income_certificate?.name ?? 'income certificate';
  const fileLabel = `${incomeFile}${income ? ` · ${income.pageCount} ${income.pageCount === 1 ? 'page' : 'pages'}` : ''}`;

  let body: ReactNode;
  switch (screen) {
    case 'landing':
      body = <Landing busy={busy} error={error} onSample={trySample} onStart={start} />;
      break;
    case 'scheme':
      body = <Scheme pack={pack} lang={lang} form={form} onForm={setForm} onBack={() => go('landing')} onNext={() => go('upload')} />;
      break;
    case 'upload':
      body = (
        <Upload
          pack={pack}
          lang={lang}
          sample={sample}
          form={form}
          onForm={setForm}
          files={files}
          onFile={(slot, file) => setFiles((f) => ({ ...f, [slot]: file }))}
          error={error}
          onBack={() => go('scheme')}
          onRun={run}
        />
      );
      break;
    case 'audit':
      body = (
        <Audit
          key={runId}
          report={report}
          income={income}
          fileLabel={fileLabel}
          firstName={form.fullName.trim().split(/\s+/)[0] ?? ''}
          onReport={() => go(report && report.failed === 0 ? 'ready' : 'report')}
        />
      );
      break;
    case 'report':
      body = report && (
        <Report report={report} lang={lang} busy={busy} canRecheck={!!sample} onReupload={() => go('upload')} onRecheck={recheck} />
      );
      break;
    case 'ready':
      body = report && <Ready report={report} form={form} onRestart={restart} />;
      break;
  }

  return (
    <div className="fs">
      <Header screen={screen} lang={lang} onLang={setLang} onHome={() => go('landing')} />
      {reduce ? (
        <div key={screen}>{body}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

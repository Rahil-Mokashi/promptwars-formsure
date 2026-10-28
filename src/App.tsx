import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import type { ApplicationForm, AuditReport, DocumentsBySlot, Lang, SampleResponse, SlotId } from './core/types';
import { audit, extract, getSample, pack } from './api';
import { UNAVAILABLE_MESSAGE, UnavailableError, validateFile } from './core/extract';
import { EASE, useReduce } from './motion';
import { Audit } from './screens/Audit';
import { Header, type Screen } from './screens/Header';
import { Landing } from './screens/Landing';
import { Ready } from './screens/Ready';
import { Report } from './screens/Report';
import { Scheme } from './screens/Scheme';
import { Upload } from './screens/Upload';

const EMPTY_FORM: ApplicationForm = { fullName: '', dateOfBirth: '', category: 'OBC', academicYear: '2026-27', applicationType: 'Fresh' };
const message = (e: unknown): string =>
  e instanceof UnavailableError ? UNAVAILABLE_MESSAGE : e instanceof Error ? e.message : 'Something went wrong. Please try again.';

export function App() {
  const reduce = useReduce();
  const [screen, setScreen] = useState<Screen>('landing');
  const [lang, setLang] = useState<Lang>('en');
  const [sample, setSample] = useState<SampleResponse | null>(null);
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM);
  const [files, setFiles] = useState<Partial<Record<SlotId, File>>>({});
  const [docs, setDocs] = useState<DocumentsBySlot>({});
  const [report, setReport] = useState<AuditReport | null>(null);
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const go = (s: Screen) => {
    setError(null);
    setScreen(s);
  };

  const trySample = () => {
    const s = getSample();
    setSample(s);
    setForm(s.form);
    setFiles({});
    setScreen('scheme');
  };

  const start = () => {
    setSample(null);
    setForm(EMPTY_FORM);
    setFiles({});
    go('scheme');
  };

  const onFile = (slot: SlotId, file: File | undefined) => {
    const problem = file ? validateFile(file) : null;
    setError(problem);
    if (problem) return;
    setFiles((f) => ({ ...f, [slot]: file }));
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
          (Object.entries(files) as [SlotId, File][]).map(async ([slot, file]) => [slot, await extract(file)] as const),
        );
        documents = Object.fromEntries(entries);
      }
      setDocs(documents);
      setReport(audit(form, documents));
    } catch (e) {
      setError(message(e));
      setScreen('upload');
    }
  };

  const recheck = () => {
    if (!sample) return go('upload');
    const fixed = audit(form, sample.fixedDocuments);
    setReport(fixed);
    setScreen(fixed.failed === 0 ? 'ready' : 'report');
  };

  const restart = () => {
    setSample(null);
    setForm(EMPTY_FORM);
    setFiles({});
    setDocs({});
    setReport(null);
    go('landing');
  };

  const fileNames: Partial<Record<SlotId, string>> = sample
    ? Object.fromEntries(Object.entries(sample.files).map(([k, v]) => [k, v.name]))
    : Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.name]));

  let body: ReactNode;
  switch (screen) {
    case 'landing':
      body = <Landing error={error} onSample={trySample} onStart={start} />;
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
          onFile={onFile}
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
          pack={pack}
          report={report}
          docs={docs}
          fileNames={fileNames}
          sample={!!sample}
          firstName={form.fullName.trim().split(/\s+/)[0] ?? ''}
          onReport={() => go(report && report.failed === 0 ? 'ready' : 'report')}
        />
      );
      break;
    case 'report':
      body = report && (
        <Report pack={pack} docs={docs} report={report} lang={lang} canRecheck={!!sample} onReupload={() => go('upload')} onRecheck={recheck} />
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

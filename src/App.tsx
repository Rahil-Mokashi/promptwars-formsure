import { AnimatePresence, m } from 'framer-motion';
import type { ReactNode } from 'react';
import { maskAadhaar } from './core/mask';
import type { AuditReport, SlotId } from './core/types';
import { useFlow, type Flow } from './hooks/useFlow';
import { EASE } from './components/motionProps';
import { useReduce } from './hooks/useMotion';
import { Audit } from './screens/Audit';
import { Header } from './components/Header';
import { Landing } from './screens/Landing';
import { Ready } from './screens/Ready';
import { Report } from './screens/Report';
import { Scheme } from './screens/Scheme';
import { Upload } from './screens/Upload';

const PAGE_FADE_S = 0.35;
const PAGE_RISE_PX = 14;

/** File names per slot, for the audit screen's document label. */
function fileNamesOf(flow: Flow): Partial<Record<SlotId, string>> {
  const names: Partial<Record<SlotId, string>> = {};
  const source: Partial<Record<SlotId, { name: string }>> = flow.sample ? flow.sample.files : flow.files;
  for (const [slot, file] of Object.entries(source) as [SlotId, { name: string }][])
    names[slot] = maskAadhaar(file.name);
  return names;
}

/** The scheme screen, wired to the flow. */
function SchemeScreen({ flow }: { flow: Flow }) {
  return (
    <Scheme
      pack={flow.pack}
      packs={flow.packs}
      sampleMode={!!flow.sample}
      onSelectPack={flow.selectPack}
      lang={flow.lang}
      form={flow.form}
      onForm={flow.setForm}
      onBack={() => {
        flow.go('landing');
      }}
      onNext={() => {
        flow.go('upload');
      }}
    />
  );
}

/** The upload screen, wired to the flow. */
function UploadScreen({ flow }: { flow: Flow }) {
  return (
    <Upload
      pack={flow.pack}
      lang={flow.lang}
      sample={flow.sample}
      form={flow.form}
      onForm={flow.setForm}
      files={flow.files}
      onFile={(slot, file) => {
        void flow.onFile(slot, file);
      }}
      slotStates={flow.reader.slotStates}
      retrying={flow.reader.retrying}
      onRetry={(slot) => {
        void flow.reader.retry(slot);
      }}
      error={flow.error}
      formErrors={flow.formErrors}
      validating={flow.validating}
      consent={flow.consent}
      onConsent={flow.setConsent}
      liveAvailable={flow.liveAvailable}
      onBack={() => {
        flow.go('scheme');
      }}
      onRun={() => {
        void flow.run();
      }}
    />
  );
}

/** The audit screen, wired to the flow; it moves on to the ready screen only when nothing needs attention. */
function AuditScreen({ flow, report }: { flow: Flow; report: AuditReport | null }) {
  const allClear = report?.failed === 0 && report.needsReview === 0 && report.advisories === 0;
  return (
    <Audit
      key={flow.runId}
      pack={flow.pack}
      report={report}
      progress={flow.reader.progress}
      docs={flow.docs}
      fileNames={fileNamesOf(flow)}
      sample={!!flow.sample}
      firstName={flow.form.fullName.trim().split(/\s+/)[0] ?? ''}
      onReport={() => {
        flow.go(allClear ? 'ready' : 'report');
      }}
    />
  );
}

/** The screen for `flow.screen`. The report and ready screens wait for a report. */
function currentScreen(flow: Flow): ReactNode {
  const { report } = flow;
  switch (flow.screen) {
    case 'landing':
      return <Landing error={flow.error} onSample={flow.trySample} onStart={flow.start} />;
    case 'scheme':
      return <SchemeScreen flow={flow} />;
    case 'upload':
      return <UploadScreen flow={flow} />;
    case 'audit':
      return <AuditScreen flow={flow} report={report} />;
    case 'report':
      return (
        report && (
          <Report
            pack={flow.pack}
            docs={flow.docs}
            report={report}
            lang={flow.lang}
            canRecheck={!!flow.sample}
            onReupload={() => {
              flow.go('upload');
            }}
            onRecheck={flow.recheck}
          />
        )
      );
    case 'ready':
      return report && <Ready report={report} form={flow.form} onRestart={flow.restart} />;
  }
}

/** The whole app: header, the current screen, and the page transition between screens. */
export function App() {
  const reduce = useReduce();
  const flow = useFlow();
  const body = currentScreen(flow);

  return (
    <div className="fs">
      <Header
        screen={flow.screen}
        lang={flow.lang}
        onLang={flow.setLang}
        onHome={() => {
          flow.go('landing');
        }}
      />
      {reduce ? (
        <div key={flow.screen}>{body}</div>
      ) : (
        <AnimatePresence mode="wait">
          <m.div
            key={flow.screen}
            initial={{ opacity: 0, y: PAGE_RISE_PX }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: PAGE_FADE_S, ease: EASE }}
          >
            {body}
          </m.div>
        </AnimatePresence>
      )}
    </div>
  );
}

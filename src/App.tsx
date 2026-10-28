import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { maskAadhaar } from './core/mask';
import type { SlotId } from './core/types';
import { pack } from './services/api';
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
  for (const [slot, file] of Object.entries(source) as [SlotId, { name: string }][]) names[slot] = maskAadhaar(file.name);
  return names;
}

function currentScreen(flow: Flow): ReactNode {
  const { screen, report } = flow;
  switch (screen) {
    case 'landing':
      return <Landing error={flow.error} onSample={flow.trySample} onStart={flow.start} />;
    case 'scheme':
      return <Scheme pack={pack} lang={flow.lang} form={flow.form} onForm={flow.setForm} onBack={() => flow.go('landing')} onNext={() => flow.go('upload')} />;
    case 'upload':
      return (
        <Upload
          pack={pack} lang={flow.lang} sample={flow.sample} form={flow.form} onForm={flow.setForm} files={flow.files}
          onFile={flow.onFile} slotStates={flow.reader.slotStates} retrying={flow.reader.retrying} onRetry={flow.reader.retry}
          error={flow.error} formErrors={flow.formErrors} validating={flow.validating} consent={flow.consent} onConsent={flow.setConsent} liveAvailable={flow.liveAvailable} onBack={() => flow.go('scheme')} onRun={flow.run}
        />
      );
    case 'audit':
      return (
        <Audit
          key={flow.runId} pack={pack} report={report} progress={flow.reader.progress} docs={flow.docs}
          fileNames={fileNamesOf(flow)} sample={!!flow.sample} firstName={flow.form.fullName.trim().split(/\s+/)[0] ?? ''}
          onReport={() => flow.go(report && report.failed === 0 && report.needsReview === 0 ? 'ready' : 'report')}
        />
      );
    case 'report':
      return report && <Report pack={pack} docs={flow.docs} report={report} lang={flow.lang} canRecheck={!!flow.sample} onReupload={() => flow.go('upload')} onRecheck={flow.recheck} />;
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
      <Header screen={flow.screen} lang={flow.lang} onLang={flow.setLang} onHome={() => flow.go('landing')} />
      {reduce ? (
        <div key={flow.screen}>{body}</div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={flow.screen}
            initial={{ opacity: 0, y: PAGE_RISE_PX }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: PAGE_FADE_S, ease: EASE }}
          >
            {body}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

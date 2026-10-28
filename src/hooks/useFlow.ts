import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { UNAVAILABLE_MESSAGE } from '../core/constants';
import { UnavailableError } from '../core/errors';
import { batchProblem } from '../core/fileValidation';
import { validateForm } from '../core/formSchema';
import type { ApplicationForm, AuditReport, DocumentsBySlot, Lang, SampleResponse, SchemePack, SlotId } from '../core/types';
import { audit, getSample, packs, wirePack } from '../services/api';
import { isLiveReadingAvailable } from '../services/firebase';
import type { ReadOutcome } from '../services/readFiles';
import { prepareUpload } from '../services/uploadPipeline';
import { flowReducer, initialFlowState, type FormErrors, type Screen } from './flowReducer';
import { useDocumentReader, type DocumentReader } from './useDocumentReader';

export { EMPTY_FORM, type FormErrors, type Screen } from './flowReducer';

const failureMessage = (outcome: ReadOutcome): string => {
  const failures = Object.values(outcome.failures);
  const first = failures[0] ?? '';
  if (outcome.stopped && first) return `${first} Your other files are kept; use "Retry this file" below.`;
  return `${failures.length === 1 ? '1 file' : `${failures.length} files`} could not be read. Retry the file below or replace it.`;
};

const messageOf = (e: unknown): string =>
  e instanceof UnavailableError ? UNAVAILABLE_MESSAGE : e instanceof Error ? e.message : 'Something went wrong. Please try again.';

/** Everything the app does, as state plus actions. Screens stay dumb. */
export interface Flow {
  screen: Screen;
  lang: Lang;
  /** The chosen scheme pack. */
  pack: SchemePack;
  /** Every scheme pack that can be chosen. */
  packs: readonly SchemePack[];
  selectPack: (packId: string) => void;
  sample: SampleResponse | null;
  form: ApplicationForm;
  files: Partial<Record<SlotId, File>>;
  error: string | null;
  /** One message per invalid form field, shown next to the field. */
  formErrors: FormErrors;
  /** True while a chosen file is still being checked and cleaned, so Run must wait. */
  validating: boolean;
  /** The applicant agreed to send documents to Gemini (live mode only). */
  consent: boolean;
  setConsent: (consent: boolean) => void;
  /** Live reading is configured (and, in production, protected by App Check). */
  liveAvailable: boolean;
  report: AuditReport | null;
  runId: number;
  /** Documents behind the current report (sample or read). */
  docs: DocumentsBySlot;
  reader: DocumentReader;
  setLang: (lang: Lang) => void;
  setForm: (form: ApplicationForm) => void;
  go: (screen: Screen) => void;
  trySample: () => void;
  start: () => void;
  onFile: (slotId: SlotId, file: File | undefined) => Promise<void>;
  run: () => Promise<void>;
  recheck: () => void;
  restart: () => void;
}

/**
 * The app's controller. State changes go through {@link flowReducer}; this hook adds the side effects
 * (cleaning files, reading with Gemini, running the rules) and dispatches their results as actions.
 */
export function useFlow(): Flow {
  const [state, dispatch] = useReducer(flowReducer, initialFlowState);
  const [validating, setValidating] = useState(0);
  const liveAvailable = useMemo(() => isLiveReadingAvailable(), []);
  const activeRun = useRef(0); // a newer run, or leaving the audit screen, cancels an older one
  const reader = useDocumentReader(state.files);
  const { cancel, reset, invalidate, readAll } = reader;
  const { sample, form, files, consent } = state;
  const pack = useMemo(() => wirePack(state.packId), [state.packId]);

  useEffect(() => {
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  // Leaving the page drops every file and result held in memory.
  useEffect(() => {
    const clear = () => {
      reset();
      for (const slotId of Object.keys(files) as SlotId[]) dispatch({ type: 'SET_FILE', slotId, file: undefined });
    };
    window.addEventListener('pagehide', clear);
    return () => window.removeEventListener('pagehide', clear);
  }, [reset, files]);

  const go = useCallback(
    (screen: Screen) => {
      if (screen !== 'audit') {
        activeRun.current++;
        cancel();
      }
      dispatch({ type: 'NAVIGATE', screen });
    },
    [cancel],
  );

  const trySample = useCallback(() => dispatch({ type: 'SELECT_SAMPLE', sample: getSample() }), []);

  const start = useCallback(() => {
    reset();
    dispatch({ type: 'SELECT_LIVE' });
  }, [reset]);

  const onFile = useCallback(
    async (slotId: SlotId, file: File | undefined) => {
      if (!file) {
        invalidate(slotId);
        dispatch({ type: 'SET_FILE', slotId, file: undefined });
        return;
      }
      setValidating((n) => n + 1);
      try {
        const others = Object.entries(files).filter(([id]) => id !== slotId).map(([, f]) => f.size);
        const batch = batchProblem([...others, file.size]);
        const prepared = batch ? { error: batch } : await prepareUpload(file);
        if (!prepared.file) {
          dispatch({ type: 'FILE_REJECTED', message: prepared.error ?? '' });
          return;
        }
        invalidate(slotId);
        dispatch({ type: 'SET_FILE', slotId, file: prepared.file });
      } finally {
        setValidating((n) => n - 1);
      }
    },
    [files, invalidate],
  );

  const run = useCallback(async () => {
    if (!sample && !consent) return;
    const checked = validateForm(form, undefined, pack.categories);
    if (!checked.ok) {
      dispatch({ type: 'RUN_AUDIT', run: { stage: 'invalid', formErrors: checked.errors } });
      return;
    }
    dispatch({ type: 'SET_FORM', form: checked.form });
    const me = ++activeRun.current;
    const current = () => activeRun.current === me;
    dispatch({ type: 'RUN_AUDIT', run: { stage: 'started' } });
    try {
      if (sample) {
        dispatch({ type: 'RUN_AUDIT', run: { stage: 'finished', report: audit(checked.form, sample.errorDocuments, pack.id) } });
        return;
      }
      const outcome = await readAll();
      if (!current()) return;
      if (Object.keys(outcome.failures).length > 0) {
        dispatch({ type: 'RUN_AUDIT', run: { stage: 'failed', error: failureMessage(outcome) } });
        return;
      }
      dispatch({ type: 'RUN_AUDIT', run: { stage: 'finished', report: audit(checked.form, outcome.documents, pack.id) } });
    } catch (e) {
      if (current()) dispatch({ type: 'RUN_AUDIT', run: { stage: 'failed', error: messageOf(e) } });
    }
  }, [consent, form, pack, readAll, sample]);

  const recheck = useCallback(() => {
    if (!sample) return go('upload');
    dispatch({ type: 'RECHECK', report: audit(form, sample.fixedDocuments, pack.id) });
  }, [form, go, pack, sample]);

  const restart = useCallback(() => {
    reset();
    activeRun.current++;
    cancel();
    dispatch({ type: 'RESTART' });
  }, [cancel, reset]);

  const selectPack = useCallback(
    (packId: string) => {
      const chosen = wirePack(packId);
      reset();
      dispatch({ type: 'SELECT_PACK', packId: chosen.id, categories: chosen.categories });
    },
    [reset],
  );

  const setLang = useCallback((lang: Lang) => dispatch({ type: 'SET_LANG', lang }), []);
  const setForm = useCallback((next: ApplicationForm) => dispatch({ type: 'SET_FORM', form: next }), []);
  const setConsent = useCallback((value: boolean) => dispatch({ type: 'SET_CONSENT', consent: value }), []);

  return {
    screen: state.screen, lang: state.lang, pack, packs, selectPack, sample, form, files, error: state.error, formErrors: state.formErrors,
    validating: validating > 0, consent, setConsent, liveAvailable, report: state.report, runId: state.runId,
    docs: sample ? sample.errorDocuments : reader.docs, reader, setLang, setForm, go, trySample, start, onFile, run, recheck, restart,
  };
}

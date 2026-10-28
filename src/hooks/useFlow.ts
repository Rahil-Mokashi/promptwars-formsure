import { useCallback, useEffect, useMemo, useReducer, type Dispatch } from 'react';
import type {
  ApplicationForm,
  AuditReport,
  DocumentsBySlot,
  Lang,
  SampleResponse,
  SchemePack,
  SlotId,
} from '../core/types';
import { audit, getSample, packs, wirePack } from '../services/api';
import { isLiveReadingAvailable } from '../services/firebase';
import { flowReducer, initialFlowState, type FlowAction, type FormErrors, type Screen } from './flowReducer';
import { useAuditRun } from './useAuditRun';
import { useDocumentReader, type DocumentReader } from './useDocumentReader';
import { useFileIntake } from './useFileIntake';

export { type FormErrors, type Screen } from './flowReducer';

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

/** The language of the page, and dropping every file and result held in memory when the page is left. */
function usePageEffects(
  lang: Lang,
  files: Partial<Record<SlotId, File>>,
  reset: () => void,
  dispatch: Dispatch<FlowAction>,
): void {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const clear = () => {
      reset();
      for (const slotId of Object.keys(files) as SlotId[]) dispatch({ type: 'SET_FILE', slotId, file: undefined });
    };
    window.addEventListener('pagehide', clear);
    return () => {
      window.removeEventListener('pagehide', clear);
    };
  }, [reset, files, dispatch]);
}

/** Actions that only dispatch (after clearing what was read, where the scheme or applicant changes). */
function useSetters(dispatch: Dispatch<FlowAction>, reset: () => void) {
  return useMemo(
    () => ({
      setLang: (lang: Lang) => {
        dispatch({ type: 'SET_LANG', lang });
      },
      setForm: (form: ApplicationForm) => {
        dispatch({ type: 'SET_FORM', form });
      },
      setConsent: (consent: boolean) => {
        dispatch({ type: 'SET_CONSENT', consent });
      },
      trySample: () => {
        dispatch({ type: 'SELECT_SAMPLE', sample: getSample() });
      },
      start: () => {
        reset();
        dispatch({ type: 'SELECT_LIVE' });
      },
      selectPack: (packId: string) => {
        const chosen = wirePack(packId);
        reset();
        dispatch({ type: 'SELECT_PACK', packId: chosen.id, categories: chosen.categories });
      },
    }),
    [dispatch, reset],
  );
}

/**
 * The app controller. State changes go through {@link flowReducer}; this hook adds the side effects
 * (cleaning files, reading with Gemini, running the rules) and dispatches their results as actions.
 */
export function useFlow(): Flow {
  const [state, dispatch] = useReducer(flowReducer, initialFlowState);
  const liveAvailable = useMemo(() => isLiveReadingAvailable(), []);
  const { sample, form, files, consent } = state;
  const pack = useMemo(() => wirePack(state.packId), [state.packId]);
  const slotOrder = useMemo(() => pack.slots.map((s) => s.id), [pack]);
  const reader = useDocumentReader(files, slotOrder);
  const { cancel, reset, invalidate, readAll } = reader;
  const { onFile, validating } = useFileIntake(files, invalidate, dispatch);
  const { run, supersede } = useAuditRun({ sample, consent, form, pack, readAll, dispatch });
  const setters = useSetters(dispatch, reset);
  usePageEffects(state.lang, files, reset, dispatch);

  const go = useCallback(
    (screen: Screen) => {
      if (screen !== 'audit') {
        supersede();
        cancel();
      }
      dispatch({ type: 'NAVIGATE', screen });
    },
    [cancel, supersede],
  );
  const recheck = useCallback(() => {
    if (!sample) go('upload');
    else dispatch({ type: 'RECHECK', report: audit(form, sample.fixedDocuments, pack.id) });
  }, [form, go, pack, sample]);
  const restart = useCallback(() => {
    reset();
    supersede();
    cancel();
    dispatch({ type: 'RESTART' });
  }, [cancel, reset, supersede]);

  return {
    ...setters,
    screen: state.screen,
    lang: state.lang,
    pack,
    packs,
    sample,
    form,
    files,
    error: state.error,
    formErrors: state.formErrors,
    validating,
    consent,
    liveAvailable,
    report: state.report,
    runId: state.runId,
    docs: sample ? sample.errorDocuments : reader.docs,
    reader,
    go,
    onFile,
    run,
    recheck,
    restart,
  };
}

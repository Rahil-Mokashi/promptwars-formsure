import { useCallback, useEffect, useRef, useState } from 'react';
import { UNAVAILABLE_MESSAGE } from '../core/constants';
import { UnavailableError } from '../core/errors';
import { validateFile } from '../core/fileValidation';
import type { ApplicationForm, AuditReport, DocumentsBySlot, Lang, SampleResponse, SlotId } from '../core/types';
import { audit, getSample } from '../services/api';
import type { ReadOutcome } from '../services/readFiles';
import { useDocumentReader, type DocumentReader } from './useDocumentReader';

/** The six screens, in the order of the design. */
export type Screen = 'landing' | 'scheme' | 'upload' | 'audit' | 'report' | 'ready';

/** Form before the applicant has typed anything. */
export const EMPTY_FORM: ApplicationForm = { fullName: '', dateOfBirth: '', category: 'OBC', academicYear: '2026-27', applicationType: 'Fresh' };

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
  sample: SampleResponse | null;
  form: ApplicationForm;
  files: Partial<Record<SlotId, File>>;
  error: string | null;
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
  onFile: (slotId: SlotId, file: File | undefined) => void;
  run: () => Promise<void>;
  recheck: () => void;
  restart: () => void;
}

/** The app's state machine: which screen, which applicant, which files, which report. */
export function useFlow(): Flow {
  const [screen, setScreen] = useState<Screen>('landing');
  const [lang, setLang] = useState<Lang>('en');
  const [sample, setSample] = useState<SampleResponse | null>(null);
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM);
  const [files, setFiles] = useState<Partial<Record<SlotId, File>>>({});
  const [report, setReport] = useState<AuditReport | null>(null);
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const activeRun = useRef(0); // a newer run, or leaving the audit screen, cancels an older one
  const reader = useDocumentReader(files);
  const { cancel, reset, invalidate, readAll } = reader;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const go = useCallback(
    (next: Screen) => {
      if (next !== 'audit') {
        activeRun.current++;
        cancel();
      }
      setError(null);
      setScreen(next);
    },
    [cancel],
  );

  const trySample = useCallback(() => {
    const s = getSample();
    setSample(s);
    setForm(s.form);
    setFiles({});
    setScreen('scheme');
  }, []);

  const start = useCallback(() => {
    setSample(null);
    setForm(EMPTY_FORM);
    setFiles({});
    reset();
    go('scheme');
  }, [go, reset]);

  const onFile = useCallback(
    (slotId: SlotId, file: File | undefined) => {
      const problem = file ? validateFile(file) : null;
      setError(problem);
      if (problem) return;
      invalidate(slotId);
      setFiles((f) => ({ ...f, [slotId]: file }));
    },
    [invalidate],
  );

  const run = useCallback(async () => {
    const me = ++activeRun.current;
    const current = () => activeRun.current === me;
    setError(null);
    setReport(null);
    setRunId((n) => n + 1);
    setScreen('audit');
    try {
      if (sample) {
        setReport(audit(form, sample.errorDocuments));
        return;
      }
      const outcome = await readAll();
      if (!current()) return;
      if (Object.keys(outcome.failures).length > 0) {
        setError(failureMessage(outcome));
        setScreen('upload');
        return;
      }
      setReport(audit(form, outcome.documents));
    } catch (e) {
      if (!current()) return;
      setError(messageOf(e));
      setScreen('upload');
    }
  }, [form, readAll, sample]);

  const recheck = useCallback(() => {
    if (!sample) return go('upload');
    const fixed = audit(form, sample.fixedDocuments);
    setReport(fixed);
    setScreen(fixed.failed === 0 ? 'ready' : 'report');
  }, [form, go, sample]);

  const restart = useCallback(() => {
    setSample(null);
    setForm(EMPTY_FORM);
    setFiles({});
    reset();
    setReport(null);
    go('landing');
  }, [go, reset]);

  const docs = sample ? sample.errorDocuments : reader.docs;
  return { screen, lang, sample, form, files, error, report, runId, docs, reader, setLang, setForm, go, trySample, start, onFile, run, recheck, restart };
}

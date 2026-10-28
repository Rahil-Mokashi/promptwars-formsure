import { assertNever } from '../core/assertNever';
import type { ApplicationForm, AuditReport, Lang, SampleResponse, SlotId } from '../core/types';

/** The six screens, in the order of the design. */
export type Screen = 'landing' | 'scheme' | 'upload' | 'audit' | 'report' | 'ready';

/** Messages for invalid form fields. */
export type FormErrors = Partial<Record<keyof ApplicationForm, string>>;

/** Form before the applicant has typed anything. */
export const EMPTY_FORM: ApplicationForm = { fullName: '', dateOfBirth: '', category: 'OBC', academicYear: '2026-27', applicationType: 'Fresh' };

/** Shown when the form has invalid fields at the moment of running a check. */
export const FORM_ERROR_NOTE = 'Check the highlighted fields, then run the check again.';

/** Everything the screens show, in one value. Changed only by {@link flowReducer}. */
export interface FlowState {
  screen: Screen;
  lang: Lang;
  /** The sample applicant, or null in live mode. */
  sample: SampleResponse | null;
  form: ApplicationForm;
  files: Partial<Record<SlotId, File>>;
  /** The applicant agreed to send documents to Gemini (live mode). */
  consent: boolean;
  /** A blocking error, shown as an alert. */
  error: string | null;
  formErrors: FormErrors;
  report: AuditReport | null;
  /** Counts runs; remounts the audit screen for each one. */
  runId: number;
}

/** The state at the start, and after "Check another application". */
export const initialFlowState: FlowState = {
  screen: 'landing', lang: 'en', sample: null, form: EMPTY_FORM, files: {}, consent: false,
  error: null, formErrors: {}, report: null, runId: 0,
};

/** The stages of running a check. */
export type RunStage =
  | { stage: 'invalid'; formErrors: FormErrors }
  | { stage: 'started' }
  | { stage: 'finished'; report: AuditReport }
  | { stage: 'failed'; error: string };

/** Everything that can happen. */
export type FlowAction =
  /** Go to a screen. */
  | { type: 'NAVIGATE'; screen: Screen }
  /** "Try sample applicant": load the sample and show the scheme screen. */
  | { type: 'SELECT_SAMPLE'; sample: SampleResponse }
  /** "Start my check": an empty live application. */
  | { type: 'SELECT_LIVE' }
  /** A file was accepted for a slot (or removed when `file` is undefined). */
  | { type: 'SET_FILE'; slotId: SlotId; file: File | undefined }
  /** A chosen file was refused; `message` says why. */
  | { type: 'FILE_REJECTED'; message: string }
  /** The check is starting, finished, failed, or the form was invalid. */
  | { type: 'RUN_AUDIT'; run: RunStage }
  /** "I've fixed these, re-check" produced a new report. */
  | { type: 'RECHECK'; report: AuditReport }
  | { type: 'SET_FORM'; form: ApplicationForm }
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'SET_CONSENT'; consent: boolean }
  /** "Check another application". */
  | { type: 'RESTART' };

/** True when nothing is left to fix or review. */
export const isClean = (report: AuditReport): boolean => report.failed === 0 && report.needsReview === 0;

function runAudit(state: FlowState, run: RunStage): FlowState {
  switch (run.stage) {
    case 'invalid':
      return { ...state, formErrors: run.formErrors, error: FORM_ERROR_NOTE };
    case 'started':
      return { ...state, screen: 'audit', error: null, formErrors: {}, report: null, runId: state.runId + 1 };
    case 'finished':
      return { ...state, report: run.report };
    case 'failed':
      return { ...state, screen: 'upload', error: run.error };
    default:
      return assertNever(run);
  }
}

/** The app's state machine as a pure function: the same state and action always give the same next state. */
export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, screen: action.screen, error: null };
    case 'SELECT_SAMPLE':
      return { ...state, sample: action.sample, form: action.sample.form, files: {}, consent: false, error: null, formErrors: {}, screen: 'scheme' };
    case 'SELECT_LIVE':
      return { ...state, sample: null, form: EMPTY_FORM, files: {}, consent: false, error: null, formErrors: {}, report: null, screen: 'scheme' };
    case 'SET_FILE': {
      const { [action.slotId]: _replaced, ...others } = state.files;
      void _replaced;
      return { ...state, files: action.file ? { ...others, [action.slotId]: action.file } : others, error: null };
    }
    case 'FILE_REJECTED':
      return { ...state, error: action.message };
    case 'RUN_AUDIT':
      return runAudit(state, action.run);
    case 'RECHECK':
      return { ...state, report: action.report, error: null, screen: isClean(action.report) ? 'ready' : 'report' };
    case 'SET_FORM':
      return { ...state, form: action.form };
    case 'SET_LANG':
      return { ...state, lang: action.lang };
    case 'SET_CONSENT':
      return { ...state, consent: action.consent };
    case 'RESTART':
      return { ...initialFlowState, lang: state.lang, runId: state.runId };
    default:
      return assertNever(action);
  }
}

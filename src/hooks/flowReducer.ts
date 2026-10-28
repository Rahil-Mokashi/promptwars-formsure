import { assertNever } from '../core/assertNever';
import { omit } from '../core/object';
import type { ApplicationForm, AuditReport, Lang, SampleResponse, SlotId } from '../core/types';

/** The six screens, in the order of the design. */
export type Screen = 'landing' | 'scheme' | 'upload' | 'audit' | 'report' | 'ready';

/** Messages for invalid form fields. */
export type FormErrors = Partial<Record<keyof ApplicationForm, string>>;

/** Form before the applicant has typed anything. */
export const EMPTY_FORM: ApplicationForm = {
  fullName: '',
  dateOfBirth: '',
  category: 'OBC',
  academicYear: '2025-26',
  applicationType: 'Fresh',
};

/** The scheme pack used until another is chosen. */
const DEFAULT_PACK = 'mahadbt-postmatric-obc';

/** Shown when the form has invalid fields at the moment of running a check. */
export const FORM_ERROR_NOTE = 'Check the highlighted fields, then run the check again.';

/** Everything the screens show, in one value. Changed only by {@link flowReducer}. */
export interface FlowState {
  screen: Screen;
  lang: Lang;
  /** Id of the chosen scheme pack. */
  packId: string;
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
  screen: 'landing',
  lang: 'en',
  packId: DEFAULT_PACK,
  sample: null,
  form: EMPTY_FORM,
  files: {},
  consent: false,
  error: null,
  formErrors: {},
  report: null,
  runId: 0,
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
  /** Choose a scheme pack (live mode only: the sample applicant is an OBC student). */
  | { type: 'SELECT_PACK'; packId: string; categories: readonly string[] }
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

/** One handler per action type; the mapped type makes a missing handler a compile-time error. */
type Handlers = {
  [T in FlowAction['type']]: (state: FlowState, action: Extract<FlowAction, { type: T }>) => FlowState;
};

/** What a fresh application starts with: no files, no consent, no errors. */
const FRESH = { files: {}, consent: false, error: null, formErrors: {} } as const;

const handlers: Handlers = {
  NAVIGATE: (state, { screen }) => ({ ...state, screen, error: null }),
  SELECT_SAMPLE: (state, { sample }) => ({
    ...state,
    ...FRESH,
    packId: DEFAULT_PACK,
    sample,
    form: sample.form,
    screen: 'scheme',
  }),
  SELECT_LIVE: (state) => ({
    ...state,
    ...FRESH,
    packId: DEFAULT_PACK,
    sample: null,
    form: EMPTY_FORM,
    report: null,
    screen: 'scheme',
  }),
  SELECT_PACK: (state, { packId, categories }) => {
    if (state.sample) return state; // the sample applicant belongs to the OBC scheme
    const keep = categories.includes(state.form.category);
    const category = keep ? state.form.category : (categories[0] ?? state.form.category);
    return {
      ...state,
      packId,
      form: { ...state.form, category },
      files: {},
      report: null,
      error: null,
      formErrors: {},
    };
  },
  SET_FILE: (state, { slotId, file }) => {
    const others = omit(state.files, slotId);
    return { ...state, files: file ? { ...others, [slotId]: file } : others, error: null };
  },
  FILE_REJECTED: (state, { message }) => ({ ...state, error: message }),
  RUN_AUDIT: (state, { run }) => runAudit(state, run),
  RECHECK: (state, { report }) => ({ ...state, report, error: null, screen: isClean(report) ? 'ready' : 'report' }),
  SET_FORM: (state, { form }) => ({ ...state, form }),
  SET_LANG: (state, { lang }) => ({ ...state, lang }),
  SET_CONSENT: (state, { consent }) => ({ ...state, consent }),
  RESTART: (state) => ({ ...initialFlowState, lang: state.lang, runId: state.runId }),
};

/** The app's state machine as a pure function: the same state and action always give the same next state. */
export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  if (!Object.hasOwn(handlers, action.type)) return assertNever(action as never);
  const handler = handlers[action.type] as (state: FlowState, action: FlowAction) => FlowState;
  return handler(state, action);
}

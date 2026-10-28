import { useCallback, useRef, type Dispatch } from 'react';
import { validateForm } from '../core/formSchema';
import type { ApplicationForm, SampleResponse, SchemePack } from '../core/types';
import { audit } from '../services/api';
import type { ReadOutcome } from '../services/readFiles';
import { failureMessage, messageOf } from './flowMessages';
import type { FlowAction, RunStage } from './flowReducer';

/** Reads every file, then runs the rules on what was read. */
async function liveStage(
  readAll: () => Promise<ReadOutcome>,
  form: ApplicationForm,
  packId: string,
): Promise<RunStage> {
  const outcome = await readAll();
  if (Object.keys(outcome.failures).length > 0) return { stage: 'failed', error: failureMessage(outcome) };
  return { stage: 'finished', report: audit(form, outcome.documents, packId) };
}

/** What {@link useAuditRun} needs from the flow. */
export interface AuditRunInput {
  sample: SampleResponse | null;
  consent: boolean;
  form: ApplicationForm;
  pack: SchemePack;
  readAll: () => Promise<ReadOutcome>;
  dispatch: Dispatch<FlowAction>;
}

/**
 * Starts a check: validates the form, reads the files (or uses the sample) and dispatches each stage.
 * A newer run, or {@link supersede}, makes an older run's result be dropped.
 */
export function useAuditRun({ sample, consent, form, pack, readAll, dispatch }: AuditRunInput) {
  const activeRun = useRef(0);
  const supersede = useCallback(() => {
    activeRun.current++;
  }, []);

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
      const stage: RunStage = sample
        ? { stage: 'finished', report: audit(checked.form, sample.errorDocuments, pack.id) }
        : await liveStage(readAll, checked.form, pack.id);
      if (current()) dispatch({ type: 'RUN_AUDIT', run: stage });
    } catch (e) {
      if (current()) dispatch({ type: 'RUN_AUDIT', run: { stage: 'failed', error: messageOf(e) } });
    }
  }, [consent, form, pack, readAll, sample, dispatch]);

  return { run, supersede };
}

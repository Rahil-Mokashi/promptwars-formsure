import { describe, expect, it } from 'vitest';
import { assertNever } from '../core/assertNever';
import { sample as sampleResponse } from '../test/docs';
import { pdfFile } from '../test/files';
import {
  EMPTY_FORM,
  FORM_ERROR_NOTE,
  flowReducer,
  initialFlowState,
  isClean,
  type FlowAction,
  type FlowState,
} from './flowReducer';
import { audit, fixed } from '../test/docs';

const reduce = (state: FlowState, ...actions: FlowAction[]): FlowState => actions.reduce(flowReducer, state);
const withSample = reduce(initialFlowState, { type: 'SELECT_SAMPLE', sample: sampleResponse });
const badReport = audit(sampleResponse.errorDocuments);
const cleanReport = audit(fixed);

describe('flowReducer: navigation and starting', () => {
  it('starts on the landing page with nothing selected', () => {
    expect(initialFlowState).toMatchObject({
      screen: 'landing',
      sample: null,
      files: {},
      consent: false,
      error: null,
      report: null,
    });
  });
  it('NAVIGATE changes the screen and clears the error', () => {
    const next = reduce({ ...initialFlowState, error: 'boom' }, { type: 'NAVIGATE', screen: 'upload' });
    expect(next).toMatchObject({ screen: 'upload', error: null });
  });
  it('SELECT_SAMPLE loads the sample, its form, and shows the scheme screen without consent', () => {
    expect(withSample).toMatchObject({
      screen: 'scheme',
      sample: sampleResponse,
      form: sampleResponse.form,
      files: {},
      consent: false,
    });
  });
  it('SELECT_LIVE starts an empty live application', () => {
    const next = reduce(withSample, { type: 'SELECT_LIVE' });
    expect(next).toMatchObject({ screen: 'scheme', sample: null, form: EMPTY_FORM, files: {}, report: null });
  });
  it('SELECT_PACK switches scheme pack and updates category to match in live mode', () => {
    const live = reduce(initialFlowState, { type: 'SELECT_LIVE' });
    const sc = reduce(live, { type: 'SELECT_PACK', packId: 'mahadbt-postmatric-sc', categories: ['SC'] });
    expect(sc.packId).toBe('mahadbt-postmatric-sc');
    expect(sc.form.category).toBe('SC');
  });
  it('SELECT_PACK is locked in sample mode', () => {
    const next = reduce(withSample, { type: 'SELECT_PACK', packId: 'mahadbt-postmatric-sc', categories: ['SC'] });
    expect(next.packId).toBe(initialFlowState.packId);
  });
});

describe('flowReducer: files', () => {
  it('SET_FILE adds, replaces and removes a file for a slot, and clears the error', () => {
    const a = pdfFile('a.pdf');
    const b = pdfFile('b.pdf');
    let state = reduce({ ...initialFlowState, error: 'old' }, { type: 'SET_FILE', slotId: 'aadhaar', file: a });
    expect(state.files).toEqual({ aadhaar: a });
    expect(state.error).toBeNull();
    state = reduce(
      state,
      { type: 'SET_FILE', slotId: 'aadhaar', file: b },
      { type: 'SET_FILE', slotId: 'marksheet', file: a },
    );
    expect(state.files).toEqual({ aadhaar: b, marksheet: a });
    state = reduce(state, { type: 'SET_FILE', slotId: 'aadhaar', file: undefined });
    expect(state.files).toEqual({ marksheet: a });
  });
  it('FILE_REJECTED shows the reason and keeps the files', () => {
    const a = pdfFile('a.pdf');
    const state = reduce(
      initialFlowState,
      { type: 'SET_FILE', slotId: 'aadhaar', file: a },
      { type: 'FILE_REJECTED', message: 'nope' },
    );
    expect(state).toMatchObject({ error: 'nope', files: { aadhaar: a } });
  });
});

describe('flowReducer: running a check', () => {
  it('RUN_AUDIT invalid keeps the screen and shows the field errors', () => {
    const next = reduce(initialFlowState, {
      type: 'RUN_AUDIT',
      run: { stage: 'invalid', formErrors: { fullName: 'Enter your full name.' } },
    });
    expect(next).toMatchObject({
      screen: 'landing',
      formErrors: { fullName: 'Enter your full name.' },
      error: FORM_ERROR_NOTE,
    });
  });
  it('RUN_AUDIT started goes to the audit screen, clears the old report and counts the run', () => {
    const next = reduce(
      { ...withSample, report: badReport, error: 'x', formErrors: { fullName: 'x' } },
      { type: 'RUN_AUDIT', run: { stage: 'started' } },
    );
    expect(next).toMatchObject({ screen: 'audit', report: null, error: null, formErrors: {}, runId: 1 });
  });
  it('RUN_AUDIT finished stores the report and stays on the audit screen', () => {
    const next = reduce(
      withSample,
      { type: 'RUN_AUDIT', run: { stage: 'started' } },
      { type: 'RUN_AUDIT', run: { stage: 'finished', report: badReport } },
    );
    expect(next).toMatchObject({ screen: 'audit', report: badReport });
  });
  it('RUN_AUDIT failed returns to the upload screen with the error', () => {
    const next = reduce(
      withSample,
      { type: 'RUN_AUDIT', run: { stage: 'started' } },
      { type: 'RUN_AUDIT', run: { stage: 'failed', error: 'Gemini is busy' } },
    );
    expect(next).toMatchObject({ screen: 'upload', error: 'Gemini is busy' });
  });
  it('RECHECK goes to Ready only when nothing needs fixing or review', () => {
    expect(reduce(withSample, { type: 'RECHECK', report: cleanReport })).toMatchObject({
      screen: 'ready',
      report: cleanReport,
    });
    expect(reduce(withSample, { type: 'RECHECK', report: badReport })).toMatchObject({
      screen: 'report',
      report: badReport,
    });
    expect(isClean(cleanReport)).toBe(true);
    expect(isClean({ ...cleanReport, needsReview: 1 })).toBe(false);
  });
});

describe('flowReducer: settings and restart', () => {
  it('SET_FORM, SET_LANG and SET_CONSENT change only their own field', () => {
    const next = reduce(
      initialFlowState,
      { type: 'SET_FORM', form: { ...EMPTY_FORM, fullName: 'Aarav' } },
      { type: 'SET_LANG', lang: 'mr' },
      { type: 'SET_CONSENT', consent: true },
    );
    expect(next).toMatchObject({ form: { fullName: 'Aarav' }, lang: 'mr', consent: true, screen: 'landing' });
  });
  it('RESTART forgets the application and files but keeps the language and the run count', () => {
    const busy = reduce(
      withSample,
      { type: 'SET_LANG', lang: 'hi' },
      { type: 'SET_CONSENT', consent: true },
      { type: 'RUN_AUDIT', run: { stage: 'started' } },
      { type: 'RUN_AUDIT', run: { stage: 'finished', report: badReport } },
    );
    expect(reduce(busy, { type: 'RESTART' })).toEqual({ ...initialFlowState, lang: 'hi', runId: 1 });
  });
  it('is pure: the same state and action give the same result and the input is not changed', () => {
    const before = JSON.stringify(withSample);
    expect(flowReducer(withSample, { type: 'SET_LANG', lang: 'mr' })).toEqual(
      flowReducer(withSample, { type: 'SET_LANG', lang: 'mr' }),
    );
    expect(JSON.stringify(withSample)).toBe(before);
  });
  it('throws on an action it does not know (exhaustiveness guard)', () => {
    expect(() => flowReducer(initialFlowState, { type: 'MYSTERY' } as never)).toThrow('Unexpected value');
    expect(() => assertNever('x' as never)).toThrow();
  });
});

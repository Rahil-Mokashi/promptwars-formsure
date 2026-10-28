import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firebase AI Logic is mocked: no network, no SDK.
const mocks = vi.hoisted(() => {
  class GoogleAIBackend {}
  const kind = (type: string) => (opts?: object) => ({ type, ...opts });
  const generateContent = vi.fn<(...args: unknown[]) => Promise<{ response: { text: () => string } }>>(async () => ({ response: { text: () => '{"ok":true}' } }));
  return {
    GoogleAIBackend,
    generateContent,
    getGenerativeModel: vi.fn<(...args: unknown[]) => object>(() => ({ generateContent })),
    initializeApp: vi.fn((config: unknown) => ({ config })),
    getApps: vi.fn((): unknown[] => []),
    getAI: vi.fn<(...args: unknown[]) => object>(() => ({})),
    Schema: {
      object: kind('object'), string: kind('string'), array: kind('array'),
      number: kind('number'), integer: kind('integer'), boolean: kind('boolean'),
    },
  };
});

vi.mock('firebase/app', () => ({ initializeApp: mocks.initializeApp, getApps: mocks.getApps }));
vi.mock('firebase/ai', () => ({
  getAI: mocks.getAI,
  getGenerativeModel: mocks.getGenerativeModel,
  GoogleAIBackend: mocks.GoogleAIBackend,
  Schema: mocks.Schema,
}));

const env = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'formsure-de6fa', VITE_FIREBASE_APP_ID: 'a' };

describe('createFirebaseGenerate (Firebase AI mocked)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls Gemini through the Gemini Developer API backend with JSON output and a response schema', async () => {
    const { createFirebaseGenerate } = await import('./live');
    const generate = createFirebaseGenerate(env);
    const text = await generate!({ mimeType: 'application/pdf', data: 'QUJD', prompt: 'read it' });

    expect(text).toBe('{"ok":true}');
    expect(mocks.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'formsure-de6fa', apiKey: 'k' }));
    expect(mocks.getAI.mock.calls[0]?.[1]).toEqual({ backend: expect.any(mocks.GoogleAIBackend) });
    const params = mocks.getGenerativeModel.mock.calls[0]?.[1] as {
      model: string;
      generationConfig: { responseMimeType: string; responseSchema: { properties: Record<string, unknown> } };
    };
    expect(params.model).toBe('gemini-3.8-flash');
    expect(params.generationConfig.responseMimeType).toBe('application/json');
    expect(Object.keys(params.generationConfig.responseSchema.properties)).toEqual([
      'documentTypes', 'language', 'applicantName', 'dateOfBirth', 'issueDate',
      'issuingAuthority', 'category', 'annualIncome', 'pageCount', 'legible',
    ]);
    expect(mocks.generateContent).toHaveBeenCalledWith([
      { type: 'inlineData', inlineData: { mimeType: 'application/pdf', data: 'QUJD' } },
      { type: 'text', text: 'read it' },
    ]);
  });

  it('uses VITE_GEMINI_MODEL and reuses an existing Firebase app', async () => {
    mocks.getApps.mockReturnValueOnce([{ name: 'existing' }]);
    const { createFirebaseGenerate } = await import('./live');
    await createFirebaseGenerate({ ...env, VITE_GEMINI_MODEL: 'gemini-custom' })!({ mimeType: 'image/png', data: 'x', prompt: 'p' });
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect((mocks.getGenerativeModel.mock.calls[0]?.[1] as { model: string }).model).toBe('gemini-custom');
  });
});

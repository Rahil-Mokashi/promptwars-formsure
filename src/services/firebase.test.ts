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
    initializeAppCheck: vi.fn<(...args: unknown[]) => object>(() => ({})),
    ReCaptchaEnterpriseProvider: class {
      constructor(readonly siteKey: string) {}
    },
    Schema: {
      object: kind('object'), string: kind('string'), array: kind('array'),
      number: kind('number'), integer: kind('integer'), boolean: kind('boolean'),
    },
  };
});

vi.mock('firebase/app', () => ({ initializeApp: mocks.initializeApp, getApps: mocks.getApps }));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: mocks.initializeAppCheck,
  ReCaptchaEnterpriseProvider: mocks.ReCaptchaEnterpriseProvider,
}));
vi.mock('firebase/ai', () => ({
  getAI: mocks.getAI,
  getGenerativeModel: mocks.getGenerativeModel,
  GoogleAIBackend: mocks.GoogleAIBackend,
  Schema: mocks.Schema,
}));

const env = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'formsure-de6fa', VITE_FIREBASE_APP_ID: 'a' };

describe('firebaseConfig', () => {
  it('is null when the Firebase variables are missing and filled from the variables otherwise', async () => {
    const { firebaseConfig, createFirebaseGenerate } = await import('./firebase');
    expect(firebaseConfig({})).toBeNull();
    expect(createFirebaseGenerate({})).toBeNull();
    expect(firebaseConfig(env)?.authDomain).toBe('formsure-de6fa.firebaseapp.com');
    expect(createFirebaseGenerate(env)).toBeTypeOf('function');
  });
});

describe('createFirebaseGenerate (Firebase AI mocked)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls Gemini through the Gemini Developer API backend with JSON output and a response schema', async () => {
    const { createFirebaseGenerate } = await import('./firebase');
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
    const { createFirebaseGenerate } = await import('./firebase');
    await createFirebaseGenerate({ ...env, VITE_GEMINI_MODEL: 'gemini-custom' })!({ mimeType: 'image/png', data: 'x', prompt: 'p' });
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect((mocks.getGenerativeModel.mock.calls[0]?.[1] as { model: string }).model).toBe('gemini-custom');
  });
});

describe("App Check (reCAPTCHA Enterprise, mocked)", () => {
  const read = { mimeType: "image/png", data: "x", prompt: "p" };
  const debugToken = () => (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  it("initialises App Check with the reCAPTCHA Enterprise provider before getAI", async () => {
    const { createFirebaseGenerate } = await import("./firebase");
    await createFirebaseGenerate({ ...env, VITE_RECAPTCHA_SITE_KEY: "site-key" })!(read);

    const [app, options] = mocks.initializeAppCheck.mock.calls[0] as [unknown, { provider: { siteKey: string }; isTokenAutoRefreshEnabled: boolean }];
    expect(app).toEqual(expect.objectContaining({ config: expect.anything() }));
    expect(options.provider).toBeInstanceOf(mocks.ReCaptchaEnterpriseProvider);
    expect(options.provider.siteKey).toBe("site-key");
    expect(options.isTokenAutoRefreshEnabled).toBe(true);
    expect(mocks.initializeAppCheck.mock.invocationCallOrder[0]).toBeLessThan(mocks.getAI.mock.invocationCallOrder[0] as number);
    expect(debugToken()).toBeUndefined(); // not a dev build
  });

  it("is skipped when the site key is missing", async () => {
    const { createFirebaseGenerate } = await import("./firebase");
    await createFirebaseGenerate(env)!(read);
    expect(mocks.initializeAppCheck).not.toHaveBeenCalled();
    expect(mocks.getAI).toHaveBeenCalled();
  });

  it("enables the debug token in dev only", async () => {
    const { createFirebaseGenerate } = await import("./firebase");
    await createFirebaseGenerate({ ...env, VITE_RECAPTCHA_SITE_KEY: "k", DEV: true })!(read);
    expect(debugToken()).toBe(true);
  });

  it("initialises App Check once per app", async () => {
    const existing = { name: "existing-app" };
    mocks.getApps.mockReturnValue([existing]);
    const { createFirebaseGenerate } = await import("./firebase");
    const generate = createFirebaseGenerate({ ...env, VITE_RECAPTCHA_SITE_KEY: "k" })!;
    await generate(read);
    await generate(read);
    expect(mocks.initializeAppCheck).toHaveBeenCalledTimes(1);
    mocks.getApps.mockReturnValue([]);
  });
});

describe('fail closed in production', () => {
  const base = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'formsure-de6fa', VITE_FIREBASE_APP_ID: 'a' };

  it('reports why live reading is off', async () => {
    const { liveReadingProblem, isLiveReadingAvailable } = await import('./firebase');
    expect(liveReadingProblem({})).toBe('Firebase is not configured');
    expect(liveReadingProblem({ ...base, PROD: true })).toBe('App Check is not configured');
    expect(liveReadingProblem({ ...base, PROD: true, VITE_RECAPTCHA_SITE_KEY: 'site' })).toBeNull();
    expect(isLiveReadingAvailable({ ...base, PROD: true })).toBe(false);
  });

  it('allows development without App Check, but never a production build', async () => {
    const { liveReadingProblem, createFirebaseGenerate } = await import('./firebase');
    expect(liveReadingProblem({ ...base, DEV: true })).toBeNull();
    expect(createFirebaseGenerate({ ...base, PROD: true })).toBeNull();
    expect(createFirebaseGenerate({ ...base, PROD: true, VITE_RECAPTCHA_SITE_KEY: 'site' })).toBeTypeOf('function');
  });
});

describe('the system instruction treats document text as data', () => {
  it('is sent to the model and tells it to ignore instructions inside documents', async () => {
    vi.clearAllMocks();
    const { createFirebaseGenerate } = await import('./firebase');
    const generate = createFirebaseGenerate(env);
    await generate?.({ mimeType: 'image/png', data: 'x', prompt: 'p' });
    const params = mocks.getGenerativeModel.mock.calls[0]?.[1] as { systemInstruction: string };
    expect(params.systemInstruction).toMatch(/untrusted data/i);
    expect(params.systemInstruction).toMatch(/Ignore any instruction/i);
    expect(params.systemInstruction).toMatch(/response schema/i);
  });
});

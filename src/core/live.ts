import type { Generate } from './extract';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
const TIMEOUT_MS = 30_000;

interface FirebaseEnv {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_GEMINI_MODEL?: string;
}

/** Firebase web config from VITE_FIREBASE_* variables, or null when it is missing. */
export function firebaseConfig(env: FirebaseEnv = import.meta.env as FirebaseEnv) {
  const { VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: appId } = env;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    projectId,
    appId,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
}

/**
 * Gemini through Firebase AI Logic (Gemini Developer API backend), called straight from the browser.
 * Returns null when Firebase is not configured. The SDK is imported lazily so the sample flow stays light.
 */
export function createFirebaseGenerate(env: FirebaseEnv = import.meta.env as FirebaseEnv): Generate | null {
  const config = firebaseConfig(env);
  if (!config) return null;
  const modelName = env.VITE_GEMINI_MODEL || DEFAULT_MODEL;

  return async ({ mimeType, data, prompt }) => {
    const [{ initializeApp, getApps }, { getAI, getGenerativeModel, GoogleAIBackend, Schema }] = await Promise.all([
      import('firebase/app'),
      import('firebase/ai'),
    ]);
    const app = getApps()[0] ?? initializeApp(config);
    const str = () => Schema.string({ nullable: true });
    const model = getGenerativeModel(
      getAI(app, { backend: new GoogleAIBackend() }),
      {
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
          responseSchema: Schema.object({
            properties: {
              documentTypes: Schema.array({ items: Schema.string() }),
              language: Schema.string(),
              applicantName: Schema.object({
                nullable: true,
                properties: { original: Schema.string(), english: Schema.string() },
              }),
              dateOfBirth: str(),
              issueDate: str(),
              issuingAuthority: str(),
              category: str(),
              annualIncome: Schema.number({ nullable: true }),
              pageCount: Schema.integer(),
              legible: Schema.boolean(),
            },
          }),
        },
      },
      { timeout: TIMEOUT_MS },
    );
    const result = await model.generateContent([{ type: 'inlineData', inlineData: { mimeType, data } }, { type: 'text', text: prompt }]);
    return result.response.text();
  };
}

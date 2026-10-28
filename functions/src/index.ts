import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { createApp } from './app';

// Attached to the function below: Cloud Functions exposes it as process.env.GEMINI_API_KEY.
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// One 2nd-gen function (runs on Cloud Run): serves /api/* and the built React app.
export const app = onRequest(
  { region: 'asia-south1', secrets: [GEMINI_API_KEY], memory: '512MiB', timeoutSeconds: 60, invoker: 'public' },
  createApp(),
);

import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { z } from 'zod';
import { DEFAULT_MODEL, ExtractionError, NotConfiguredError, createGeminiGenerate, extractDocument, extractedSchema, type Generate } from './gemini';
import { runAudit } from './rules/engine';
import { buildSample } from './rules/sample';
import { getPack, toWirePack } from './rules/schema';

const MAX_FILE = 5 * 1024 * 1024;
const MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const SLOTS = ['aadhaar', 'caste_certificate', 'income_certificate', 'domicile', 'bonafide', 'marksheet', 'bank_passbook'] as const;

/** Mask any 12-digit number (Aadhaar) so only the last four digits ever leave the server. */
export const maskAadhaar = (text: string): string => text.replace(/(?<!\d)(\d{4})[ -]?(\d{4})[ -]?(\d{4})(?!\d)/g, 'XXXX XXXX $3');

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

const auditBody = z.object({
  schemeId: z.string().max(80),
  form: z.object({
    fullName: z.string().trim().min(1).max(120),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    category: z.string().trim().min(1).max(20),
    academicYear: z.string().max(20).default(''),
    applicationType: z.string().max(20).default(''),
  }),
  documents: z.partialRecord(z.enum(SLOTS), extractedSchema),
});

export interface AppDeps {
  /** Overrides the Gemini call (tests). Default: real Gemini using GEMINI_API_KEY. */
  generate?: Generate;
  now?: () => Date;
}

function findWebDir(): string | undefined {
  const candidates = [
    process.env.WEB_DIR,
    path.resolve(__dirname, '../../../web'), // functions/lib/functions/src -> functions/web
    path.resolve(__dirname, '../../../../dist/web'), // repo build output
  ];
  return candidates.find((d): d is string => !!d && existsSync(path.join(d, 'index.html')));
}

export function createApp(deps: AppDeps = {}) {
  const now = deps.now ?? (() => new Date());
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  const api = express.Router();
  api.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
  api.use(express.json({ limit: '256kb' }));
  // Every JSON response passes through here, so no 12-digit number can leave unmasked.
  api.use((_req, res, next) => {
    res.json = (body: unknown): Response => res.type('json').send(maskAadhaar(JSON.stringify(body)));
    next();
  });

  const upload = multer({
    storage: multer.memoryStorage(), // uploaded files are never written to disk
    limits: { fileSize: MAX_FILE, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, MIME.includes(file.mimetype)),
  });

  api.get('/health', (_req, res) => {
    res.json({ ok: true, geminiConfigured: !!process.env.GEMINI_API_KEY });
  });

  api.get('/schemes/:id', (req, res) => {
    const pack = getPack(String(req.params.id));
    if (!pack) throw new HttpError(404, 'not_found', 'Unknown scheme');
    res.json(toWirePack(pack));
  });

  api.get('/sample', (_req, res) => {
    res.json(buildSample(now()));
  });

  api.post('/audit', (req: Request, res) => {
    const body = auditBody.parse(req.body);
    const pack = getPack(body.schemeId);
    if (!pack) throw new HttpError(404, 'not_found', 'Unknown scheme');
    res.json(runAudit(pack, body.form, body.documents, now()));
  });

  api.post('/extract', upload.single('file'), async (req: Request, res) => {
    const slot = z.enum(SLOTS).parse(req.body?.slot);
    if (!req.file) throw new HttpError(400, 'invalid_request', 'Attach one PNG, JPG, WebP or PDF file up to 5 MB.');
    const key = process.env.GEMINI_API_KEY;
    const generate = deps.generate ?? (key ? createGeminiGenerate(key, process.env.GEMINI_MODEL || DEFAULT_MODEL) : undefined);
    if (!generate) throw new NotConfiguredError('Live reading unavailable, try the sample applicant');
    const document = await extractDocument(generate, { mimeType: req.file.mimetype, data: req.file.buffer });
    res.json({ slot, document });
  });

  api.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'Not found')));
  app.use('/api', api);

  const web = findWebDir();
  if (web) {
    app.use(express.static(web, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(web, 'index.html')));
  }

  // Central error handler: typed JSON errors, never a stack trace.
  // Express identifies error handlers by their 4-argument signature, so _next must stay.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    let status = 500;
    let code = 'internal_error';
    let message = 'Something went wrong';
    if (err instanceof HttpError) ({ status, code, message } = { status: err.status, code: err.code, message: err.message });
    else if (err instanceof z.ZodError) {
      status = 400;
      code = 'invalid_request';
      message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    } else if (err instanceof multer.MulterError) {
      status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      code = 'invalid_request';
      message = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 5 MB' : 'Invalid upload';
    } else if (err instanceof NotConfiguredError) {
      status = 503;
      code = 'gemini_unavailable';
      message = err.message;
    } else if (err instanceof ExtractionError) {
      status = 502;
      code = 'extraction_failed';
      message = err.message;
    } else if (err instanceof SyntaxError && 'body' in err) {
      status = 400;
      code = 'invalid_request';
      message = 'Malformed JSON';
    } else if (typeof err?.status === 'number' && err.status < 500) {
      status = err.status; // e.g. 413 from the JSON body limit
      code = 'invalid_request';
      message = 'Request rejected';
    } else console.error('Unhandled error:', err instanceof Error ? err.message : 'unknown');
    res.status(status).type('json').send(maskAadhaar(JSON.stringify({ error: { code, message } })));
  };
  app.use(onError);
  return app;
}

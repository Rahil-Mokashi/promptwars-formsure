# Security

## What is protected

Applicants' identity and education documents (Aadhaar, caste and income certificates, marksheets, passbooks) and the details read from them.

## Reporting a vulnerability

Report it privately through a [GitHub security advisory](https://github.com/Rahil-Mokashi/promptwars-formsure/security/advisories/new). Please do not open a public issue. Include steps to reproduce. There is no bug bounty.

## Data flow: what goes where, and why

```
Browser (the only place FormSure's own code runs)
  1. you pick a file  ->  checked here: type, size, magic bytes, PDF structure, image size
  2. images           ->  re-encoded through a canvas (EXIF and other metadata dropped), scaled down only above 2400 px
  3. consent ticked   ->  the cleaned file is sent to Gemini through Firebase AI Logic (App Check token attached)
  4. Gemini's JSON    <-  validated with Zod; 12-digit numbers masked
  5. rules engine     ->  runs here on the validated fields only; the report is shown here
```

| Sent to Google Gemini via Firebase | Why | Not sent |
|---|---|---|
| The cleaned image, or the PDF as it is (PDF metadata cannot be stripped in the browser), plus a fixed instruction and a system instruction | To read the fields printed on the document | The name, date of birth and category you typed on the form; the rules; other documents (each file is a separate request) |

FormSure stores no document data anywhere: no server, no database, and no `localStorage`, IndexedDB or Cache API use. The one exception is the rate limiter, which keeps call timestamps (numbers only) in `sessionStorage` so that reloading the tab does not reset the quota; they expire after 24 hours and vanish when the tab closes. `src/App.privacy.test.tsx` scans the source to prove nothing else touches browser storage. Files and results live in memory and are dropped when the page is hidden or closed (`pagehide` handler in `src/hooks/useFlow.ts`) or when a file is replaced or the flow restarts. Two honest caveats: the **Firebase SDK** may keep an installation ID and the App Check token in the browser's IndexedDB, which FormSure's code does not control; and **Google processes the document** under its own terms for your project, so "nothing is stored" describes FormSure, not Google.

## Threat model

| Threat | Mitigation | Where (code, then test) |
|---|---|---|
| Documents leaking from storage | Nothing is persisted; files and results are memory-only, cleared on replace, restart and page hide | `src/hooks/useFlow.ts`, `src/hooks/useDocumentReader.ts`; `src/App.privacy.test.tsx` |
| Personal data in logs | Errors are logged as name, status and code only, never the provider message, request, document, name or number | `describeError` in `src/core/mask.ts`, used in `src/services/extraction.ts`; `src/core/mask.test.ts`, `src/App.privacy.test.tsx` |
| Aadhaar number exposure | Any 12-digit number is rewritten to `XXXX XXXX 1234` in model output, report, error messages and file names, before it is shown, printed or downloaded | `src/core/mask.ts`, `src/services/api.ts`; `src/core/mask.test.ts` |
| Secrets in the repo or history | None in the repo. `VITE_*` values are public web identifiers kept in a git-ignored `.env`. CI runs gitleaks over the full history | `.gitignore`, `.env.example`, `.github/workflows/ci.yml` |
| Quota abuse by other clients | **App Check with reCAPTCHA Enterprise** attaches a token to each AI Logic request so the project can reject other clients. It protects the quota; it is **not user authorisation** (there are no users). In production the app **fails closed**: without Firebase config and the App Check site key, live reading is disabled and only the sample works | `src/services/firebase.ts` (`liveReadingProblem`, `initializeAppCheck`); `src/services/firebase.test.ts` |
| Hammering the free tier from one tab | One file at a time, 4 s apart; at most 8 Gemini calls a minute and 60 a day per browser tab session (timestamps in `sessionStorage`, so a reload does not reset them); 429s back off 10 s, 20 s, 40 s; no retry on schema errors | `src/services/rateLimiter.ts`, `src/services/readFiles.ts`, `src/services/extraction.ts`; their tests |
| Malicious or malformed uploads | Type, 5 MB, empty, **magic bytes** (a PDF renamed `.png`, or a script renamed `.pdf`, is rejected); PDFs: truncated, encrypted and over 10 pages rejected; images over 6000 × 6000 px rejected; at most 10 files and 25 MB in total | `src/core/fileValidation.ts`, `src/services/uploadPipeline.ts`, `src/hooks/useFlow.ts`; `src/core/fileValidation.test.ts`, `src/services/uploadPipeline.test.ts` |
| Hidden metadata in images (GPS, device) | Images are re-encoded through a canvas, which drops EXIF; large images are scaled down only above 2400 px on the long side | `browserImageTools` in `src/services/uploadPipeline.ts` |
| Prompt injection inside a document | The system instruction says document text is untrusted data; the response schema is strict; Zod validates the answer; extracted text is never used in prompts and the rules engine reads only validated fields, so a document can at worst change the fields it is read as | `src/services/prompt.ts`, `src/core/extractSchema.ts`, `src/core/rules/`; `src/services/firebase.test.ts` |
| Wrong or manipulated model output | Unknown values coerced or rejected, impossible dates become null (so the rule needs review), lengths capped; a missing or ambiguous value means `needs_review`, never a pass | `src/core/extractSchema.ts`, `src/core/rules/context.ts`; `src/core/dates.test.ts`, `src/core/engine.test.ts` |
| Hostile form input | Zod: trimmed, length-capped (name 100), letters-only name, real date of birth, fixed category and type lists | `src/core/formSchema.ts`; `src/core/formSchema.test.ts` |
| XSS | React escapes all text; no `dangerouslySetInnerHTML`; CSP allows no inline script and no `eval` (Zod runs jitless); external links use `rel="noopener noreferrer"` | `firebase.json`, `src/core/zodConfig.ts` |
| Clickjacking, sniffing, downgrade, window hijack | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (1 year, includeSubDomains), `Cross-Origin-Opener-Policy: same-origin` | `firebase.json` |
| Data leaving the site | `connect-src` limited to the site, `*.googleapis.com`, `*.firebaseio.com` and `www.google.com`; `Referrer-Policy: no-referrer`; camera, microphone and geolocation denied | `firebase.json` |
| Crashes exposing internals | A top-level ErrorBoundary shows a friendly fallback without a stack trace; user-facing errors are generic | `src/components/ErrorBoundary.tsx` |
| Vulnerable or malicious dependencies | CI runs `npm audit --audit-level=high` and Dependabot opens weekly update PRs. A transitive `@grpc/grpc-js` advisory (pulled in by Firebase's unused Firestore) is cleared with an npm `overrides` entry | `.github/workflows/ci.yml`, `.github/dependabot.yml`, `package.json` |
| Stale build tooling | Node 22 is pinned for local runs and CI | `.nvmrc`, `package.json` (`engines`) |

## Known gaps

- **App Check only protects the quota once enforcement is switched on in the Firebase console**; reCAPTCHA is probabilistic, not a guarantee.
- **Client-side rate limiter is a usability safeguard:** The limiter's `sessionStorage` timestamps are scoped to a single tab and provide reload persistence within that tab only. Authoritative quota protection and abuse prevention relies on provider-side Firebase App Check (reCAPTCHA Enterprise) and Google Cloud project quotas. The client-side checks and form validation run in the browser, so a determined user can bypass them.
- **Visual document redaction is not implemented:** Text-level 12-digit number masking (`maskAadhaar`, `maskDeep`) is strictly applied across all model outputs, reports, logs, and filenames before display or download. However, pre-transmission visual redaction of uploaded images or PDFs (such as drawing masks over card numbers or redacting QR codes) is **not implemented**; raw document scans are transmitted to Google's Gemini API for OCR reading, stripped of image EXIF metadata only.
- Magic bytes and the PDF checks are heuristics: they show a file starts like a PNG, JPEG, WebP or PDF and has no obvious damage, not that its contents are harmless. PDF page counting can fail when the page tree is compressed; the model's own page count is checked after reading.
- PDF metadata is sent as-is.
- `style-src` allows `'unsafe-inline'` because Framer Motion sets inline styles.
- Only fictional sample data is in this repository.

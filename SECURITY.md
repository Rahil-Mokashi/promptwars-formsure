# Security

## What is protected

Applicants' identity documents (Aadhaar, caste and income certificates, marksheets, passbooks) and the data read from them.

## Architecture in one line

A static site on Firebase Hosting (Spark plan). All logic runs in the user's browser; the only network call is to Gemini through Firebase AI Logic, and only when the user uploads a file for live reading. There is no server, database or storage. The sample flow makes no network request.

## Reporting a vulnerability

Please report it privately through a [GitHub security advisory](https://github.com/Rahil-Mokashi/promptwars-formsure/security/advisories/new) and do not open a public issue. Include steps to reproduce; expect an acknowledgement within a few days. There is no bug bounty.

## Threat model

| Threat | Mitigation | Where in the code |
|--------|------------|-------------------|
| Documents leaking from storage | Nothing is stored anywhere. Files are read in memory, sent once to Gemini via Firebase, and dropped when the page closes. No analytics. | `src/services/extraction.ts`, `src/services/readFiles.ts` (cache holds documents in memory only) |
| Document content in logs | Errors are logged as a one-line description (name, status, masked message), never the request, file or model text. | `describeError` in `src/core/mask.ts`; used by `src/services/extraction.ts` |
| Aadhaar number exposure | Any 12-digit number is rewritten to `XXXX XXXX 1234` in model output, in the report, in error messages, in logs and in file names, before it is shown, printed or downloaded. | `maskAadhaar`, `maskDeep` in `src/core/mask.ts`; `src/services/api.ts` (`audit`), `src/core/fileValidation.ts` |
| Secrets in the repo | None. `VITE_FIREBASE_*` and `VITE_RECAPTCHA_SITE_KEY` are public web identifiers kept in `.env` (git-ignored); `.env.example` has no values. The Gemini key is never in the browser. | `.gitignore`, `.env.example`, `src/services/firebase.ts` |
| Abuse of the public Firebase API key and Gemini quota | **App Check with reCAPTCHA Enterprise** protects the quota: it is initialised before AI Logic so every request carries a token, and enforcement in the Firebase console rejects the rest. A client-side limiter allows at most 8 Gemini calls a minute, files are read one at a time with a 4 s gap, and 429s back off 10 s, 20 s, 40 s. Also restrict the API key by referrer and set budget alerts. | `initializeAppCheck` in `src/services/firebase.ts`; `src/services/rateLimiter.ts`; `src/services/readFiles.ts`; `src/services/extraction.ts` |
| Malicious uploads | Type (png / jpg / webp / pdf), size (max 5 MB) and emptiness are checked, then the file's **magic bytes** must match its declared type (a PDF renamed `.png`, or a script renamed `.pdf`, is rejected). Files are never executed, rendered as HTML or written to disk. | `validateFile`, `detectFileKind`, `validateUpload` in `src/core/fileValidation.ts`; `src/hooks/useFlow.ts` (`onFile`) |
| Malformed or hostile form input | Validated with Zod before a check runs: trimmed, length-capped (name 100), letters-only name, real date of birth (1900 to today), fixed category and type lists. Inputs carry `maxLength`. | `src/core/formSchema.ts`; `src/hooks/useFlow.ts` (`run`); `src/screens/Upload.tsx` |
| Gemini returning bad or manipulated output | Output is validated with Zod (unknown values coerced to safe defaults, wrong shapes rejected, lengths capped) and is never retried on schema errors. Rule decisions are made by code, never the model, so a document that tries to inject instructions can at worst change the fields it is read as. | `src/core/extractSchema.ts`; `src/core/engine.ts` |
| XSS | React escapes all rendered text; there is no `dangerouslySetInnerHTML`. The CSP allows no inline scripts and no `eval`; Zod runs in interpreted (jitless) mode so it needs no `unsafe-eval`. External links use `rel="noopener noreferrer"`. | `firebase.json` (CSP), `src/core/zodConfig.ts` |
| Clickjacking, sniffing, downgrade, cross-origin windows | `frame-ancestors 'none'` and `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; `Strict-Transport-Security` (1 year, includeSubDomains); `Cross-Origin-Opener-Policy: same-origin`. | `firebase.json` (headers) |
| Data leaving the site | `connect-src` is limited to the site, `*.googleapis.com` and `www.google.com` (reCAPTCHA); `script-src` adds only `www.google.com` and `www.gstatic.com`; `Referrer-Policy: no-referrer`; camera, microphone and geolocation are denied. | `firebase.json` (CSP, headers) |
| Wrong guidance | Unverified rules are never applied; every rule shows its source; the UI states that approval is decided by MahaDBT and the college. | `src/core/engine.ts` (`verified`), `src/core/schemes/*.json` |
| Crashes exposing internals | A top-level ErrorBoundary shows a friendly fallback with no stack trace. | `src/ErrorBoundary.tsx` |
| Vulnerable dependencies | CI runs lint, typecheck, tests with coverage, the build and an end-to-end test on every push. `npm audit` is not enforced in CI; run it before release. | `.github/workflows/ci.yml` |

## Known gaps

- App Check protects the quota only once the site key is configured and enforcement is switched on in the Firebase console; with no `VITE_RECAPTCHA_SITE_KEY` the app skips it. reCAPTCHA is probabilistic, not a guarantee against abuse.
- Documents are sent to the Gemini API. Check Google's data-use terms for your project's settings and tell users plainly; "nothing is stored" describes FormSure, not Google.
- `style-src` allows `'unsafe-inline'` because Framer Motion sets inline styles.
- Magic bytes confirm a file starts like a PNG, JPEG, WebP or PDF; they do not prove the rest of the file is well-formed or free of malicious content inside that format.
- The client-side limiter and the form validation run in the user's browser, so a determined user can bypass them; server-side limits come from App Check and Firebase AI Logic quotas.
- Only fictional sample data is in this repository.

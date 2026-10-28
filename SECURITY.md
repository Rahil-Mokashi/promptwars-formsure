# Security

## What is protected

Applicants' identity documents (Aadhaar, caste and income certificates, marksheets, passbooks) and the data read from them.

## Architecture in one line

A static site on Firebase Hosting (Spark plan). All logic runs in the user's browser; the only network call is to Gemini through Firebase AI Logic, and only when the user uploads a file for live reading. There is no server, database or storage. The sample flow makes no network request.

## Threat model

| Threat | Mitigation |
|--------|------------|
| Documents leaking from storage | Nothing is stored anywhere. Files are read in memory, sent once to Gemini via Firebase, and dropped when the page closes. No analytics, no logging of document content (the ErrorBoundary logs only an error message). |
| Aadhaar number exposure | Any 12-digit number in model output or in the report is rewritten to `XXXX XXXX 1234` before it reaches the screen, the printable checklist or the text download. Covered by unit tests. |
| Secrets in the repo | There are none. `VITE_FIREBASE_*` values are public web identifiers and live in `.env`, which is git-ignored (`.env.example` has no values). The Gemini key is never in the browser; Firebase AI Logic holds it. |
| Abuse of the public Firebase API key | The web API key is public by design. **App Check with reCAPTCHA Enterprise protects the Gemini quota:** the app initialises App Check before Firebase AI Logic, so every request carries a token, and enforcement in the Firebase console rejects requests without a valid one. Restrict the API key by HTTP referrer and API, and set budget alerts and quotas as defence in depth. In dev a debug token is used (`FIREBASE_APPCHECK_DEBUG_TOKEN`); register it in the console and never ship it. |
| Malicious uploads | Type (png / jpg / webp / pdf), size (max 5 MB) and emptiness are checked in the browser before anything is sent. Files are never executed, rendered as HTML, or written to disk. Only the declared MIME type is checked (no magic-byte sniffing). |
| Gemini returning bad or manipulated output | Output is validated with Zod (unknown values coerced to safe defaults, bad shapes rejected); invalid output is retried once, then a friendly error is shown. Rule decisions are made by code, not the model. A document that tries to inject instructions can at worst change the fields it is read as, not the rules or the verdict logic. |
| XSS | React escapes all rendered text; no `dangerouslySetInnerHTML`. Hosting sends `script-src 'self'` plus Google's reCAPTCHA hosts (no inline scripts, no `eval`), so injected inline script would not run. External links use `rel="noopener noreferrer"`. |
| Clickjacking and content sniffing | `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`. |
| Data leaving the site | `connect-src` is limited to the site, `*.googleapis.com` and `www.google.com` (reCAPTCHA); `script-src` adds only `www.google.com` and `www.gstatic.com`; `frame-src` only Google reCAPTCHA; `Referrer-Policy: no-referrer`; camera, microphone and geolocation are denied by `Permissions-Policy`. |
| Wrong guidance | Unverified rules are never applied; every rule shows its source; the UI states that approval is decided by MahaDBT and the college. |
| Crashes exposing internals | A top-level ErrorBoundary shows a friendly fallback with no stack trace. |
| Vulnerable dependencies | CI runs lint, typecheck, tests with coverage and the build on every push. `npm audit` is not enforced in CI; run it before release. |

## Known gaps

- App Check only protects the quota once the site key is configured and enforcement is switched on in the Firebase console; with no `VITE_RECAPTCHA_SITE_KEY` the app skips App Check. reCAPTCHA scores are probabilistic, not a guarantee against abuse.
- Documents are sent to the Gemini API. Check Google's data-use terms for your project's settings and tell users plainly; the UI says nothing is *stored*, which describes FormSure, not Google.
- `style-src` allows `'unsafe-inline'` because Framer Motion sets inline styles.
- No magic-byte sniffing of uploads.
- Only fictional sample data is in this repository.

## Reporting

Open a private security advisory on the GitHub repository.

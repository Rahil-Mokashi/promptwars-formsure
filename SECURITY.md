# Security

## What is protected

Applicants' identity documents (Aadhaar, caste and income certificates, marksheets, passbooks) and the data read from them.

## Architecture in one line

A static site on Firebase Hosting. All logic runs in the user's browser; the only network call is to Gemini through Firebase AI Logic. There is no server, database or storage.

## Threat model

| Threat | Mitigation |
|--------|------------|
| Documents leaking from storage | Nothing is stored anywhere. Files are read in memory, sent once to Gemini via Firebase, and dropped when the page closes. No analytics, no logging of content. |
| Aadhaar number exposure | Any 12-digit number in model output or in the report is rewritten to `XXXX XXXX 1234` before it reaches the screen or the downloadable checklist. |
| Secrets in the repo | There are none. `VITE_FIREBASE_*` values are public web identifiers and live in `.env`, which is git-ignored; `.env.example` has no values. The Gemini key is never in the browser: Firebase AI Logic holds it. |
| Malicious uploads | Type (png/jpg/webp/pdf), size (max 5 MB) and emptiness are checked in the browser before anything is sent. Files are never executed, rendered as HTML, or written to disk. |
| Gemini returning bad or manipulated output | Output is validated with Zod; invalid output is retried once, then a friendly error is shown. Rule decisions are made by code, not the model ("Gemini reads, code decides"). A document that tries to inject instructions can at worst change the fields it is read as. |
| Quota abuse | **App Check is not enabled yet.** In production it should be enabled so only this site can call Gemini through the project. Until then, anyone with the URL can use the project's quota; set budget alerts and Firebase AI Logic rate limits. |
| Browser attacks | Hosting sends a strict CSP (`script-src 'self'`, fonts only from Google Fonts, `connect-src` limited to `*.googleapis.com`), `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`. React escapes all rendered text. External links use `rel="noopener noreferrer"`. |
| Wrong guidance | Unverified rules are never applied; every rule shows its source; the UI states that approval is decided by MahaDBT and the college. |

## Known gaps

- App Check not enabled (see above).
- Documents are sent to the Gemini API; check Google's data-use terms for your project's settings and tell users.
- Only the declared MIME type is checked; there is no magic-byte sniffing.
- Only fictional sample data is in this repository.

## Reporting

Open a private security advisory on the GitHub repository.

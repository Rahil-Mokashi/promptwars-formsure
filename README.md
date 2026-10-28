# FormSure

**Check your MahaDBT scholarship application before you submit: Gemini reads your documents, plain rules decide, and you see exactly what to fix, in English, Marathi or Hindi.**

**Live:** https://formsure-de6fa.web.app  (Firebase Hosting, free Spark plan)  ·  Hackathon track: Education & Student Life

> **Gemini reads, code decides.** The AI only turns a scan into structured JSON. Every pass/fail verdict comes from a deterministic rules engine that runs in your browser against a versioned *scheme pack*, so each verdict is explainable and links to its source.

## Screenshots

Sample applicant "Aarav Sunil Patil" (fictional). All screenshots are from the built app.

| Landing | Scheme picker | Upload |
|---|---|---|
| ![Landing](docs/screenshots/01-landing.png) | ![Scheme picker](docs/screenshots/02-scheme.png) | ![Upload](docs/screenshots/03-upload.png) |

| Live audit | Readiness report (57 %) | Ready (100 %) |
|---|---|---|
| ![Live audit](docs/screenshots/04-audit.png) | ![Report](docs/screenshots/05-report.png) | ![Ready](docs/screenshots/06-ready.png) |

| Printable checklist | Phone: landing | Phone: scheme picker |
|---|---|---|
| ![Checklist](docs/screenshots/07-checklist.png) | ![Phone landing](docs/screenshots/m1-landing.png) | ![Phone scheme](docs/screenshots/m2-scheme.png) |

## The problem

A MahaDBT application can be sent back for a mistake that is easy to prevent but hard to see: an income certificate from the previous financial year, a non-creamy-layer certificate missing from the income PDF, or a name spelt *Arav* on one document and *Aarav* on another. The student usually learns this only after submission, with a generic rejection, and has to wait for the next window.

The rules FormSure checks come from public guides and a college notice, not from an official machine-readable spec:

- Required documents for the Maharashtra Post-Matric OBC scheme: [IndiaScholarships guide](https://www.indiascholarships.in/hi/scholarships/maharashtra-postmatric-obc)
- Income certificate must belong to the current financial year: [MahaDBT 2.0 guide](https://anantamias.com/mahadbt/)
- OBC / SBC / VJNT applicants upload income + non-creamy-layer together: [college scholarship notice (Vaze College, 2025-26)](https://vazecollege.net/wp-content/uploads/2026/02/Notice-for-Reserve-Caste-Cetogary-Students-SFC-for-2025-26.pdf)
- Names and details must match across documents: [CareerIndia, MahaDBT verification steps](https://www.careerindia.com/news/mahadbt-1-0-portal-closing-today-urgent-scholarship-verification-steps-2026-011-65787.html)

See [Honest limitations](#honest-limitations): these have not yet been checked against the official scheme document.

## Who it is for

- **Applicants**, first-generation students above all, who apply on a phone and read Marathi or Hindi more comfortably than English.
- **College scholarship desk staff** who help many students and can use the printable checklist to see what is ready.

## How it works

```mermaid
flowchart LR
  A[Student picks scheme<br/>and enters form details] --> B[Uploads 1 file per slot]
  B --> C{Browser checks<br/>type and size<br/>png / jpg / webp / pdf, 5 MB}
  C -- invalid --> B
  C -- ok --> D[Firebase AI Logic<br/>to Gemini, JSON schema]
  D --> E{Zod validates<br/>the JSON}
  E -- bad, first time --> D
  E -- bad, second time --> F[Friendly error]
  E -- ok --> G[Mask 12-digit numbers]
  G --> H[Rules engine<br/>8 rules, in the browser]
  H --> I[Report: readiness %,<br/>evidence, why, fix in EN/MR/HI, source link]
  I -- fixed documents --> B
```

1. Pick the scheme and enter the details exactly as on MahaDBT.
2. Upload one file per slot (7 slots). Each file is checked in the browser, then sent only to Gemini through Firebase AI Logic with a response schema.
3. The answer is validated with Zod and retried once on bad JSON or a timeout; after that a friendly error is shown.
4. The rules engine runs over the extracted JSON. `readiness = passed ÷ applied checks × 100`; skipped rules are not counted.
5. The report shows each issue with the evidence found, why it matters, the fix in the chosen language, a mini preview of the document with the problem field highlighted, and a link to the source of the rule.

**Try sample applicant** runs the same engine on fictional data with no network and no Firebase config: **57 %** with 3 issues, then **100 %** after "I've fixed these, re-check".

## The 8 rules

| # | Rule | Checked by | Source | Verified |
|---|------|------------|--------|----------|
| 1 | Required documents present | Code | [IndiaScholarships guide](https://www.indiascholarships.in/hi/scholarships/maharashtra-postmatric-obc) | Yes |
| 2 | Right document in each slot | AI reads, code decides | [IndiaScholarships guide](https://www.indiascholarships.in/hi/scholarships/maharashtra-postmatric-obc) | Yes |
| 3 | Income certificate issued in the current Indian financial year (1 Apr – 31 Mar, IST) | Code | [MahaDBT 2.0 guide](https://anantamias.com/mahadbt/) | Yes |
| 4 | OBC / SBC / VJNT: income slot holds income certificate **and** non-creamy layer | AI reads, code decides | [College notice](https://vazecollege.net/wp-content/uploads/2026/02/Notice-for-Reserve-Caste-Cetogary-Students-SFC-for-2025-26.pdf) | Yes |
| 5 | Name matches the form across Aadhaar, income certificate, marksheet | AI reads, code decides | [CareerIndia](https://www.careerindia.com/news/mahadbt-1-0-portal-closing-today-urgent-scholarship-verification-steps-2026-011-65787.html) | Yes |
| 6 | Date of birth matches Aadhaar | Code | [CareerIndia](https://www.careerindia.com/news/mahadbt-1-0-portal-closing-today-urgent-scholarship-verification-steps-2026-011-65787.html) | Yes |
| 7 | Category matches caste certificate | Code | [IndiaScholarships guide](https://www.indiascholarships.in/hi/scholarships/maharashtra-postmatric-obc) | Yes |
| 8 | Family income within limit | Code | [MahaDBT 2.0 guide](https://anantamias.com/mahadbt/) | **No: skipped** (sources conflict) |

"AI reads, code decides" means Gemini supplies the extracted field (document types, transliterated name); the verdict is still computed by code.

**Name matching (rule 5).** English documents must match the form exactly after normalising case and spaces. Marathi and Hindi documents compare a phonetic key (`aa→a`, `ee→i`, `oo→u`, `w→v`) of Gemini's English transliteration. So *आरव → Aarav* passes against *Aarav* on the Marathi income certificate, while an English marksheet that says *Arav* fails.

## Architecture

A static site. No server, no Cloud Functions, no database. Firebase Spark (free) plan.

```mermaid
flowchart TB
  subgraph Browser
    UI[React + Framer Motion<br/>6 screens]
    CORE[src/core<br/>Zod pack schema, rules engine,<br/>sample fixtures, extraction + masking]
    UI --> CORE
  end
  HOST[Firebase Hosting<br/>static build + CSP headers] --> Browser
  FONTS[Google Fonts] --> Browser
  CORE -- "only on live upload,<br/>lazy-loaded SDK" --> AIL[Firebase AI Logic]
  AIL --> GEM[Gemini API]
  UI -. "Add deadline" link .-> CAL[Google Calendar]
```

```
src/core/           runs in the browser
  schema.ts           Zod schema + validated scheme pack
  schemes/*.json      the scheme pack (rules)
  engine.ts           runAudit(pack, form, documents, now)
  sample.ts           fictional fixtures (error + fixed)
  extract.ts          Zod validation of Gemini output, retry once, file checks, 12-digit masking
  live.ts             Gemini via Firebase AI Logic (lazy-loaded)
  types.ts            shared types
src/screens/        Landing, Scheme, Upload, Audit, Report, Ready (+ Modal, Ring, Confetti)
src/                App, glue (api.ts), ErrorBoundary, Framer Motion helpers, styles.css
public/             favicon, apple-touch icon, web manifest
firebase.json       Hosting: public = dist, SPA rewrite, security headers
```

## Why AI is essential

- **Reading scans.** Applicants upload phone photos and PDFs of Marathi, Hindi and English documents. Classical OCR plus hand-written parsers would need one template per issuing authority. Gemini reads the page, recognises which document(s) a PDF contains (an income certificate *and* a non-creamy-layer certificate in one file), and returns typed fields.
- **Marathi → English name matching.** The same person is written *आरव सुनील पाटील* on a Tehsildar's certificate and *Aarav Sunil Patil* on the form. Comparing the English transliteration with a phonetic key lets the engine pass legitimate spelling variants of a Devanagari name and still catch a real mismatch.
- **Why not let the AI judge?** A model that decides "ready or not" cannot cite a source or be audited. Here the model never decides; code does, and each rule is tested.

## Scheme packs

A pack is one JSON file (`src/core/schemes/mahadbt-postmatric-obc.json`) validated with Zod when the app starts. It has `slots` (the documents, with names in en / mr / hi and the document types each slot accepts) and `rules`. Every rule has an `id`, a `type`, a `label`, a `severity`, `why` and `fix` text in three languages, a `source` (label, URL, kind), `verified`, and `usesAi`.

Supported rule types: `required_document`, `document_check`, `date_window`, `conditional`, `cross_document_match`, `field_consistency`, `numeric_max`.

To add a scheme:

1. Copy the JSON file and edit `slots` and `rules`. Reuse existing rule types; a new kind of check means one new `case` in `src/core/engine.ts` plus a Zod schema entry in `src/core/schema.ts`.
2. Put the official source for every rule in `source`. Leave `verified: false` until a person has compared the rule with that source. Unverified rules are skipped, never applied.
3. Add tests for the new rules (see `src/core/engine.test.ts`).
4. Register the pack in `src/core/schema.ts`.

**Honest status:** the engine and schema are pack-driven, but the UI currently loads the single MahaDBT pack. The "Add a new scheme" card opens a dialog that lists the live pack's rules (rule, AI or code, source, verified) so you can see how packs work; multi-pack selection is future work.

## Google services used

- **Gemini via Firebase AI Logic** (Gemini Developer API backend): document reading with structured JSON output
- **Firebase Hosting**: serves the static build with security headers
- **Google Fonts**: Plus Jakarta Sans, Noto Sans Devanagari, JetBrains Mono
- **Google Calendar**: "Add deadline to Google Calendar" link on the Ready screen

## Security and privacy

Details in [SECURITY.md](SECURITY.md).

- **No storage.** There is no backend and no database. Files are read in memory, sent once to Gemini through Firebase AI Logic, and dropped when the page closes.
- **Aadhaar masking.** Any 12-digit number in model output or in the report is rewritten to `XXXX XXXX 1234` before it is displayed or printed.
- **File validation** in the browser: png / jpg / webp / pdf only, 1 byte to 5 MB, before anything is sent.
- **Zod on AI output.** Invalid output is retried once, then rejected with a friendly message.
- **CSP and headers** from Firebase Hosting: `script-src 'self'`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`; connections limited to `*.googleapis.com`.
- **No secrets in the repo.** `.env` is git-ignored; `VITE_FIREBASE_*` are public web identifiers.
- Only **fictional** sample data is included.

## Accessibility

Target: **WCAG 2.1 AA**.

- Real buttons, labels and landmarks; keyboard-operable file inputs; focus returns to the opener when a dialog closes; Escape closes dialogs.
- `aria-live` regions for audit progress, a `progressbar` role, severity shown as icon + word + colour.
- **axe tests** (`vitest-axe`) run on every screen and both dialogs with no violations.
- **Contrast** (computed from the palette): body text 9.3:1 to 17:1, muted text on white 5.9:1, status colours on their tints 4.84:1 to 7.3:1, white on indigo 7.9:1. The lowest pair is green on its tint at 4.84:1. jsdom cannot measure contrast, so this was computed separately and is not part of the automated suite.
- **Reduced motion.** `useReducedMotion` turns off every Framer Motion animation and the CSS transitions: results appear immediately, no confetti, no ambient drift.
- **Three languages.** EN / मराठी / हिंदी toggle changes fixes, "why it matters" and document names, and sets `<html lang>`; Marathi and Hindi fragments carry their own `lang`.
- Works at phone width: one compact header row, step numbers only below 640 px; verified with no horizontal overflow at 390 px.

Not done: a full screen-reader pass with NVDA / VoiceOver. axe catches structural problems, not whether the experience is good.

## Testing

`npm test` runs **72 tests in 12 files** (Vitest, jsdom, Testing Library, vitest-axe). `npm run test:coverage` adds coverage with a threshold on `src/core`.

| Coverage | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/core` (rules engine, extraction, masking, Firebase wrapper) | 98.7 % | 93.1 % | 96.6 % | 100 % |
| Whole `src` | 88.8 % | 75.4 % | 84.0 % | 91.2 % |

What is covered:

- Every rule type; Indian financial-year edges (31 March vs 1 April, and the IST boundary at 20:00 UTC); unverified rule skipped; missing or unreadable data skipped, not guessed.
- Error fixture = exactly **3 failures, readiness 57**; fixed fixture = **100**.
- File validation, Aadhaar masking, Gemini retry-then-success and retry-then-failure (Firebase AI **mocked**), live reading unavailable without Firebase config, and the Firebase wrapper's request shape (JSON mime type, response schema, model from env).
- UI: 3 issues rendered for the sample, language toggle and `html lang`, upload validation messages, keyboard navigation, dialogs, mini document preview, printable checklist, reduced-motion path, ErrorBoundary.
- Accessibility: axe on every screen.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, `test:coverage` and build on every push.

```bash
npm test                # all tests
npm run test:coverage   # with coverage report
npm run lint            # ESLint, zero warnings (includes jsx-a11y)
npm run typecheck
```

## Performance

Vendor code is split so no chunk exceeds 500 KB (largest: 211 KB). The Firebase SDK is loaded only when someone uploads a file for live reading, so the sample flow never downloads it.

| Chunk | Raw | Gzip | Loaded |
|---|---|---|---|
| `react` | 210.5 KB | 65.7 KB | on start |
| `framer-motion` | 161.3 KB | 54.2 KB | on start |
| app (`index`) | 157.1 KB | 46.0 KB | on start |
| `firebase` (app + AI Logic) | 80.9 KB | 24.3 KB | lazy, live upload only |
| CSS | 17.9 KB | 4.5 KB | on start |

Initial JavaScript is about 529 KB raw / 166 KB gzip. I have not run Lighthouse or measured real-device load times.

## Run and deploy

Requires Node 22.

```bash
npm install
cp .env.example .env         # optional: Firebase web config for live reading; the sample works without it
npm run dev                  # Vite dev server on http://localhost:5173
npm run build && npm start   # production build preview
```

Live reading needs a Firebase project with **Firebase AI Logic** enabled (Gemini Developer API provider) and a registered web app. Copy its config into `.env` **before building**, because `VITE_*` values are compiled into the bundle:

```
VITE_FIREBASE_API_KEY=  VITE_FIREBASE_AUTH_DOMAIN=  VITE_FIREBASE_PROJECT_ID=  VITE_FIREBASE_APP_ID=
VITE_GEMINI_MODEL=gemini-3.8-flash
```

If the config is missing, live upload shows "Live reading unavailable, try the sample applicant" and the sample flow still works.

Deploy to Firebase Hosting (project `formsure-de6fa`, set in `.firebaserc`):

```bash
npx firebase-tools login
npx firebase-tools deploy --only hosting     # predeploy runs npm run build
```

The build tooling in this repository never deployed the site; the live link above works once you deploy.

## AI tools used and how I prompted

- **Claude Code (Claude Sonnet 5.5)** wrote most of this codebase, tests and docs.
- **Gemini** (through Firebase AI Logic) is used at runtime for document reading only.

How the work was directed:

1. **A fixed design as the contract.** A clickable prototype (`design/formsure-design.html`) was the visual and behavioural reference: port its CSS, copy and six screens exactly, replace the hard-coded data with real calls.
2. **Principle first.** "Gemini reads, code decides" was stated up front and shaped the architecture: a rules engine with sources, a `verified` flag, and AI output that is only ever data.
3. **Explicit fixtures and numbers.** The brief fixed the sample applicant, the three failures, 57 % and 100 %, and the rule order, so tests could pin them.
4. **Tests as gates.** Each part was committed only after lint, typecheck, tests and build passed.
5. **Changing constraints.** The deployment target changed twice during the build (Cloud Run, then Cloud Functions, then a static site); the architecture was reworked each time, which is why the engine moved into `src/core`.

The prompt text is not reproduced here. Review the code, not the prompt: everything above is checked by tests.

## Honest limitations

- **Rules are not verified against the official scheme document.** They come from college notices and community guides, and each links to its source so a person can verify it.
- **The income-limit rule is skipped** as unverified because sources conflict. Its limit in the pack is a placeholder that is never applied.
- **The live Gemini path has only been tested with mocks.** No Firebase project or key was used by the automated tests. Check the model name (`gemini-3.8-flash`) and the response schema against your own project before relying on it.
- **App Check is not enabled yet; in production it would protect the Gemini quota.** Until then, anyone with the site URL can spend the project's Gemini quota. Restrict the Firebase API key by HTTP referrer and set budget alerts.
- Extraction quality depends on scan quality, and transliteration-based name matching is a heuristic: it can pass a near-miss or flag a valid variant.
- Documents are sent to Google's Gemini API for reading. "Nothing is stored" describes FormSure, not Google's own data handling for your project.
- The UI loads one scheme pack; the other scheme cards are "coming soon".
- **FormSure flags likely problems. It does not guarantee approval.** The decision rests with MahaDBT and the college.
- Accessibility was checked with axe and a computed contrast table, not with real assistive-technology users.

## Future work

- **More scheme packs** (VJNT, Freeship, other states), with a pack selector and an AI-assisted pack builder where a person verifies every drafted rule against the official source.
- **Verify the rules** against the official scheme documents and resolve the income-limit conflict, then enable rule 8.
- **App Check** (reCAPTCHA) on Firebase AI Logic, plus per-user rate limits.
- **College desk dashboard** to review many students' checklists (with explicit consent and a real privacy design).
- Screen-reader testing, offline support for the sample, and more languages.

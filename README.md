# FormSure

An AI pre-submission checker for **MahaDBT (Maharashtra) scholarship applications**. Hackathon track: Education & Student Life.

> **Gemini reads, code decides.** Gemini turns each uploaded document into structured JSON. A deterministic rules engine then checks that JSON against a *scheme pack* (JSON rules). Every issue in the report shows the evidence, why it matters, the fix in English / मराठी / हिंदी, and a link to the source of the rule.

## Problem

Students lose weeks when a MahaDBT application is sent back for avoidable mistakes: an income certificate from the previous financial year, a missing non-creamy-layer page, a name spelt two ways. Rejections are only discovered after submission, and the reasons are rarely explained in the student's language.

## Users

First-generation scholarship applicants (OBC / SBC / VJNT first), and the college scholarship desk staff who help them. The UI works at phone width and offers fixes in Marathi and Hindi.

## How it works

1. Pick the scheme (the first pack is *Post-Matric Scholarship for OBC students*) and enter the details used on MahaDBT.
2. Upload one file per slot (7 slots). Each file is checked in the browser (png/jpg/webp/pdf, max 5 MB) and sent **only to Gemini via Firebase AI Logic**, with a response schema. The answer is validated with Zod and retried once on bad JSON or timeout; after that a friendly error is shown.
3. The rules engine runs the 8 rules over the extracted JSON, in the browser: `readiness = passed / applied checks × 100`.
4. The report lists each failing rule with evidence, why, the fix in the chosen language, and the source link.

"Try sample applicant" uses fictional data and the same real rules engine, with no network and no Firebase config: 57 % with 3 issues, then 100 % after the fix.

### The 8 rules

| # | Rule | Type | Uses AI | Verified |
|---|------|------|---------|----------|
| 1 | Required documents present | `required_document` | no | yes |
| 2 | Right document in each slot | `document_check` | yes | yes |
| 3 | Income certificate issued in the current Indian financial year (1 Apr – 31 Mar, IST) | `date_window` | no | yes |
| 4 | OBC/SBC/VJNT: income slot has income certificate **and** non-creamy layer | `conditional` | yes | yes |
| 5 | Name matches the form across Aadhaar, income certificate, marksheet | `cross_document_match` | yes | yes |
| 6 | Date of birth matches Aadhaar | `field_consistency` | no | yes |
| 7 | Category matches caste certificate | `field_consistency` | no | yes |
| 8 | Family income within limit | `numeric_max` | no | **no, skipped** |

Name matching: English-language documents must match exactly after normalising case and spaces. Marathi/Hindi documents compare a phonetic key (`aa→a, ee→i, oo→u, w→v`) of Gemini's English transliteration, so *आरव → Aarav* matches *Arav* only on the Marathi document, while an English marksheet saying *Arav* fails.

Rules live in `src/core/schemes/mahadbt-postmatric-obc.json`, are validated with Zod at start-up, and **unverified rules are skipped, never applied**.

## Architecture

A static site: no server, no Cloud Functions, no Docker. Firebase Spark (free) plan.

```
src/core/           runs in the browser
  schema.ts           Zod schema + validated scheme pack
  schemes/*.json      the scheme pack (rules)
  engine.ts           runAudit(pack, form, documents, now)
  sample.ts           fictional fixtures (error + fixed)
  extract.ts          Zod validation of Gemini output, retry-once, file checks, 12-digit masking
  live.ts             Gemini via Firebase AI Logic (lazy-loaded)
  types.ts            shared types
src/screens/        the six screens ported from design/formsure-design.html
src/                App, glue (api.ts), Framer Motion helpers, styles.css
firebase.json       Hosting: public = dist, SPA rewrite, security headers (CSP)
```

Live reading: `getAI(app, { backend: new GoogleAIBackend() })` and `getGenerativeModel` with `responseMimeType: "application/json"` and a `Schema.object(...)` response schema. Model from `VITE_GEMINI_MODEL` (default `gemini-3.8-flash`). Firebase config comes from `VITE_FIREBASE_*` variables. If they are missing, live upload shows "Live reading unavailable, try the sample applicant" and the sample flow still works fully.

Animation: Framer Motion (page transitions with `AnimatePresence`, staggered lists, checks revealed one by one every 650 ms, ring count-up, layout-animated issue cards, confetti). `useReducedMotion` turns all of it off: results appear immediately, no confetti.

## Google services

- **Gemini via Firebase AI Logic** (Gemini Developer API backend), structured JSON output
- **Firebase Hosting**, serves the static build
- **Google Fonts**, Plus Jakarta Sans, Noto Sans Devanagari, JetBrains Mono
- **Google Calendar link**, "Add deadline to Google Calendar" on the Ready screen

## Security

See [SECURITY.md](SECURITY.md). In short: uploaded files are validated in the browser and sent only to Gemini via Firebase; they are never stored; any 12-digit number is masked to `XXXX XXXX 1234` before display; there is no server and no secret in the repo (`.env` is git-ignored; Firebase web config values are public identifiers); strict CSP and other headers on Hosting. Only fictional sample data is included.

## Tests

`npm test` runs Vitest (jsdom):

- every rule type, financial-year edges (31 March vs 1 April, IST boundary), unverified rule skipped
- error fixture = exactly 3 failures and readiness 57; fixed fixture = 100; audit of the sample
- file validation (type, 5 MB), Aadhaar masking, Gemini retry-then-failure (Firebase AI mocked), live reading unavailable without Firebase config
- UI renders 3 issues for the sample, language toggle and `html lang`, live upload with mocked Firebase AI, reduced-motion path (no delays, no confetti, final numbers immediately)

Also: `npm run lint` (ESLint, zero warnings, includes jsx-a11y) and `npm run typecheck`.

## Accessibility

Real buttons and labels, keyboard-operable file inputs (visually hidden, focus ring on the label), `aria-live` regions for progress and checks, a `progressbar` role, visible focus outlines, severity shown as icon + word + colour, `lang` follows the language toggle (also set on Marathi/Hindi fragments), text colours chosen for ≥ 4.5:1 contrast, layout works at phone width. With `prefers-reduced-motion` every Framer Motion animation and CSS transition is off.

## Run

Requires Node 22.

```bash
npm install
cp .env.example .env         # optional: Firebase web config for live reading; the sample works without it
npm run dev                  # Vite dev server
npm run build && npm start   # production build preview
```

Live reading needs a Firebase project with **Firebase AI Logic** enabled (Gemini Developer API provider) and a registered web app; copy its config into `.env` before building, because `VITE_*` values are compiled into the bundle.

## Deploy (Firebase Hosting, Spark plan)

Not deployed by this repo's tooling. To deploy yourself:

```bash
npx firebase-tools login
# .firebaserc uses the project id "formsure-de6fa"; change it if you use another project
npx firebase-tools deploy --only hosting     # predeploy runs npm run build
```

## Decisions made without asking

- Everything runs in the browser (`src/core`); there is no API layer, so the audit and the sample are plain function calls.
- "Try sample applicant" loads the sample and follows the design's flow (scheme → upload → check); the audit runs when "Run FormSure check" is pressed.
- Sample fixture dates are generated from the current Indian financial year so the sample keeps its meaning over time. Tests pin the clock to 2026-10-28.
- Rule 8 carries a placeholder limit (₹8,00,000). It is never applied while `verified: false`.
- In upload mode, "I've fixed these, re-check" returns to the upload screen (re-reading needs new files); in sample mode it audits the fixed sample.
- "Download checklist for college desk" builds a plain-text file in the browser.
- Rules have two extra copy fields (`issueTitle`, `issueDoc`) to reproduce the design's issue headings.
- The design's CSS had `font: 700 15px/1 inherit`, which is invalid CSS; the intent (inherit the font family) is what was ported.

## AI tools used

Claude Code (Claude Sonnet 5.5) wrote most of this codebase from the design prototype and brief. Gemini is used at runtime for document reading only.

## Honest limitations

- Rules come from college notices and community guides, **not yet checked against the official scheme document**. Each rule links to its source so a human can verify it.
- The family-income-limit rule is **skipped as unverified** because sources conflict.
- Extraction quality depends on scan quality and on Gemini; name matching on transliterations is heuristic.
- The live Gemini path has been tested only with mocks (no Firebase project or key was used during the build); check the response schema and model name against your project before demo day.
- **App Check not enabled yet; in production it would protect the Gemini quota.** Until then, anyone with the site URL can use the Firebase project's Gemini quota.
- FormSure flags likely problems. **It does not guarantee approval**; the decision rests with MahaDBT and your college.

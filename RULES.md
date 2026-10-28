# Rules register

Generated from `src/core/schemes/mahadbt-postmatric-obc.2025-26.json` (pack version 2.0.0). Do not edit by hand: run `npm run rules:register`. A test fails if this file is out of date.

## How rules are trusted

- **Source kinds:** `official` (a government page), `college-notice` (a notice published by a college) and `secondary` (guides and news).
- **Status:** `verified` (backed by an official source or a college notice), `pending` (secondary sources only) and `conflicting` (sources disagree).
- **Only rules that are `verified` with at least one `official` or `college-notice` source are applied.** `pending` and `conflicting` rules are reported as *not evaluated*, never as a pass or a fail.
- **Evidence year:** the quotes below come from notices for academic year 2025-26. Whether the same rule holds for another year is not verified.
- Quotes are verbatim from the sources, read on the "last checked" date. The college-notice PDFs were read as text with `pdftotext`; the official page and the guides were read through a web fetch tool, so re-check a quote against the live page before relying on it.

## Summary

| Rule id | Description | Applied | Status | Source (kind) | Evidence year | Version | Last checked | Tests |
|---|---|---|---|---|---|---|---|---|
| `required-documents` | Every required slot holds a file. | no | conflicting | [MahaDBT scheme page: Post Matric Scholarship to OBC Students](https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData?str=E9DDFA703C38E51AB02E984835E89FEFDB316E301CE6A991F41C5D42B01A7D7E) (official) | 2025-26 | 2.0.0 | 2026-10-28 | `core/engine.test.ts` “names every missing document” |
| `right-document` | Each file is legible and is the kind of document its slot accepts. | yes | verified | [KET’s V. G. Vaze College notice VC/2025-26/SFC/532, 11/02/2026](https://vazecollege.net/wp-content/uploads/2026/02/Notice-for-Reserve-Caste-Cetogary-Students-SFC-for-2025-26.pdf) (college-notice) | 2025-26 | 2.0.0 | 2026-10-28 | `core/engine.test.ts` “fails on the wrong kind of document in a slot”<br>`core/engine.test.ts` “needs review when nothing could be recognised in a file” |
| `income-financial-year` | The income certificate was issued in the current Indian financial year (1 April to 31 March, IST). | no | conflicting | [College notice: MahaDBT Scholarship Application Process for 2025-26 (tirpude.edu.in)](https://www.tirpude.edu.in/wp-content/uploads/2025/10/Notice-of-Scholarship-2025.pdf) (college-notice) | 2025-26 | 2.0.0 | 2026-10-28 | `core/engine.test.ts` “certificate issued 31 March fails on 1 April, passes on 31 March”<br>`core/engine.test.ts` “uses India time: 20:00 UTC on 31 March is already 1 April in IST” |
| `income-ncl` | For OBC, SBC and VJNT applicants the income certificate slot holds the income certificate and the non-creamy-layer certificate in one PDF. | yes | verified | [KET’s V. G. Vaze College notice VC/2025-26/SFC/532, 11/02/2026](https://vazecollege.net/wp-content/uploads/2026/02/Notice-for-Reserve-Caste-Cetogary-Students-SFC-for-2025-26.pdf) (college-notice) | 2025-26 | 2.0.0 | 2026-10-28 | `core/engine.test.ts` “is not evaluated for a category outside OBC / SBC / VJNT”<br>`core/engine.test.ts` “says there is no matching certificate when nothing was recognised in the file” |
| `name-match` | The applicant name matches the form on all seven documents (English exactly after normalisation, Devanagari through a phonetic key; order swaps and initials need review). | no | pending | [MahaDBT 2.0 guide (anantamias.com)](https://anantamias.com/mahadbt/) (secondary) | 2025-26 | 2.0.0 | 2026-10-28 | `core/nameMatch.test.ts` “an unreadable name on ANY of the seven documents needs review”<br>`core/nameMatch.test.ts` “a Devanagari document passes on the phonetic key of its transliteration” |
| `dob-match` | The date of birth on the form matches the Aadhaar. | no | pending | [CareerIndia: MahaDBT verification steps](https://www.careerindia.com/news/mahadbt-1-0-portal-closing-today-urgent-scholarship-verification-steps-2026-011-65787.html) (secondary) | 2025-26 | 2.0.0 | 2026-10-28 | `core/engine.test.ts` “fails on a different date of birth or category” |
| `category-match` | The category on the form matches the caste certificate. | no | pending | [College notice: MahaDBT Scholarship Application Process for 2025-26 (tirpude.edu.in)](https://www.tirpude.edu.in/wp-content/uploads/2025/10/Notice-of-Scholarship-2025.pdf) (college-notice) | 2025-26 | 2.0.0 | 2026-10-28 | `core/engine.test.ts` “fails on a different date of birth or category” |
| `income-limit` | Annual family income is within the scheme limit. | no | conflicting | [MahaDBT scheme page: Post Matric Scholarship to OBC Students](https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData?str=E9DDFA703C38E51AB02E984835E89FEFDB316E301CE6A991F41C5D42B01A7D7E) (official) | 2025-26 | 2.0.0 | 2026-10-28 | `core/engine.test.ts` “passes at the maximum, fails above it, needs review when unreadable”<br>`core/engine.test.ts` “a conflicting rule is not evaluated even when its data would fail it” |

## Evidence

### `required-documents` — Required documents present

Status: **conflicting**. Not evaluated. Last checked 2026-10-28.

- **Official source**, [MahaDBT scheme page: Post Matric Scholarship to OBC Students](https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData?str=E9DDFA703C38E51AB02E984835E89FEFDB316E301CE6A991F41C5D42B01A7D7E): “Caste certificate - should be issued by competent authority(Issued by Govt. of Maharashtra)”
- **Official source**, [MahaDBT scheme page: Post Matric Scholarship to OBC Students](https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData?str=E9DDFA703C38E51AB02E984835E89FEFDB316E301CE6A991F41C5D42B01A7D7E): “Income certificate / Income Declaration - should be issued by competent authority”
- **Official source**, [MahaDBT scheme page: Post Matric Scholarship to OBC Students](https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData?str=E9DDFA703C38E51AB02E984835E89FEFDB316E301CE6A991F41C5D42B01A7D7E): “HSC or SSC marksheet or last examination marksheet.”
- **College notice**, [KET’s V. G. Vaze College notice VC/2025-26/SFC/532, 11/02/2026](https://vazecollege.net/wp-content/uploads/2026/02/Notice-for-Reserve-Caste-Cetogary-Students-SFC-for-2025-26.pdf): “Domicile Certificate (for Applicant)”
- **College notice**, [KET’s V. G. Vaze College notice VC/2025-26/SFC/532, 11/02/2026](https://vazecollege.net/wp-content/uploads/2026/02/Notice-for-Reserve-Caste-Cetogary-Students-SFC-for-2025-26.pdf): “Bank Adhar Seeding Form (available in MahaDBT Portal)”
- **College notice**, [College notice: MahaDBT Scholarship Application Process for 2025-26 (tirpude.edu.in)](https://www.tirpude.edu.in/wp-content/uploads/2025/10/Notice-of-Scholarship-2025.pdf): “College Bonafide Certificate”
- **College notice**, [College notice: Scholarship Notice AY 2025-26 (mitcorer.edu.in)](https://mitcorer.edu.in/pdf/Fy-Pdf/Scholarship-Notice-AY-2025-26.pdf): “Bank Passbook (Adhar Link)”

### `right-document` — Right document in each slot

Status: **verified**. Applied. Last checked 2026-10-28.

- **College notice**, [KET’s V. G. Vaze College notice VC/2025-26/SFC/532, 11/02/2026](https://vazecollege.net/wp-content/uploads/2026/02/Notice-for-Reserve-Caste-Cetogary-Students-SFC-for-2025-26.pdf): “OBC, SBC & VJNT category students should upload the Income Certificate & Non Creamy layer Certificate merge in one PDF format and upload in option of Income certificate.”

### `income-financial-year` — Income certificate from this financial year

Status: **conflicting**. Not evaluated. Last checked 2026-10-28.

- **College notice**, [College notice: Scholarship Notice AY 2025-26 (mitcorer.edu.in)](https://mitcorer.edu.in/pdf/Fy-Pdf/Scholarship-Notice-AY-2025-26.pdf): “Income Certificate (Financial Year 2024-25)”
- **College notice**, [College notice: MahaDBT Scholarship Application Process for 2025-26 (tirpude.edu.in)](https://www.tirpude.edu.in/wp-content/uploads/2025/10/Notice-of-Scholarship-2025.pdf): “Income Certificate for 2025-26 (Parent/Guardian)”
- **Secondary source**, [MahaDBT 2.0 guide (anantamias.com)](https://anantamias.com/mahadbt/): “Income certificate issued in the current financial year; an older one gets the application rejected”

### `income-ncl` — Income + non-creamy layer in one PDF

Status: **verified**. Applied. Last checked 2026-10-28.

- **College notice**, [KET’s V. G. Vaze College notice VC/2025-26/SFC/532, 11/02/2026](https://vazecollege.net/wp-content/uploads/2026/02/Notice-for-Reserve-Caste-Cetogary-Students-SFC-for-2025-26.pdf): “OBC, SBC & VJNT category students should upload the Income Certificate & Non Creamy layer Certificate merge in one PDF format and upload in option of Income certificate.”

### `name-match` — Name matches across documents

Status: **pending**. Not evaluated. Last checked 2026-10-28.

- **Secondary source**, [MahaDBT 2.0 guide (anantamias.com)](https://anantamias.com/mahadbt/): “Your MahaDBT name comes from Aadhaar.”
- **Secondary source**, [MahaDBT 2.0 guide (anantamias.com)](https://anantamias.com/mahadbt/): “Correct Aadhaar, or get the certificate corrected so both match.”
- **Secondary source**, [CareerIndia: MahaDBT verification steps](https://www.careerindia.com/news/mahadbt-1-0-portal-closing-today-urgent-scholarship-verification-steps-2026-011-65787.html): “Re-check name order, date of birth, and category fields.”

### `dob-match` — Date of birth matches Aadhaar

Status: **pending**. Not evaluated. Last checked 2026-10-28.

- **Secondary source**, [CareerIndia: MahaDBT verification steps](https://www.careerindia.com/news/mahadbt-1-0-portal-closing-today-urgent-scholarship-verification-steps-2026-011-65787.html): “Re-check name order, date of birth, and category fields.”

### `category-match` — Category matches caste certificate

Status: **pending**. Not evaluated. Last checked 2026-10-28.

- **College notice**, [College notice: MahaDBT Scholarship Application Process for 2025-26 (tirpude.edu.in)](https://www.tirpude.edu.in/wp-content/uploads/2025/10/Notice-of-Scholarship-2025.pdf): “Category : Must belong to SC, ST, OBC, SBC, VJNT, or SEBC and possess a valid caste certificate.”
- **Secondary source**, [CareerIndia: MahaDBT verification steps](https://www.careerindia.com/news/mahadbt-1-0-portal-closing-today-urgent-scholarship-verification-steps-2026-011-65787.html): “Re-check name order, date of birth, and category fields.”

### `income-limit` — Family income within scheme limit

Status: **conflicting**. Not evaluated. Last checked 2026-10-28.

- **Official source**, [MahaDBT scheme page: Post Matric Scholarship to OBC Students](https://mahadbt.maharashtra.gov.in/SchemeData/SchemeData?str=E9DDFA703C38E51AB02E984835E89FEFDB316E301CE6A991F41C5D42B01A7D7E): “The parents/Guardians annual Income should be less than or equal to Rs.2.50 Lac.”
- **College notice**, [College notice: Scholarship Notice AY 2025-26 (mitcorer.edu.in)](https://mitcorer.edu.in/pdf/Fy-Pdf/Scholarship-Notice-AY-2025-26.pdf): “Up to 1.50 Lakhs Post Matric Scholarship to VINT, OBC & SBC Students”
- **College notice**, [College notice: MahaDBT Scholarship Application Process for 2025-26 (tirpude.edu.in)](https://www.tirpude.edu.in/wp-content/uploads/2025/10/Notice-of-Scholarship-2025.pdf): “OBC, SBC, VJNT & SEBC : 8,00,000 or less.”

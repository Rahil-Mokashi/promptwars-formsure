/** Instruction sent to Gemini with each document. It asks for facts only: the rules engine does the judging. */
export const EXTRACTION_PROMPT = `You are reading one document uploaded for a Maharashtra (MahaDBT) scholarship application.
Only read what is printed; never guess, never judge whether the document is acceptable.
Return JSON with:
- documentTypes: every kind of document contained in the file, each one of: aadhaar, caste_certificate, income_certificate, non_creamy_layer, domicile_certificate, bonafide_certificate, marksheet, bank_passbook, other. A PDF may contain several.
- language: main language of the text: en, mr, hi or other.
- applicantName: the applicant's name exactly as printed (original) and its English transliteration (english, Latin letters, "Firstname Middlename Surname"). null if absent.
- dateOfBirth and issueDate as YYYY-MM-DD (convert from DD/MM/YYYY and from Devanagari digits), null if absent.
- issuingAuthority, category (for example OBC, SBC, VJNT, SC, ST, Open), annualIncome in rupees as a number, null if absent.
- pageCount: number of pages.
- legible: false if the scan is too blurry or cropped to read reliably.`;

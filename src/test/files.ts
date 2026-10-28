/** Test helpers: files with genuine magic bytes, so they pass content validation like real uploads. */

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const PDF_HEADER = [...'%PDF-1.4\n'].map((c) => c.charCodeAt(0));
const WEBP_HEADER = [...'RIFF\0\0\0\0WEBPVP8 '].map((c) => c.charCodeAt(0));

const make = (header: number[], name: string, type: string, extraBytes = 16): File =>
  new File([new Uint8Array([...header, ...new Array<number>(extraBytes).fill(0x20)])], name, { type });

/** A tiny valid-looking PNG. */
export const pngFile = (name = 'a.png'): File => make(PNG_HEADER, name, 'image/png');
/** A tiny valid-looking JPEG. */
export const jpegFile = (name = 'a.jpg'): File => make(JPEG_HEADER, name, 'image/jpeg');
/** A tiny valid-looking WebP. */
export const webpFile = (name = 'a.webp'): File => make(WEBP_HEADER, name, 'image/webp');
/** A tiny valid-looking PDF. */
export const pdfFile = (name = 'a.pdf'): File => make(PDF_HEADER, name, 'application/pdf');
/** A file whose declared type and content disagree: PDF bytes labelled as PNG. */
export const mislabelledFile = (name = 'fake.png'): File => make(PDF_HEADER, name, 'image/png');

/** A well-formed extraction answer for a marksheet, as JSON text. */
export const MARKSHEET_JSON = JSON.stringify({
  documentTypes: ['marksheet'], language: 'en',
  applicantName: { original: 'Aarav Sunil Patil', english: 'Aarav Sunil Patil' },
  dateOfBirth: null, issueDate: '2026-04-02', issuingAuthority: 'Fictional University', category: null,
  annualIncome: null, pageCount: 1, legible: true,
});

/** An error shaped like Firebase AI Logic's 429. */
export const tooManyRequests = (): Error => Object.assign(new Error('[429 Too Many Requests] Resource exhausted'), { status: 429 });

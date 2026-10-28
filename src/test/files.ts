/** Test helpers: files with genuine magic bytes and structure, so they pass content validation like real uploads. */

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_HEADER = [...'RIFF\0\0\0\0WEBPVP8 '].map((c) => c.charCodeAt(0));
const PADDING = 16;

const text = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
const withPadding = (header: number[]): Uint8Array<ArrayBuffer> => new Uint8Array([...header, ...new Array<number>(PADDING).fill(0x20)]);

/** A tiny valid-looking PNG. */
export const pngFile = (name = 'a.png'): File => new File([withPadding(PNG_HEADER)], name, { type: 'image/png' });
/** A tiny valid-looking JPEG. */
export const jpegFile = (name = 'a.jpg'): File => new File([withPadding(JPEG_HEADER)], name, { type: 'image/jpeg' });
/** A tiny valid-looking WebP. */
export const webpFile = (name = 'a.webp'): File => new File([withPadding(WEBP_HEADER)], name, { type: 'image/webp' });

/** The first bytes of an image of the given MIME type, for stubbing canvas output. */
export const imageHeader = (type: string): Uint8Array<ArrayBuffer> =>
  withPadding(type === 'image/jpeg' ? JPEG_HEADER : type === 'image/webp' ? WEBP_HEADER : PNG_HEADER);

/** Raw bytes of a small PDF with `pages` pages, optionally encrypted or cut off before `%%EOF`. */
export function pdfBytes(pages: number, options: { encrypted?: boolean; truncated?: boolean } = {}): Uint8Array<ArrayBuffer> {
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(' ');
  const objects = Array.from({ length: pages }, (_, i) => `${i + 3} 0 obj<</Type/Page/Parent 2 0 R>>endobj\n`).join('');
  const encrypt = options.encrypted ? '/Encrypt 9 0 R' : '';
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[${kids}]/Count ${pages}>>endobj\n${objects}trailer<</Root 1 0 R${encrypt}>>\n`;
  return new Uint8Array(text(options.truncated ? body : `${body}%%EOF\n`));
}

const pdf = (name: string, bytes: Uint8Array<ArrayBuffer>): File => new File([bytes], name, { type: 'application/pdf' });

/** A small valid PDF. */
export const pdfFile = (name = 'a.pdf', pages = 1): File => pdf(name, pdfBytes(pages));
/** A PDF with no end-of-file marker, as if the upload was cut off. */
export const truncatedPdf = (name = 'cut.pdf'): File => pdf(name, pdfBytes(1, { truncated: true }));
/** A password-protected PDF. */
export const encryptedPdf = (name = 'locked.pdf'): File => pdf(name, pdfBytes(1, { encrypted: true }));
/** A file whose declared type and content disagree: PDF bytes labelled as PNG. */
export const mislabelledFile = (name = 'fake.png'): File => new File([pdfBytes(1)], name, { type: 'image/png' });

/** A well-formed extraction answer for a marksheet, as JSON text. */
export const MARKSHEET_JSON = JSON.stringify({
  documentTypes: ['marksheet'], language: 'en',
  applicantName: { original: 'Aarav Sunil Patil', english: 'Aarav Sunil Patil' },
  dateOfBirth: null, issueDate: '2026-04-02', issuingAuthority: 'Fictional University', category: null,
  annualIncome: null, pageCount: 1, legible: true,
});

/** An error shaped like Firebase AI Logic's 429. */
export const tooManyRequests = (): Error => Object.assign(new Error('[429 Too Many Requests] Resource exhausted'), { status: 429 });

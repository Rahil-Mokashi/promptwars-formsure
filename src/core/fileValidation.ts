import {
  ALLOWED_MIME_TYPES,
  DOWNSCALE_ABOVE_PX,
  MAGIC_BYTES_LENGTH,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_IMAGE_SIDE_PX,
  MAX_PDF_PAGES,
  MAX_TOTAL_BYTES,
  PDF_TAIL_BYTES,
} from './constants';
import { maskAadhaar } from './mask';

/** The parts of a `File` that validation needs. */
export interface FileLike {
  type: string;
  size: number;
  name: string;
}

/** File kinds FormSure accepts, recognised by their first bytes. */
export type FileKind = 'png' | 'jpeg' | 'webp' | 'pdf';

/** The kind each allowed MIME type must contain. */
const KIND_OF_MIME: Readonly<Record<string, FileKind>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Bytes that must appear at a given offset. */
interface SignaturePart {
  offset: number;
  bytes: readonly number[];
}

const ascii = (text: string): number[] => Array.from(text, (c) => c.charCodeAt(0));

/** The magic bytes of each accepted kind. WebP has two parts: "RIFF" at 0 and "WEBP" at 8. */
const SIGNATURES: readonly { kind: FileKind; parts: readonly SignaturePart[] }[] = [
  { kind: 'png', parts: [{ offset: 0, bytes: [0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a] }] },
  { kind: 'jpeg', parts: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] },
  {
    kind: 'webp',
    parts: [
      { offset: 0, bytes: ascii('RIFF') },
      { offset: 8, bytes: ascii('WEBP') },
    ],
  },
  { kind: 'pdf', parts: [{ offset: 0, bytes: ascii('%PDF-') }] },
];

/** True when `bytes` holds every part of a signature at its offset (and is long enough to). */
const hasParts = (bytes: Uint8Array, parts: readonly SignaturePart[]): boolean =>
  parts.every(({ offset, bytes: expected }) => expected.every((byte, i) => bytes[offset + i] === byte));

/**
 * Recognises PNG, JPEG, WebP and PDF by magic bytes (the first bytes of the file).
 * @returns the kind, or null when the content is none of them
 */
export function detectFileKind(bytes: Uint8Array): FileKind | null {
  return SIGNATURES.find((signature) => hasParts(bytes, signature.parts))?.kind ?? null;
}

/** Quick checks that need no file content: type, emptiness and size. Returns an error message or null. */
export function validateFile(file: FileLike): string | null {
  const name = maskAadhaar(file.name);
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return `${name}: use a PNG, JPG, WebP or PDF file.`;
  if (file.size > MAX_FILE_BYTES) return `${name}: the file is larger than 5 MB.`;
  if (file.size === 0) return `${name}: the file is empty.`;
  return null;
}

const readHeader = (file: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => {
      reject(new Error('Could not read the file'));
    };
    reader.readAsArrayBuffer(file.slice(0, MAGIC_BYTES_LENGTH));
  });

/**
 * Full upload check: type, size and emptiness, then the file's real content by magic bytes.
 * A file whose bytes disagree with its declared type (for example a PDF renamed `.png`) is rejected.
 * @returns an error message that is safe to show, or null when the file is acceptable
 */
export async function validateUpload(file: File): Promise<string | null> {
  const quick = validateFile(file);
  if (quick) return quick;
  const name = maskAadhaar(file.name);
  let kind: FileKind | null;
  try {
    kind = detectFileKind(await readHeader(file));
  } catch {
    return `${name}: the file could not be read.`;
  }
  if (kind === null) return `${name}: the content is not a PNG, JPG, WebP or PDF file.`;
  if (kind !== KIND_OF_MIME[file.type]) return `${name}: the content does not match its file type.`;
  return null;
}

/** What {@link inspectPdf} found. */
export interface PdfInspection {
  /** The file does not end with a `%%EOF` marker, so it was cut off. */
  truncated: boolean;
  /** The file declares encryption (`/Encrypt`), which Gemini cannot read. */
  encrypted: boolean;
  /** Pages counted from the page tree; 0 when the page tree is compressed and could not be counted. */
  pages: number;
}

const latin1 = (bytes: Uint8Array): string => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return text;
};

/**
 * Heuristic inspection of a PDF's raw bytes: truncated (no `%%EOF` near the end), encrypted (`/Encrypt`) and page count
 * (page objects, or the largest `/Count` of a page tree). Compressed object streams can hide the page tree, in which
 * case `pages` is 0 and the model's own page count is checked after reading.
 */
export function inspectPdf(bytes: Uint8Array): PdfInspection {
  const text = latin1(bytes);
  const tail = text.slice(-PDF_TAIL_BYTES);
  const pageObjects = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
  const counts = [...text.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/g)].map(
    (m) => Number(m[1] ?? m[2]),
  );
  return {
    truncated: !tail.includes('%%EOF'),
    encrypted: /\/Encrypt\b/.test(text),
    pages: Math.max(pageObjects, ...counts, 0),
  };
}

/** Message for a PDF that cannot be used, or null. */
export function pdfProblem(name: string, inspection: PdfInspection): string | null {
  const shown = maskAadhaar(name);
  if (inspection.truncated) return `${shown}: the PDF looks cut off or damaged.`;
  if (inspection.encrypted) return `${shown}: the PDF is password-protected. Upload an unlocked copy.`;
  if (inspection.pages > MAX_PDF_PAGES) return `${shown}: the PDF has more than ${MAX_PDF_PAGES} pages.`;
  return null;
}

/** Message for an image that is too large in pixels, or null. */
export function imageSizeProblem(name: string, width: number, height: number): string | null {
  if (width <= 0 || height <= 0) return `${maskAadhaar(name)}: the image could not be read.`;
  if (width > MAX_IMAGE_SIDE_PX || height > MAX_IMAGE_SIDE_PX)
    return `${maskAadhaar(name)}: the image is larger than ${MAX_IMAGE_SIDE_PX} × ${MAX_IMAGE_SIDE_PX} pixels.`;
  return null;
}

/** Scale (at most 1) that brings the long side down to {@link DOWNSCALE_ABOVE_PX}; 1 when it is already small enough. */
export function downscaleFactor(width: number, height: number): number {
  const longSide = Math.max(width, height);
  return longSide > DOWNSCALE_ABOVE_PX ? DOWNSCALE_ABOVE_PX / longSide : 1;
}

/**
 * Checks the selection as a whole: at most 10 files and 25 MB in total.
 * @param sizes sizes in bytes of every file that would be selected
 */
export function batchProblem(sizes: readonly number[]): string | null {
  if (sizes.length > MAX_FILES) return `You can upload at most ${MAX_FILES} files.`;
  if (sizes.reduce((a, b) => a + b, 0) > MAX_TOTAL_BYTES) return 'The files together are larger than 25 MB.';
  return null;
}

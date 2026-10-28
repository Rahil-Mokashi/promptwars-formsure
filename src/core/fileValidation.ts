import { ALLOWED_MIME_TYPES, MAGIC_BYTES_LENGTH, MAX_FILE_BYTES } from './constants';
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

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.slice(start, start + length));

/**
 * Recognises PNG, JPEG, WebP and PDF by magic bytes (the first bytes of the file).
 * @returns the kind, or null when the content is none of them
 */
export function detectFileKind(bytes: Uint8Array): FileKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') return 'pdf';
  return null;
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
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('Could not read the file'));
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

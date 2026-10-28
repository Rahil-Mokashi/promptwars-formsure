import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from './constants';

/** The parts of a `File` that validation needs. */
export interface FileLike {
  type: string;
  size: number;
  name: string;
}

/** Quick checks that need no file content: type, emptiness and size. Returns an error message or null. */
export function validateFile(file: FileLike): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return `${file.name}: use a PNG, JPG, WebP or PDF file.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name}: the file is larger than 5 MB.`;
  if (file.size === 0) return `${file.name}: the file is empty.`;
  return null;
}

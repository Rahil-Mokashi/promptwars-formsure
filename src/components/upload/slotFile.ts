import { BYTES_PER_KB } from '../../core/constants';
import { maskAadhaar } from '../../core/mask';

/** What a slot card shows about its file. */
export interface ShownFile {
  name: string;
  size: string;
}

/** `5242880` becomes `"5.0 MB"`, `120_000` becomes `"117 KB"`; never less than 1 KB. */
export const sizeLabel = (bytes: number): string =>
  bytes >= BYTES_PER_KB * BYTES_PER_KB
    ? `${(bytes / BYTES_PER_KB / BYTES_PER_KB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;

/**
 * The file a card shows: the sample's own file info in sample mode, else the chosen file with its name masked
 * (a 12-digit number in a file name never appears) and its size, or null when nothing is chosen.
 */
export function shownFile(sampleFile: ShownFile | undefined, file: File | undefined): ShownFile | null {
  if (sampleFile) return sampleFile;
  return file ? { name: maskAadhaar(file.name), size: sizeLabel(file.size) } : null;
}

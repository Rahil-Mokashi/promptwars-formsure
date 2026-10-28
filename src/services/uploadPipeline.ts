import { MAX_FILE_BYTES, REENCODE_QUALITY } from '../core/constants';
import { downscaleFactor, imageSizeProblem, inspectPdf, pdfProblem, validateUpload } from '../core/fileValidation';
import { maskAadhaar } from '../core/mask';

/** An image decoded for inspection. `close` frees it. */
export interface DecodedImage {
  width: number;
  height: number;
  close: () => void;
  /** Whatever the encoder needs to draw it. */
  source: unknown;
}

/** The browser's image abilities, injectable for tests. */
export interface ImageTools {
  decode: (file: File) => Promise<DecodedImage>;
  /** Draws the image at `scale` on a canvas and encodes it; the result carries no EXIF or other metadata. */
  encode: (image: DecodedImage, type: string, scale: number) => Promise<Blob>;
}

/** Result of {@link prepareUpload}: a file that is safe to send, or a message that is safe to show. */
export type PreparedUpload = { file: File; error?: undefined } | { file?: undefined; error: string };

/** Image abilities of the real browser: `createImageBitmap` and a canvas. Fails closed where they are missing. */
export const browserImageTools: ImageTools = {
  async decode(file) {
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap is not available');
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, close: () => bitmap.close(), source: bitmap };
  },
  encode(image, type, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return Promise.reject(new Error('canvas is not available'));
    context.drawImage(image.source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encoding failed'))), type, REENCODE_QUALITY);
    });
  },
};

const readAllBytes = (file: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsArrayBuffer(file);
  });

/**
 * The whole upload pipeline for one file:
 * 1. type, size, emptiness and magic bytes;
 * 2. PDFs: reject truncated, encrypted or over-long files;
 * 3. images: reject over 6000 × 6000 px, then re-encode through a canvas (this strips EXIF and other metadata)
 *    and scale down only when the long side is above 2400 px.
 * PDFs are sent as they are: their metadata cannot be stripped in the browser.
 */
export async function prepareUpload(file: File, tools: ImageTools = browserImageTools): Promise<PreparedUpload> {
  const problem = await validateUpload(file);
  if (problem) return { error: problem };
  const name = maskAadhaar(file.name);

  if (file.type === 'application/pdf') {
    try {
      const message = pdfProblem(file.name, inspectPdf(await readAllBytes(file)));
      return message ? { error: message } : { file };
    } catch {
      return { error: `${name}: the file could not be read.` };
    }
  }

  let image: DecodedImage;
  try {
    image = await tools.decode(file);
  } catch {
    return { error: `${name}: the image could not be read or this browser cannot prepare images safely.` };
  }
  try {
    const tooBig = imageSizeProblem(file.name, image.width, image.height);
    if (tooBig) return { error: tooBig };
    const blob = await tools.encode(image, file.type, downscaleFactor(image.width, image.height));
    if (blob.size > MAX_FILE_BYTES) return { error: `${name}: the image is larger than 5 MB after cleaning.` };
    return { file: new File([blob], file.name, { type: file.type }) };
  } catch {
    return { error: `${name}: the image could not be prepared.` };
  } finally {
    image.close();
  }
}

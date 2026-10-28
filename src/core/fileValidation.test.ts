import { describe, expect, it, vi } from 'vitest';
import { jpegFile, mislabelledFile, pdfFile, pngFile, webpFile } from '../test/files';
import { batchProblem, detectFileKind, downscaleFactor, imageSizeProblem, inspectPdf, pdfProblem, validateFile, validateUpload } from './fileValidation';

describe('validateFile (type, size, emptiness)', () => {
  it('accepts png, jpg, webp and pdf up to exactly 5 MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']) {
      expect(validateFile({ type, size: 1000, name: 'f' })).toBeNull();
    }
    expect(validateFile({ type: 'application/pdf', size: 5 * 1024 * 1024, name: 'f' })).toBeNull();
  });
  it('rejects other file types with a clear message', () => {
    expect(validateFile({ type: 'text/plain', size: 10, name: 'a.txt' })).toBe('a.txt: use a PNG, JPG, WebP or PDF file.');
    expect(validateFile({ type: 'image/gif', size: 10, name: 'a.gif' })).not.toBeNull();
    expect(validateFile({ type: '', size: 10, name: 'noext' })).not.toBeNull();
  });
  it('rejects a file one byte over 5 MB', () => {
    expect(validateFile({ type: 'image/png', size: 5 * 1024 * 1024 + 1, name: 'big.png' })).toBe('big.png: the file is larger than 5 MB.');
  });
  it('rejects an empty file', () => {
    expect(validateFile({ type: 'image/png', size: 0, name: 'e.png' })).toBe('e.png: the file is empty.');
  });
});

describe('detectFileKind (magic bytes)', () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  const text = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

  it('recognises PNG, JPEG, WebP and PDF by their first bytes', () => {
    expect(detectFileKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('png');
    expect(detectFileKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(detectFileKind(text('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    expect(detectFileKind(text('%PDF-1.7'))).toBe('pdf');
  });
  it('rejects anything else, including text, HTML, scripts and too-short files', () => {
    expect(detectFileKind(text('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectFileKind(text('MZ\x90\x00'))).toBeNull();
    expect(detectFileKind(text('RIFF\0\0\0\0WAVEfmt '))).toBeNull();
    expect(detectFileKind(bytes(0x89, 0x50))).toBeNull();
    expect(detectFileKind(bytes())).toBeNull();
  });
});

describe('validateUpload (type, size and real content)', () => {
  it.each([['png', pngFile()], ['jpeg', jpegFile()], ['webp', webpFile()], ['pdf', pdfFile()]])('accepts a genuine %s', async (_k, file) => {
    await expect(validateUpload(file)).resolves.toBeNull();
  });
  it('rejects a file whose content does not match its declared type', async () => {
    await expect(validateUpload(mislabelledFile('fake.png'))).resolves.toBe('fake.png: the content does not match its file type.');
  });
  it('rejects text or a script renamed to .pdf', async () => {
    const script = new File(['<script>alert(1)</script>'], 'evil.pdf', { type: 'application/pdf' });
    await expect(validateUpload(script)).resolves.toBe('evil.pdf: the content is not a PNG, JPG, WebP or PDF file.');
  });
  it('rejects empty, oversized and wrong-type files before reading them', async () => {
    await expect(validateUpload(new File([], 'e.pdf', { type: 'application/pdf' }))).resolves.toMatch(/empty/);
    await expect(validateUpload(new File(['x'], 'a.txt', { type: 'text/plain' }))).resolves.toMatch(/PNG, JPG, WebP or PDF/);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' });
    await expect(validateUpload(big)).resolves.toMatch(/5 MB/);
  });
  it('masks a 12-digit number in the file name', async () => {
    await expect(validateUpload(new File(['x'], '1234 5678 9012.txt', { type: 'text/plain' }))).resolves.toBe('XXXX XXXX 9012.txt: use a PNG, JPG, WebP or PDF file.');
  });
  it('reports a file that cannot be read', async () => {
    const spy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.onerror?.call(this, new ProgressEvent('error') as ProgressEvent<FileReader>));
    });
    await expect(validateUpload(pdfFile('a.pdf'))).resolves.toBe('a.pdf: the file could not be read.');
    spy.mockRestore();
  });
});

describe('inspectPdf and pdfProblem', () => {
  const bytes = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  it('counts pages from page objects and from the page tree', () => {
    expect(inspectPdf(bytes('%PDF-1.4 /Type /Page /Type /Page /Type/Pages /Count 2 %%EOF')).pages).toBe(2);
    expect(inspectPdf(bytes('%PDF-1.4 /Count 7 /Type /Pages %%EOF')).pages).toBe(7);
    expect(inspectPdf(bytes('%PDF-1.4 %%EOF')).pages).toBe(0);
  });
  it('detects truncation and encryption', () => {
    expect(inspectPdf(bytes('%PDF-1.4 ... no marker')).truncated).toBe(true);
    expect(inspectPdf(bytes('%PDF-1.4 ... %%EOF')).truncated).toBe(false);
    expect(inspectPdf(bytes('%PDF-1.4 /Encrypt 5 0 R %%EOF')).encrypted).toBe(true);
  });
  it('gives a message for each problem and null for a good file', () => {
    expect(pdfProblem('a.pdf', { truncated: true, encrypted: false, pages: 1 })).toMatch(/cut off/);
    expect(pdfProblem('a.pdf', { truncated: false, encrypted: true, pages: 1 })).toMatch(/password/);
    expect(pdfProblem('a.pdf', { truncated: false, encrypted: false, pages: 11 })).toMatch(/more than 10 pages/);
    expect(pdfProblem('a.pdf', { truncated: false, encrypted: false, pages: 10 })).toBeNull();
  });
});

describe('image and batch limits', () => {
  it('limits images to 6000 × 6000 and scales down only above 2400', () => {
    expect(imageSizeProblem('a.png', 6000, 6000)).toBeNull();
    expect(imageSizeProblem('a.png', 6001, 10)).toMatch(/larger than 6000/);
    expect(imageSizeProblem('a.png', 10, 6001)).toMatch(/larger than 6000/);
    expect(imageSizeProblem('a.png', 0, 10)).toMatch(/could not be read/);
    expect(downscaleFactor(2400, 100)).toBe(1);
    expect(downscaleFactor(4800, 100)).toBe(0.5);
    expect(downscaleFactor(100, 4800)).toBe(0.5);
  });
  it('limits a selection to 10 files and 25 MB in total', () => {
    const mb = 1024 * 1024;
    expect(batchProblem(Array(10).fill(1))).toBeNull();
    expect(batchProblem(Array(11).fill(1))).toBe('You can upload at most 10 files.');
    expect(batchProblem([5 * mb, 5 * mb, 5 * mb, 5 * mb, 5 * mb])).toBeNull();
    expect(batchProblem([5 * mb, 5 * mb, 5 * mb, 5 * mb, 5 * mb, 1])).toBe('The files together are larger than 25 MB.');
  });
});

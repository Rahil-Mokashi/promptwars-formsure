import { describe, expect, it, vi } from 'vitest';
import { jpegFile, mislabelledFile, pdfFile, pngFile, webpFile } from '../test/files';
import { detectFileKind, validateFile, validateUpload } from './fileValidation';

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

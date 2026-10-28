import { describe, expect, it, vi } from 'vitest';
import { encryptedPdf, imageHeader, jpegFile, mislabelledFile, pdfFile, pngFile, truncatedPdf, webpFile } from '../test/files';
import { browserImageTools, prepareUpload, type DecodedImage, type ImageTools } from './uploadPipeline';

/** Fake browser: decodes to a chosen size and "re-encodes" to a header-only blob of the requested type. */
function fakeTools(width: number, height: number, overrides: Partial<ImageTools> = {}) {
  const close = vi.fn();
  const encode = vi.fn<ImageTools['encode']>(async (_image, type) => new Blob([imageHeader(type)], { type }));
  const tools: ImageTools = { decode: async () => ({ width, height, close, source: {} }), encode, ...overrides };
  return { tools, close, encode };
}

describe('prepareUpload: PDFs', () => {
  it('passes a normal PDF through unchanged', async () => {
    const file = pdfFile('ok.pdf');
    const result = await prepareUpload(file, fakeTools(1, 1).tools);
    expect(result.file).toBe(file);
  });
  it('rejects a truncated PDF', async () => {
    expect((await prepareUpload(truncatedPdf('cut.pdf'))).error).toBe('cut.pdf: the PDF looks cut off or damaged.');
  });
  it('rejects an encrypted PDF', async () => {
    expect((await prepareUpload(encryptedPdf('locked.pdf'))).error).toBe('locked.pdf: the PDF is password-protected. Upload an unlocked copy.');
  });
  it('accepts exactly 10 pages and rejects 11', async () => {
    expect((await prepareUpload(pdfFile('ten.pdf', 10))).error).toBeUndefined();
    expect((await prepareUpload(pdfFile('eleven.pdf', 11))).error).toBe('eleven.pdf: the PDF has more than 10 pages.');
  });
  it('reports a PDF that cannot be read', async () => {
    const spy = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      queueMicrotask(() => this.onerror?.call(this, new ProgressEvent('error') as ProgressEvent<FileReader>));
    });
    expect((await prepareUpload(pdfFile('x.pdf'))).error).toBe('x.pdf: the file could not be read.');
    spy.mockRestore();
  });
});

describe('prepareUpload: spoofed and invalid files never reach the model', () => {
  it('rejects a PDF labelled as a PNG, and plain text labelled as a PDF', async () => {
    expect((await prepareUpload(mislabelledFile('fake.png'))).error).toBe('fake.png: the content does not match its file type.');
    const text = new File(['hello'], 'x.pdf', { type: 'application/pdf' });
    expect((await prepareUpload(text)).error).toMatch(/content is not a PNG, JPG, WebP or PDF/);
  });
  it('rejects an empty file and a wrong type before reading anything', async () => {
    expect((await prepareUpload(new File([], 'e.pdf', { type: 'application/pdf' }))).error).toMatch(/empty/);
    expect((await prepareUpload(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).error).toMatch(/PNG, JPG, WebP or PDF/);
  });
});

describe('prepareUpload: images are re-encoded through a canvas (metadata stripped)', () => {
  it.each([['png', pngFile('a.png')], ['jpeg', jpegFile('a.jpg')], ['webp', webpFile('a.webp')]])('re-encodes a %s into a new file with the same name and type', async (_k, file) => {
    const { tools, encode, close } = fakeTools(800, 600);
    const result = await prepareUpload(file, tools);
    expect(result.file).not.toBe(file);
    expect(result.file?.name).toBe(file.name);
    expect(result.file?.type).toBe(file.type);
    expect(encode).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it('never scales a small image', async () => {
    const { tools, encode } = fakeTools(2400, 1800);
    await prepareUpload(pngFile(), tools);
    expect(encode.mock.calls[0]?.[2]).toBe(1);
  });
  it('scales an image down only above 2400 px on the long side, to exactly 2400', async () => {
    const { tools, encode } = fakeTools(4800, 3000);
    await prepareUpload(pngFile(), tools);
    expect(encode.mock.calls[0]?.[2]).toBeCloseTo(0.5);
  });
  it('accepts 6000 × 6000 and rejects anything larger', async () => {
    expect((await prepareUpload(pngFile(), fakeTools(6000, 6000).tools)).error).toBeUndefined();
    const wide = fakeTools(6001, 100);
    expect((await prepareUpload(pngFile('wide.png'), wide.tools)).error).toBe('wide.png: the image is larger than 6000 × 6000 pixels.');
    expect(wide.encode).not.toHaveBeenCalled();
    expect(wide.close).toHaveBeenCalled();
  });
  it('rejects an image that decodes to nothing', async () => {
    expect((await prepareUpload(pngFile('zero.png'), fakeTools(0, 0).tools)).error).toBe('zero.png: the image could not be read.');
  });
  it('fails closed when the image cannot be decoded (or the browser cannot do it)', async () => {
    const tools: ImageTools = { decode: async () => { throw new Error('no'); }, encode: vi.fn() };
    expect((await prepareUpload(pngFile('a.png'), tools)).error).toMatch(/cannot prepare images safely/);
  });
  it('fails closed when encoding fails', async () => {
    const { tools, close } = fakeTools(10, 10, { encode: async () => { throw new Error('no'); } });
    expect((await prepareUpload(pngFile('a.png'), tools)).error).toBe('a.png: the image could not be prepared.');
    expect(close).toHaveBeenCalled();
  });
  it('rejects a cleaned image that grew past 5 MB', async () => {
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' });
    const { tools } = fakeTools(10, 10, { encode: async () => big });
    expect((await prepareUpload(pngFile('big.png'), tools)).error).toBe('big.png: the image is larger than 5 MB after cleaning.');
  });
  it('masks a 12-digit number in the file name of every message', async () => {
    expect((await prepareUpload(pngFile('1234 5678 9012.png'), fakeTools(7000, 10).tools)).error).toMatch(/^XXXX XXXX 9012\.png/);
  });
});

describe('browserImageTools (the real browser path, with a stubbed browser)', () => {
  it('decodes with createImageBitmap and encodes through a canvas at the requested scale', async () => {
    const drawImage = vi.fn();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    const decoded = await browserImageTools.decode(pngFile());
    expect([decoded.width, decoded.height]).toEqual([100, 100]);
    const blob = await browserImageTools.encode(decoded, 'image/png', 0.5);
    expect(blob.type).toBe('image/png');
    expect(drawImage).toHaveBeenCalledWith(decoded.source, 0, 0, 50, 50);
    getContext.mockRestore();
  });
  it('fails closed without createImageBitmap, without a 2d canvas, and when the canvas cannot encode', async () => {
    const original = globalThis.createImageBitmap;
    Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, writable: true, value: undefined });
    await expect(browserImageTools.decode(pngFile())).rejects.toThrow();
    Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, writable: true, value: original });

    const image: DecodedImage = { width: 10, height: 10, close: () => undefined, source: {} };
    const noContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(browserImageTools.encode(image, 'image/png', 1)).rejects.toThrow('canvas is not available');
    noContext.mockRestore();

    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => undefined } as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null));
    await expect(browserImageTools.encode(image, 'image/png', 1)).rejects.toThrow('encoding failed');
    toBlob.mockRestore();
    context.mockRestore();
  });
});

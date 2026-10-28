import { describe, expect, it } from 'vitest';
import { validateFile } from './fileValidation';

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

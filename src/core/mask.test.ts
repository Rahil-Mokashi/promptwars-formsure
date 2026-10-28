import { describe, expect, it } from 'vitest';
import { describeError, maskAadhaar, maskDeep } from './mask';

describe('maskAadhaar', () => {
  it('masks spaced, dashed and plain 12-digit numbers down to the last four digits', () => {
    expect(maskAadhaar('1234 5678 9012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('1234-5678-9012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('123456789012')).toBe('XXXX XXXX 9012');
  });
  it('leaves other numbers alone, including 13-digit runs and incomes', () => {
    expect(maskAadhaar('1234567890123')).toBe('1234567890123');
    expect(maskAadhaar('income 240000')).toBe('income 240000');
  });
  it('masks several numbers in one string', () => {
    expect(maskAadhaar('a 1111 2222 3333 b 4444 5555 6666')).toBe('a XXXX XXXX 3333 b XXXX XXXX 6666');
  });
});

describe('maskDeep', () => {
  it('masks inside nested objects and arrays without changing the shape', () => {
    expect(maskDeep({ a: { b: ['ID 1111 2222 3333'] }, n: 5 })).toEqual({ a: { b: ['ID XXXX XXXX 3333'] }, n: 5 });
  });
});

describe('describeError', () => {
  it('describes name, status and code, and never the provider message', () => {
    const err = Object.assign(new Error('failed for 1234 5678 9012 Aarav Patil'), {
      name: 'FirebaseError',
      status: 429,
      code: 'ai/fetch-error',
    });
    const text = describeError(err);
    expect(text).toBe('FirebaseError status 429 code ai/fetch-error');
    expect(text).not.toMatch(/Aarav|1234/);
  });
  it('reads the status the Firebase SDK keeps in customErrorData', () => {
    expect(describeError({ name: 'FirebaseError', customErrorData: { status: 503 } })).toBe('FirebaseError status 503');
  });
  it('masks a 12-digit number that appears in a code', () => {
    expect(describeError({ name: 'E', code: 'id-123456789012' })).toBe('E code id-XXXX XXXX 9012');
  });
  it('copes with non-error values', () => {
    expect(describeError(null)).toBe('unknown error');
    expect(describeError('boom')).toBe('unknown error');
    expect(describeError({})).toBe('Error');
  });
});

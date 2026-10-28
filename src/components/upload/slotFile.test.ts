import { describe, expect, it } from 'vitest';
import { pdfFile } from '../../test/files';
import { shownFile, sizeLabel } from './slotFile';

describe('sizeLabel', () => {
  it('shows KB below 1 MB (at least 1 KB) and MB from 1 MB', () => {
    expect(sizeLabel(10)).toBe('1 KB');
    expect(sizeLabel(120_000)).toBe('117 KB');
    expect(sizeLabel(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('shownFile', () => {
  it('prefers the sample file info', () => {
    expect(shownFile({ name: 'aarav_income.pdf', size: '121 KB' }, pdfFile('x.pdf'))).toEqual({
      name: 'aarav_income.pdf',
      size: '121 KB',
    });
  });
  it('masks a 12-digit number in the chosen file name', () => {
    expect(shownFile(undefined, pdfFile('1234 5678 9012.pdf'))?.name).toBe('XXXX XXXX 9012.pdf');
  });
  it('is null when nothing is chosen', () => {
    expect(shownFile(undefined, undefined)).toBeNull();
  });
});

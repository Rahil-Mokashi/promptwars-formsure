import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audit } from '../../services/api';
import { NOW, sample } from '../../test/docs';
import { ChecklistDialog } from './ChecklistDialog';

const report = audit(sample.form, sample.errorDocuments, undefined, NOW);

afterEach(() => vi.restoreAllMocks());

describe('ChecklistDialog', () => {
  it('lists every check with the applicant and readiness', () => {
    render(<ChecklistDialog report={report} form={sample.form} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: /checklist for college desk/i })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Readiness ${report.readiness}%`))).toBeInTheDocument();
    for (const check of report.checks) expect(screen.getByText(check.label, { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText(/advisory, not scored/)).toHaveLength(report.checks.filter((c) => c.advisory).length);
  });

  it('prints the checklist', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<ChecklistDialog report={report} form={sample.form} onClose={() => undefined} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /print or save as pdf/i }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('downloads a plain-text copy built in the browser and frees the object URL afterwards', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:checklist';
    });
    const revoke = vi.fn();
    URL.revokeObjectURL = revoke;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<ChecklistDialog report={report} form={sample.form} onClose={() => undefined} />);
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole('button', { name: /download as text/i }));
    expect(click).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:checklist');
    const text = await blobs[0]?.text();
    expect(text).toContain(`Applicant: ${sample.form.fullName}`);
    expect(text).toContain(`Readiness: ${report.readiness}%`);
    vi.useRealTimers();
  });
});

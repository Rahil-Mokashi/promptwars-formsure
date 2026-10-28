import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const doc = JSON.stringify({
  documentTypes: ['income_certificate', 'non_creamy_layer'], language: 'mr',
  applicantName: { original: 'आरव सुनील पाटील', english: 'Aarav Sunil Patil' },
  dateOfBirth: '2006-03-14', issueDate: '2026-04-05', issuingAuthority: 'Tehsildar', category: 'OBC',
  annualIncome: 200000, pageCount: 2, legible: true,
});

// Firebase AI is mocked: no network, no SDK.
vi.mock('./core/live', () => ({ createFirebaseGenerate: () => async () => doc }));

beforeAll(() => {
  (globalThis as { __REDUCE_MOTION__?: boolean }).__REDUCE_MOTION__ = true;
});

describe('live upload with mocked Firebase AI', () => {
  it('reads uploaded files, audits them and rejects bad files in the browser', async () => {
    const { App } = await import('./App');
    const user = userEvent.setup({ applyAccept: false });
    render(<App />);
    await user.click(screen.getByRole('button', { name: /start my check/i }));
    await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
    await user.type(await screen.findByLabelText('Full name'), 'Aarav Sunil Patil');
    await user.type(screen.getByLabelText('Date of birth'), '2006-03-14');

    await user.upload(screen.getByLabelText(/Aadhaar card/), new File(['x'], 'a.txt', { type: 'text/plain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/PNG, JPG, WebP or PDF/);

    await user.upload(screen.getByLabelText(/Aadhaar card/), new File(['x'], 'aadhaar.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /run formsure check/i }));
    expect(await screen.findByText('Checking Aarav’s application')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /see readiness report/i }));
    expect(await screen.findByRole('heading', { name: /to fix before you submit/ })).toBeInTheDocument();
  });
});

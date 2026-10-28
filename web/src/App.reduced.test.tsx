import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from './App';
import { mockApi } from './test-api';

beforeAll(() => {
  (globalThis as { __REDUCE_MOTION__?: boolean }).__REDUCE_MOTION__ = true;
});

async function toReport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /try sample applicant/i }));
  await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
  await user.click(await screen.findByRole('button', { name: /run formsure check/i }));
  await user.click(await screen.findByRole('button', { name: /see readiness report/i }));
}

describe('reduced-motion sample flow', () => {
  it('renders 3 issues at 57% with no animation delay, then 100% after the re-check', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await toReport(user);

    expect(await screen.findByRole('heading', { name: '3 things to fix before you submit' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    // Count-up is skipped: the final number is there immediately.
    expect(screen.getByText('57%')).toBeInTheDocument();
    expect(screen.getByText(/Skipped: family income limit/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /re-check/i }));
    expect(await screen.findByRole('heading', { name: 'Ready to submit' })).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(document.querySelector('.confetti')).toBeNull(); // no confetti when motion is off
  });

  it('shows all checks at once on the audit screen', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try sample applicant/i }));
    await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
    await user.click(await screen.findByRole('button', { name: /run formsure check/i }));
    const bar = await screen.findByRole('progressbar');
    expect(await within(document.body).findByRole('button', { name: /see readiness report/i })).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '8');
  });

  it('language toggle changes fix text and the html lang attribute', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await toReport(user);
    await screen.findByRole('heading', { name: /things to fix/ });
    await user.click(screen.getByRole('button', { name: 'मराठी' }));
    expect(document.documentElement.lang).toBe('mr');
    expect(screen.getByText(/तहसील कार्यालयातून १ एप्रिल/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'हिंदी' }));
    expect(document.documentElement.lang).toBe('hi');
    expect(screen.getByText(/तहसील कार्यालय से 1 अप्रैल/)).toBeInTheDocument();
  });

  it('upload mode shows the unavailable message on a 503', async () => {
    mockApi();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /start my check/i }));
    await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
    await user.type(await screen.findByLabelText('Full name'), 'Aarav Sunil Patil');
    await user.type(screen.getByLabelText('Date of birth'), '2006-03-14');
    await user.upload(await screen.findByLabelText(/Aadhaar card/), new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /run formsure check/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Live reading unavailable, try the sample applicant');
  });
});

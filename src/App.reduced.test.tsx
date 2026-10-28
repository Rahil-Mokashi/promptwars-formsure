import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { pdfFile } from './test/files';
import { App } from './App';

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
  it('renders the one issue at 50% with no animation delay, then 100% after the re-check', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toReport(user);

    expect(
      await screen.findByRole('heading', {
        name: 'Pre-check complete — 1 passed, 1 need fixing, 0 couldn’t be verified.',
      }),
    ).toBeInTheDocument();
    // One scored failure plus two advisory warnings (income certificate year, marksheet name), shown but not scored.
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getAllByRole('article').filter((a) => a.textContent.includes('Advisory'))).toHaveLength(2);
    // Count-up is skipped: the final number is there immediately.
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/Not evaluated \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/2 advisory warnings/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /re-check/i }));
    expect(await screen.findByRole('heading', { name: 'Pre-check complete' })).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/7 of 8 checks are green/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Every check' }).querySelectorAll('li')).toHaveLength(8);
    expect(document.querySelector('.confetti-canvas')).toBeNull(); // no confetti when motion is off
  });

  it('shows all checks at once on the audit screen', async () => {
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
    const user = userEvent.setup();
    render(<App />);
    await toReport(user);
    await screen.findByRole('heading', { name: /Pre-check complete/ });
    await user.click(screen.getByRole('button', { name: 'मराठी' }));
    expect(document.documentElement.lang).toBe('mr');
    expect(screen.getByText(/नॉन-क्रिमीलेयर प्रमाणपत्र एकाच PDF मध्ये जोडा/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'हिंदी' }));
    expect(document.documentElement.lang).toBe('hi');
    expect(screen.getByText(/नॉन-क्रीमी लेयर प्रमाणपत्र को एक ही PDF में जोड़ें/)).toBeInTheDocument();
  });

  it('live upload without Firebase config says so up front, hides the consent box and cannot run', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /start my check/i }));
    await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
    await user.type(await screen.findByLabelText('Full name'), 'Aarav Sunil Patil');
    await user.type(screen.getByLabelText('Date of birth'), '2006-03-14');
    await user.upload(await screen.findByLabelText(/Aadhaar card/), pdfFile('a.pdf'));
    expect(await screen.findByRole('status')).toHaveTextContent('Live reading unavailable, try the sample applicant');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: /run formsure check/i })).toBeDisabled();
  });
});

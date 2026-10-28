import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { configureAxe } from 'vitest-axe';
import { App } from './App';

// jsdom cannot compute colours, so contrast is covered separately (README: palette ratios).
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } });
type User = ReturnType<typeof userEvent.setup>;

beforeAll(() => {
  (globalThis as { __REDUCE_MOTION__?: boolean }).__REDUCE_MOTION__ = true;
});

const click = (user: User, name: RegExp | string) => user.click(screen.getByRole('button', { name }));
const clickWhenReady = async (user: User, name: RegExp | string) => user.click(await screen.findByRole('button', { name }));

describe('axe: no accessibility violations on any screen', () => {
  it('landing', async () => {
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('scheme picker, upload (sample), audit, report, ready, and the dialogs', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await click(user, /try sample applicant/i);
    await screen.findByText('Which scholarship are you applying for?');
    expect(await axe(container)).toHaveNoViolations();

    await click(user, /add a new scheme/i);
    expect(await axe(await screen.findByRole('dialog'))).toHaveNoViolations();
    await user.keyboard('{Escape}');

    await clickWhenReady(user, /continue to upload/i);
    await screen.findByText('Upload your documents');
    expect(await axe(container)).toHaveNoViolations();

    await clickWhenReady(user, /run formsure check/i);
    await clickWhenReady(user, /see readiness report/i);
    expect(await axe(container)).toHaveNoViolations();

    await clickWhenReady(user, /^Critical/i).catch(() => undefined);
    await screen.findByRole('heading', { name: /Pre-check complete/ });
    expect(await axe(container)).toHaveNoViolations();

    await click(user, /re-check/i);
    await screen.findByRole('heading', { name: 'Pre-check complete' });
    expect(await axe(container)).toHaveNoViolations();

    await click(user, /download checklist/i);
    expect(await axe(await screen.findByRole('dialog'))).toHaveNoViolations();
  });

  it('upload screen in live mode and the report in Marathi', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await click(user, /start my check/i);
    await clickWhenReady(user, /continue to upload/i);
    await screen.findByLabelText('Full name');
    expect(await axe(container)).toHaveNoViolations();

    await click(user, 'मराठी');
    expect(await axe(container)).toHaveNoViolations();
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from './App';

beforeAll(() => {
  (globalThis as { __REDUCE_MOTION__?: boolean }).__REDUCE_MOTION__ = true;
});

async function toReady(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /try sample applicant/i }));
  await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
  await user.click(await screen.findByRole('button', { name: /run formsure check/i }));
  await user.click(await screen.findByRole('button', { name: /see readiness report/i }));
  await screen.findByRole('heading', { name: /Pre-check complete/ });
}

describe('landing', () => {
  it('shows the stats strip', () => {
    render(<App />);
    const strip = screen.getByRole('list', { name: /at a glance/i });
    expect(within(strip).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['8 checks', '3 languages', '0 files stored']);
  });
});

describe('scheme pack dialog', () => {
  it('opens from "Add a new scheme", lists every rule with AI/code, source and status, and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try sample applicant/i }));
    await user.click(await screen.findByRole('button', { name: /add a new scheme/i }));
    const dialog = await screen.findByRole('dialog', { name: /how a scheme pack works/i });
    const rows = within(dialog).getAllByRole('row');
    expect(rows).toHaveLength(9); // header + 8 rules
    expect(within(dialog).getAllByText(/Not evaluated \(/)).toHaveLength(6);
    expect(within(dialog).getAllByText('Verified, applied')).toHaveLength(2);
    expect(within(dialog).getAllByText('College notice').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Secondary source').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('AI reads, code decides').length).toBe(3);
    expect(within(dialog).getAllByRole('link').length).toBe(8);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('multi-scheme selection', () => {
  it('allows picking the SC scheme in live mode and updates categories', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /start my check/i }));
    const scCard = await screen.findByRole('button', { name: /Post-Matric Scholarship for SC students/i });
    expect(scCard).toHaveAttribute('aria-pressed', 'false');
    await user.click(scCard);
    expect(scCard).toHaveAttribute('aria-pressed', 'true');
    const catSelect = screen.getByLabelText('Category');
    expect(within(catSelect).getAllByRole('option').map((o) => o.textContent)).toEqual(['SC']);
  });

  it('locks other scheme cards in sample mode', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try sample applicant/i }));
    const scCard = await screen.findByRole('button', { name: /Post-Matric Scholarship for SC students/i });
    expect(scCard).toHaveAttribute('aria-disabled', 'true');
    expect(scCard).toHaveTextContent('Sample is OBC');
  });
});

describe('report preview and ready checklist', () => {
  it('shows a mini document with the problem field when an issue is opened', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toReady(user);
    const preview = screen.getByRole('group', { name: /preview of income certificate/i });
    expect(within(preview).getByText('income certificate')).toHaveClass('hl'); // the only document type found: the NCL page is missing
    await user.click(screen.getByRole('button', { name: /non-creamy layer certificate is missing/i }));
    expect(screen.queryByRole('group', { name: /preview of income certificate/i })).toBeNull();
  });

  it('opens a printable checklist dialog from the Ready screen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toReady(user);
    await user.click(screen.getByRole('button', { name: /re-check/i }));
    await user.click(await screen.findByRole('button', { name: /download checklist/i }));
    const dialog = await screen.findByRole('dialog', { name: /checklist for college desk/i });
    expect(within(dialog).getByText(/Readiness 100%/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /print or save as pdf/i })).toBeInTheDocument();
  });
});

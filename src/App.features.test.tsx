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
  await screen.findByRole('heading', { name: /things to fix/ });
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
    expect(within(dialog).getByText('Not verified, skipped')).toBeInTheDocument();
    expect(within(dialog).getAllByText('AI reads, code decides').length).toBe(3);
    expect(within(dialog).getAllByRole('link').length).toBe(8);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('report preview and ready checklist', () => {
  it('shows a mini document with the problem field when an issue is opened', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toReady(user);
    expect(screen.getByRole('group', { name: /preview of income certificate/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /name is spelled differently/i }));
    const marks = screen.getByRole('group', { name: /preview of marksheet/i });
    expect(within(marks).getAllByText('Arav Sunil Patil')[0]).toHaveClass('hl');
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

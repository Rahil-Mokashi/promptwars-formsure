import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, configure, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { GenerateRequest } from './services/extraction';
import { MARKSHEET_JSON, pdfFile } from './test/files';
import { clickRun } from './test/ui';

const hoisted = vi.hoisted(() => ({ generate: vi.fn<(req: GenerateRequest) => Promise<string>>() }));
vi.mock('./services/firebase', () => ({ createFirebaseGenerate: () => hoisted.generate, isLiveReadingAvailable: () => true }));
vi.mock('./services/rateLimiter', async (importOriginal) => ({ ...(await importOriginal<typeof import('./services/rateLimiter')>()), geminiLimiter: { acquire: async () => undefined } }));
vi.mock('./core/constants', async (importOriginal) => ({ ...(await importOriginal<typeof import('./core/constants')>()), READ_STAGGER_MS: 0 }));

beforeAll(() => {
  (globalThis as { __REDUCE_MOTION__?: boolean }).__REDUCE_MOTION__ = true;
  configure({ asyncUtilTimeout: 5000 });
});
afterEach(() => {
  hoisted.generate.mockReset();
  vi.restoreAllMocks();
});

async function toUpload(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /start my check/i }));
  await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
  await user.type(await screen.findByLabelText('Full name'), 'Aarav Sunil Patil');
  await user.type(screen.getByLabelText('Date of birth'), '2006-03-14');
}

describe('consent before live reading', () => {
  it('asks in the required words and keeps Run disabled until it is ticked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), pdfFile('a.pdf'));
    await screen.findByText('a.pdf');
    const box = screen.getByRole('checkbox', { name: 'Your documents are sent to Google Gemini via Firebase only to read them. Nothing is stored.' });
    expect(box).toHaveAccessibleDescription(/whole scan is sent, including your Aadhaar number and QR code/);
    expect(box).not.toBeChecked();
    expect(screen.getByRole('button', { name: /run formsure check/i })).toBeDisabled();
    await user.click(box);
    expect(screen.getByRole('button', { name: /run formsure check/i })).toBeEnabled();
  });

  it('is not shown for the sample applicant, and is cleared when starting over', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try sample applicant/i }));
    await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
    await screen.findByText('Upload your documents');
    expect(screen.queryByRole('checkbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: /formsure, back to start/i }));
    await user.click(await screen.findByRole('button', { name: /start my check/i }));
    await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
  });
});

describe('privacy: nothing is stored, nothing sensitive is logged', () => {
  it('a full live run writes nothing to localStorage, sessionStorage, IndexedDB or the Cache API', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    hoisted.generate.mockResolvedValue(MARKSHEET_JSON);
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), pdfFile('a.pdf'));
    await screen.findByText('a.pdf');
    await clickRun(user);
    await screen.findByRole('button', { name: /see readiness report/i });
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(typeof indexedDB).toBe('undefined'); // the app has no use for it, and jsdom has none to write to
    expect(typeof caches).toBe('undefined');
  });

  it('console output never contains names, numbers or raw provider messages', async () => {
    const user = userEvent.setup();
    const spies = (['error', 'warn', 'log', 'info', 'debug'] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => undefined));
    hoisted.generate.mockRejectedValue(Object.assign(new Error('internal failure for Aarav Sunil Patil 1234 5678 9012'), { status: 500 }));
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), pdfFile('1234 5678 9012.pdf'));
    await screen.findByText('XXXX XXXX 9012.pdf');
    await clickRun(user);
    await screen.findByRole('alert');
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).toMatch(/Gemini request failed/);
    expect(logged).not.toMatch(/Aarav|Patil|1234|5678|internal failure/);
    expect(document.body.textContent).not.toMatch(/1234 5678/);
  });

  it('page hide clears every file held in memory', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), pdfFile('a.pdf'));
    await screen.findByText('a.pdf');
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await waitFor(() => expect(screen.queryByText('a.pdf')).toBeNull(), { timeout: 10_000 });
  });
});

describe('browser storage use is confined to the limiter', () => {
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? sourceFiles(`${dir}/${e.name}`) : /\.(ts|tsx)$/.test(e.name) && !/\.test\.|test-setup|\/test\//.test(`${dir}/${e.name}`) ? [`${dir}/${e.name}`] : [],
    );

  it('no application file uses localStorage, IndexedDB or the Cache API, and only rateLimiter.ts uses sessionStorage', () => {
    const files = sourceFiles(resolve(__dirname));
    expect(files.length).toBeGreaterThan(30);
    for (const file of files) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, ''); // comments may mention storage
      expect(code, file).not.toMatch(/\blocalStorage\b|\bindexedDB\b|\bcaches\.(open|match)\b/);
      if (!file.replace(/\\/g, '/').endsWith('services/rateLimiter.ts')) expect(code, file).not.toMatch(/\bsessionStorage\b/);
    }
  });
});

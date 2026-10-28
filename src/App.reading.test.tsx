import { act, configure, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { Audit } from './screens/Audit';
import { pack } from './services/api';
import type { GenerateRequest } from './services/extraction';
import { MARKSHEET_JSON, pdfFile, tooManyRequests } from './test/files';
import { clickRun } from './test/ui';

// Firebase AI is mocked, and the 4 s gap between files is switched off for the test.
const hoisted = vi.hoisted(() => ({ generate: vi.fn<(req: GenerateRequest) => Promise<string>>() }));
vi.mock('./services/firebase', () => ({
  createFirebaseGenerate: () => hoisted.generate,
  isLiveReadingAvailable: () => true,
}));
// The shared 8-calls-a-minute limiter is covered in rateLimiter.test.ts; here it must not slow the tests down.
vi.mock('./services/rateLimiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/rateLimiter')>()),
  geminiLimiter: { acquire: () => Promise.resolve(undefined) },
}));
vi.mock('./core/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./core/constants')>()),
  READ_STAGGER_MS: 0,
}));

beforeAll(() => {
  (globalThis as { __REDUCE_MOTION__?: boolean }).__REDUCE_MOTION__ = true;
  configure({ asyncUtilTimeout: 5000 }); // the full suite runs many files in parallel
});
afterEach(() => {
  hoisted.generate.mockReset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;

async function chooseThreeAndRun(user: User) {
  await user.click(screen.getByRole('button', { name: /start my check/i }));
  await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
  await user.type(await screen.findByLabelText('Full name'), 'Aarav Sunil Patil');
  await user.type(screen.getByLabelText('Date of birth'), '2006-03-14');
  await user.upload(screen.getByLabelText(/Aadhaar card/), pdfFile('a-aadhaar.pdf'));
  await user.upload(screen.getByLabelText(/OBC caste certificate/), pdfFile('b-caste.pdf'));
  await user.upload(screen.getByLabelText(/Income certificate \+ non-creamy layer/), pdfFile('c-income.pdf'));
  await waitFor(() => {
    expect(screen.getAllByText('Uploaded')).toHaveLength(3);
  }); // file checks finish asynchronously
  await clickRun(user);
}

describe('live reading: two files at a time, with visible progress', () => {
  it('reads at most two files at once, starts the third when one finishes, and shows "Reading n of N…"', async () => {
    const user = userEvent.setup();
    let running = 0;
    let most = 0;
    const release: (() => void)[] = [];
    hoisted.generate.mockImplementation(async () => {
      most = Math.max(most, ++running);
      await new Promise<void>((resolve) => release.push(resolve));
      running--;
      return MARKSHEET_JSON;
    });
    render(<App />);
    await chooseThreeAndRun(user);

    await waitFor(() => {
      expect(release).toHaveLength(2);
    }); // two in flight; the third waits for a free slot
    expect(hoisted.generate).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Reading 2 of 3…')).toBeInTheDocument(); // the most recently started
    const bar = screen.getByRole('progressbar', { name: 'Documents read' });
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(bar).toHaveAttribute('aria-valuenow', '1');

    act(() => {
      release.shift()?.();
    }); // one finishes, so the third starts
    expect(await screen.findByText('Reading 3 of 3…')).toBeInTheDocument();
    await waitFor(() => {
      expect(release).toHaveLength(2);
    });
    act(() => {
      release.splice(0).forEach((r) => {
        r();
      });
    });

    expect(await screen.findByRole('button', { name: /see readiness report/i })).toBeInTheDocument();
    expect(hoisted.generate).toHaveBeenCalledTimes(3);
    expect(most).toBe(2);
  });

  it('shows "Gemini is busy, retrying in Ns…" after a 429, does not count it as a failure, then carries on', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    hoisted.generate.mockRejectedValueOnce(tooManyRequests()).mockResolvedValue(MARKSHEET_JSON);
    render(<App />);
    await chooseThreeAndRun(user);

    expect(await screen.findByText('Gemini is busy, retrying in 10s…')).toBeInTheDocument();
    expect(screen.getByText('Reading 1 of 3…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000);
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /see readiness report/i })).toBeInTheDocument());
    expect(hoisted.generate).toHaveBeenCalledTimes(4); // 1 rate-limited + 3 files
  });

  it('after the last backoff, says Gemini is busy, stops starting reads, and returns to the upload screen with a retry per failed file', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    hoisted.generate.mockRejectedValue(tooManyRequests());
    render(<App />);
    await chooseThreeAndRun(user);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(75_000); // 10 + 20 + 40 s
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Gemini is still busy.*Retry this file/);
    expect(hoisted.generate).toHaveBeenCalledTimes(8); // two reads in flight, each tried once and retried three times
    expect(screen.getAllByRole('button', { name: /retry this file/i })).toHaveLength(2); // the third file never started
  });
});

describe('"Retry this file"', () => {
  it('re-reads only the failed file; the others are not read again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    hoisted.generate
      .mockResolvedValueOnce(MARKSHEET_JSON) // aadhaar
      .mockResolvedValueOnce('not json') // caste: bad scan
      .mockResolvedValueOnce(MARKSHEET_JSON); // income
    render(<App />);
    await chooseThreeAndRun(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('1 file could not be read');
    expect(screen.getByText(/Could not read b-caste\.pdf/)).toBeInTheDocument();
    expect(hoisted.generate).toHaveBeenCalledTimes(3);

    hoisted.generate.mockResolvedValueOnce(MARKSHEET_JSON);
    await user.click(screen.getByRole('button', { name: /retry this file/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /retry this file/i })).toBeNull();
    });
    expect(hoisted.generate).toHaveBeenCalledTimes(4); // only the failed file

    // Running again reuses every cached document: no new Gemini calls.
    await clickRun(user);
    expect(await screen.findByRole('button', { name: /see readiness report/i })).toBeInTheDocument();
    expect(hoisted.generate).toHaveBeenCalledTimes(4);
  });

  it('shows the failure again, with a Retry button, when the retry also fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    hoisted.generate
      .mockResolvedValueOnce(MARKSHEET_JSON)
      .mockResolvedValueOnce('nope')
      .mockResolvedValueOnce(MARKSHEET_JSON)
      .mockResolvedValueOnce('still nope');
    render(<App />);
    await chooseThreeAndRun(user);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: /retry this file/i }));
    await waitFor(() => {
      expect(hoisted.generate).toHaveBeenCalledTimes(4);
    });
    expect(await screen.findByRole('button', { name: /retry this file/i })).toBeEnabled();
  });

  it('replacing a failed file clears its error and reads the new file next time', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    hoisted.generate
      .mockResolvedValueOnce(MARKSHEET_JSON)
      .mockResolvedValueOnce('nope')
      .mockResolvedValueOnce(MARKSHEET_JSON);
    render(<App />);
    await chooseThreeAndRun(user);
    await screen.findByRole('alert');
    await user.upload(screen.getByLabelText(/OBC caste certificate/), pdfFile('b-caste-v2.pdf'));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /retry this file/i })).toBeNull();
    }); // the file check is asynchronous
    hoisted.generate.mockResolvedValueOnce(MARKSHEET_JSON);
    await clickRun(user);
    expect(await screen.findByRole('button', { name: /see readiness report/i })).toBeInTheDocument();
    expect(hoisted.generate).toHaveBeenCalledTimes(4);
  });
});

describe('Audit screen while reading', () => {
  it('shows the file count, the busy countdown and a "Documents read" progress bar', () => {
    render(
      <Audit
        pack={pack}
        report={null}
        progress={{ index: 3, total: 7, slotId: 'income_certificate', detail: 'Gemini is busy, retrying in 10s…' }}
        docs={{}}
        fileNames={{}}
        sample={false}
        firstName="Aarav"
        onReport={() => undefined}
      />,
    );
    expect(screen.getByText('Reading 3 of 7…')).toBeInTheDocument();
    expect(screen.getByText('Gemini is busy, retrying in 10s…')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Documents read' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '7');
  });
});

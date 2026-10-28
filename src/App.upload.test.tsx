import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { mislabelledFile, pdfFile, pngFile } from './test/files';
import { clickRun } from './test/ui';
import { App } from './App';

beforeAll(() => {
  (globalThis as { __REDUCE_MOTION__?: boolean }).__REDUCE_MOTION__ = true;
});

vi.mock('./services/firebase', async (importOriginal) => ({ ...(await importOriginal<typeof import('./services/firebase')>()), isLiveReadingAvailable: () => true }));

// applyAccept:false lets us push a wrong file type through, as the "All files" picker option would.
const setup = () => userEvent.setup({ applyAccept: false });

async function toUpload(user: ReturnType<typeof setup>) {
  await user.click(screen.getByRole('button', { name: /start my check/i }));
  await user.click(await screen.findByRole('button', { name: /continue to upload/i }));
  await screen.findByLabelText('Full name');
}

describe('upload validation in the browser', () => {
  it('rejects a wrong file type with a clear message and stores nothing', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('notes.txt: use a PNG, JPG, WebP or PDF file.');
    expect(screen.queryByText('Uploaded')).toBeNull();
  });

  it('rejects a file over 5 MB', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/Aadhaar card/), big);
    expect(await screen.findByRole('alert')).toHaveTextContent('big.pdf: the file is larger than 5 MB.');
  });

  it('accepts png, jpg, webp and pdf, shows the file name, and clears the error', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), new File(['x'], 'bad.gif', { type: 'image/gif' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.upload(screen.getByLabelText(/Aadhaar card/), pngFile('aadhaar.png'));
    expect(await screen.findByText('aadhaar.png')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
  });

  it('keeps "Run FormSure check" disabled until name, date of birth and one file are present', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    const run = screen.getByRole('button', { name: /run formsure check/i });
    expect(run).toBeDisabled();
    await user.type(screen.getByLabelText('Full name'), 'Aarav Sunil Patil');
    await user.type(screen.getByLabelText('Date of birth'), '2006-03-14');
    expect(run).toBeDisabled();
    await user.upload(screen.getByLabelText(/Aadhaar card/), pdfFile('a.pdf'));
    await screen.findByText('a.pdf');
    expect(run).toBeDisabled(); // still no consent
    await user.click(screen.getByRole('checkbox', { name: /sent to Google Gemini via Firebase only to read them/ }));
    expect(run).toBeEnabled();
  });
});

describe('language toggle', () => {
  it('switches document names between languages and keeps aria-pressed in sync', async () => {
    const user = setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /start my check/i }));
    await screen.findByText('Which scholarship are you applying for?');
    expect(screen.getAllByText('Aadhaar card').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'मराठी' }));
    expect(screen.getByRole('button', { name: 'मराठी' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('mr');
    expect(screen.getByText('उत्पन्न व नॉन-क्रिमीलेयर प्रमाणपत्र', { selector: 'span' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'हिंदी' }));
    expect(document.documentElement.lang).toBe('hi');
    expect(screen.getByText('आय व नॉन-क्रीमी लेयर प्रमाणपत्र', { selector: 'span' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('keyboard navigation', () => {
  it('reaches "Try sample applicant" with Tab and activates it with Enter', async () => {
    const user = setup();
    render(<App />);
    for (let i = 0; i < 8 && !/try sample applicant/i.test(document.activeElement?.tagName === 'BUTTON' ? (document.activeElement.textContent ?? '') : ''); i++) await user.tab();
    expect(document.activeElement?.tagName).toBe('BUTTON');
    expect(document.activeElement).toHaveTextContent(/try sample applicant/i);
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Which scholarship are you applying for?')).toBeInTheDocument();
  });

  it('toggles a language with the Space key', async () => {
    const user = setup();
    render(<App />);
    for (let i = 0; i < 8 && !(document.activeElement?.tagName === 'BUTTON' && document.activeElement.textContent === 'हिंदी'); i++) await user.tab();
    expect(document.activeElement).toHaveTextContent('हिंदी');
    await user.keyboard(' ');
    expect(document.documentElement.lang).toBe('hi');
  });

  it('can reach every file input with the keyboard alone', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    const seen = new Set<Element>();
    for (let i = 0; i < 60; i++) {
      await user.tab();
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === 'file') seen.add(el);
    }
    expect(seen.size).toBe(7);
  });

  it('opens and closes the scheme-pack dialog from the keyboard and returns focus', async () => {
    const user = setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /start my check/i }));
    const opener = await screen.findByRole('button', { name: /add a new scheme/i });
    opener.focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe('upload security checks in the browser', () => {
  it('rejects a file whose content does not match its type (a PDF renamed .png)', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), mislabelledFile('scan.png'));
    expect(await screen.findByRole('alert')).toHaveTextContent('scan.png: the content does not match its file type.');
    expect(screen.queryByText('Uploaded')).toBeNull();
  });

  it('rejects a script renamed to .pdf', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), new File(['<script>alert(1)</script>'], 'evil.pdf', { type: 'application/pdf' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('evil.pdf: the content is not a PNG, JPG, WebP or PDF file.');
  });

  it('masks a 12-digit number in a file name, both in errors and on the card', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    await user.upload(screen.getByLabelText(/Aadhaar card/), new File(['x'], '1234 5678 9012.txt', { type: 'text/plain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('XXXX XXXX 9012.txt');
    await user.upload(screen.getByLabelText(/Aadhaar card/), pdfFile('1234 5678 9012.pdf'));
    expect(await screen.findByText('XXXX XXXX 9012.pdf')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('1234 5678');
  });
});

describe('form validation before a check runs', () => {
  async function fill(user: ReturnType<typeof setup>, name: string, dob: string) {
    await toUpload(user);
    await user.type(screen.getByLabelText('Full name'), name);
    await user.type(screen.getByLabelText('Date of birth'), dob);
    await user.upload(screen.getByLabelText(/Aadhaar card/), pdfFile('a.pdf'));
    await clickRun(user);
  }

  it('shows a message next to an invalid name and does not start the check', async () => {
    const user = setup();
    render(<App />);
    await fill(user, 'Aarav 123', '2006-03-14');
    const name = screen.getByLabelText('Full name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Use letters only, as on your documents.');
    expect(screen.getByRole('alert')).toHaveTextContent('Check the highlighted fields');
    expect(screen.getByRole('heading', { name: 'Upload your documents' })).toBeInTheDocument();
  });

  it('rejects a date of birth in the future', async () => {
    const user = setup();
    render(<App />);
    await fill(user, 'Aarav Patil', '2099-01-01');
    expect(screen.getByLabelText('Date of birth')).toHaveAccessibleDescription('The date of birth cannot be in the future.');
  });

  it('limits the name field to 100 characters', async () => {
    const user = setup();
    render(<App />);
    await toUpload(user);
    expect(screen.getByLabelText('Full name')).toHaveAttribute('maxlength', '100');
  });
});

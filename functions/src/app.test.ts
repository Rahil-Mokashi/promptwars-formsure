import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, maskAadhaar } from './app';
import type { Generate } from './gemini';

const NOW = new Date('2026-10-28T06:00:00Z');
const goodJson = JSON.stringify({
  documentTypes: ['marksheet'], language: 'en',
  applicantName: { original: 'Aarav Sunil Patil', english: 'Aarav Sunil Patil' },
  dateOfBirth: null, issueDate: '2026-04-02', issuingAuthority: 'Fictional University', category: null,
  annualIncome: null, pageCount: 1, legible: true,
});
const png = Buffer.from('89504e470d0a1a0a', 'hex');
const app = (generate?: Generate) => createApp({ generate, now: () => NOW });

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe('GET /api/health, /api/schemes, /api/sample', () => {
  it('reports whether Gemini is configured', async () => {
    expect((await request(app()).get('/api/health')).body).toEqual({ ok: true, geminiConfigured: false });
    process.env.GEMINI_API_KEY = 'test';
    expect((await request(app()).get('/api/health')).body).toEqual({ ok: true, geminiConfigured: true });
  });
  it('returns the scheme pack and 404 for an unknown one', async () => {
    const ok = await request(app()).get('/api/schemes/mahadbt-postmatric-obc');
    expect(ok.status).toBe(200);
    expect(ok.body.slots).toHaveLength(7);
    expect(ok.body.rules).toHaveLength(8);
    expect((await request(app()).get('/api/schemes/nope')).status).toBe(404);
  });
});

describe('POST /api/audit', () => {
  it('audits the sample: error documents 57, fixed documents 100', async () => {
    const sample = (await request(app()).get('/api/sample')).body;
    const post = (documents: unknown) =>
      request(app()).post('/api/audit').send({ schemeId: 'mahadbt-postmatric-obc', form: sample.form, documents });
    const bad = await post(sample.errorDocuments);
    expect(bad.status).toBe(200);
    expect([bad.body.readiness, bad.body.failed, bad.body.passed, bad.body.skipped]).toEqual([57, 3, 4, 1]);
    expect((await post(sample.fixedDocuments)).body.readiness).toBe(100);
  });

  it('rejects invalid bodies with a 400 and no stack trace', async () => {
    const res = await request(app()).post('/api/audit').send({ schemeId: 'x', form: { fullName: '' }, documents: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_request');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js):\d+/);
  });
  it('rejects malformed JSON and unknown slots', async () => {
    const bad = await request(app()).post('/api/audit').set('Content-Type', 'application/json').send('{nope');
    expect(bad.status).toBe(400);
    const sample = (await request(app()).get('/api/sample')).body;
    const slot = await request(app()).post('/api/audit').send({ schemeId: 'mahadbt-postmatric-obc', form: sample.form, documents: { passport: {} } });
    expect(slot.status).toBe(400);
  });
});

describe('POST /api/extract', () => {
  const send = (a: ReturnType<typeof app>, slot?: string, mime = 'image/png', buf = png) => {
    const r = request(a).post('/api/extract');
    if (slot) r.field('slot', slot);
    return r.attach('file', buf, { filename: 'a.png', contentType: mime });
  };

  it('returns 503 with a clear message when GEMINI_API_KEY is missing', async () => {
    const res = await send(app(), 'marksheet');
    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe('Live reading unavailable, try the sample applicant');
  });
  it('validates slot, file presence, type and size', async () => {
    expect((await send(app(async () => goodJson))).status).toBe(400); // no slot
    expect((await send(app(async () => goodJson), 'passport')).status).toBe(400);
    expect((await request(app(async () => goodJson)).post('/api/extract').field('slot', 'marksheet')).status).toBe(400); // no file
    expect((await send(app(async () => goodJson), 'marksheet', 'text/plain')).status).toBe(400); // filtered out
    const big = await send(app(async () => goodJson), 'marksheet', 'image/png', Buffer.alloc(5 * 1024 * 1024 + 1));
    expect(big.status).toBe(413);
  });
  it('returns the validated document', async () => {
    const res = await send(app(async () => goodJson), 'marksheet');
    expect(res.status).toBe(200);
    expect(res.body.document.applicantName.english).toBe('Aarav Sunil Patil');
  });

  it('retries once on bad JSON, then succeeds', async () => {
    const generate = vi.fn<Generate>().mockResolvedValueOnce('not json').mockResolvedValueOnce(goodJson);
    const res = await send(app(generate), 'marksheet');
    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('retries once on a timeout, then fails with a typed error', async () => {
    const generate = vi.fn<Generate>().mockRejectedValue(new Error('timeout'));
    const res = await send(app(generate), 'marksheet');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('extraction_failed');
  });
  it('fails after two schema-invalid answers', async () => {
    const generate = vi.fn<Generate>().mockResolvedValue('{"documentTypes":"x"}');
    expect((await send(app(generate), 'marksheet')).status).toBe(502);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('masks a 12-digit number in Gemini output', async () => {
    const leaky = JSON.stringify({ ...JSON.parse(goodJson), issuingAuthority: 'ID 1234 5678 9012 UIDAI' });
    const res = await send(app(async () => leaky), 'aadhaar');
    expect(res.text).toContain('XXXX XXXX 9012');
    expect(res.text).not.toContain('1234 5678');
  });
});

describe('maskAadhaar', () => {
  it('masks spaced, dashed and plain 12-digit numbers but not other numbers', () => {
    expect(maskAadhaar('1234 5678 9012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('1234-5678-9012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('{"a":"123456789012"}')).toBe('{"a":"XXXX XXXX 9012"}');
    expect(maskAadhaar('1234567890123')).toBe('1234567890123');
    expect(maskAadhaar('income 240000')).toBe('income 240000');
  });
});

describe('static app', () => {
  it('unknown API routes are JSON 404s', async () => {
    const res = await request(app()).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

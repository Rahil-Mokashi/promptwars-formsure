import { vi } from 'vitest';
import { runAudit } from '../../functions/src/rules/engine';
import { buildSample } from '../../functions/src/rules/sample';
import { mahadbtPack } from '../../functions/src/rules/schema';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Stubs fetch with the real rules engine and sample data; /api/extract answers 503 like a server without a key. */
export function mockApi() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/schemes/')) return json(mahadbtPack);
    if (url === '/api/sample') return json(buildSample(new Date()));
    if (url === '/api/audit') {
      const b = JSON.parse(String(init?.body));
      return json(runAudit(mahadbtPack, b.form, b.documents, new Date()));
    }
    if (url === '/api/extract') return json({ error: { code: 'gemini_unavailable', message: 'Live reading unavailable, try the sample applicant' } }, 503);
    return json({ error: { code: 'not_found', message: 'Not found' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

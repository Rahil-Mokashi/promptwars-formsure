import type { ApplicationForm, AuditReport, DocumentsBySlot, ExtractedDocument, SampleResponse, SchemePack, SlotId } from '../../shared/types';

export const SCHEME_ID = 'mahadbt-postmatric-obc';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, 'Could not reach FormSure. Check your connection.');
  }
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new ApiError(res.status, body?.error?.message ?? 'Something went wrong');
  return body as T;
}

export const getPack = () => call<SchemePack>(`/api/schemes/${SCHEME_ID}`);
export const getSample = () => call<SampleResponse>('/api/sample');

export const postAudit = (form: ApplicationForm, documents: DocumentsBySlot) =>
  call<AuditReport>('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schemeId: SCHEME_ID, form, documents }),
  });

export async function postExtract(slot: SlotId, file: File): Promise<ExtractedDocument> {
  const body = new FormData();
  body.append('slot', slot);
  body.append('file', file);
  return (await call<{ document: ExtractedDocument }>('/api/extract', { method: 'POST', body })).document;
}

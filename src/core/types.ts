// Types only (no runtime code): imported by both the Express app and the React app.

export type Lang = 'en' | 'mr' | 'hi';
export type Trio = Record<Lang, string>;

export type SlotId =
  | 'aadhaar'
  | 'caste_certificate'
  | 'income_certificate'
  | 'domicile'
  | 'bonafide'
  | 'marksheet'
  | 'bank_passbook';

export type DocumentType =
  | 'aadhaar'
  | 'caste_certificate'
  | 'income_certificate'
  | 'non_creamy_layer'
  | 'domicile_certificate'
  | 'bonafide_certificate'
  | 'marksheet'
  | 'bank_passbook'
  | 'other';

export interface ExtractedDocument {
  documentTypes: DocumentType[];
  language: 'en' | 'mr' | 'hi' | 'other';
  applicantName: { original: string; english: string } | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  issueDate: string | null; // YYYY-MM-DD
  issuingAuthority: string | null;
  category: string | null;
  annualIncome: number | null;
  pageCount: number;
  legible: boolean;
}

export interface ApplicationForm {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  category: string; // OBC | SBC | VJNT
  academicYear: string;
  applicationType: string;
}

export type DocumentsBySlot = Partial<Record<SlotId, ExtractedDocument>>;

export interface Source {
  label: string;
  url: string;
  kind: string;
}

export interface SlotDef {
  id: SlotId;
  short: string;
  label: Trio;
  accepts: DocumentType[];
}

export interface SchemePack {
  id: string;
  name: string;
  portal: string;
  slots: SlotDef[];
  rules: Record<string, unknown>[];
}

export type CheckStatus = 'pass' | 'fail' | 'skipped';

export interface Evidence {
  foundLabel: string;
  found: string;
  neededLabel: string;
  needed: string;
}

export interface Check {
  ruleId: string;
  label: string;
  status: CheckStatus;
  detail: string;
  evidence: Evidence | null;
  severity: 'critical' | 'warning';
  usesAi: boolean;
  why: Trio;
  fix: Trio;
  source: Source;
  issueTitle: string;
  issueDoc: string;
}

export interface AuditReport {
  readiness: number;
  checks: Check[];
  passed: number;
  failed: number;
  skipped: number;
}

export interface SampleResponse {
  form: ApplicationForm;
  errorDocuments: DocumentsBySlot;
  fixedDocuments: DocumentsBySlot;
  files: Record<SlotId, { name: string; size: string }>;
}

/** Live reading progress shown on the audit screen. */
export interface ReadProgress {
  /** 1-based position of the file being read. */
  index: number;
  total: number;
  slotId: SlotId;
  /** What is happening now: the file name, a pause, or a busy countdown. */
  detail: string;
}

/** What is going on with one slot's file while live reading. */
export interface SlotReadState {
  status: 'reading' | 'failed';
  /** Safe to show: why it failed, or the busy countdown. */
  message: string;
}

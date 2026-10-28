/** Languages the UI and the fixes are available in. */
export type Lang = 'en' | 'mr' | 'hi';

/** One text in each language. */
export type Trio = Record<Lang, string>;

/** The seven document slots of the scheme pack. */
export type SlotId =
  | 'aadhaar'
  | 'caste_certificate'
  | 'income_certificate'
  | 'domicile'
  | 'bonafide'
  | 'marksheet'
  | 'bank_passbook';

/** Kinds of document the model can recognise in a file. */
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

/** What the model read from one document. Every field may be missing; the rules decide what that means. */
export interface ExtractedDocument {
  documentTypes: DocumentType[];
  language: 'en' | 'mr' | 'hi' | 'other';
  applicantName: { original: string; english: string } | null;
  /** `YYYY-MM-DD`, a real calendar date, or null. */
  dateOfBirth: string | null;
  /** `YYYY-MM-DD`, a real calendar date, or null. */
  issueDate: string | null;
  issuingAuthority: string | null;
  category: string | null;
  annualIncome: number | null;
  pageCount: number;
  legible: boolean;
}

/** The details the applicant enters, as on the MahaDBT form. */
export interface ApplicationForm {
  fullName: string;
  /** `YYYY-MM-DD` */
  dateOfBirth: string;
  /** OBC, SBC or VJNT */
  category: string;
  academicYear: string;
  applicationType: string;
}

/** Documents read so far, keyed by slot. */
export type DocumentsBySlot = Partial<Record<SlotId, ExtractedDocument>>;

/** How trustworthy a rule's source is: an official page, a college notice, or a secondary guide or news item. */
export type SourceKind = 'official' | 'college-notice' | 'secondary';

/** Where a rule comes from. */
export interface Source {
  label: string;
  url: string;
  kind: SourceKind;
}

/** One document slot of a scheme pack. */
export interface SlotDef {
  id: SlotId;
  /** Short English name, for example "Marksheet". */
  short: string;
  label: Trio;
  /** Document types this slot accepts. */
  accepts: DocumentType[];
}

/** A scheme pack as the UI sees it. Rules are validated by Zod where the pack is loaded. */
export interface SchemePack {
  id: string;
  name: string;
  portal: string;
  /** Version of this pack file. */
  version: string;
  /** Academic year the pack's evidence applies to. */
  academicYear: string;
  /** Categories the applicant can choose for this scheme. */
  categories: string[];
  slots: SlotDef[];
  rules: Record<string, unknown>[];
}

/**
 * The one outcome model:
 * - `pass`: evaluated and satisfied
 * - `fail`: evaluated and not satisfied
 * - `needs_review`: could not be verified (missing, unreadable or ambiguous data); a person should check
 * - `not_evaluated`: the rule is not applied (unverified, conflicting sources, or not applicable)
 */
export type CheckStatus = 'pass' | 'fail' | 'needs_review' | 'not_evaluated';

/** What a check found, and what it needed, with the document and field they come from. */
export interface Evidence {
  /** The document the evidence comes from, for example "Marksheet". */
  document: string;
  /** The field read from it, for example "issueDate". */
  field: string;
  foundLabel: string;
  found: string;
  neededLabel: string;
  needed: string;
}

/** The result of one rule. */
export interface Check {
  ruleId: string;
  /** Version of the rule that produced this result. */
  ruleVersion: string;
  /** Academic year the rule's evidence applies to. */
  academicYear: string;
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

/** The whole report: readiness and every check. */
export interface AuditReport {
  /** `passed ÷ (passed + failed + needsReview) × 100`, rounded. 100 only when every evaluated rule passed. */
  readiness: number;
  checks: Check[];
  passed: number;
  failed: number;
  /** Checks that could not be verified and need a person. */
  needsReview: number;
  /** Rules that were not applied (unverified, conflicting sources, or not applicable). */
  notEvaluated: number;
}

/** The fictional sample applicant, with an error set and a fixed set of documents. */
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

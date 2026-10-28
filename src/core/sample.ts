import type { ApplicationForm, DocumentsBySlot, ExtractedDocument, SampleResponse } from './types';
import { fyStartYear, istDate } from './dates';

// Fictional applicant. Dates follow the current Indian financial year so the
// sample keeps behaving the same way as the calendar moves on.
const base = (over: Partial<ExtractedDocument>): ExtractedDocument => ({
  documentTypes: [],
  language: 'en',
  applicantName: { original: 'Aarav Sunil Patil', english: 'Aarav Sunil Patil' },
  dateOfBirth: null,
  issueDate: null,
  issuingAuthority: null,
  category: null,
  annualIncome: null,
  pageCount: 1,
  legible: true,
  ...over,
});

export function buildSample(now: Date): SampleResponse {
  const fy = fyStartYear(istDate(now));
  const form: ApplicationForm = {
    fullName: 'Aarav Sunil Patil',
    dateOfBirth: '2006-03-14',
    category: 'OBC',
    academicYear: `${fy}-${String(fy + 1).slice(2)}`,
    applicationType: 'Fresh',
  };

  const common: DocumentsBySlot = {
    aadhaar: base({ documentTypes: ['aadhaar'], dateOfBirth: '2006-03-14', issuingAuthority: 'UIDAI' }),
    caste_certificate: base({ documentTypes: ['caste_certificate'], category: 'OBC', issueDate: '2023-08-02', issuingAuthority: 'Tehsildar, Haveli' }),
    domicile: base({ documentTypes: ['domicile_certificate'], issueDate: '2023-08-02', issuingAuthority: 'Tehsildar, Haveli' }),
    bonafide: base({ documentTypes: ['bonafide_certificate'], issueDate: `${fy}-07-01`, issuingAuthority: 'Fictional College of Arts and Science' }),
    bank_passbook: base({ documentTypes: ['bank_passbook'], issuingAuthority: 'Fictional Bank' }),
  };
  const income = (over: Partial<ExtractedDocument>): ExtractedDocument =>
    base({
      documentTypes: ['income_certificate'],
      language: 'mr',
      applicantName: { original: 'आरव सुनील पाटील', english: 'Aarav Sunil Patil' },
      issuingAuthority: 'Tehsildar, Haveli',
      annualIncome: 240000,
      ...over,
    });

  const errorDocuments: DocumentsBySlot = {
    ...common,
    // Issued in the previous financial year, and no non-creamy layer page.
    income_certificate: income({ issueDate: `${fy - 1}-05-12` }),
    // Misspelt English name.
    marksheet: base({
      documentTypes: ['marksheet'],
      applicantName: { original: 'Arav Sunil Patil', english: 'Arav Sunil Patil' },
      issuingAuthority: 'Fictional University',
    }),
  };
  const fixedDocuments: DocumentsBySlot = {
    ...common,
    income_certificate: income({
      documentTypes: ['income_certificate', 'non_creamy_layer'],
      issueDate: `${fy}-04-02`,
      pageCount: 2,
    }),
    marksheet: base({ documentTypes: ['marksheet'], issuingAuthority: 'Fictional University' }),
  };

  return {
    form,
    errorDocuments,
    fixedDocuments,
    files: {
      aadhaar: { name: 'aarav_aadhaar.pdf', size: '92 KB' },
      caste_certificate: { name: 'aarav_caste.pdf', size: '148 KB' },
      income_certificate: { name: 'aarav_income.pdf', size: '1 page · 121 KB' },
      domicile: { name: 'aarav_domicile.pdf', size: '110 KB' },
      bonafide: { name: 'aarav_bonafide.pdf', size: '87 KB' },
      marksheet: { name: 'aarav_marksheet.pdf', size: '176 KB' },
      bank_passbook: { name: 'aarav_passbook.pdf', size: '64 KB' },
    },
  };
}

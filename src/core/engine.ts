import type {
  ApplicationForm,
  AuditReport,
  Check,
  DocumentsBySlot,
  DocumentType,
  Evidence,
  ExtractedDocument,
  SlotId,
} from './types';
import type { Pack, Rule } from './schema';

// ---- date helpers (all dates are YYYY-MM-DD strings, compared lexically) ----

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-05-12" -> "12 May 2025" */
export const longDate = (d: string): string => {
  const [y, m, day] = d.split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`;
};
/** "2025-05-12" -> "12/05/2025" */
export const slashDate = (d: string): string => d.split('-').reverse().join('/');

/** Calendar year in which the Indian financial year (1 Apr - 31 Mar) containing `date` starts. */
export const fyStartYear = (date: string): number => {
  const y = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 4 ? y : y - 1;
};
export const fyLabel = (startYear: number): string => `${startYear}-${String(startYear + 1).slice(2)}`;

/** Today's date in India (IST) as YYYY-MM-DD. */
export const istDate = (now: Date): string => new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

// ---- name helpers ----

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();
/** Phonetic key for English transliterations of Marathi/Hindi names. */
export const phonetic = (s: string): string =>
  norm(s).replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/w/g, 'v');

const DEV_DIGITS = '०१२३४५६७८९';
const toDevanagari = (s: string): string => s.replace(/\d/g, (d) => DEV_DIGITS[Number(d)] ?? d);
const LANG_NAME = { en: 'English', mr: 'Marathi', hi: 'Hindi', other: 'other language' } as const;
const DOC_NAME: Partial<Record<DocumentType, string>> = {
  income_certificate: 'income certificate',
  non_creamy_layer: 'non-creamy layer certificate',
};
const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---- engine ----

interface Outcome {
  status: Check['status'];
  detail: string;
  evidence?: Evidence;
}
type Ctx = {
  pack: Pack;
  form: ApplicationForm;
  docs: DocumentsBySlot;
  today: string;
};

const short = (ctx: Ctx, id: SlotId): string => ctx.pack.slots.find((s) => s.id === id)?.short ?? id;
const slotLabel = (ctx: Ctx, id: SlotId): string => ctx.pack.slots.find((s) => s.id === id)?.label.en ?? id;
const skipped = (detail: string): Outcome => ({ status: 'skipped', detail });
const notUploaded = (ctx: Ctx, id: SlotId): Outcome => skipped(`${short(ctx, id)} not uploaded`);

function evaluate(rule: Rule, ctx: Ctx): Outcome {
  switch (rule.type) {
    case 'required_document': {
      const missing = rule.slots.filter((s) => !ctx.docs[s]);
      if (missing.length === 0) return { status: 'pass', detail: `All ${rule.slots.length} documents uploaded` };
      return {
        status: 'fail',
        detail: `Missing: ${missing.map((s) => short(ctx, s)).join(', ')}`,
        evidence: {
          foundLabel: 'Found',
          found: `${rule.slots.length - missing.length} of ${rule.slots.length} documents uploaded`,
          neededLabel: 'Needed',
          needed: `All ${rule.slots.length} documents. Missing: ${missing.map((s) => slotLabel(ctx, s)).join(', ')}`,
        },
      };
    }

    case 'document_check': {
      const present = ctx.pack.slots.filter((s) => ctx.docs[s.id]);
      if (present.length === 0) return skipped('No documents to check');
      for (const slot of present) {
        const doc = ctx.docs[slot.id] as ExtractedDocument;
        if (!doc.legible) {
          return {
            status: 'fail',
            detail: `${slot.short} is not legible`,
            evidence: { foundLabel: slot.short, found: 'Not legible', neededLabel: 'Needed', needed: 'A clear, readable scan' },
          };
        }
        if (!doc.documentTypes.some((t) => slot.accepts.includes(t))) {
          return {
            status: 'fail',
            detail: `${slot.short} slot has the wrong file`,
            evidence: {
              foundLabel: 'Found in file',
              found: doc.documentTypes.join(', ').replace(/_/g, ' ') || 'unrecognised document',
              neededLabel: 'Needed',
              needed: slot.label.en,
            },
          };
        }
      }
      return { status: 'pass', detail: 'Each file matches its slot' };
    }

    case 'date_window': {
      const doc = ctx.docs[rule.slot];
      if (!doc) return notUploaded(ctx, rule.slot);
      const start = fyStartYear(ctx.today);
      const needed = `Issued in FY ${fyLabel(start)}, on or after 1 April ${start}`;
      if (!doc.issueDate) {
        return {
          status: 'fail',
          detail: 'Issue date not found',
          evidence: { foundLabel: 'Found on certificate', found: 'No issue date', neededLabel: 'Needed', needed },
        };
      }
      const inWindow = doc.issueDate >= `${start}-04-01` && doc.issueDate <= `${start + 1}-03-31`;
      const fy = fyLabel(fyStartYear(doc.issueDate));
      if (inWindow) return { status: 'pass', detail: `Issued ${longDate(doc.issueDate)}, FY ${fy}` };
      return {
        status: 'fail',
        detail: `Issued ${longDate(doc.issueDate)}, FY ${fy}`,
        evidence: {
          foundLabel: 'Found on certificate',
          found: `Issued ${slashDate(doc.issueDate)} (FY ${fy})`,
          neededLabel: 'Needed',
          needed,
        },
      };
    }

    case 'conditional': {
      if (!rule.when.in.includes(ctx.form.category)) return skipped(`Not required for ${ctx.form.category}`);
      const doc = ctx.docs[rule.slot];
      if (!doc) return notUploaded(ctx, rule.slot);
      const have = rule.mustContain.filter((t) => doc.documentTypes.includes(t));
      const missing = rule.mustContain.filter((t) => !doc.documentTypes.includes(t));
      if (missing.length === 0) return { status: 'pass', detail: 'Income and non-creamy layer both found' };
      const name = (t: DocumentType): string => DOC_NAME[t] ?? t.replace(/_/g, ' ');
      return {
        status: 'fail',
        detail: `${plural(doc.pageCount, 'page')} found, ${missing.map((t) => name(t).replace(' certificate', '') + ' page').join(', ')} missing`,
        evidence: {
          foundLabel: 'Found in file',
          found: `${plural(doc.pageCount, 'page')}: ${have.length ? have.map(name).join(' + ') + ' only' : 'no matching certificate'}`,
          neededLabel: 'Needed',
          needed: rule.needed,
        },
      };
    }

    case 'cross_document_match': {
      const formName = ctx.form.fullName;
      const compared = rule.slots.flatMap((slot) => {
        const doc = ctx.docs[slot];
        return doc?.applicantName ? [{ slot, doc, name: doc.applicantName }] : [];
      });
      if (compared.length === 0) return skipped('No names could be read');
      const matches = (c: (typeof compared)[number]): boolean =>
        c.doc.language === 'en'
          ? norm(c.name.english) === norm(formName)
          : phonetic(c.name.english) === phonetic(formName);
      const bad = compared.find((c) => !matches(c));
      if (!bad) return { status: 'pass', detail: `Name matches on ${compared.length} documents and the form` };

      const a = bad.name.english.trim().split(/\s+/);
      const b = formName.trim().split(/\s+/);
      const i = a.findIndex((w, k) => norm(w) !== norm(b[k] ?? ''));
      const [got, want] = a.length === b.length && i >= 0 ? [a[i] as string, b[i] as string] : [bad.name.english, formName];
      const good = compared.filter((c) => c !== bad && matches(c));
      const foreign = good.filter((c) => c.doc.language !== 'en');
      const refs = foreign.length ? foreign : good;
      const refLabel = (c: (typeof compared)[number]): string =>
        c.doc.language === 'en' ? short(ctx, c.slot) : `${short(ctx, c.slot)} (${LANG_NAME[c.doc.language]})`;
      const first = foreign[0];
      return {
        status: 'fail',
        detail: `${short(ctx, bad.slot)} says ${got}, not ${want}`,
        evidence: {
          foundLabel: short(ctx, bad.slot),
          found: bad.name.english,
          neededLabel: `${[...refs.map(refLabel), 'form'].join(', ').replace(/, ([^,]*)$/, ' and $1')}`,
          needed: first ? `${first.name.original} → ${first.name.english}` : formName,
        },
      };
    }

    case 'field_consistency': {
      const doc = ctx.docs[rule.slot];
      if (!doc) return notUploaded(ctx, rule.slot);
      const docVal = doc[rule.docField];
      if (!docVal) return skipped(`Not readable on ${short(ctx, rule.slot)}`);
      const formVal = ctx.form[rule.formField];
      const same = rule.format === 'date' ? docVal === formVal : docVal.trim().toUpperCase() === formVal.trim().toUpperCase();
      const show = (v: string): string => (rule.format === 'date' ? longDate(v) : v);
      if (same) return { status: 'pass', detail: `${show(docVal)} on both` };
      return {
        status: 'fail',
        detail: `Form says ${show(formVal)}, ${short(ctx, rule.slot)} says ${show(docVal)}`,
        evidence: { foundLabel: short(ctx, rule.slot), found: show(docVal), neededLabel: 'Form', needed: show(formVal) },
      };
    }

    case 'numeric_max': {
      const doc = ctx.docs[rule.slot];
      if (!doc) return notUploaded(ctx, rule.slot);
      const v = doc[rule.docField];
      if (v === null) return skipped(`Income not readable on ${short(ctx, rule.slot)}`);
      const inr = (n: number): string => `₹${n.toLocaleString('en-IN')}`;
      if (v <= rule.max) return { status: 'pass', detail: `${inr(v)} is within ${inr(rule.max)}` };
      return {
        status: 'fail',
        detail: `${inr(v)} is above ${inr(rule.max)}`,
        evidence: { foundLabel: 'Found on certificate', found: inr(v), neededLabel: 'Needed', needed: `Up to ${inr(rule.max)}` },
      };
    }
  }
}

export function runAudit(pack: Pack, form: ApplicationForm, documents: DocumentsBySlot, now: Date): AuditReport {
  const today = istDate(now);
  const year = String(fyStartYear(today));
  const ctx: Ctx = { pack, form, docs: documents, today };

  const checks: Check[] = pack.rules.map((rule) => {
    // Unverified rules are never applied.
    const out: Outcome = rule.verified ? evaluate(rule, ctx) : skipped('Rule not verified yet, skipped');
    const fill = (t: string, lang: 'en' | 'mr' | 'hi'): string => t.replace('{year}', lang === 'mr' ? toDevanagari(year) : year);
    return {
      ruleId: rule.id,
      label: rule.label,
      status: out.status,
      detail: out.detail,
      evidence: out.evidence ?? null,
      severity: rule.severity,
      usesAi: rule.usesAi,
      why: rule.why,
      fix: { en: fill(rule.fix.en, 'en'), mr: fill(rule.fix.mr, 'mr'), hi: fill(rule.fix.hi, 'hi') },
      source: rule.source,
      issueTitle: rule.issueTitle,
      issueDoc: rule.issueDoc,
    };
  });

  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const applied = passed + failed;
  return {
    readiness: applied === 0 ? 0 : Math.round((passed / applied) * 100),
    checks,
    passed,
    failed,
    skipped: checks.length - applied,
  };
}

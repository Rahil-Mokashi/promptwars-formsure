import { useMemo } from 'react';
import { APPLICATION_TYPES } from '../../core/formSchema';
import type { ApplicationForm, SchemePack } from '../../core/types';

const KNOWN_YEARS = ['2025-26', '2026-27'] as const;

/** Props of {@link ApplicationDetails}. */
export interface ApplicationDetailsProps {
  pack: SchemePack;
  form: ApplicationForm;
  onForm: (form: ApplicationForm) => void;
}

/** The category, academic year and application type pickers. */
export function ApplicationDetails({ pack, form, onForm }: ApplicationDetailsProps) {
  const years = useMemo(
    () => Array.from(new Set([form.academicYear, ...KNOWN_YEARS].filter(Boolean))),
    [form.academicYear],
  );
  const set = (key: keyof ApplicationForm) => (e: { target: { value: string } }) => {
    onForm({ ...form, [key]: e.target.value });
  };

  return (
    <section className="card panel" aria-labelledby="app-details">
      <p className="ptitle" id="app-details">
        Application details
      </p>
      <p className="pdesc">Use exactly what you entered on MahaDBT.</p>
      <div className="field">
        <label htmlFor="cat">Category</label>
        <select id="cat" value={form.category} onChange={set('category')}>
          {pack.categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="yr">Academic year</label>
        <select id="yr" value={form.academicYear} onChange={set('academicYear')}>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <small className="slotnote" style={{ display: 'block', marginTop: 4 }}>
          Evidence and rules are verified for AY {pack.academicYear}.
        </small>
      </div>
      <div className="field">
        <label htmlFor="typ">Application type</label>
        <select id="typ" value={form.applicationType} onChange={set('applicationType')}>
          {APPLICATION_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
    </section>
  );
}

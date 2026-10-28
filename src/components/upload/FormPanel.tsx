import { NAME_MAX_LENGTH } from '../../core/constants';
import type { ApplicationForm } from '../../core/types';
import type { FormErrors } from '../../hooks/useFlow';

/** `2006-03-14` becomes `14/03/2006`. */
const dayMonthYear = (iso: string): string => iso.split('-').reverse().join('/');

/** Props of {@link FormPanel}. */
export interface FormPanelProps {
  form: ApplicationForm;
  errors: FormErrors;
  /** Sample mode: the values are shown but cannot be edited. */
  readOnly: boolean;
  onForm: (form: ApplicationForm) => void;
}

/** "As entered on MahaDBT": the name and date of birth every document is compared with. */
export function FormPanel({ form, errors, readOnly, onForm }: FormPanelProps) {
  return (
    <section className="card panel" aria-labelledby="as-entered">
      <p className="ptitle" id="as-entered">
        As entered on MahaDBT
      </p>
      <p className="pdesc">FormSure compares these with every document.</p>
      <div className="field">
        <label htmlFor="nm">Full name</label>
        <input
          id="nm"
          value={form.fullName}
          readOnly={readOnly}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={!!errors.fullName}
          aria-describedby={errors.fullName ? 'nm-err' : undefined}
          onChange={(e) => {
            onForm({ ...form, fullName: e.target.value });
          }}
        />
        {errors.fullName && (
          <p className="fielderr" id="nm-err">
            {errors.fullName}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="dob">Date of birth</label>
        {readOnly ? (
          <input id="dob" value={dayMonthYear(form.dateOfBirth)} readOnly />
        ) : (
          <input
            id="dob"
            type="date"
            value={form.dateOfBirth}
            aria-invalid={!!errors.dateOfBirth}
            aria-describedby={errors.dateOfBirth ? 'dob-err' : undefined}
            onChange={(e) => {
              onForm({ ...form, dateOfBirth: e.target.value });
            }}
          />
        )}
        {errors.dateOfBirth && (
          <p className="fielderr" id="dob-err">
            {errors.dateOfBirth}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="cg">Category</label>
        <input id="cg" value={form.category} readOnly />
      </div>
    </section>
  );
}

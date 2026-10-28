import { motion } from 'framer-motion';
import { NAME_MAX_LENGTH } from '../core/constants';
import { maskAadhaar } from '../core/mask';
import type { FormErrors } from '../hooks/useFlow';
import type { ApplicationForm, Lang, SampleResponse, SchemePack, SlotId, SlotReadState } from '../core/types';
import { ArrowIcon, FileIcon, Tick } from '../icons';
import { fadeUp, useReduce } from '../motion';
import { slotNames } from '../names';

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dmy = (iso: string) => iso.split('-').reverse().join('/');

interface Props {
  pack: SchemePack | null;
  lang: Lang;
  sample: SampleResponse | null; // set in sample mode
  form: ApplicationForm;
  onForm: (f: ApplicationForm) => void;
  files: Partial<Record<SlotId, File>>;
  onFile: (slot: SlotId, file: File | undefined) => void;
  /** Per-slot reading / failed state from live reading. */
  slotStates: Partial<Record<SlotId, SlotReadState>>;
  /** True while a single-file retry runs (other retries wait). */
  retrying: boolean;
  onRetry: (slot: SlotId) => void;
  error: string | null;
  /** Messages for invalid form fields. */
  formErrors: FormErrors;
  /** A chosen file is still being checked. */
  validating: boolean;
  onBack: () => void;
  onRun: () => void;
}

export function Upload({ pack, lang, sample, form, onForm, files, onFile, slotStates, retrying, onRetry, error, formErrors, validating, onBack, onRun }: Props) {
  const reduce = useReduce();
  const canRun = !validating && (sample !== null || (form.fullName.trim() !== '' && form.dateOfBirth !== '' && Object.keys(files).length > 0));

  return (
    <main className="wrap page">
      <h2 className="h2">Upload your documents</h2>
      <p className="sub">
        One file per slot, exactly as you will upload it on MahaDBT.
        {sample && ' Sample applicant: Aarav Patil.'}
      </p>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
        <div className="slots" style={{ gridColumn: 'span 2' }}>
          {pack?.slots.map((slot, i) => {
            const n = slotNames(slot, lang);
            const file = files[slot.id];
            const state = slotStates[slot.id];
            const shown = sample ? sample.files[slot.id] : file ? { name: maskAadhaar(file.name), size: kb(file.size) } : null;
            return (
              <motion.div key={slot.id} className="card slot" {...fadeUp(reduce, 0.12 + i * 0.06)}>
                <div className="slottop">
                  <span className="dicon"><FileIcon size={16} /></span>
                  <div>
                    <div className="slotname">{n.name}</div>
                    <div className="mr dev" lang={n.subLang} style={{ fontSize: 12, color: '#5B6478' }}>{n.sub}</div>
                  </div>
                </div>
                <div className="file">
                  <span className="mono">{shown?.name ?? 'No file chosen'}</span>
                  <span>{shown?.size}</span>
                </div>
                {state && (
                  <p className="slotnote" role="status" data-failed={state.status === 'failed'}>{state.message}</p>
                )}
                {state?.status === 'failed' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onRetry(slot.id)} disabled={retrying}>Retry this file</button>
                )}
                {shown && !state && (
                  <span className="ok"><Tick reduce={reduce} />Uploaded</span>
                )}
                {!sample && (
                  <label className="btn btn-ghost btn-sm">
                    {file ? 'Replace file' : 'Choose file'}
                    <span className="sr-only"> for {slot.label.en}</span>
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={(e) => onFile(slot.id, e.target.files?.[0])}
                    />
                  </label>
                )}
              </motion.div>
            );
          })}
        </div>
        <section className="card panel" aria-labelledby="as-entered">
          <p className="ptitle" id="as-entered">As entered on MahaDBT</p>
          <p className="pdesc">FormSure compares these with every document.</p>
          <div className="field">
            <label htmlFor="nm">Full name</label>
            <input
              id="nm" value={form.fullName} readOnly={!!sample} maxLength={NAME_MAX_LENGTH} autoComplete="off"
              aria-invalid={!!formErrors.fullName} aria-describedby={formErrors.fullName ? 'nm-err' : undefined}
              onChange={(e) => onForm({ ...form, fullName: e.target.value })}
            />
            {formErrors.fullName && <p className="fielderr" id="nm-err">{formErrors.fullName}</p>}
          </div>
          <div className="field">
            <label htmlFor="dob">Date of birth</label>
            {sample ? (
              <input id="dob" value={dmy(form.dateOfBirth)} readOnly />
            ) : (
              <input
                id="dob" type="date" value={form.dateOfBirth} aria-invalid={!!formErrors.dateOfBirth}
                aria-describedby={formErrors.dateOfBirth ? 'dob-err' : undefined}
                onChange={(e) => onForm({ ...form, dateOfBirth: e.target.value })}
              />
            )}
            {formErrors.dateOfBirth && <p className="fielderr" id="dob-err">{formErrors.dateOfBirth}</p>}
          </div>
          <div className="field">
            <label htmlFor="cg">Category</label>
            <input id="cg" value={form.category} readOnly />
          </div>
        </section>
      </div>
      {error && <p className="errnote" role="alert">{error}</p>}
      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onRun} disabled={!canRun}>
          Run FormSure check<ArrowIcon />
        </button>
      </div>
    </main>
  );
}

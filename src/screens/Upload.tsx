import { ArrowIcon } from '../components/icons';
import { FormPanel } from '../components/upload/FormPanel';
import { SlotCard } from '../components/upload/SlotCard';
import type { ApplicationForm, Lang, SampleResponse, SchemePack, SlotId, SlotReadState } from '../core/types';
import { UNAVAILABLE_MESSAGE } from '../core/constants';
import type { FormErrors } from '../hooks/useFlow';

/** Props of {@link Upload}. */
export interface UploadProps {
  pack: SchemePack;
  lang: Lang;
  /** Set in sample mode: files are the sample's and nothing can be edited. */
  sample: SampleResponse | null;
  form: ApplicationForm;
  onForm: (form: ApplicationForm) => void;
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
  /** The applicant agreed to send documents to Gemini. */
  consent: boolean;
  onConsent: (consent: boolean) => void;
  /** Live reading is configured and allowed. */
  liveAvailable: boolean;
  onBack: () => void;
  onRun: () => void;
}

/** Third screen: one file per slot, the form details, and the button that starts the check. */
export function Upload(props: UploadProps) {
  const { pack, lang, sample, form, files, slotStates, retrying, error, formErrors, validating, consent, liveAvailable } = props;
  const ready = form.fullName.trim() !== '' && form.dateOfBirth !== '' && Object.keys(files).length > 0;
  const canRun = !validating && (sample !== null || (ready && liveAvailable && consent));

  return (
    <main className="wrap page" id="main" tabIndex={-1}>
      <h1 className="h2">Upload your documents</h1>
      <p className="sub">
        One file per slot, exactly as you will upload it on MahaDBT.
        {sample && ' Sample applicant: Aarav Patil.'}
      </p>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
        <div className="slots" style={{ gridColumn: 'span 2' }}>
          {pack.slots.map((slot, i) => (
            <SlotCard
              key={slot.id} slot={slot} index={i} lang={lang} file={files[slot.id]} sampleFile={sample?.files[slot.id]}
              state={slotStates[slot.id]} retrying={retrying}
              onFile={(file) => props.onFile(slot.id, file)} onRetry={() => props.onRetry(slot.id)}
            />
          ))}
        </div>
        <FormPanel form={form} errors={formErrors} readOnly={sample !== null} onForm={props.onForm} />
      </div>
      {!sample && liveAvailable && (
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => props.onConsent(e.target.checked)} />
          <span>Your documents are sent to Google Gemini via Firebase only to read them. Nothing is stored.</span>
        </label>
      )}
      {!sample && !liveAvailable && <p className="errnote" role="status">{UNAVAILABLE_MESSAGE}</p>}
      {error && <p className="errnote" role="alert">{error}</p>}
      <div className="actions">
        <button className="btn btn-ghost" onClick={props.onBack}>Back</button>
        <button className="btn btn-primary" onClick={props.onRun} disabled={!canRun}>
          Run FormSure check<ArrowIcon />
        </button>
      </div>
    </main>
  );
}

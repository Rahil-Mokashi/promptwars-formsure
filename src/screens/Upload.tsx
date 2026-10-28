import { ArrowIcon } from '../components/icons';
import { FormPanel } from '../components/upload/FormPanel';
import { SlotGrid } from '../components/upload/SlotGrid';
import { canRunCheck } from '../components/upload/uploadState';
import { UploadNotices } from '../components/upload/UploadNotices';
import type { ApplicationForm, Lang, SampleResponse, SchemePack, SlotId, SlotReadState } from '../core/types';
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
  const { pack, lang, sample, form, files, slotStates, retrying, formErrors } = props;
  const canRun = canRunCheck({
    validating: props.validating,
    isSample: sample !== null,
    form,
    fileCount: Object.keys(files).length,
    liveAvailable: props.liveAvailable,
    consent: props.consent,
  });

  return (
    <main className="wrap page" id="main" tabIndex={-1}>
      <h1 className="h2">Upload your documents</h1>
      <p className="sub">
        One file per slot, exactly as you will upload it on MahaDBT.
        {sample && ' Sample applicant: Aarav Patil.'}
      </p>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
        <SlotGrid
          pack={pack}
          lang={lang}
          sample={sample}
          files={files}
          slotStates={slotStates}
          retrying={retrying}
          onFile={props.onFile}
          onRetry={props.onRetry}
        />
        <FormPanel form={form} errors={formErrors} readOnly={sample !== null} onForm={props.onForm} />
      </div>
      <UploadNotices
        isSample={sample !== null}
        liveAvailable={props.liveAvailable}
        consent={props.consent}
        onConsent={props.onConsent}
        error={props.error}
      />
      <div className="actions">
        <button className="btn btn-ghost" onClick={props.onBack}>
          Back
        </button>
        <button className="btn btn-primary" onClick={props.onRun} disabled={!canRun}>
          Run FormSure check
          <ArrowIcon />
        </button>
      </div>
    </main>
  );
}

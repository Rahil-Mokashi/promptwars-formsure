import { useState } from 'react';
import { ArrowIcon } from '../components/icons';
import { ApplicationDetails } from '../components/scheme/ApplicationDetails';
import { PackDialog } from '../components/scheme/PackDialog';
import { RequiredDocs } from '../components/scheme/RequiredDocs';
import { SchemeCards } from '../components/scheme/SchemeCards';
import type { ApplicationForm, Lang, SchemePack } from '../core/types';

/** Props of {@link Scheme}. */
export interface SchemeProps {
  /** The chosen scheme pack. */
  pack: SchemePack;
  /** Every pack that can be chosen. */
  packs: readonly SchemePack[];
  /** Sample mode: the sample applicant is an OBC student, so the scheme cannot change. */
  sampleMode: boolean;
  onSelectPack: (packId: string) => void;
  lang: Lang;
  form: ApplicationForm;
  onForm: (form: ApplicationForm) => void;
  onBack: () => void;
  onNext: () => void;
}

/** Second screen: choose the scheme, confirm the application details, see the documents it needs. */
export function Scheme({ pack, packs, sampleMode, onSelectPack, lang, form, onForm, onBack, onNext }: SchemeProps) {
  const [packOpen, setPackOpen] = useState(false);

  return (
    <main className="wrap page" id="main" tabIndex={-1}>
      <h1 className="h2">Which scholarship are you applying for?</h1>
      <p className="sub">
        FormSure loads that scheme’s rules. MahaDBT is the first scheme pack; new forms are added as new packs.
      </p>
      <SchemeCards
        packs={packs}
        selectedId={pack.id}
        sampleMode={sampleMode}
        onSelect={onSelectPack}
        onOpenPack={() => {
          setPackOpen(true);
        }}
      />
      <div className="grid2">
        <ApplicationDetails pack={pack} form={form} onForm={onForm} />
        <RequiredDocs pack={pack} lang={lang} />
      </div>
      {packOpen && (
        <PackDialog
          packId={pack.id}
          onClose={() => {
            setPackOpen(false);
          }}
        />
      )}
      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          Continue to upload
          <ArrowIcon />
        </button>
      </div>
    </main>
  );
}

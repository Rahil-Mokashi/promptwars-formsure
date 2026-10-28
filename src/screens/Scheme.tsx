import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ArrowIcon, FileIcon } from '../components/icons';
import { fadeUp } from '../components/motionProps';
import { PackDialog } from '../components/scheme/PackDialog';
import { SchemeCards } from '../components/scheme/SchemeCards';
import { APPLICATION_TYPES } from '../core/formSchema';
import { slotNames } from '../core/slotNames';
import type { ApplicationForm, Lang, SchemePack } from '../core/types';
import { useReduce } from '../hooks/useMotion';

const LIST_DELAY_S = 0.12;
const LIST_STAGGER_S = 0.06;
const KNOWN_YEARS = ['2026-27', '2025-26'] as const;

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
  const reduce = useReduce();
  const [packOpen, setPackOpen] = useState(false);
  const years = useMemo(() => Array.from(new Set([form.academicYear, ...KNOWN_YEARS].filter(Boolean))), [form.academicYear]);
  const set = (key: keyof ApplicationForm) => (e: { target: { value: string } }) => onForm({ ...form, [key]: e.target.value });

  return (
    <main className="wrap page" id="main" tabIndex={-1}>
      <h1 className="h2">Which scholarship are you applying for?</h1>
      <p className="sub">FormSure loads that scheme’s rules. MahaDBT is the first scheme pack; new forms are added as new packs.</p>
      <SchemeCards packs={packs} selectedId={pack.id} sampleMode={sampleMode} onSelect={onSelectPack} onOpenPack={() => setPackOpen(true)} />
      <div className="grid2">
        <section className="card panel" aria-labelledby="app-details">
          <p className="ptitle" id="app-details">Application details</p>
          <p className="pdesc">Use exactly what you entered on MahaDBT.</p>
          <div className="field">
            <label htmlFor="cat">Category</label>
            <select id="cat" value={form.category} onChange={set('category')}>
              {pack.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="yr">Academic year</label>
            <select id="yr" value={form.academicYear} onChange={set('academicYear')}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="typ">Application type</label>
            <select id="typ" value={form.applicationType} onChange={set('applicationType')}>
              {APPLICATION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </section>
        <section className="card panel" aria-labelledby="req-docs">
          <p className="ptitle" id="req-docs">Documents this scheme needs</p>
          <p className="pdesc">{pack.slots.length} documents for {pack.name}</p>
          <ul className="doclist">
            {pack.slots.map((slot, i) => {
              const n = slotNames(slot, lang);
              return (
                <motion.li key={slot.id} {...fadeUp(reduce, LIST_DELAY_S + i * LIST_STAGGER_S)}>
                  <span className="dicon"><FileIcon size={16} /></span>
                  <span>
                    {n.name}
                    <span className="mr dev" lang={n.subLang}>{n.sub}</span>
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </section>
      </div>
      {packOpen && <PackDialog packId={pack.id} onClose={() => setPackOpen(false)} />}
      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext}>Continue to upload<ArrowIcon /></button>
      </div>
    </main>
  );
}

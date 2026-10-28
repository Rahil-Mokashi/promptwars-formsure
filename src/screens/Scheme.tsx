import { motion } from 'framer-motion';
import type { ApplicationForm, Lang, SchemePack } from '../core/types';
import { ArrowIcon, FileIcon } from '../icons';
import { fadeUp, useReduce } from '../motion';
import { slotNames } from '../names';

const SCHEMES = [
  { name: 'Post-Matric Scholarship for OBC students', portal: 'MahaDBT · VJNT, OBC & SBC Welfare', pill: 'Scheme pack ready', on: true },
  { name: 'Post-Matric Scholarship for VJNT students', portal: 'MahaDBT', pill: 'Coming soon', on: false },
  { name: 'Tuition and exam fees (Freeship)', portal: 'MahaDBT', pill: 'Coming soon', on: false },
  { name: 'Add a new scheme', portal: 'Pack builder: AI drafts rules from official guidelines, you verify', pill: 'Pack builder', on: false },
];

interface Props {
  pack: SchemePack | null;
  lang: Lang;
  form: ApplicationForm;
  onForm: (f: ApplicationForm) => void;
  onBack: () => void;
  onNext: () => void;
}

export function Scheme({ pack, lang, form, onForm, onBack, onNext }: Props) {
  const reduce = useReduce();
  const years = Array.from(new Set([form.academicYear, '2026-27', '2025-26'].filter(Boolean)));
  const set = (k: keyof ApplicationForm) => (e: { target: { value: string } }) => onForm({ ...form, [k]: e.target.value });

  return (
    <main className="wrap page">
      <h2 className="h2">Which scholarship are you applying for?</h2>
      <p className="sub">FormSure loads that scheme’s rules. MahaDBT is the first scheme pack; new forms are added as new packs.</p>
      <div className="schemes">
        {SCHEMES.map((s, i) => (
          <motion.button
            key={s.name}
            className={`scheme ${s.on ? 'sel' : 'off'}`}
            aria-pressed={s.on}
            aria-disabled={!s.on}
            {...fadeUp(reduce, i * 0.07)}
          >
            <span className="sname">{s.name}</span>
            <span className="sportal">{s.portal}</span>
            <span className={`pill ${s.on ? 'pill-on' : 'pill-off'}`}>{s.pill}</span>
          </motion.button>
        ))}
      </div>
      <div className="grid2">
        <section className="card panel" aria-labelledby="app-details">
          <p className="ptitle" id="app-details">Application details</p>
          <p className="pdesc">Use exactly what you entered on MahaDBT.</p>
          <div className="field">
            <label htmlFor="cat">Category</label>
            <select id="cat" value={form.category} onChange={set('category')}>
              <option>OBC</option>
              <option>SBC</option>
              <option>VJNT</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="yr">Academic year</label>
            <select id="yr" value={form.academicYear} onChange={set('academicYear')}>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="typ">Application type</label>
            <select id="typ" value={form.applicationType} onChange={set('applicationType')}>
              <option>Fresh</option>
              <option>Renewal</option>
            </select>
          </div>
        </section>
        <section className="card panel" aria-labelledby="req-docs">
          <p className="ptitle" id="req-docs">Documents this scheme needs</p>
          <p className="pdesc">{pack?.slots.length ?? 7} documents for Post-Matric Scholarship (OBC)</p>
          <ul className="doclist">
            {pack?.slots.map((slot, i) => {
              const n = slotNames(slot, lang);
              return (
                <motion.li key={slot.id} {...fadeUp(reduce, 0.12 + i * 0.06)}>
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
      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext}>
          Continue to upload<ArrowIcon />
        </button>
      </div>
    </main>
  );
}

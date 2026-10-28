import { motion } from 'framer-motion';
import { useState } from 'react';
import { mahadbtPack } from '../core/schema';
import type { ApplicationForm, Lang, SchemePack } from '../core/types';
import { ArrowIcon, FileIcon } from '../icons';
import { fadeUp, useReduce } from '../motion';
import { slotNames } from '../names';
import { Modal } from './Modal';

function PackDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How a scheme pack works" onClose={onClose}>
      <p className="sub" style={{ marginTop: 0, maxWidth: 'none' }}>
        A scheme pack is one JSON file of rules. The engine runs only rules marked verified; an AI-drafted rule stays skipped until a person checks it against the official source. Below is the pack that is live now: {mahadbtPack.name}.
      </p>
      <div className="tablewrap">
        <table className="packtable">
          <caption className="sr-only">Rules in the {mahadbtPack.name} pack</caption>
          <thead>
            <tr><th scope="col">Rule</th><th scope="col">Checked by</th><th scope="col">Source</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {mahadbtPack.rules.map((r) => (
              <tr key={r.id}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 600 }}>{r.label}</th>
                <td><span className={`tag ${r.usesAi ? 'tag-ai' : 'tag-code'}`}>{r.usesAi ? 'AI reads, code decides' : 'Code'}</span></td>
                <td><a href={r.source.url} target="_blank" rel="noopener noreferrer">{r.source.label}</a></td>
                <td><span className={`tag ${r.verified ? 'tag-ok' : 'tag-no'}`}>{r.verified ? 'Verified' : 'Not verified, skipped'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

const SCHEMES = [
  { name: 'Post-Matric Scholarship for OBC students', portal: 'MahaDBT · VJNT, OBC & SBC Welfare', pill: 'Scheme pack ready', on: true, opens: false },
  { name: 'Post-Matric Scholarship for VJNT students', portal: 'MahaDBT', pill: 'Coming soon', on: false, opens: false },
  { name: 'Tuition and exam fees (Freeship)', portal: 'MahaDBT', pill: 'Coming soon', on: false, opens: false },
  { name: 'Add a new scheme', portal: 'Pack builder: AI drafts rules from official guidelines, you verify', pill: 'Pack builder', on: false, opens: true },
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
  const [packOpen, setPackOpen] = useState(false);
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
            className={`scheme ${s.on ? 'sel' : s.opens ? '' : 'off'}`}
            aria-pressed={s.on}
            aria-disabled={!s.on && !s.opens}
            aria-haspopup={s.opens ? 'dialog' : undefined}
            onClick={s.opens ? () => setPackOpen(true) : undefined}
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
      {packOpen && <PackDialog onClose={() => setPackOpen(false)} />}
      <div className="actions">
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onNext}>
          Continue to upload<ArrowIcon />
        </button>
      </div>
    </main>
  );
}

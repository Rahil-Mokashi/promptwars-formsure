import { motion } from 'framer-motion';
import { useReduce } from '../../hooks/useMotion';
import { fadeUp } from '../motionProps';

const STAGGER_S = 0.07;

interface SchemeDef {
  name: string;
  portal: string;
  pill: string;
  /** The scheme pack exists and is selected. */
  on: boolean;
  /** Clicking opens the "how packs work" dialog. */
  opens: boolean;
}

const SCHEMES: readonly SchemeDef[] = [
  { name: 'Post-Matric Scholarship for OBC students', portal: 'MahaDBT · VJNT, OBC & SBC Welfare', pill: 'Scheme pack ready', on: true, opens: false },
  { name: 'Post-Matric Scholarship for VJNT students', portal: 'MahaDBT', pill: 'Coming soon', on: false, opens: false },
  { name: 'Tuition and exam fees (Freeship)', portal: 'MahaDBT', pill: 'Coming soon', on: false, opens: false },
  { name: 'Add a new scheme', portal: 'Pack builder: AI drafts rules from official guidelines, you verify', pill: 'Pack builder', on: false, opens: true },
];

/** The four scheme cards. Only the OBC pack is live; the last card opens the pack dialog. */
export function SchemeCards({ onOpenPack }: { onOpenPack: () => void }) {
  const reduce = useReduce();
  return (
    <div className="schemes">
      {SCHEMES.map((s, i) => (
        <motion.button
          key={s.name}
          className={`scheme ${s.on ? 'sel' : s.opens ? '' : 'off'}`}
          aria-pressed={s.on}
          aria-disabled={!s.on && !s.opens}
          aria-haspopup={s.opens ? 'dialog' : undefined}
          onClick={s.opens ? onOpenPack : undefined}
          {...fadeUp(reduce, i * STAGGER_S)}
        >
          <span className="sname">{s.name}</span>
          <span className="sportal">{s.portal}</span>
          <span className={`pill ${s.on ? 'pill-on' : 'pill-off'}`}>{s.pill}</span>
        </motion.button>
      ))}
    </div>
  );
}

import { m } from 'framer-motion';
import type { SchemePack } from '../../core/types';
import { useReduce } from '../../hooks/useMotion';
import { fadeUp } from '../motionProps';

const STAGGER_S = 0.07;

interface CardDef {
  key: string;
  name: string;
  portal: string;
  pill: string;
  /** Id of the scheme pack this card selects, or null for a card that is not a pack. */
  packId: string | null;
  /** Clicking opens the "how packs work" dialog. */
  opens: boolean;
}

/** The scheme cards after the live packs: the same "coming soon" and pack-builder cards as the design. */
const OTHER_CARDS: readonly CardDef[] = [
  { key: 'vjnt', name: 'Post-Matric Scholarship for VJNT students', portal: 'MahaDBT', pill: 'Coming soon', packId: null, opens: false },
  { key: 'freeship', name: 'Tuition and exam fees (Freeship)', portal: 'MahaDBT', pill: 'Coming soon', packId: null, opens: false },
  { key: 'add', name: 'Add a new scheme', portal: 'Pack builder: AI drafts rules from official guidelines, you verify', pill: 'Pack builder', packId: null, opens: true },
];

/** Props of {@link SchemeCards}. */
export interface SchemeCardsProps {
  packs: readonly SchemePack[];
  selectedId: string;
  /** Sample mode: the sample applicant is an OBC student, so other schemes cannot be chosen. */
  sampleMode: boolean;
  onSelect: (packId: string) => void;
  onOpenPack: () => void;
}

/** The scheme cards: every shipped pack is selectable; the rest are "coming soon" or open the pack dialog. */
export function SchemeCards({ packs, selectedId, sampleMode, onSelect, onOpenPack }: SchemeCardsProps) {
  const reduce = useReduce();
  const cards: CardDef[] = [
    ...packs.map((p) => ({ key: p.id, name: p.name, portal: p.portal, pill: 'Scheme pack ready', packId: p.id, opens: false })),
    ...OTHER_CARDS,
  ];

  return (
    <div className="schemes">
      {cards.map((card, i) => {
        const selected = card.packId === selectedId;
        const locked = card.packId !== null && !selected && sampleMode;
        const live = card.packId !== null && !locked;
        return (
          <m.button
            key={card.key}
            className={`scheme ${selected ? 'sel' : live || card.opens ? '' : 'off'}`}
            aria-pressed={card.packId !== null ? selected : false}
            aria-disabled={!live && !card.opens}
            aria-haspopup={card.opens ? 'dialog' : undefined}
            title={locked ? 'The sample applicant is an OBC student. Choose "Start my check" to pick another scheme.' : undefined}
            onClick={card.opens ? onOpenPack : live && card.packId ? () => onSelect(card.packId as string) : undefined}
            {...fadeUp(reduce, i * STAGGER_S)}
          >
            <span className="sname">{card.name}</span>
            <span className="sportal">{card.portal}</span>
            <span className={`pill ${card.packId !== null ? 'pill-on' : 'pill-off'}`}>{locked ? 'Sample is OBC' : card.pill}</span>
          </m.button>
        );
      })}
    </div>
  );
}

import type { DocumentsBySlot, SlotDef } from '../../core/types';

/** Props of {@link ThumbStrip}. */
export interface ThumbStripProps {
  slots: readonly SlotDef[];
  docs: DocumentsBySlot;
  /** The slot being scanned. */
  index: number;
  /** Every check is revealed, so every thumbnail counts as done. */
  allDone: boolean;
}

const stateOf = (i: number, index: number, allDone: boolean): string => {
  if (i === index) return 'on';
  return i < index || allDone ? 'done' : '';
};

/** One small thumbnail per document slot; decorative, the scan is announced separately. */
export function ThumbStrip({ slots, docs, index, allDone }: ThumbStripProps) {
  return (
    <ul className="thumbs" aria-hidden="true">
      {slots.map((s, i) => (
        <li key={s.id} className={`thumb ${stateOf(i, index, allDone)} ${docs[s.id] ? '' : 'absent'}`}>
          <i />
          <i />
          <i />
        </li>
      ))}
    </ul>
  );
}

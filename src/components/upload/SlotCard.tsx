import { m } from 'framer-motion';
import { slotNames } from '../../core/slotNames';
import type { Lang, SlotDef, SlotReadState } from '../../core/types';
import { useReduce } from '../../hooks/useMotion';
import { FileIcon } from '../icons';
import { fadeUp } from '../motionProps';
import { shownFile, type ShownFile } from './slotFile';
import { SlotStatus } from './SlotStatus';

const STAGGER_DELAY_S = 0.12;
const STAGGER_STEP_S = 0.06;
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';

/** Props of {@link SlotCard}. */
export interface SlotCardProps {
  slot: SlotDef;
  index: number;
  lang: Lang;
  /** The chosen file (live mode). */
  file: File | undefined;
  /** The sample's file info (sample mode); when set the card is read-only. */
  sampleFile: ShownFile | undefined;
  state: SlotReadState | undefined;
  retrying: boolean;
  onFile: (file: File | undefined) => void;
  onRetry: () => void;
}

/** The keyboard-operable file input, shown as a button. */
function FilePicker({ slot, hasFile, onFile }: { slot: SlotDef; hasFile: boolean; onFile: SlotCardProps['onFile'] }) {
  return (
    <label className="btn btn-ghost btn-sm">
      {hasFile ? 'Replace file' : 'Choose file'}
      <span className="sr-only"> for {slot.label.en}</span>
      <input
        className="sr-only"
        type="file"
        accept={ACCEPT}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
        }}
      />
    </label>
  );
}

/** One document slot: its name, the file chosen, reading state, and the file input (not in sample mode). */
export function SlotCard({ slot, index, lang, file, sampleFile, state, retrying, onFile, onRetry }: SlotCardProps) {
  const reduce = useReduce();
  const n = slotNames(slot, lang);
  const shown = shownFile(sampleFile, file);

  return (
    <m.div className="card slot" {...fadeUp(reduce, STAGGER_DELAY_S + index * STAGGER_STEP_S)}>
      <div className="slottop">
        <span className="dicon">
          <FileIcon size={16} />
        </span>
        <div>
          <div className="slotname">{n.name}</div>
          <div className="mr dev" lang={n.subLang} style={{ fontSize: 12, color: '#5B6478' }}>
            {n.sub}
          </div>
        </div>
      </div>
      <div className="file">
        <span className="mono">{shown?.name ?? 'No file chosen'}</span>
        <span>{shown?.size}</span>
      </div>
      <SlotStatus state={state} hasFile={shown !== null} retrying={retrying} reduce={reduce} onRetry={onRetry} />
      {sampleFile === undefined && <FilePicker slot={slot} hasFile={file !== undefined} onFile={onFile} />}
    </m.div>
  );
}

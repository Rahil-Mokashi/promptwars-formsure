import { m } from 'framer-motion';
import { maskAadhaar } from '../../core/mask';
import { slotNames } from '../../core/slotNames';
import type { Lang, SlotDef, SlotReadState } from '../../core/types';
import { useReduce } from '../../hooks/useMotion';
import { FileIcon, Tick } from '../icons';
import { fadeUp } from '../motionProps';

const BYTES_PER_KB = 1024;
const STAGGER_DELAY_S = 0.12;
const STAGGER_STEP_S = 0.06;

const sizeLabel = (bytes: number): string =>
  bytes >= BYTES_PER_KB * BYTES_PER_KB ? `${(bytes / BYTES_PER_KB / BYTES_PER_KB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;

/** Props of {@link SlotCard}. */
export interface SlotCardProps {
  slot: SlotDef;
  index: number;
  lang: Lang;
  /** The chosen file (live mode). */
  file: File | undefined;
  /** The sample's file info (sample mode); when set the card is read-only. */
  sampleFile: { name: string; size: string } | undefined;
  state: SlotReadState | undefined;
  retrying: boolean;
  onFile: (file: File | undefined) => void;
  onRetry: () => void;
}

/** One document slot: its name, the file chosen, reading state, and the keyboard-operable file input. */
export function SlotCard({ slot, index, lang, file, sampleFile, state, retrying, onFile, onRetry }: SlotCardProps) {
  const reduce = useReduce();
  const n = slotNames(slot, lang);
  const readOnly = sampleFile !== undefined;
  const shown = sampleFile ?? (file ? { name: maskAadhaar(file.name), size: sizeLabel(file.size) } : null);

  return (
    <m.div className="card slot" {...fadeUp(reduce, STAGGER_DELAY_S + index * STAGGER_STEP_S)}>
      <div className="slottop">
        <span className="dicon"><FileIcon size={16} /></span>
        <div>
          <div className="slotname">{n.name}</div>
          <div className="mr dev" lang={n.subLang} style={{ fontSize: 12, color: '#5B6478' }}>{n.sub}</div>
        </div>
      </div>
      <div className="file">
        <span className="mono">{shown?.name ?? 'No file chosen'}</span>
        <span>{shown?.size}</span>
      </div>
      {state && <p className="slotnote" role="status" data-failed={state.status === 'failed'}>{state.message}</p>}
      {state?.status === 'failed' && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry} disabled={retrying}>Retry this file</button>
      )}
      {shown && !state && <span className="ok"><Tick reduce={reduce} />Uploaded</span>}
      {!readOnly && (
        <label className="btn btn-ghost btn-sm">
          {file ? 'Replace file' : 'Choose file'}
          <span className="sr-only"> for {slot.label.en}</span>
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      )}
    </m.div>
  );
}

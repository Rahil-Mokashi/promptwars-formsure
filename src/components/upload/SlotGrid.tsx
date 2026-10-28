import type { Lang, SampleResponse, SchemePack, SlotId, SlotReadState } from '../../core/types';
import { SlotCard } from './SlotCard';

/** Props of {@link SlotGrid}. */
export interface SlotGridProps {
  pack: SchemePack;
  lang: Lang;
  sample: SampleResponse | null;
  files: Partial<Record<SlotId, File>>;
  slotStates: Partial<Record<SlotId, SlotReadState>>;
  retrying: boolean;
  onFile: (slot: SlotId, file: File | undefined) => void;
  onRetry: (slot: SlotId) => void;
}

/** One card per document slot of the chosen scheme. */
export function SlotGrid({ pack, lang, sample, files, slotStates, retrying, onFile, onRetry }: SlotGridProps) {
  return (
    <div className="slots" style={{ gridColumn: 'span 2' }}>
      {pack.slots.map((slot, i) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          index={i}
          lang={lang}
          file={files[slot.id]}
          sampleFile={sample?.files[slot.id]}
          state={slotStates[slot.id]}
          retrying={retrying}
          onFile={(file) => {
            onFile(slot.id, file);
          }}
          onRetry={() => {
            onRetry(slot.id);
          }}
        />
      ))}
    </div>
  );
}

import type { SlotReadState } from '../../core/types';
import { Tick } from '../icons';

/** Props of {@link SlotStatus}. */
export interface SlotStatusProps {
  /** Reading or failed state, from live reading. */
  state: SlotReadState | undefined;
  /** A file is chosen (or it is the sample's). */
  hasFile: boolean;
  retrying: boolean;
  reduce: boolean;
  onRetry: () => void;
}

/** What is going on with a slot's file: a status line, a "Retry this file" button after a failure, or "Uploaded". */
export function SlotStatus({ state, hasFile, retrying, reduce, onRetry }: SlotStatusProps) {
  if (state) {
    return (
      <>
        <p className="slotnote" role="status" data-failed={state.status === 'failed'}>
          {state.message}
        </p>
        {state.status === 'failed' && (
          <button className="btn btn-ghost btn-sm" onClick={onRetry} disabled={retrying}>
            Retry this file
          </button>
        )}
      </>
    );
  }
  if (!hasFile) return null;
  return (
    <span className="ok">
      <Tick reduce={reduce} />
      Uploaded
    </span>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { omit } from '../core/object';
import type { SlotId, SlotReadState } from '../core/types';

/** Per-slot reading / failed state. */
export type SlotStates = Partial<Record<SlotId, SlotReadState>>;

/** Sets (or, with undefined, clears) the state of one slot. */
export type SlotSetter = (slotId: SlotId, state: SlotReadState | undefined) => void;

/** The per-slot reading states, with a setter for one slot (undefined clears it) and a way to clear all. */
export function useSlotStates() {
  const [slotStates, setSlotStates] = useState<SlotStates>({});
  const setSlot = useCallback<SlotSetter>((slotId, state) => {
    setSlotStates((prev) => {
      const rest = omit(prev, slotId);
      return state ? { ...rest, [slotId]: state } : rest;
    });
  }, []);
  const clearSlots = useCallback(() => {
    setSlotStates({});
  }, []);
  const retrying = useMemo(() => Object.values(slotStates).some((s) => s.status === 'reading'), [slotStates]);
  return { slotStates, setSlot, clearSlots, retrying };
}

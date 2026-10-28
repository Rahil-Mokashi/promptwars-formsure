import { useCallback, useState, type Dispatch } from 'react';
import { batchProblem } from '../core/fileValidation';
import type { SlotId } from '../core/types';
import { prepareUpload } from '../services/uploadPipeline';
import type { FlowAction } from './flowReducer';

/**
 * Checks and cleans a chosen file before it is kept (size, type, magic bytes), and counts the files still being checked.
 * @param invalidate forgets what was read from the slot's previous file
 */
export function useFileIntake(
  files: Partial<Record<SlotId, File>>,
  invalidate: (slotId: SlotId) => void,
  dispatch: Dispatch<FlowAction>,
) {
  const [checking, setChecking] = useState(0);

  const onFile = useCallback(
    async (slotId: SlotId, file: File | undefined) => {
      if (!file) {
        invalidate(slotId);
        dispatch({ type: 'SET_FILE', slotId, file: undefined });
        return;
      }
      setChecking((n) => n + 1);
      try {
        const others = Object.entries(files)
          .filter(([id]) => id !== slotId)
          .map(([, f]) => f.size);
        const batch = batchProblem([...others, file.size]);
        const prepared = batch ? { error: batch } : await prepareUpload(file);
        if (!prepared.file) {
          dispatch({ type: 'FILE_REJECTED', message: prepared.error });
          return;
        }
        invalidate(slotId);
        dispatch({ type: 'SET_FILE', slotId, file: prepared.file });
      } finally {
        setChecking((n) => n - 1);
      }
    },
    [files, invalidate, dispatch],
  );

  return { onFile, validating: checking > 0 };
}

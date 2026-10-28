import { motion } from 'framer-motion';
import type { Preview } from '../../core/preview';

const FLASH_S = 1;

/** A mini document with the problem field highlighted, shown beside the evidence of an issue. */
export function MiniDoc({ preview, reduce }: { preview: Preview; reduce: boolean }) {
  return (
    <div className="minidoc" aria-label={`Preview of ${preview.slot.short}`} role="group">
      <div className="docbar"><span className="docsample">PREVIEW</span></div>
      <p className="doctitle">{preview.slot.short}</p>
      {preview.rows.map((row) => (
        <div className="minirow" key={row.label}>
          <span>{row.label}</span>
          {row.hl ? (
            <motion.span className="hl" {...(reduce ? {} : { initial: { backgroundColor: '#FCD34D' }, animate: { backgroundColor: '#FEF3C7' }, transition: { duration: FLASH_S } })}>
              {row.value}
            </motion.span>
          ) : (
            <span>{row.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

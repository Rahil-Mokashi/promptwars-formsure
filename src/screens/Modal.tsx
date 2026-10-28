import { motion } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useReduce } from '../motion';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  printable?: boolean;
}

/** Accessible modal: labelled dialog, Escape closes, Tab stays inside, focus returns to the opener. */
export function Modal({ title, onClose, children, printable }: Props) {
  const reduce = useReduce();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close.current();
      if (e.key !== 'Tab' || !box.current) return;
      const f = box.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,[tabindex]:not([tabindex="-1"])');
      const first = f[0];
      const last = f[f.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        ref={box}
        className={`modal ${printable ? 'printable' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(reduce ? {} : { initial: { opacity: 0, y: 18, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.25 } })}
      >
        <div className="modalhead noprint">
          <h2 id={titleId}>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

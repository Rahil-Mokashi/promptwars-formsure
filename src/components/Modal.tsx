import { motion } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useReduce } from '../hooks/useMotion';

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,[tabindex]:not([tabindex="-1"])';
const OPEN_S = 0.25;
const OPEN_RISE_PX = 18;
const OPEN_SCALE_FROM = 0.98;

/** Props of {@link Modal}. */
export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Print only this dialog (used by the checklist). */
  printable?: boolean;
}

/** Keeps Tab inside `box`: wraps from the last control to the first and back. */
function trapTab(event: KeyboardEvent, box: HTMLElement): void {
  const controls = box.querySelectorAll<HTMLElement>(FOCUSABLE);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/** Accessible modal: labelled dialog, Escape closes, Tab stays inside, focus returns to the opener. */
export function Modal({ title, onClose, children, printable }: ModalProps) {
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return close.current();
      if (event.key === 'Tab' && box.current) trapTab(event, box.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  const entrance = reduce
    ? {}
    : { initial: { opacity: 0, y: OPEN_RISE_PX, scale: OPEN_SCALE_FROM }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: OPEN_S } };

  return (
    <div className="overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div ref={box} className={`modal ${printable ? 'printable' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} {...entrance}>
        <div className="modalhead noprint">
          <h2 id={titleId}>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

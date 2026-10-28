import { m } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { useReduce } from '../hooks/useMotion';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
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

/**
 * Marks every sibling of `overlay` and of each of its ancestors as `inert` and returns them, so they can be restored.
 * Elements that were already inert are left alone.
 */
function inertBackground(overlay: HTMLElement | null): HTMLElement[] {
  const marked: HTMLElement[] = [];
  for (let node = overlay; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node && sibling instanceof HTMLElement && !sibling.hasAttribute('inert')) {
        sibling.setAttribute('inert', '');
        marked.push(sibling);
      }
    }
  }
  return marked;
}

/**
 * While the dialog is open: focus moves into it, the background is inert, Escape closes, Tab stays inside,
 * and on close focus returns to the element that opened it.
 */
function useDialogFocus(box: RefObject<HTMLDivElement | null>, onClose: () => void): void {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Everything behind the dialog becomes inert, so neither keyboard nor screen reader can reach it.
    const background = inertBackground(box.current?.parentElement ?? null);
    box.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close.current();
        return;
      }
      if (event.key === 'Tab' && box.current) trapTab(event, box.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      for (const el of background) el.removeAttribute('inert');
      opener?.focus();
    };
  }, [box]);
}

/** Accessible modal: labelled dialog, background inert, Escape closes, Tab stays inside, focus returns to the opener. */
export function Modal({ title, onClose, children, printable }: ModalProps) {
  const reduce = useReduce();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, onClose);

  const entrance = reduce
    ? {}
    : {
        initial: { opacity: 0, y: OPEN_RISE_PX, scale: OPEN_SCALE_FROM },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: OPEN_S },
      };

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <m.div
        ref={box}
        className={`modal ${printable ? 'printable' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        {...entrance}
      >
        <div className="modalhead noprint">
          <h2 id={titleId}>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </m.div>
    </div>
  );
}

import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

const DEFAULT_SIZE = 18;
const SPINNER_SIZE = 22;
const CHEVRON_SIZE = 20;
const TICK_DRAW_S = 0.4;
const SPIN_S = 0.8;
const CHEVRON_TURN_S = 0.25;

interface SvgProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const Svg = ({ size = DEFAULT_SIZE, className = 'ic', style, children }: SvgProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
    {children}
  </svg>
);

/** Optional size and style for the plain icons. */
export interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

/** Shield with a check mark: the FormSure logo. */
export const ShieldIcon = (p: IconProps) => (<Svg {...p}><path d="M9 12l2 2 4-4" /><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></Svg>);
/** Graduation cap. */
export const CapIcon = (p: IconProps) => (<Svg {...p}><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></Svg>);
/** Right arrow. */
export const ArrowIcon = (p: IconProps) => (<Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>);
/** Padlock. */
export const LockIcon = (p: IconProps) => (<Svg {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></Svg>);
/** Document with a folded corner. */
export const FileIcon = (p: IconProps) => (<Svg {...p}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5" /></Svg>);
/** Cross. */
export const XIcon = (p: IconProps) => (<Svg {...p}><path d="M7 7l10 10M17 7L7 17" /></Svg>);
/** Dash (skipped). */
export const DashIcon = (p: IconProps) => (<Svg {...p}><path d="M7 12h10" /></Svg>);
/** Warning triangle. */
export const WarnIcon = (p: IconProps) => (<Svg {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></Svg>);
/** Question mark in a circle (could not verify). */
export const QuestionIcon = (p: IconProps) => (<Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" /></Svg>);
/** Four-point sparkle (AI). */
export const SparkIcon = (p: IconProps) => (<Svg {...p}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></Svg>);
/** Wrench (the fix). */
export const WrenchIcon = (p: IconProps) => (<Svg {...p}><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" /></Svg>);
/** Arrow leaving a box (external link). */
export const ExternalIcon = (p: IconProps) => (<Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></Svg>);
/** Circular arrow (re-check). */
export const RefreshIcon = (p: IconProps) => (<Svg {...p}><path d="M20 12a8 8 0 11-2.3-5.7M20 4v4h-4" /></Svg>);
/** Arrow into a tray (download). */
export const DownloadIcon = (p: IconProps) => (<Svg {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>);
/** Calendar. */
export const CalendarIcon = (p: IconProps) => (<Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></Svg>);

/** Chevron that turns upside down when its card is open. */
export const ChevronIcon = ({ open, reduce }: { open: boolean; reduce: boolean }) => (
  <motion.span className="chev" style={{ display: 'inline-flex' }} animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduce ? 0 : CHEVRON_TURN_S }}>
    <Svg size={CHEVRON_SIZE}><path d="M6 9l6 6 6-6" /></Svg>
  </motion.span>
);

/** Check mark that draws itself (the design's stroke-dashoffset "tick"). */
export const Tick = ({ size = 14, reduce }: { size?: number; reduce: boolean }) => (
  <Svg size={size}>
    <motion.path
      d="M5 12l5 5 9-10"
      initial={reduce ? false : { pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: reduce ? 0 : TICK_DRAW_S, ease: 'easeOut' }}
    />
  </Svg>
);

/** Spinning arc shown while a check or a read is running. */
export const Spinner = ({ reduce }: { reduce: boolean }) => (
  <motion.span
    style={{ display: 'inline-flex' }}
    animate={reduce ? undefined : { rotate: 360 }}
    transition={{ duration: SPIN_S, ease: 'linear', repeat: Infinity }}
  >
    <Svg size={SPINNER_SIZE}><path d="M12 3a9 9 0 019 9" /></Svg>
  </motion.span>
);

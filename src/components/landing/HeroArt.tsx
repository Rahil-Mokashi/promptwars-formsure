import { m } from 'framer-motion';

const FLOAT_RISE_PX = -10;
const TILT_DEG = 7;
const TILT_SCALE = 1.03;
const SPRING = { type: 'spring' as const, stiffness: 260, damping: 18 };
const FLAG_TIMES = [0, 0.42, 0.5, 0.92, 1];
const FLAG_CYCLE_S = 5;
const PERSPECTIVE_PX = 900;

/** Gentle up-and-down float; nothing when motion is off. */
const float = (reduce: boolean, seconds: number, delay = 0) =>
  reduce ? {} : { animate: { y: [0, FLOAT_RISE_PX, 0] }, transition: { duration: seconds, repeat: Infinity, ease: 'easeInOut' as const, delay } };

/** Cross-fades the "bad" and "fixed" flags; shows only the bad one when motion is off. */
const flag = (reduce: boolean, opacity: number[], bad: boolean) =>
  reduce
    ? { style: { opacity: bad ? 1 : 0 } }
    : { animate: { opacity: opacity }, transition: { duration: FLAG_CYCLE_S, times: FLAG_TIMES, repeat: Infinity, ease: 'easeInOut' as const } };

/** Hover tilt for a document card at rest rotation `rotate` (degrees). */
const tilt = (reduce: boolean, rotate: number) =>
  reduce
    ? { style: { rotate } }
    : {
        style: { rotate, transformPerspective: PERSPECTIVE_PX },
        whileHover: { rotate: rotate * 0.5, rotateX: TILT_DEG, rotateY: -TILT_DEG, scale: TILT_SCALE },
        transition: SPRING,
      };

/** The stack of three sample documents and the AI name-match chip beside the hero text. Decorative. */
export function HeroArt({ reduce }: { reduce: boolean }) {
  return (
    <div className="stack" aria-hidden="true">
      <m.div className="doc doc-back" {...tilt(reduce, -8)}>
        <div className="docbar"><span className="docsample">SAMPLE</span></div>
        <p className="doctitle">Marksheet</p>
        <div className="docline w90" /><div className="docline w60" /><div className="docline w80" /><div className="docline w40" />
        <p className="docfield">Name: <span className="hl">Arav Sunil Patil</span></p>
      </m.div>
      <m.div className="doc doc-mid" {...tilt(reduce, 6)}>
        <div className="docbar"><span className="docsample">SAMPLE</span></div>
        <p className="doctitle dev" lang="mr">आधार कार्ड</p>
        <div className="docline w80" /><div className="docline w60" />
        <p className="docfield mono">XXXX XXXX 4417</p>
      </m.div>
      <m.div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} {...float(reduce, 6)}>
        <m.div
          className="doc doc-front"
          style={{ pointerEvents: 'auto' }}
          {...(reduce ? {} : { whileHover: { rotateX: TILT_DEG - 1, rotateY: -(TILT_DEG - 1), scale: TILT_SCALE }, transition: SPRING })}
        >
          <div className="docbar"><span className="docsample dev" lang="mr">नमुना · SAMPLE</span></div>
          <p className="doctitle dev" lang="mr">उत्पन्न प्रमाणपत्र</p>
          <div className="docline w90" /><div className="docline w80" /><div className="docline w60" />
          <p className="docfield dev" lang="mr">नाव: <span className="hl">आरव सुनील पाटील</span></p>
          <p className="docfield dev" lang="mr">दिनांक: १२/०५/२०२५</p>
          <div className="flag">
            <m.span className="flag-bad" {...flag(reduce, [1, 1, 0, 0, 1], true)}>Certificate from last financial year</m.span>
            <m.span className="flag-good" {...flag(reduce, [0, 0, 1, 1, 0], false)}>Fixed · ready to submit</m.span>
          </div>
        </m.div>
      </m.div>
      <m.div className="chipfloat" {...float(reduce, 7, -2)}>
        <small>AI name match</small><span className="dev" lang="mr">आरव</span> → Aarav ≠ Arav
      </m.div>
    </div>
  );
}

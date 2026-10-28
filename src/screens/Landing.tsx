import { motion } from 'framer-motion';
import { ArrowIcon, CapIcon, LockIcon } from '../icons';
import { fadeUp, useReduce } from '../motion';

interface Props {
  error: string | null;
  onSample: () => void;
  onStart: () => void;
}

export function Landing({ error, onSample, onStart }: Props) {
  const reduce = useReduce();
  const float = (duration: number, delay = 0) =>
    reduce ? {} : { animate: { y: [0, -10, 0] }, transition: { duration, repeat: Infinity, ease: 'easeInOut' as const, delay } };
  const flag = (times: number[], values: number[], bad: boolean) =>
    reduce
      ? { style: { opacity: bad ? 1 : 0 } }
      : { animate: { opacity: values }, transition: { duration: 5, times, repeat: Infinity, ease: 'easeInOut' as const } };
  // Gentle hover tilt for the document cards (rotation is driven by Framer Motion, not CSS).
  const tilt = (rotate: number) =>
    reduce
      ? { style: { rotate } }
      : {
          style: { rotate, transformPerspective: 900 },
          whileHover: { rotate: rotate * 0.5, rotateX: 7, rotateY: -7, scale: 1.03 },
          transition: { type: 'spring' as const, stiffness: 260, damping: 18 },
        };
  const blob = (x: number[], y: number[], duration: number) =>
    reduce ? {} : { animate: { x, y }, transition: { duration, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const } };

  return (
    <main className="wrap hero">
      <div className="aurora" aria-hidden="true">
        <motion.i className="a1" {...blob([0, 80, -20], [0, 40, 10], 14)} />
        <motion.i className="a2" {...blob([0, -70, 20], [0, 60, -10], 17)} />
        <motion.i className="a3" {...blob([0, 50, -40], [0, -30, 20], 19)} />
      </div>
      <motion.div {...fadeUp(reduce, 0, 0.5)}>
        <p className="eyebrow"><CapIcon size={14} />For MahaDBT scholarship applicants</p>
        <h1 className="h1">Check before<br />you submit.</h1>
        <p className="lead">FormSure reads your documents, checks them against your scheme’s rules, and shows exactly what to fix, before your application gets sent back.</p>
        <div className="row">
          <button className="btn btn-primary" onClick={onSample}>
            Try sample applicant<ArrowIcon />
          </button>
          <button className="btn btn-ghost" onClick={onStart}>Start my check</button>
        </div>
        {error && <p className="errnote" role="alert">{error}</p>}
        <ul className="statstrip" aria-label="FormSure at a glance">
          <li>8 checks</li>
          <li>3 languages</li>
          <li>0 files stored</li>
        </ul>
        <ol className="how">
          <li><span className="hownum">01</span>Upload your documents</li>
          <li><span className="hownum">02</span>AI reads, rules check</li>
          <li><span className="hownum">03</span>Fix before you submit</li>
        </ol>
        <p className="trust"><LockIcon size={16} />Nothing is stored. Every rule links to its official source.</p>
      </motion.div>

      <div className="stack" aria-hidden="true">
        <motion.div className="doc doc-back" {...tilt(-8)}>
          <div className="docbar"><span className="docsample">SAMPLE</span></div>
          <p className="doctitle">Marksheet</p>
          <div className="docline w90" /><div className="docline w60" /><div className="docline w80" /><div className="docline w40" />
          <p className="docfield">Name: <span className="hl">Arav Sunil Patil</span></p>
        </motion.div>
        <motion.div className="doc doc-mid" {...tilt(6)}>
          <div className="docbar"><span className="docsample">SAMPLE</span></div>
          <p className="doctitle dev" lang="mr">आधार कार्ड</p>
          <div className="docline w80" /><div className="docline w60" />
          <p className="docfield mono">XXXX XXXX 4417</p>
        </motion.div>
        <motion.div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} {...float(6)}>
          <motion.div className="doc doc-front" style={{ pointerEvents: 'auto' }} {...(reduce ? {} : { whileHover: { rotateX: 6, rotateY: -6, scale: 1.03 }, transition: { type: 'spring', stiffness: 260, damping: 18 } })}>
            <div className="docbar"><span className="docsample dev" lang="mr">नमुना · SAMPLE</span></div>
            <p className="doctitle dev" lang="mr">उत्पन्न प्रमाणपत्र</p>
            <div className="docline w90" /><div className="docline w80" /><div className="docline w60" />
            <p className="docfield dev" lang="mr">नाव: <span className="hl">आरव सुनील पाटील</span></p>
            <p className="docfield dev" lang="mr">दिनांक: १२/०५/२०२५</p>
            <div className="flag">
              <motion.span className="flag-bad" {...flag([0, 0.42, 0.5, 0.92, 1], [1, 1, 0, 0, 1], true)}>Certificate from last financial year</motion.span>
              <motion.span className="flag-good" {...flag([0, 0.42, 0.5, 0.92, 1], [0, 0, 1, 1, 0], false)}>Fixed · ready to submit</motion.span>
            </div>
          </motion.div>
        </motion.div>
        <motion.div className="chipfloat" {...float(7, -2)}>
          <small>AI name match</small><span className="dev" lang="mr">आरव</span> → Aarav ≠ Arav
        </motion.div>
      </div>
    </main>
  );
}

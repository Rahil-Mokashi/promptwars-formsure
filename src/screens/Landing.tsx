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

  return (
    <main className="wrap hero">
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
        <ol className="how">
          <li><span className="hownum">01</span>Upload your documents</li>
          <li><span className="hownum">02</span>AI reads, rules check</li>
          <li><span className="hownum">03</span>Fix before you submit</li>
        </ol>
        <p className="trust"><LockIcon size={16} />Nothing is stored. Every rule links to its official source.</p>
      </motion.div>

      <div className="stack" aria-hidden="true">
        <div className="doc doc-back">
          <div className="docbar"><span className="docsample">SAMPLE</span></div>
          <p className="doctitle">Marksheet</p>
          <div className="docline w90" /><div className="docline w60" /><div className="docline w80" /><div className="docline w40" />
          <p className="docfield">Name: <span className="hl">Arav Sunil Patil</span></p>
        </div>
        <div className="doc doc-mid">
          <div className="docbar"><span className="docsample">SAMPLE</span></div>
          <p className="doctitle dev" lang="mr">आधार कार्ड</p>
          <div className="docline w80" /><div className="docline w60" />
          <p className="docfield mono">XXXX XXXX 4417</p>
        </div>
        <motion.div style={{ position: 'absolute', inset: 0 }} {...float(6)}>
          <div className="doc doc-front">
            <div className="docbar"><span className="docsample dev" lang="mr">नमुना · SAMPLE</span></div>
            <p className="doctitle dev" lang="mr">उत्पन्न प्रमाणपत्र</p>
            <div className="docline w90" /><div className="docline w80" /><div className="docline w60" />
            <p className="docfield dev" lang="mr">नाव: <span className="hl">आरव सुनील पाटील</span></p>
            <p className="docfield dev" lang="mr">दिनांक: १२/०५/२०२५</p>
            <div className="flag">
              <motion.span className="flag-bad" {...flag([0, 0.42, 0.5, 0.92, 1], [1, 1, 0, 0, 1], true)}>Certificate from last financial year</motion.span>
              <motion.span className="flag-good" {...flag([0, 0.42, 0.5, 0.92, 1], [0, 0, 1, 1, 0], false)}>Fixed · ready to submit</motion.span>
            </div>
          </div>
        </motion.div>
        <motion.div className="chipfloat" {...float(7, -2)}>
          <small>AI name match</small><span className="dev" lang="mr">आरव</span> → Aarav ≠ Arav
        </motion.div>
      </div>
    </main>
  );
}

import { m } from 'framer-motion';
import { fadeUp } from '../components/motionProps';
import { ArrowIcon, CapIcon, LockIcon } from '../components/icons';
import { HeroArt } from '../components/landing/HeroArt';
import { useReduce } from '../hooks/useMotion';

const HERO_FADE_S = 0.5;
const BLOB_DRIFT_S = [14, 17, 19] as const;

/** Slowly drifting aurora glow behind the hero. Decorative; static when motion is off. */
function Aurora({ reduce }: { reduce: boolean }) {
  const blob = (x: number[], y: number[], seconds: number) =>
    reduce ? {} : { animate: { x, y }, transition: { duration: seconds, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const } };
  return (
    <div className="aurora" aria-hidden="true">
      <m.i className="a1" {...blob([0, 80, -20], [0, 40, 10], BLOB_DRIFT_S[0])} />
      <m.i className="a2" {...blob([0, -70, 20], [0, 60, -10], BLOB_DRIFT_S[1])} />
      <m.i className="a3" {...blob([0, 50, -40], [0, -30, 20], BLOB_DRIFT_S[2])} />
    </div>
  );
}

/** Props of {@link Landing}. */
export interface LandingProps {
  error: string | null;
  onSample: () => void;
  onStart: () => void;
}

/** The first screen: pitch, the two ways in, a stats strip and the animated document stack. */
export function Landing({ error, onSample, onStart }: LandingProps) {
  const reduce = useReduce();
  return (
    <main className="wrap hero" id="main" tabIndex={-1}>
      <Aurora reduce={reduce} />
      <m.div {...fadeUp(reduce, 0, HERO_FADE_S)}>
        <p className="eyebrow"><CapIcon size={14} />For MahaDBT scholarship applicants</p>
        <h1 className="h1">Check before<br />you submit.</h1>
        <p className="lead">FormSure reads your documents, checks them against your scheme’s rules, and shows exactly what to fix, before your application gets sent back.</p>
        <div className="row">
          <button className="btn btn-primary" onClick={onSample}>Try sample applicant<ArrowIcon /></button>
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
      </m.div>
      <HeroArt reduce={reduce} />
    </main>
  );
}

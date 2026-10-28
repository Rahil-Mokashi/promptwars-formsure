import type { Check } from '../../core/types';
import { Tick } from '../icons';

const ICON_PX = 22;
const MARK_PX = 12;

/** The list of checks that passed, each with a tick. */
export function PassedChecks({ checks, reduce }: { checks: readonly Check[]; reduce: boolean }) {
  return (
    <section className="card panel" aria-labelledby="passed-h">
      <p className="ptitle" id="passed-h">
        Passed checks
      </p>
      <ul className="mini" style={{ marginTop: 12 }}>
        {checks.map((c) => (
          <li key={c.ruleId}>
            <span className="cicon ci-pass" style={{ width: ICON_PX, height: ICON_PX }}>
              <Tick size={MARK_PX} reduce={reduce} />
            </span>
            {c.label}
            {c.advisory && <span className="ctag">Advisory</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

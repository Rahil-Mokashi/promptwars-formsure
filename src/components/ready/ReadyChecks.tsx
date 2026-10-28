import type { Check } from '../../core/types';
import { DashIcon, Tick } from '../icons';

const ICON_PX = 22;
const MARK_PX = 12;

/** Every check on the 100 % screen: a tick for each pass, a dash for each rule that was not evaluated. */
export function ReadyChecks({ checks, reduce }: { checks: readonly Check[]; reduce: boolean }) {
  return (
    <ul className="mini readylist" aria-label="Every check">
      {checks.map((c) => (
        <li key={c.ruleId}>
          {c.status === 'pass' ? (
            <span className="cicon ci-pass" style={{ width: ICON_PX, height: ICON_PX }}>
              <Tick size={MARK_PX} reduce={reduce} />
            </span>
          ) : (
            <span className="cicon ci-skip" style={{ width: ICON_PX, height: ICON_PX }}>
              <DashIcon size={MARK_PX} />
            </span>
          )}
          <span>
            {c.label}
            {c.advisory && <span className="ctag">Advisory</span>}
            <span className="sr-only">{c.status === 'pass' ? ' Passed.' : ' Not evaluated.'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

import { SOURCE_KIND_LABEL } from '../../core/copy';
import { isEvaluable, mahadbtPack } from '../../core/schema';
import { Modal } from '../Modal';

/** Props of {@link PackDialog}. */
export interface PackDialogProps {
  onClose: () => void;
}

/** Shows the live scheme pack's rules as a table (rule, AI or code, source, verified) so judges can see how packs work. */
export function PackDialog({ onClose }: PackDialogProps) {
  return (
    <Modal title="How a scheme pack works" onClose={onClose}>
      <p className="sub" style={{ marginTop: 0, maxWidth: 'none' }}>
        A scheme pack is one versioned JSON file of rules. The engine applies a rule only when it is verified by an official source or a college notice; a rule backed only by secondary guides, or whose sources conflict, is not evaluated. Below is the pack that is live now: {mahadbtPack.name}, version {mahadbtPack.version}, evidence from academic year {mahadbtPack.academicYear}. Exact quotes and dates are in RULES.md.
      </p>
      <div className="tablewrap">
        <table className="packtable">
          <caption className="sr-only">Rules in the {mahadbtPack.name} pack</caption>
          <thead>
            <tr><th scope="col">Rule</th><th scope="col">Checked by</th><th scope="col">Source</th><th scope="col">Status</th></tr>
          </thead>
          <tbody>
            {mahadbtPack.rules.map((r) => (
              <tr key={r.id}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 600 }}>{r.label}</th>
                <td><span className={`tag ${r.usesAi ? 'tag-ai' : 'tag-code'}`}>{r.usesAi ? 'AI reads, code decides' : 'Code'}</span></td>
                <td>
                  <a href={r.source.url} target="_blank" rel="noopener noreferrer">{r.source.label}</a>
                  <div className="srckind">{SOURCE_KIND_LABEL[r.source.kind]}</div>
                </td>
                <td>
                  <span className={`tag ${isEvaluable(r) ? 'tag-ok' : 'tag-no'}`}>{isEvaluable(r) ? 'Verified, applied' : `Not evaluated (${r.status})`}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

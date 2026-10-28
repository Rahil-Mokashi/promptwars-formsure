import { mahadbtPack } from '../../core/schema';
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
        A scheme pack is one JSON file of rules. The engine runs only rules marked verified; an AI-drafted rule stays skipped until a person checks it against the official source. Below is the pack that is live now: {mahadbtPack.name}.
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
                <td><a href={r.source.url} target="_blank" rel="noopener noreferrer">{r.source.label}</a></td>
                <td><span className={`tag ${r.verified ? 'tag-ok' : 'tag-no'}`}>{r.verified ? 'Verified' : 'Not verified, skipped'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

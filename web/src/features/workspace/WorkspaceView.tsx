import { Notes } from './Notes.tsx';
import { Secrets } from './Secrets.tsx';

/** F-60 / F-61 */
export function WorkspaceView() {
  return (
    <div className="space">
      <Notes />
      <Secrets />
    </div>
  );
}

import type { Task } from '../../data/model.ts';
import { newId } from '../../data/ids.ts';
import { useAppData } from '../../state/hooks.ts';
import { addNote, linkNoteTask, notesOfTask, unlinkNoteTask } from '../../state/ops.ts';
import { Icon, IconButton } from '../../ui/Icon.tsx';
import { folderOptions } from '../knowledge/tree.ts';

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

/** Phase 1.4: notes linked to the task. A note opens in the workspace tab. */
export function TaskNotes({ task, onOpenNote }: { task: Task; onOpenNote: (id: string) => void }) {
  const { data, apply } = useAppData();
  const linked = notesOfTask(data, task.id);
  const paths = new Map(folderOptions(data).map((f) => [f.id, f.label]));
  const free = data.notes
    .filter((n) => !n.taskIds.includes(task.id))
    .sort((a, b) => collator.compare(a.title, b.title));

  return (
    <section className="pane-sec">
      <div className="sec-head">
        <h3>Заметки</h3>
        {linked.length > 0 && <span className="muted">{linked.length}</span>}
      </div>
      <ul className="list">
        {linked.map((n) => (
          <li key={n.id} className="link-item">
            <button type="button" className="link-main" onClick={() => onOpenNote(n.id)}>
              <Icon name="note" />
              <span className="link-text">
                <span className="link-label">{n.title}</span>
                <span className="link-url">
                  {n.folderId ? (paths.get(n.folderId) ?? 'Корень') : 'Корень'}
                </span>
              </span>
            </button>
            <IconButton
              icon="x"
              label={`Отвязать заметку «${n.title}»`}
              onClick={() => apply((d) => unlinkNoteTask(d, n.id, task.id))}
            />
          </li>
        ))}
      </ul>
      <div className="row note-link-row">
        {free.length > 0 && (
          <select
            className="select link-select"
            aria-label="Привязать заметку"
            value=""
            onChange={(e) => {
              const noteId = e.target.value;
              if (noteId) apply((d) => linkNoteTask(d, noteId, task.id));
            }}
          >
            <option value="">+ Привязать заметку…</option>
            {free.map((n) => (
              <option key={n.id} value={n.id}>
                {n.folderId ? `${paths.get(n.folderId)} / ${n.title}` : n.title}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            const id = newId();
            const now = Date.now();
            apply((d) => {
              addNote(d, task.title, '', id, now);
              linkNoteTask(d, id, task.id);
            });
            onOpenNote(id);
          }}
        >
          Новая заметка
        </button>
      </div>
    </section>
  );
}

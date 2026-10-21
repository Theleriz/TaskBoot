import type { Note } from '../../data/model.ts';
import { useAppData } from '../../state/hooks.ts';
import { linkNoteTask, unlinkNoteTask } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { QUADRANT_ZONES, zoneTitle } from '../boards/zones.ts';

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

/** Tasks linked to a note: open one in the details panel, link more, unlink. */
export function NoteTasks({ note, onOpenTask }: { note: Note; onOpenTask: (id: string) => void }) {
  const { data, apply } = useAppData();
  const linked = note.taskIds.flatMap((id) => data.tasks.find((t) => t.id === id) ?? []);
  const free = data.tasks
    .filter((t) => !note.taskIds.includes(t.id))
    .sort((a, b) => collator.compare(a.title, b.title));

  return (
    <div className="note-tasks" role="group" aria-label="Связанные задачи">
      <span className="muted">Задачи</span>
      {linked.map((t) => (
        <span key={t.id} className={`task-chip${t.status === 'done' ? ' is-done' : ''}`}>
          <button type="button" className="task-chip-open" onClick={() => onOpenTask(t.id)}>
            <span
              className="dot"
              style={{ background: zoneTitle(QUADRANT_ZONES, t.quadrant)?.color }}
            />
            {t.title}
          </button>
          <IconButton
            icon="x"
            label={`Отвязать задачу «${t.title}»`}
            onClick={() => apply((d) => unlinkNoteTask(d, note.id, t.id))}
          />
        </span>
      ))}
      {free.length > 0 ? (
        <select
          className="select link-select"
          aria-label="Привязать задачу"
          value=""
          onChange={(e) => {
            const taskId = e.target.value;
            if (taskId) apply((d) => linkNoteTask(d, note.id, taskId));
          }}
        >
          <option value="">+ Привязать задачу…</option>
          {free.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      ) : (
        linked.length === 0 && <span className="muted">нет задач</span>
      )}
    </div>
  );
}

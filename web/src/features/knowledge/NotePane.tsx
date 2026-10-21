import { Suspense, lazy, useState } from 'react';
import type { Note } from '../../data/model.ts';
import { useAppData } from '../../state/hooks.ts';
import { deleteNote, moveNote, renameNote, setNoteText } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { formatDate } from '../../ui/format.ts';
import type { Jump } from './NoteEditor.tsx';
import { NoteTasks } from './NoteTasks.tsx';
import { NOTE_MODES, type NoteMode } from './modes.ts';
import { folderOptions } from './tree.ts';

const NoteEditor = lazy(() => import('./NoteEditor.tsx'));
const NotePreview = lazy(() => import('./NotePreview.tsx'));

const ROOT = '';

/** One note of the knowledge space. Changes are saved as you type. */
export function NotePane({
  note,
  mode,
  onMode,
  onDeleted,
  focusTitle = false,
  jump = null,
  onOpenTask,
}: {
  note: Note;
  mode: NoteMode;
  onMode: (mode: NoteMode) => void;
  onDeleted: () => void;
  focusTitle?: boolean;
  /** Search match to show in the editor. */
  jump?: Jump | null;
  onOpenTask: (taskId: string) => void;
}) {
  const { data, apply } = useAppData();
  const [title, setTitle] = useState(note.title);

  const commitTitle = () => {
    const now = Date.now();
    if (title.trim()) apply((d) => renameNote(d, note.id, title, now));
    else setTitle(note.title);
  };

  return (
    <section className="box note-pane" aria-label={`Заметка «${note.title}»`}>
      <div className="note-head">
        <input
          className="input note-title-input"
          aria-label="Заголовок заметки"
          maxLength={200}
          autoComplete="off"
          autoFocus={focusTitle}
          onFocus={(e) => focusTitle && e.currentTarget.select()}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setTitle(note.title);
              // Blur after the state is reset, so the old title is not committed again.
              setTimeout(() => (e.target as HTMLInputElement).blur());
            }
          }}
        />
        <div className="chips" role="radiogroup" aria-label="Вид заметки">
          {NOTE_MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              role="radio"
              className="chip"
              aria-checked={mode === m.mode}
              onClick={() => onMode(m.mode)}
            >
              {m.title}
            </button>
          ))}
        </div>
      </div>

      <div className="row note-meta">
        <label className="note-folder">
          <span className="muted">Папка</span>
          <select
            className="select"
            value={note.folderId ?? ROOT}
            onChange={(e) => {
              const folderId = e.target.value === ROOT ? null : e.target.value;
              apply((d) => moveNote(d, note.id, folderId));
            }}
          >
            <option value={ROOT}>Корень</option>
            {folderOptions(data).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <span className="muted note-saved">
          Сохраняется автоматически · изменена {formatDate(note.updatedAt)}
        </span>
        <span className="spacer" />
        <IconButton
          icon="trash"
          label="Удалить заметку"
          danger
          onClick={() => {
            if (!window.confirm(`Удалить заметку «${note.title}»?`)) return;
            apply((d) => deleteNote(d, note.id));
            onDeleted();
          }}
        />
      </div>

      <NoteTasks note={note} onOpenTask={onOpenTask} />

      <div className={`note-body mode-${mode}`}>
        {mode !== 'preview' && (
          <Suspense fallback={<div className="note-loading">Загрузка редактора…</div>}>
            <NoteEditor
              initialText={note.text}
              jump={jump}
              onChange={(text) => {
                const now = Date.now();
                apply((d) => setNoteText(d, note.id, text, now));
              }}
            />
          </Suspense>
        )}
        {mode !== 'edit' && (
          <Suspense fallback={<div className="note-loading">Загрузка просмотра…</div>}>
            <NotePreview text={note.text} />
          </Suspense>
        )}
      </div>
    </section>
  );
}

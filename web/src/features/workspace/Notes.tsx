import { useState } from 'react';
import type { Note } from '../../data/model.ts';
import { newId } from '../../data/ids.ts';
import { useAppData, useToast } from '../../state/hooks.ts';
import { addNote, deleteNote, updateNote } from '../../state/ops.ts';
import { formatDate } from '../../ui/format.ts';

function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const { apply } = useAppData();
  const toast = useToast();
  const [title, setTitle] = useState(note.title);
  const [text, setText] = useState(note.text);
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      className="note-edit"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) {
          setInvalid(true);
          return;
        }
        const now = Date.now();
        apply((d) => updateNote(d, note.id, title, text, now));
        onClose();
        toast('Заметка сохранена');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <input
        className={`input${invalid ? ' invalid' : ''}`}
        maxLength={200}
        aria-label="Заголовок заметки"
        autoComplete="off"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setInvalid(false);
        }}
      />
      <textarea
        className="textarea"
        aria-label="Текст заметки"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {invalid && <div className="field-error">Введите заголовок заметки</div>}
      <div className="row">
        <button className="btn primary" type="submit">
          Сохранить
        </button>
        <button className="btn" type="button" onClick={onClose}>
          Свернуть
        </button>
        <span style={{ flex: 1 }} />
        <button
          className="btn danger-ghost"
          type="button"
          onClick={() => {
            if (!window.confirm(`Удалить заметку «${note.title}»?`)) return;
            apply((d) => deleteNote(d, note.id));
            onClose();
          }}
        >
          Удалить
        </button>
      </div>
      <span className="hint">
        Изменена {formatDate(note.updatedAt)}. «Свернуть» закрывает заметку без сохранения правок.
      </span>
    </form>
  );
}

/** F-62..F-64, F-69 */
export function Notes() {
  const { data, apply } = useAppData();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const notes = [...data.notes].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <section className="box" aria-labelledby="notesHead">
      <div className="box-head">
        <span className="stripe" style={{ background: 'var(--accent)' }} />
        <h2 id="notesHead">Заметки</h2>
        <span className="count">{data.notes.length}</span>
      </div>
      <form
        className="create stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            setInvalid(true);
            return;
          }
          const id = newId();
          const now = Date.now();
          apply((d) => addNote(d, title, text, id, now));
          setTitle('');
          setText('');
        }}
      >
        <input
          className={`input${invalid ? ' invalid' : ''}`}
          placeholder="Заголовок заметки"
          maxLength={200}
          autoComplete="off"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setInvalid(false);
          }}
        />
        <textarea
          className="textarea"
          placeholder="Текст заметки"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {invalid && <div className="field-error">Введите заголовок заметки</div>}
        <div>
          <button className="btn primary" type="submit">
            Добавить заметку
          </button>
        </div>
      </form>
      <div className="list">
        {notes.length === 0 && <div className="empty">пусто</div>}
        {notes.map((note) =>
          note.id === openId ? (
            <NoteEditor key={note.id} note={note} onClose={() => setOpenId(null)} />
          ) : (
            <button
              key={note.id}
              type="button"
              className="note-row"
              aria-expanded="false"
              onClick={() => setOpenId(note.id)}
            >
              <span className="note-title">{note.title}</span>
              <span className="note-date">{formatDate(note.updatedAt)}</span>
              {note.text.trim() && (
                <span className="note-preview">
                  {note.text.split('\n').find((l) => l.trim()) ?? ''}
                </span>
              )}
            </button>
          ),
        )}
      </div>
    </section>
  );
}

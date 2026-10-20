import { useState } from 'react';
import { newId } from '../../data/ids.ts';
import { useAppData } from '../../state/hooks.ts';
import { addFolder, addNote } from '../../state/ops.ts';
import { FolderTree } from '../knowledge/FolderTree.tsx';
import { NotePane } from '../knowledge/NotePane.tsx';
import { type NoteMode, isNoteMode } from '../knowledge/modes.ts';
import { folderAncestors } from '../knowledge/tree.ts';
import { Icon } from '../../ui/Icon.tsx';
import { Secrets } from './Secrets.tsx';

// UI conveniences kept in browser storage, like the last tab (never the data itself).
const SELECTION_KEY = 'taskTracker.space.selected';
const OPEN_KEY = 'taskTracker.space.open';
const MODE_KEY = 'taskTracker.space.mode';
const SECRETS = 'secrets';

function read(prefs: Storage | null, key: string): string | null {
  try {
    return prefs?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(prefs: Storage | null, key: string, value: string) {
  try {
    prefs?.setItem(key, value);
  } catch {
    /* only a convenience */
  }
}

function readOpen(prefs: Storage | null): Set<string> {
  try {
    const ids: unknown = JSON.parse(read(prefs, OPEN_KEY) ?? '[]');
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * F-60 / F-61: the workspace. Left — the knowledge space (folders and notes) and the secrets
 * section; right — the open note or the secrets.
 */
export function WorkspaceView({ prefs = null }: { prefs?: Storage | null }) {
  const { data, apply } = useAppData();
  // A note id, SECRETS, or null.
  const [selected, setSelected] = useState<string | null>(() => read(prefs, SELECTION_KEY));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => readOpen(prefs));
  const [mode, setMode] = useState<NoteMode>(() => {
    const saved = read(prefs, MODE_KEY);
    return isNoteMode(saved) ? saved : 'split';
  });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const note = data.notes.find((n) => n.id === selected);

  const select = (id: string | null) => {
    setSelected(id);
    write(prefs, SELECTION_KEY, id ?? '');
  };
  const updateExpanded = (recipe: (next: Set<string>) => void) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      recipe(next);
      write(prefs, OPEN_KEY, JSON.stringify([...next]));
      return next;
    });
  const expandTo = (folderId: string | null) =>
    updateExpanded((next) => folderAncestors(data, folderId).forEach((id) => next.add(id)));

  const createNote = (folderId: string | null) => {
    const id = newId();
    const now = Date.now();
    apply((d) => addNote(d, 'Новая заметка', '', id, now, folderId));
    expandTo(folderId);
    setCreatedId(id);
    select(id);
  };
  const createFolder = (parentId: string | null) => {
    const id = newId();
    const now = Date.now();
    apply((d) => addFolder(d, 'Новая папка', id, now, parentId));
    expandTo(parentId);
    setRenamingId(id);
  };

  return (
    <div className="space">
      <aside className="box space-side" aria-labelledby="notesHead">
        <div className="box-head">
          <span className="stripe" style={{ background: 'var(--accent)' }} />
          <h2 id="notesHead">Заметки</h2>
          <span className="count">{data.notes.length}</span>
          <span className="spacer" />
          <button
            type="button"
            className="icon-btn"
            title="Новая заметка в корне"
            aria-label="Новая заметка в корне"
            onClick={() => createNote(null)}
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Новая папка в корне"
            aria-label="Новая папка в корне"
            onClick={() => createFolder(null)}
          >
            <Icon name="folderPlus" />
          </button>
        </div>
        <FolderTree
          selectedNoteId={note ? note.id : null}
          expanded={expanded}
          renamingId={renamingId}
          onToggle={(id) =>
            updateExpanded((next) => {
              if (next.has(id)) next.delete(id);
              else next.add(id);
            })
          }
          onExpand={(id) => expandTo(id)}
          onSelectNote={(id) => {
            setCreatedId(null);
            select(id);
          }}
          onCreateNote={createNote}
          onCreateFolder={createFolder}
          onRename={setRenamingId}
          onRenameDone={() => setRenamingId(null)}
        />
        <button
          type="button"
          className="tree-row tree-label secrets-link"
          aria-current={selected === SECRETS ? 'true' : undefined}
          onClick={() => select(SECRETS)}
        >
          <Icon name="lock" />
          <span className="tree-name">Секреты</span>
          <span className="count">{data.secrets.length}</span>
        </button>
      </aside>

      <div className="space-main">
        {note ? (
          <NotePane
            key={note.id}
            note={note}
            mode={mode}
            onMode={(next) => {
              setMode(next);
              write(prefs, MODE_KEY, next);
            }}
            onDeleted={() => select(null)}
            focusTitle={note.id === createdId}
          />
        ) : selected === SECRETS ? (
          <Secrets />
        ) : (
          <section className="box space-empty">
            <p>Выберите заметку слева или создайте новую.</p>
            <p className="hint">
              Заметки пишутся в Markdown, формулы — в LaTeX: <code>$a^2 + b^2 = c^2$</code>. Заметки
              и папки можно перетаскивать между папками.
            </p>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => createNote(null)}>
                Новая заметка
              </button>
              <button type="button" className="btn" onClick={() => createFolder(null)}>
                Новая папка
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

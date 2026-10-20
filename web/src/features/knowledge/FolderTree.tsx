import { useRef, useState } from 'react';
import type { AppData, Folder } from '../../data/model.ts';
import { useAppData } from '../../state/hooks.ts';
import {
  deleteFolder,
  findFolder,
  isInsideFolder,
  moveFolder,
  moveNote,
  renameFolder,
} from '../../state/ops.ts';
import { Icon, IconButton } from '../../ui/Icon.tsx';
import { type TreeIndex, indexTree } from './tree.ts';

type Dragged = { kind: 'note' | 'folder'; id: string };

/** Where a dragged item may go: a folder (id) or the root (null). */
function canDrop(d: AppData, item: Dragged, target: string | null): boolean {
  if (item.kind === 'note') return d.notes.find((n) => n.id === item.id)?.folderId !== target;
  const folder = findFolder(d, item.id);
  if (!folder || folder.parentId === target) return false;
  return target === null || !isInsideFolder(d, target, item.id);
}

interface TreeProps {
  selectedNoteId: string | null;
  expanded: ReadonlySet<string>;
  renamingId: string | null;
  onToggle: (folderId: string) => void;
  onExpand: (folderId: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameDone: () => void;
}

function RenameInput({ folder, onDone }: { folder: Folder; onDone: () => void }) {
  const { apply } = useAppData();
  const [name, setName] = useState(folder.name);
  const done = useRef(false);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save && name.trim()) apply((d) => renameFolder(d, folder.id, name));
    onDone();
  };
  return (
    <input
      className="input tree-rename"
      aria-label="Название папки"
      maxLength={200}
      autoComplete="off"
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
    />
  );
}

function Level({
  parentId,
  depth,
  index,
  props,
  drag,
}: {
  parentId: string | null;
  depth: number;
  index: TreeIndex;
  props: TreeProps;
  drag: DragApi;
}) {
  const { apply } = useAppData();
  const folders = index.folders.get(parentId) ?? [];
  const notes = index.notes.get(parentId) ?? [];
  const indent = { paddingLeft: 8 + depth * 16 };

  return (
    <ul className="tree-level">
      {folders.map((f) => {
        const open = props.expanded.has(f.id);
        return (
          <li key={f.id}>
            <div
              className={`tree-row folder${drag.over === f.id ? ' drop' : ''}`}
              style={indent}
              draggable={props.renamingId !== f.id}
              onDragStart={(e) => drag.start(e, { kind: 'folder', id: f.id })}
              onDragEnd={drag.end}
              onDragEnter={(e) => drag.enter(e, f.id)}
              onDragOver={(e) => drag.enter(e, f.id)}
              onDragLeave={(e) => drag.leave(e, f.id)}
              onDrop={(e) => drag.drop(e, f.id)}
            >
              {props.renamingId === f.id ? (
                <>
                  <Icon name="folder" />
                  <RenameInput folder={f} onDone={props.onRenameDone} />
                </>
              ) : (
                <button
                  type="button"
                  className="tree-label"
                  aria-expanded={open}
                  onClick={() => props.onToggle(f.id)}
                >
                  <span className={`tree-chevron${open ? ' open' : ''}`}>
                    <Icon name="chevron" />
                  </span>
                  <Icon name="folder" />
                  <span className="tree-name">{f.name}</span>
                </button>
              )}
              <span className="tree-actions">
                <IconButton
                  icon="plus"
                  label={`Новая заметка в «${f.name}»`}
                  onClick={() => props.onCreateNote(f.id)}
                />
                <IconButton
                  icon="folderPlus"
                  label={`Новая папка в «${f.name}»`}
                  onClick={() => props.onCreateFolder(f.id)}
                />
                <IconButton
                  icon="edit"
                  label={`Переименовать «${f.name}»`}
                  onClick={() => drag.rename(f.id)}
                />
                <IconButton
                  icon="trash"
                  label={`Удалить папку «${f.name}»`}
                  danger
                  onClick={() => {
                    const where = f.parentId
                      ? `в папку «${drag.folderName(f.parentId) ?? ''}»`
                      : 'в корень';
                    const ok = window.confirm(
                      `Удалить папку «${f.name}»? Заметки и вложенные папки из неё переместятся ${where}.`,
                    );
                    if (ok) apply((d) => deleteFolder(d, f.id));
                  }}
                />
              </span>
            </div>
            {open && (
              <Level parentId={f.id} depth={depth + 1} index={index} props={props} drag={drag} />
            )}
          </li>
        );
      })}
      {notes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            className="tree-row tree-label note"
            style={indent}
            aria-current={props.selectedNoteId === n.id ? 'true' : undefined}
            draggable
            onDragStart={(e) => drag.start(e, { kind: 'note', id: n.id })}
            onDragEnd={drag.end}
            // Dropping onto a note means "into the folder of this note".
            onDragEnter={(e) => drag.enter(e, n.folderId)}
            onDragOver={(e) => drag.enter(e, n.folderId)}
            onDrop={(e) => drag.drop(e, n.folderId)}
            onClick={() => props.onSelectNote(n.id)}
          >
            <span className="tree-chevron" />
            <Icon name="note" />
            <span className="tree-name">{n.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

interface DragApi {
  over: string | null | undefined;
  start: (e: React.DragEvent, item: Dragged) => void;
  end: () => void;
  enter: (e: React.DragEvent, target: string | null) => void;
  leave: (e: React.DragEvent, target: string | null) => void;
  drop: (e: React.DragEvent, target: string | null) => void;
  rename: (folderId: string) => void;
  folderName: (folderId: string) => string | undefined;
}

/** Folders and notes of the knowledge space; items can be dragged into folders or to the root. */
export function FolderTree(props: TreeProps & { onRename: (folderId: string) => void }) {
  const { data, apply } = useAppData();
  const index = indexTree(data);
  // The dragged item lives in a ref: dataTransfer cannot be read during dragover.
  const dragged = useRef<Dragged | null>(null);
  // undefined — no drop target; null — the root.
  const [over, setOver] = useState<string | null | undefined>(undefined);

  const drag: DragApi = {
    over,
    start(e, item) {
      e.stopPropagation();
      dragged.current = item;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.id);
    },
    end() {
      dragged.current = null;
      setOver(undefined);
    },
    enter(e, target) {
      const item = dragged.current;
      if (!item) return;
      // The innermost target decides; an invalid one must not fall through to the root.
      e.stopPropagation();
      if (!canDrop(data, item, target)) {
        setOver(undefined);
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setOver(target);
    },
    leave(e, target) {
      if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null) && over === target) {
        setOver(undefined);
      }
    },
    drop(e, target) {
      const item = dragged.current;
      dragged.current = null;
      setOver(undefined);
      if (!item || !canDrop(data, item, target)) return;
      e.preventDefault();
      e.stopPropagation();
      apply((d) =>
        item.kind === 'note' ? moveNote(d, item.id, target) : moveFolder(d, item.id, target),
      );
      if (target) props.onExpand(target);
    },
    rename: props.onRename,
    folderName: (id) => findFolder(data, id)?.name,
  };

  const empty = data.folders.length === 0 && data.notes.length === 0;

  return (
    <div
      className={`tree${over === null ? ' drop' : ''}`}
      role="group"
      aria-label="Папки и заметки"
      onDragEnter={(e) => drag.enter(e, null)}
      onDragOver={(e) => drag.enter(e, null)}
      onDragLeave={(e) => drag.leave(e, null)}
      onDrop={(e) => drag.drop(e, null)}
    >
      {empty ? (
        <div className="empty">пусто</div>
      ) : (
        <Level parentId={null} depth={0} index={index} props={props} drag={drag} />
      )}
    </div>
  );
}

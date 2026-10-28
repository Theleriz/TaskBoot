import { useEffect, useRef, useState } from 'react';
import { WORKSPACE_TABS, type WorkspaceTab } from '../../data/model.ts';
import { type WorkspaceInput, workspaceProblem } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { TAB_TITLES } from '../../tabs.ts';

interface Row {
  id: WorkspaceTab;
  on: boolean;
}

/** Chosen tabs first, in their order; the others after, in the default order. */
function rowsFor(tabs: readonly WorkspaceTab[]): Row[] {
  return [
    ...tabs.map((id) => ({ id, on: true })),
    ...WORKSPACE_TABS.filter((id) => !tabs.includes(id)).map((id) => ({ id, on: false })),
  ];
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Create or set up a workspace: name, which tabs and in what order (phase 2.2). */
export function WorkspaceDialog({
  title,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  title: string;
  initial: WorkspaceInput;
  onSave: (input: WorkspaceInput) => void;
  /** Absent for a new workspace and for the last one. */
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [rows, setRows] = useState(() => rowsFor(initial.tabs));
  const [error, setError] = useState<string | null>(null);
  const dragged = useRef<number | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInput.current?.focus();
    nameInput.current?.select();
  }, []);

  const tabs = rows.filter((r) => r.on).map((r) => r.id);
  const update = (next: Row[]) => {
    setRows(next);
    setError(null);
  };
  const save = () => {
    const input = { name, tabs };
    const problem = workspaceProblem(input);
    if (problem) setError(problem);
    else onSave(input);
  };

  return (
    <div
      className="modal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal ws-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Закрыть (Esc)" onClick={onClose} />
        </div>
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        >
          <label className="card-field">
            <span className="card-field-head">Название</span>
            <input
              ref={nameInput}
              className="input"
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </label>

          <div className="card-field">
            <span className="card-field-head">
              Вкладки — отметьте нужные и расставьте по порядку
            </span>
            <ol className="ws-tabs" aria-label="Вкладки рабочего пространства">
              {rows.map((row, i) => (
                <li
                  key={row.id}
                  className={`ws-tab${row.on ? '' : ' off'}`}
                  draggable
                  onDragStart={(e) => {
                    dragged.current = i;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', row.id);
                  }}
                  onDragOver={(e) => {
                    if (dragged.current === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragged.current !== null) update(move(rows, dragged.current, i));
                    dragged.current = null;
                  }}
                  onDragEnd={() => {
                    dragged.current = null;
                  }}
                >
                  <span className="ws-grip" aria-hidden="true">
                    ⋮⋮
                  </span>
                  <label className="ws-tab-label">
                    <input
                      type="checkbox"
                      checked={row.on}
                      onChange={(e) =>
                        update(
                          rows.map((r) => (r.id === row.id ? { ...r, on: e.target.checked } : r)),
                        )
                      }
                    />
                    {TAB_TITLES[row.id]}
                  </label>
                  <button
                    type="button"
                    className="btn small"
                    disabled={i === 0}
                    aria-label={`Выше: ${TAB_TITLES[row.id]}`}
                    onClick={() => update(move(rows, i, i - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    disabled={i === rows.length - 1}
                    aria-label={`Ниже: ${TAB_TITLES[row.id]}`}
                    onClick={() => update(move(rows, i, i + 1))}
                  >
                    ↓
                  </button>
                </li>
              ))}
            </ol>
            <p className="hint">
              Задачи, заметки и карточки общие для всех рабочих пространств: здесь выбирается только
              набор вкладок. Настройки (шестерёнка) и таймер в шапке есть всегда.
            </p>
          </div>

          {error && <div className="field-error">{error}</div>}
          <div className="row">
            <button type="submit" className="btn primary">
              Сохранить
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Отмена
            </button>
            <span className="spacer" />
            {onDelete && (
              <button type="button" className="btn danger-ghost" onClick={onDelete}>
                Удалить пространство
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

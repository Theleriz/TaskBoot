import { useEffect, useRef, useState } from 'react';
import type { Quadrant, Status, Task } from '../../data/model.ts';
import { useAppData } from '../../state/hooks.ts';
import { deleteTask, moveTask, renameTask, setDescription } from '../../state/ops.ts';
import { formatDate } from '../../ui/format.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { QUADRANT_ZONES, STAGE_ZONES } from '../boards/zones.ts';
import { Checklist } from './Checklist.tsx';
import { Links } from './Links.tsx';

function TitleField({ task }: { task: Task }) {
  const { apply } = useAppData();
  const [draft, setDraft] = useState<string | null>(null);
  const empty = draft !== null && !draft.trim();

  return (
    <div className="grow">
      <input
        className="panel-title"
        value={draft ?? task.title}
        maxLength={200}
        aria-label="Заголовок задачи"
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          // F-08: an empty title is never saved.
          if (v.trim()) apply((d) => renameTask(d, task.id, v));
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      {empty && <div className="field-error">Заголовок не может быть пустым</div>}
    </div>
  );
}

/** F-83 / F-86: task details in a side panel. Closes on Esc and on a click outside (N-24). */
export function DetailsPanel({ task, onClose }: { task: Task; onClose: () => void }) {
  const { apply } = useAppData();
  const panel = useRef<HTMLElement>(null);
  const downOnOverlay = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    panel.current?.focus();
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`overlay${open ? ' open' : ''}`}
      onPointerDown={(e) => {
        downOnOverlay.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnOverlay.current) onClose();
      }}
    >
      <aside
        className="panel"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Детали задачи"
        tabIndex={-1}
      >
        <header className="panel-head">
          <TitleField key={task.id} task={task} />
          <IconButton icon="x" label="Закрыть (Esc)" onClick={onClose} />
        </header>

        <div className="panel-body">
          <section className="pane-sec">
            <div className="selects">
              <label>
                Квадрант
                <select
                  className="select"
                  value={task.quadrant}
                  onChange={(e) =>
                    apply((d) => moveTask(d, task.id, { quadrant: e.target.value as Quadrant }))
                  }
                >
                  {QUADRANT_ZONES.map((z) => (
                    <option key={z.key} value={z.key}>
                      {z.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Стадия
                <select
                  className="select"
                  value={task.status}
                  onChange={(e) =>
                    apply((d) => moveTask(d, task.id, { status: e.target.value as Status }))
                  }
                >
                  {STAGE_ZONES.map((z) => (
                    <option key={z.key} value={z.key}>
                      {z.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="pane-sec">
            <div className="sec-head">
              <h3>Описание</h3>
            </div>
            <textarea
              className="textarea"
              rows={5}
              placeholder="Добавьте описание…"
              aria-label="Описание"
              value={task.description}
              onChange={(e) => {
                const v = e.target.value;
                apply((d) => setDescription(d, task.id, v));
              }}
            />
          </section>

          <Checklist task={task} />
          <Links task={task} />
        </div>

        <footer className="panel-foot">
          <span className="muted">Создана {formatDate(task.createdAt)}</span>
          <button
            type="button"
            className="btn danger-ghost"
            onClick={() => {
              if (window.confirm(`Удалить задачу «${task.title}»?`)) {
                apply((d) => deleteTask(d, task.id));
                onClose();
              }
            }}
          >
            Удалить задачу
          </button>
        </footer>
      </aside>
    </div>
  );
}

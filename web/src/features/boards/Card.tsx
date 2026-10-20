import type { DragEvent } from 'react';
import type { Task } from '../../data/model.ts';
import { Icon, IconButton } from '../../ui/Icon.tsx';
import type { Zone } from './zones.ts';

interface Props {
  task: Task;
  /** Where the task is on the other board (stage in the matrix, quadrant in kanban). */
  other: Zone<string> | undefined;
  dragging: boolean;
  /** Receives the event time, to tell a click right after a drag (F-90). */
  onOpen: (eventTime: number) => void;
  onDelete: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
}

export function Card({ task, other, dragging, onOpen, onDelete, onDragStart, onDragEnd }: Props) {
  const done = task.checklist.filter((i) => i.done).length;
  const total = task.checklist.length;

  return (
    <article
      className={`card${task.status === 'done' ? ' is-done' : ''}${dragging ? ' dragging' : ''}`}
      draggable
      tabIndex={0}
      data-id={task.id}
      aria-label={task.title}
      onClick={(e) => onOpen(e.timeStamp)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(e.timeStamp);
        } else if (e.key === 'Delete') {
          onDelete();
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="card-body">
        <div className="card-title">{task.title}</div>
        <div className="card-meta">
          {other && (
            <span className="badge">
              <span className="dot" style={{ background: other.color }} />
              {other.title}
            </span>
          )}
          {/* F-85: detail indicators */}
          {task.description.trim() && (
            <span className="ind" title="Есть описание">
              <Icon name="text" />
            </span>
          )}
          {total > 0 && (
            <span
              className={`ind${done === total ? ' complete' : ''}`}
              title={`Чек-лист: выполнено ${done} из ${total}`}
            >
              <Icon name="check" />
              {done}/{total}
            </span>
          )}
          {task.links.length > 0 && (
            <span className="ind" title={`Ссылок: ${task.links.length}`}>
              <Icon name="link" />
              {task.links.length}
            </span>
          )}
        </div>
      </div>
      <IconButton
        icon="x"
        label="Удалить задачу"
        danger
        className="card-del"
        onClick={() => {
          onDelete();
        }}
      />
    </article>
  );
}

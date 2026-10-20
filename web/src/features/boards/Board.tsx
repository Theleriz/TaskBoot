import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { Task } from '../../data/model.ts';
import { useAppData } from '../../state/hooks.ts';
import { deleteTask, moveTask } from '../../state/ops.ts';
import { confirmDelete } from './confirm.ts';
import { Card } from './Card.tsx';
import { QUADRANT_ZONES, STAGE_ZONES, type Zone } from './zones.ts';

const DRAG_TYPE = 'text/plain';

export function Board({
  kind,
  onOpen,
}: {
  kind: 'matrix' | 'kanban';
  onOpen: (id: string) => void;
}) {
  const { data, apply } = useAppData();
  const matrix = kind === 'matrix';
  const zones: Zone<string>[] = matrix ? QUADRANT_ZONES : STAGE_ZONES;
  const others: Zone<string>[] = matrix ? STAGE_ZONES : QUADRANT_ZONES;

  // The ref is read by drag handlers right away; the state only drives the styling.
  // (A drag can reach dragover before React re-renders after dragstart.)
  const dragId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const lastDragEnd = useRef(0);

  const zoneOf = (t: Task) => (matrix ? t.quadrant : t.status);
  const otherOf = (t: Task) => others.find((z) => z.key === (matrix ? t.status : t.quadrant));

  const endDrag = (e: DragEvent) => {
    dragId.current = null;
    setDraggingId(null);
    setOver(null);
    lastDragEnd.current = e.timeStamp;
  };

  // Cancelling dragenter / dragover marks the zone as a drop target (HTML drag and drop).
  const acceptDrop = (e: DragEvent, zoneKey: string) => {
    if (!dragId.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (over !== zoneKey) setOver(zoneKey);
  };

  const onDrop = (e: DragEvent, zoneKey: string) => {
    e.preventDefault();
    const id = dragId.current;
    endDrag(e);
    if (!id) return;
    apply((d) =>
      moveTask(
        d,
        id,
        matrix ? { quadrant: zoneKey as Task['quadrant'] } : { status: zoneKey as Task['status'] },
      ),
    );
  };

  return (
    <div className={`board ${kind}`}>
      {zones.map((zone) => {
        const tasks = data.tasks
          .filter((t) => zoneOf(t) === zone.key)
          .sort((a, b) => a.createdAt - b.createdAt);
        return (
          <section
            key={zone.key}
            className={`zone${over === zone.key ? ' over' : ''}`}
            data-zone={zone.key}
            onDragEnter={(e) => acceptDrop(e, zone.key)}
            onDragOver={(e) => acceptDrop(e, zone.key)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
            }}
            onDrop={(e) => onDrop(e, zone.key)}
          >
            <header className="zone-head">
              <span className="stripe" style={{ background: zone.color }} />
              <h2>{zone.title}</h2>
              <span className="count" title={`Задач: ${tasks.length}`}>
                {tasks.length}
              </span>
            </header>
            <div className="zone-list">
              {tasks.length === 0 && <div className="empty">пусто</div>}
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  task={task}
                  other={otherOf(task)}
                  dragging={draggingId === task.id}
                  onOpen={(eventTime) => {
                    // F-90: a drag does not open the details.
                    if (eventTime - lastDragEnd.current < 250) return;
                    onOpen(task.id);
                  }}
                  onDelete={() => {
                    if (confirmDelete(task)) apply((d) => deleteTask(d, task.id));
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, task.id);
                    e.dataTransfer.effectAllowed = 'move';
                    dragId.current = task.id;
                    setDraggingId(task.id);
                  }}
                  onDragEnd={endDrag}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

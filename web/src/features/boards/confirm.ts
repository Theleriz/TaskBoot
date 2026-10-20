import type { Task } from '../../data/model.ts';
import { hasDetails } from '../../state/ops.ts';

/** Asks before deleting a task that has details (they are lost with it, F-96). */
export function confirmDelete(task: Task): boolean {
  return (
    !hasDetails(task) ||
    window.confirm(`Удалить задачу «${task.title}» вместе с описанием, чек-листом и ссылками?`)
  );
}

import { useRef, useState } from 'react';
import { dayKey } from '../../data/activity.ts';
import { newId } from '../../data/ids.ts';
import type { Goal } from '../../data/model.ts';
import { useAppData, useToast } from '../../state/hooks.ts';
import {
  addGoal,
  addTask,
  deleteGoal,
  deleteTask,
  goalProgress,
  takeForToday,
  updateGoal,
} from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { confirmDelete } from '../boards/confirm.ts';
import { QUADRANT_ZONES, zoneTitle } from '../boards/zones.ts';
import { GoalDialog } from './GoalDialog.tsx';
import { daysUntil, deadlineHint, formatDay } from './deadline.ts';

/** Which backlog tasks are shown: all, those without a goal, or those of one goal. */
type Filter = 'all' | 'none' | string;

/** Goals with a deadline first, nearest first; then the others, oldest first. */
function byDeadline(a: Goal, b: Goal): number {
  if (a.deadline && b.deadline && a.deadline !== b.deadline) {
    return a.deadline < b.deadline ? -1 : 1;
  }
  if (a.deadline && !b.deadline) return -1;
  if (!a.deadline && b.deadline) return 1;
  return a.createdAt - b.createdAt;
}

/**
 * The backlog tab (phase 2.3): tasks put off for later, «Взять на сегодня» brings one to the
 * boards; long-term goals with progress and deadlines.
 */
export function BacklogView({ onOpen }: { onOpen: (taskId: string) => void }) {
  const { data, apply } = useAppData();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [title, setTitle] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  // Deadlines are compared by day; the day the tab was opened is good enough.
  const [today] = useState(() => dayKey(Date.now()));
  const input = useRef<HTMLInputElement>(null);

  const goals = [...data.goals].sort(byDeadline);
  const goalsById = new Map(data.goals.map((g) => [g.id, g]));
  // A deleted goal stops filtering.
  const shown: Filter =
    filter === 'all' || filter === 'none' || goalsById.has(filter) ? filter : 'all';
  const backlog = data.tasks.filter((t) => t.backlog);
  const tasks = backlog
    .filter((t) => shown === 'all' || (shown === 'none' ? t.goalId === null : t.goalId === shown))
    .sort((a, b) => a.createdAt - b.createdAt);
  const filterGoal = goalsById.get(shown);

  return (
    <div className="backlog-view">
      <section className="box" aria-labelledby="backlogHead">
        <div className="box-head">
          <span className="stripe" style={{ background: 'var(--q2)' }} />
          <h2 id="backlogHead">Задачи на потом</h2>
          <span className="count">{backlog.length}</span>
          <span className="spacer" />
          <select
            className="select backlog-filter"
            aria-label="Показать задачи"
            value={shown}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Все задачи</option>
            <option value="none">Без цели</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                Цель: {g.title}
              </option>
            ))}
          </select>
        </div>

        <form
          className="inline-form create"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) {
              setInvalid(true);
              input.current?.focus();
              return;
            }
            const id = newId();
            const now = Date.now();
            // A task added while one goal is shown belongs to that goal.
            const goalId = filterGoal ? filterGoal.id : null;
            apply((d) => addTask(d, title, id, now, { backlog: true, goalId }));
            setTitle('');
            input.current?.focus();
          }}
        >
          <input
            ref={input}
            className={`input${invalid ? ' invalid' : ''}`}
            placeholder={filterGoal ? `Задача для цели «${filterGoal.title}»…` : 'Задача на потом…'}
            aria-label="Заголовок задачи на потом"
            maxLength={200}
            autoComplete="off"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setInvalid(false);
            }}
          />
          <button type="submit" className="btn">
            Добавить
          </button>
        </form>
        {invalid && <div className="field-error">Введите заголовок задачи</div>}

        <ul className="list backlog-list" aria-label="Задачи на потом">
          {tasks.length === 0 && (
            <li className="empty">
              {backlog.length === 0
                ? 'пусто — добавьте задачу на потом или отложите задачу с доски в её деталях'
                : 'нет задач с этим отбором'}
            </li>
          )}
          {tasks.map((task) => {
            const goal = task.goalId ? goalsById.get(task.goalId) : undefined;
            const zone = zoneTitle(QUADRANT_ZONES, task.quadrant);
            return (
              <li key={task.id} className="backlog-item" data-id={task.id}>
                <button type="button" className="backlog-open" onClick={() => onOpen(task.id)}>
                  <span className="backlog-title">{task.title}</span>
                  <span className="card-meta">
                    {zone && (
                      <span className="badge" title="Квадрант, куда задача попадёт">
                        <span className="dot" style={{ background: zone.color }} />
                        {zone.title}
                      </span>
                    )}
                    {goal && shown !== goal.id && (
                      <span className="badge goal-badge">{goal.title}</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn small primary"
                  aria-label={`Взять на сегодня: ${task.title}`}
                  onClick={() => {
                    apply((d) => takeForToday(d, task.id));
                    toast(`«${task.title}» — в TODO, ${zone?.title ?? ''}`);
                  }}
                >
                  Взять на сегодня
                </button>
                <IconButton
                  icon="trash"
                  label={`Удалить «${task.title}»`}
                  danger
                  onClick={() => {
                    if (confirmDelete(task)) apply((d) => deleteTask(d, task.id));
                  }}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="box" aria-labelledby="goalsHead">
        <div className="box-head">
          <span className="stripe" style={{ background: 'var(--rest)' }} />
          <h2 id="goalsHead">Цели</h2>
          <span className="count">{data.goals.length}</span>
          <span className="spacer" />
          <button type="button" className="btn small" onClick={() => setEditing('new')}>
            + Новая цель
          </button>
        </div>
        <ul className="list goal-list">
          {goals.length === 0 && (
            <li className="empty">пусто — цель объединяет задачи и показывает прогресс по ним</li>
          )}
          {goals.map((goal) => {
            const { done, total } = goalProgress(data, goal.id);
            const complete = total > 0 && done === total;
            const overdue =
              !complete && goal.deadline !== null && daysUntil(goal.deadline, today) < 0;
            const percent = total === 0 ? 0 : Math.round((done / total) * 100);
            return (
              <li key={goal.id} className={`goal${complete ? ' complete' : ''}`}>
                <div className="goal-head">
                  <button
                    type="button"
                    className="goal-open"
                    aria-pressed={shown === goal.id}
                    title="Показать задачи цели в бэклоге"
                    onClick={() => setFilter(shown === goal.id ? 'all' : goal.id)}
                  >
                    {goal.title}
                  </button>
                  <IconButton
                    icon="edit"
                    label={`Изменить цель «${goal.title}»`}
                    onClick={() => setEditing(goal)}
                  />
                </div>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label={`Прогресс цели «${goal.title}»`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <i style={{ width: `${percent}%` }} />
                </div>
                <div className="goal-meta">
                  <span>
                    {total === 0
                      ? 'нет задач'
                      : complete
                        ? `выполнена — ${total} из ${total}`
                        : `выполнено ${done} из ${total}`}
                  </span>
                  {goal.deadline && (
                    <span className={overdue ? 'overdue' : undefined}>
                      срок {formatDay(goal.deadline)}
                      {!complete && ` · ${deadlineHint(goal.deadline, today)}`}
                    </span>
                  )}
                </div>
                {goal.description.trim() && <p className="goal-desc">{goal.description}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {editing && (
        <GoalDialog
          title={editing === 'new' ? 'Новая цель' : `Цель «${editing.title}»`}
          initial={editing === 'new' ? { title: '', description: '', deadline: null } : editing}
          onClose={() => setEditing(null)}
          onSave={(goalInput) => {
            if (editing === 'new') {
              const id = newId();
              const now = Date.now();
              apply((d) => addGoal(d, goalInput, id, now));
            } else {
              const id = editing.id;
              apply((d) => updateGoal(d, id, goalInput));
            }
            setEditing(null);
          }}
          onDelete={
            editing === 'new'
              ? undefined
              : () => {
                  const target = editing;
                  if (
                    !window.confirm(
                      `Удалить цель «${target.title}»? Её задачи останутся, без привязки к цели.`,
                    )
                  ) {
                    return;
                  }
                  apply((d) => deleteGoal(d, target.id));
                  setEditing(null);
                }
          }
        />
      )}
    </div>
  );
}

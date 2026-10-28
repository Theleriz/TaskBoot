import { useEffect, useRef, useState } from 'react';
import { type GoalInput, goalProblem } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';

/** Create or edit a long-term goal: title, description, optional deadline (phase 2.3). */
export function GoalDialog({
  title,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  title: string;
  initial: GoalInput;
  onSave: (input: GoalInput) => void;
  /** Absent for a new goal. */
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [deadline, setDeadline] = useState(initial.deadline ?? '');
  const [error, setError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInput.current?.focus();
    nameInput.current?.select();
  }, []);

  const save = () => {
    const input = { title: name, description, deadline: deadline || null };
    const problem = goalProblem(input);
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
      <div className="modal goal-dialog" role="dialog" aria-modal="true" aria-label={title}>
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
              maxLength={200}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </label>
          <label className="card-field">
            <span className="card-field-head">Описание</span>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Зачем эта цель, что значит «достигнута»…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="card-field">
            <label className="card-field-head" htmlFor="goalDeadline">
              Срок — необязательно
            </label>
            <div className="row">
              <input
                id="goalDeadline"
                type="date"
                className="input goal-date"
                value={deadline}
                onChange={(e) => {
                  setDeadline(e.target.value);
                  setError(null);
                }}
              />
              {deadline && (
                <button type="button" className="btn small" onClick={() => setDeadline('')}>
                  Без срока
                </button>
              )}
            </div>
          </div>
          <p className="hint">
            Задачи привязываются к цели в их деталях. Прогресс — доля выполненных задач цели, на
            досках и в бэклоге.
          </p>

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
                Удалить цель
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

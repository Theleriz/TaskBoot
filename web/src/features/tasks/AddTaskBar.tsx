import { useRef, useState } from 'react';
import { newId } from '../../data/ids.ts';
import { useAppData } from '../../state/hooks.ts';
import { addTask } from '../../state/ops.ts';

/** F-01 / F-08: new task by title only; blank titles are rejected. */
export function AddTaskBar() {
  const { apply } = useAppData();
  const [title, setTitle] = useState('');
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="addbar">
      <form
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
          apply((d) => addTask(d, title, id, now));
          setTitle('');
          input.current?.focus();
        }}
      >
        <input
          ref={input}
          className={`input${invalid ? ' invalid' : ''}`}
          placeholder="Новая задача…"
          maxLength={200}
          autoComplete="off"
          aria-label="Заголовок новой задачи"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setInvalid(false);
          }}
        />
        <button className="btn primary" type="submit">
          Добавить
        </button>
      </form>
      {invalid ? (
        <div className="field-error">Введите заголовок задачи</div>
      ) : (
        <p className="hint">
          Щелчок по карточке открывает детали. Карточки можно перетаскивать между зонами.
        </p>
      )}
    </section>
  );
}

import { useState } from 'react';
import type { CheckItem, Task } from '../../data/model.ts';
import { newId } from '../../data/ids.ts';
import { useAppData } from '../../state/hooks.ts';
import { addChecklistItem, removeChecklistItem, updateChecklistItem } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';

function Row({ taskId, item }: { taskId: string; item: CheckItem }) {
  const { apply } = useAppData();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <li className="check-item">
      <input
        type="checkbox"
        checked={item.done}
        aria-label={`Выполнено: ${item.text}`}
        onChange={(e) => {
          const done = e.target.checked;
          apply((d) => updateChecklistItem(d, taskId, item.id, { done }));
        }}
      />
      <input
        className={`inline-input${item.done ? ' is-done' : ''}`}
        value={draft ?? item.text}
        maxLength={300}
        aria-label="Текст пункта"
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          if (v.trim()) apply((d) => updateChecklistItem(d, taskId, item.id, { text: v }));
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      <IconButton
        icon="x"
        label="Удалить пункт"
        danger
        onClick={() => apply((d) => removeChecklistItem(d, taskId, item.id))}
      />
    </li>
  );
}

/** F-81 */
export function Checklist({ task }: { task: Task }) {
  const { apply } = useAppData();
  const [text, setText] = useState('');
  const total = task.checklist.length;
  const done = task.checklist.filter((i) => i.done).length;

  return (
    <section className="pane-sec">
      <div className="sec-head">
        <h3>Чек-лист</h3>
        {total > 0 && <span className="muted">{`выполнено ${done} из ${total}`}</span>}
      </div>
      {total > 0 && (
        <div className="progress">
          <i style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
      )}
      <ul className="list">
        {task.checklist.map((item) => (
          <Row key={item.id} taskId={task.id} item={item} />
        ))}
      </ul>
      <form
        className="inline-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const id = newId();
          apply((d) => addChecklistItem(d, task.id, text, id));
          setText('');
        }}
      >
        <input
          className="input"
          placeholder="Новый пункт…"
          maxLength={300}
          autoComplete="off"
          aria-label="Новый пункт чек-листа"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn" type="submit">
          Добавить
        </button>
      </form>
    </section>
  );
}

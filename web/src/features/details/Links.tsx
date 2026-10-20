import { useState } from 'react';
import type { LinkItem, Task } from '../../data/model.ts';
import { newId } from '../../data/ids.ts';
import { normalizeUrl } from '../../data/url.ts';
import { useAppData, usePlatform } from '../../state/hooks.ts';
import { addLink, removeLink, updateLink } from '../../state/ops.ts';
import { hostOf } from '../../ui/format.ts';
import { Icon, IconButton } from '../../ui/Icon.tsx';

function LinkForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { url: string; label: string };
  submitLabel: string;
  onSubmit: (url: string, label: string) => void;
  onCancel?: () => void;
}) {
  const [url, setUrl] = useState(initial.url);
  const [label, setLabel] = useState(initial.label);
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      className="link-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        // F-89: empty or invalid addresses are not accepted.
        if (!normalizeUrl(url)) {
          setInvalid(true);
          return;
        }
        onSubmit(url, label);
        if (!onCancel) {
          setUrl('');
          setLabel('');
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="row">
        <input
          className={`input${invalid ? ' invalid' : ''}`}
          placeholder="https://…"
          aria-label="Адрес ссылки"
          autoComplete="off"
          spellCheck={false}
          autoFocus={Boolean(onCancel)}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setInvalid(false);
          }}
        />
        <input
          className="input"
          placeholder="Подпись (необязательно)"
          maxLength={200}
          aria-label="Подпись ссылки"
          autoComplete="off"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      {invalid && (
        <div className="field-error">Введите корректный адрес, например https://example.com</div>
      )}
      <div className="row">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        {onCancel && (
          <button className="btn danger-ghost" type="button" onClick={onCancel}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}

function LinkRow({ taskId, link, onEdit }: { taskId: string; link: LinkItem; onEdit: () => void }) {
  const { apply } = useAppData();
  const platform = usePlatform();

  return (
    <li className="link-item">
      {/* F-88: links open in a new browser tab (in the shell: in the default browser). */}
      <a
        className="link-main"
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        title={link.url}
        onClick={(e) => {
          if (platform.kind === 'shell') {
            e.preventDefault();
            platform.openExternal(link.url);
          }
        }}
      >
        <Icon name="external" />
        <span className="link-text">
          <span className="link-label">{link.label || hostOf(link.url)}</span>
          <span className="link-url">{link.url}</span>
        </span>
      </a>
      <IconButton icon="edit" label="Изменить ссылку" onClick={onEdit} />
      <IconButton
        icon="x"
        label="Удалить ссылку"
        danger
        onClick={() => apply((d) => removeLink(d, taskId, link.id))}
      />
    </li>
  );
}

/** F-82 */
export function Links({ task }: { task: Task }) {
  const { apply } = useAppData();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="pane-sec">
      <div className="sec-head">
        <h3>Ссылки</h3>
        {task.links.length > 0 && <span className="muted">{task.links.length}</span>}
      </div>
      <ul className="list">
        {task.links.map((link) =>
          editing === link.id ? (
            <li key={link.id}>
              <LinkForm
                initial={link}
                submitLabel="Сохранить"
                onSubmit={(url, label) => {
                  apply((d) => updateLink(d, task.id, link.id, url, label));
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <LinkRow
              key={link.id}
              taskId={task.id}
              link={link}
              onEdit={() => setEditing(link.id)}
            />
          ),
        )}
      </ul>
      <LinkForm
        initial={{ url: '', label: '' }}
        submitLabel="Добавить ссылку"
        onSubmit={(url, label) => {
          const id = newId();
          apply((d) => addLink(d, task.id, url, label, id));
        }}
      />
    </section>
  );
}

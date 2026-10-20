import { useState } from 'react';
import type { Secret } from '../../data/model.ts';
import { newId } from '../../data/ids.ts';
import { useAppData, usePlatform, useToast } from '../../state/hooks.ts';
import { addSecret, deleteSecret, updateSecret } from '../../state/ops.ts';
import { IconButton } from '../../ui/Icon.tsx';

/** A fixed-length mask does not reveal the length of the value (F-66). */
const MASK = '••••••••••';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok: boolean;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

function SecretEditor({ secret, onClose }: { secret: Secret; onClose: () => void }) {
  const { apply } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(secret.name);
  const [value, setValue] = useState(secret.value);
  const [invalid, setInvalid] = useState(false);

  return (
    <li>
      <form
        className="secret-edit"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !value) {
            setInvalid(true);
            return;
          }
          apply((d) => updateSecret(d, secret.id, name, value));
          onClose();
          toast('Секрет сохранён');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <input
          className="input"
          maxLength={200}
          aria-label="Название секрета"
          autoComplete="off"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          aria-label="Значение секрета"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {invalid && <div className="field-error">Заполните название и значение</div>}
        <div className="row">
          <button className="btn primary" type="submit">
            Сохранить
          </button>
          <button className="btn" type="button" onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </li>
  );
}

/** F-65..F-70 */
export function Secrets() {
  const { data, apply } = useAppData();
  const toast = useToast();
  const platform = usePlatform();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const where = platform.kind === 'shell' ? 'в файле data.json' : 'в браузере (localStorage)';

  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="box" aria-labelledby="secretsHead">
      <div className="box-head">
        <span className="stripe" style={{ background: 'var(--q3)' }} />
        <h2 id="secretsHead">Секреты</h2>
        <span className="count">{data.secrets.length}</span>
      </div>
      <p className="warning">
        Значения хранятся {where} в открытом виде, без шифрования. Это не менеджер паролей: не
        храните здесь ничего критичного.
      </p>
      <form
        className="create stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !value) {
            setInvalid(true);
            return;
          }
          const id = newId();
          const now = Date.now();
          apply((d) => addSecret(d, name, value, id, now));
          setName('');
          setValue('');
        }}
      >
        <input
          className="input"
          placeholder="Название, например «API-токен GitHub»"
          maxLength={200}
          autoComplete="off"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setInvalid(false);
          }}
        />
        <input
          className="input"
          type="password"
          placeholder="Значение"
          autoComplete="new-password"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
        />
        {invalid && <div className="field-error">Заполните название и значение</div>}
        <div>
          <button className="btn primary" type="submit">
            Добавить секрет
          </button>
        </div>
      </form>
      <ul className="list">
        {data.secrets.length === 0 && <li className="empty">пусто</li>}
        {data.secrets.map((secret) => {
          if (secret.id === editing) {
            return (
              <SecretEditor key={secret.id} secret={secret} onClose={() => setEditing(null)} />
            );
          }
          const shown = revealed.has(secret.id);
          return (
            <li key={secret.id} className="secret">
              <div className="secret-main">
                <div className="secret-name">{secret.name}</div>
                <code className={`secret-value${shown ? '' : ' masked'}`}>
                  {shown ? secret.value : MASK}
                </code>
              </div>
              <div className="secret-actions">
                <button
                  type="button"
                  className="btn small"
                  aria-pressed={shown}
                  onClick={() => toggle(secret.id)}
                >
                  {shown ? 'Скрыть' : 'Показать'}
                </button>
                <IconButton
                  icon="copy"
                  label="Копировать значение"
                  onClick={() => {
                    void copyText(secret.value).then((ok) =>
                      toast(ok ? 'Значение скопировано' : 'Не удалось скопировать'),
                    );
                  }}
                />
                <IconButton icon="edit" label="Изменить" onClick={() => setEditing(secret.id)} />
                <IconButton
                  icon="x"
                  label="Удалить"
                  danger
                  onClick={() => {
                    if (!window.confirm(`Удалить секрет «${secret.name}»?`)) return;
                    apply((d) => deleteSecret(d, secret.id));
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

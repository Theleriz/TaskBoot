import { useEffect, useRef, useState } from 'react';
import type { Workspace } from '../../data/model.ts';
import { Icon } from '../../ui/Icon.tsx';

/**
 * The workspace menu at the left of the header: switch, set up the current one, add a new one.
 * A plain list of buttons in a popup; Escape or a click outside closes it.
 */
export function WorkspaceSwitcher({
  workspaces,
  active,
  onSelect,
  onEdit,
  onCreate,
}: {
  workspaces: Workspace[];
  active: Workspace;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="ws-switcher" ref={box}>
      <button
        ref={button}
        type="button"
        className="ws-button"
        aria-haspopup="true"
        aria-expanded={open}
        title="Рабочее пространство"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ws-name">{active.name}</span>
        <span className={`tree-chevron${open ? ' open' : ''}`}>
          <Icon name="chevron" />
        </span>
      </button>
      {open && (
        <div className="ws-menu" role="group" aria-label="Рабочие пространства">
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              className="ws-item"
              aria-current={w.id === active.id ? 'true' : undefined}
              onClick={() => pick(() => onSelect(w.id))}
            >
              {w.name}
            </button>
          ))}
          <hr className="ws-sep" />
          <button type="button" className="ws-item" onClick={() => pick(onEdit)}>
            Настроить «{active.name}»…
          </button>
          <button type="button" className="ws-item" onClick={() => pick(onCreate)}>
            + Новое рабочее пространство
          </button>
        </div>
      )}
    </div>
  );
}

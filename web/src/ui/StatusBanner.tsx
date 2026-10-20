import { useState } from 'react';
import { useAppData } from '../state/hooks.ts';
import { IconButton } from './Icon.tsx';

/** Load notices (migration, recovery, read-only) and save errors. */
export function StatusBanner() {
  const { load, saveError } = useAppData();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const notice = load.kind === 'ready' ? load.notice : null;
  const message = saveError ? `Не удалось сохранить изменения: ${saveError}` : notice;
  if (!message || message === dismissed) return null;

  return (
    <div className={`banner${saveError ? ' error' : ''}`} role="status">
      <span>{message}</span>
      <IconButton icon="x" label="Скрыть" onClick={() => setDismissed(message)} />
    </div>
  );
}

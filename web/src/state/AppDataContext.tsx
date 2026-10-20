import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DataFormatError, SchemaTooNewError } from '../data/errors.ts';
import type { AppData } from '../data/model.ts';
import { createEmptyData } from '../data/normalize.ts';
import type { DataStore } from '../data/store.ts';
import { type AppDataApi, type LoadState, AppDataContext } from './contexts.ts';
import { usePlatform } from './hooks.ts';

const SAVE_DELAY_MS = 300;

function noticeFor(error: unknown): { readOnly: boolean; notice: string } {
  if (error instanceof SchemaTooNewError) {
    return {
      readOnly: true,
      notice:
        'Данные сохранены более новой версией приложения. Они открыты только для чтения, чтобы ничего не потерять.',
    };
  }
  if (error instanceof DataFormatError) {
    return {
      readOnly: false,
      notice:
        'Сохранённые данные повреждены. Их копия сохранена, приложение начато с пустых данных.',
    };
  }
  return {
    readOnly: true,
    notice: 'Не удалось загрузить данные. Изменения не будут сохранены до перезапуска.',
  };
}

export function AppDataProvider({ store, children }: { store: DataStore; children: ReactNode }) {
  const [data, setData] = useState<AppData>(createEmptyData);
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const platform = usePlatform();
  const dirty = useRef(false);
  const latest = useRef(data);
  const readOnly = load.kind === 'ready' && load.readOnly;

  useEffect(() => {
    let cancelled = false;
    store.load().then(
      (result) => {
        if (cancelled) return;
        setData(result.data);
        setLoad({
          kind: 'ready',
          readOnly: false,
          notice: result.origin === 'legacy' ? 'Данные перенесены из прежней веб-версии.' : null,
        });
        // Save once so migrated or imported data is written in the current format.
        dirty.current = result.origin === 'legacy';
      },
      (error: unknown) => {
        if (cancelled) return;
        setLoad({ kind: 'ready', ...noticeFor(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Debounced save after every change.
  useEffect(() => {
    latest.current = data;
    if (!dirty.current || readOnly || load.kind !== 'ready') return;
    const timer = setTimeout(() => {
      dirty.current = false;
      store.save(data).then(
        () => setSaveError(null),
        (e: unknown) => setSaveError(e instanceof Error ? e.message : String(e)),
      );
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [data, store, readOnly, load.kind]);

  // Do not lose the last edit when the page or the shell window closes during the save delay.
  useEffect(() => {
    const flush = async () => {
      if (!dirty.current || readOnly) return;
      dirty.current = false;
      await store.save(latest.current);
    };
    const onPageHide = () => void flush().catch(() => {});
    window.addEventListener('pagehide', onPageHide);
    const offClosing = platform.onClosing(flush);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      offClosing();
    };
  }, [store, readOnly, platform]);

  const apply = useCallback((recipe: (draft: AppData) => void) => {
    dirty.current = true;
    setData((prev) => {
      const next = structuredClone(prev);
      recipe(next);
      return next;
    });
  }, []);

  const replace = useCallback((next: AppData) => {
    dirty.current = true;
    setData(next);
  }, []);

  const api = useMemo<AppDataApi>(
    () => ({ data, load, saveError, apply, replace }),
    [data, load, saveError, apply, replace],
  );
  return <AppDataContext.Provider value={api}>{children}</AppDataContext.Provider>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ToastContext } from '../state/contexts.ts';

const SHOW_MS = 2200;

/** Short status message at the bottom of the window. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    setText(message);
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), SHOW_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={'toast' + (visible ? ' show' : '')} role="status" aria-live="polite">
        {text}
      </div>
    </ToastContext.Provider>
  );
}

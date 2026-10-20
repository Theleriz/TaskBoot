import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

const snapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/** Whether the OS / browser is in dark mode; updates live (the "system" theme mode). */
export function useSystemDark(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

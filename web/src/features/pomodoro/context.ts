import { createContext, useContext } from 'react';
import type { Timer, TimerKey } from './timer.ts';

export interface PomodoroApi {
  timers: Record<TimerKey, Timer>;
  /** Current time, refreshed by the ticker while a timer runs. */
  now: number;
  /** Timer the user touched last (for the widget when both are paused). */
  lastActive: TimerKey | null;
  fullMs(key: TimerKey): number;
  start(key: TimerKey): void;
  pause(key: TimerKey): void;
  reset(key: TimerKey): void;
  /** Set when a timer finished while the window was in the background; the title blinks it. */
  alert: string | null;
}

export const PomodoroContext = createContext<PomodoroApi | null>(null);

export function usePomodoro() {
  const api = useContext(PomodoroContext);
  if (!api) throw new Error('usePomodoro must be used inside PomodoroProvider');
  return api;
}

export const TIMER_TITLES: Record<TimerKey, string> = { work: 'Работа', rest: 'Отдых' };

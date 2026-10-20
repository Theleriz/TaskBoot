import type { PomodoroApi } from './context.ts';
import type { TimerKey } from './timer.ts';

/** Which timer the header widget and window title show (F-42..F-45). */
export function shownTimer(p: PomodoroApi): { key: TimerKey; running: boolean } | null {
  if (p.timers.work.state === 'running') return { key: 'work', running: true };
  if (p.timers.rest.state === 'running') return { key: 'rest', running: true };
  if (p.lastActive && p.timers[p.lastActive].state === 'paused') {
    return { key: p.lastActive, running: false };
  }
  if (p.timers.work.state === 'paused') return { key: 'work', running: false };
  if (p.timers.rest.state === 'paused') return { key: 'rest', running: false };
  return null;
}

// Pomodoro timer model (base spec 3.4). Pure and immutable: every change returns a new object.
// The full duration is not stored here: an idle timer always shows the current setting, so
// changing the duration in settings applies at once to idle timers and after reset to others.

export type TimerKey = 'work' | 'rest';
export type TimerState = 'idle' | 'running' | 'paused';

export interface Timer {
  state: TimerState;
  /** Time left when paused, ms. */
  remaining: number;
  /** Moment the running timer ends, ms since epoch. */
  endsAt: number;
}

export const IDLE: Timer = { state: 'idle', remaining: 0, endsAt: 0 };

export function remainingMs(t: Timer, fullMs: number, now: number): number {
  if (t.state === 'running') return Math.max(0, t.endsAt - now);
  if (t.state === 'paused') return t.remaining;
  return fullMs;
}

export function start(t: Timer, fullMs: number, now: number): Timer {
  if (t.state === 'running') return t;
  const left = t.state === 'paused' && t.remaining > 0 ? t.remaining : fullMs;
  return { state: 'running', remaining: left, endsAt: now + left };
}

export function pause(t: Timer, now: number): Timer {
  if (t.state !== 'running') return t;
  return { state: 'paused', remaining: Math.max(0, t.endsAt - now), endsAt: 0 };
}

export function reset(): Timer {
  return IDLE;
}

export function isFinished(t: Timer, now: number): boolean {
  return t.state === 'running' && t.endsAt <= now;
}

export function progress(t: Timer, fullMs: number, now: number): number {
  if (fullMs <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - remainingMs(t, fullMs, now) / fullMs));
}

/** mm:ss, minutes may exceed 59 (up to 180). */
export function formatTime(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

export const otherTimer = (key: TimerKey): TimerKey => (key === 'work' ? 'rest' : 'work');

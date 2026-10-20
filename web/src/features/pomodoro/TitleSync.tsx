import { useEffect } from 'react';
import { usePlatform } from '../../state/hooks.ts';
import { TIMER_TITLES, usePomodoro } from './context.ts';
import { shownTimer } from './shown.ts';
import { formatTime, progress, remainingMs } from './timer.ts';

const APP = 'Task Tracker';

/** Remaining time in the window title and on the taskbar button; blinks after a finish in background. */
export function TitleSync() {
  const p = usePomodoro();
  const platform = usePlatform();
  const shown = shownTimer(p);
  const key = shown?.key ?? null;
  const running = shown?.running ?? false;
  const left = key ? remainingMs(p.timers[key], p.fullMs(key), p.now) : 0;
  const done = key ? progress(p.timers[key], p.fullMs(key), p.now) : 0;
  const blinkOn = p.alert !== null && Math.floor(p.now / 1000) % 2 === 0;

  useEffect(() => {
    const normal = key
      ? `${formatTime(left)} · ${TIMER_TITLES[key]}${running ? '' : ' (пауза)'} — ${APP}`
      : APP;
    platform.setTitle(blinkOn && p.alert ? `(!) ${p.alert}` : normal);
  }, [platform, key, running, left, blinkOn, p.alert]);

  useEffect(() => {
    platform.setTaskbarProgress(key ? (running ? 'normal' : 'paused') : 'none', done);
  }, [platform, key, running, done]);

  return null;
}

import { TIMER_TITLES, usePomodoro } from './context.ts';
import { shownTimer } from './shown.ts';
import { formatTime, remainingMs } from './timer.ts';

/** F-40..F-46: timer indicator in the header; opens the Pomodoro tab. */
export function TimerWidget({ onOpen, hidden }: { onOpen: () => void; hidden: boolean }) {
  const p = usePomodoro();
  const shown = shownTimer(p);
  const cls = ['widget'];
  if (shown?.running) cls.push(shown.key, 'running');

  return (
    <button
      type="button"
      className={cls.join(' ')}
      title="Открыть Pomodoro"
      onClick={onOpen}
      hidden={hidden}
    >
      <span className="w-dot" />
      <span className="w-label">
        {shown
          ? shown.running
            ? TIMER_TITLES[shown.key]
            : `${TIMER_TITLES[shown.key]} · пауза`
          : 'Pomodoro'}
      </span>
      <span className="w-time">
        {shown ? formatTime(remainingMs(p.timers[shown.key], p.fullMs(shown.key), p.now)) : '—'}
      </span>
    </button>
  );
}

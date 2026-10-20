import { useState } from 'react';
import { DURATION_LIMITS } from '../../data/model.ts';
import { setDurations } from '../../state/ops.ts';
import { useAppData, usePlatform } from '../../state/hooks.ts';
import { TIMER_TITLES, usePomodoro } from './context.ts';
import { type TimerKey, formatTime, progress, remainingMs } from './timer.ts';

function DurationInput({ timer }: { timer: TimerKey }) {
  const { data, apply } = useAppData();
  const field = timer === 'work' ? 'workMinutes' : 'restMinutes';
  const limits = DURATION_LIMITS[field];
  const saved = data.settings[field];
  // While the field is being edited, its text is local; the setting changes on Enter / blur.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const v = parseInt(draft, 10);
    if (Number.isFinite(v) && v !== saved) apply((d) => setDurations(d, { [field]: v }));
    setDraft(null);
  };

  return (
    <input
      id={`min-${timer}`}
      className="input"
      type="number"
      inputMode="numeric"
      min={limits.min}
      max={limits.max}
      step={1}
      aria-label="Длительность, минут"
      value={draft ?? String(saved)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function TimerCard({ timer }: { timer: TimerKey }) {
  const p = usePomodoro();
  const t = p.timers[timer];
  const full = p.fullMs(timer);
  const max = DURATION_LIMITS[timer === 'work' ? 'workMinutes' : 'restMinutes'].max;
  const running = t.state === 'running';

  return (
    <article className={`timer ${timer}${running ? ' active' : ''}`}>
      <div className="t-head">
        <h2>{TIMER_TITLES[timer]}</h2>
        <span className="t-state">
          {running ? 'Идёт' : t.state === 'paused' ? 'Пауза' : 'Остановлен'}
        </span>
      </div>
      <div className="t-time" role="timer">
        {formatTime(remainingMs(t, full, p.now))}
      </div>
      <div className="t-bar">
        <i style={{ width: `${(progress(t, full, p.now) * 100).toFixed(2)}%` }} />
      </div>
      <div className="t-buttons">
        <button
          type="button"
          className={`btn ${timer}`}
          disabled={running}
          onClick={() => p.start(timer)}
        >
          Старт
        </button>
        <button type="button" className="btn" disabled={!running} onClick={() => p.pause(timer)}>
          Пауза
        </button>
        <button
          type="button"
          className="btn"
          disabled={t.state === 'idle'}
          onClick={() => p.reset(timer)}
        >
          Сброс
        </button>
      </div>
      <div className="t-duration">
        <label htmlFor={`min-${timer}`}>
          Длительность, мин<small>от 1 до {max}</small>
        </label>
        <DurationInput timer={timer} />
      </div>
      <p className="hint" hidden={t.state === 'idle'}>
        Новая длительность применится после сброса
      </p>
    </article>
  );
}

function NotifyHint() {
  const platform = usePlatform();
  const state = platform.notifyPermission();
  if (state === 'denied') {
    return (
      <p className="timers-note">
        Уведомления браузера запрещены для этой страницы. Окончание таймера будет видно по звуку и
        миганию заголовка вкладки. Разрешить их можно в настройках сайта (значок слева от адреса).
      </p>
    );
  }
  if (state === 'unsupported') {
    return (
      <p className="timers-note">
        Этот браузер не поддерживает уведомления. Окончание таймера будет видно по звуку и миганию
        заголовка вкладки.
      </p>
    );
  }
  return null;
}

export function PomodoroView() {
  return (
    <>
      <div className="timers">
        <TimerCard timer="work" />
        <TimerCard timer="rest" />
      </div>
      <p className="timers-note">
        Когда заканчивается работа, автоматически начинается отдых, и наоборот.
      </p>
      <NotifyHint />
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppData, usePlatform, useToast } from '../../state/hooks.ts';
import { type PomodoroApi, PomodoroContext } from './context.ts';
import { chime, unlockAudio } from './sound.ts';
import { startTicker } from './ticker.ts';
import {
  type Timer,
  type TimerKey,
  IDLE,
  isFinished,
  otherTimer,
  pause as pauseTimer,
  start as startTimer,
} from './timer.ts';

const AUTO_SWITCH_MS = 400; // F-36 / F-37

type Timers = Record<TimerKey, Timer>;

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { data } = useAppData();
  const platform = usePlatform();
  const toast = useToast();

  const [timers, setTimers] = useState<Timers>({ work: IDLE, rest: IDLE });
  const [lastActive, setLastActive] = useState<TimerKey | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [alert, setAlert] = useState<string | null>(null);

  const minutes = { work: data.settings.workMinutes, rest: data.settings.restMinutes };
  const workMs = minutes.work * 60_000;
  const restMs = minutes.rest * 60_000;
  const fullMs = useCallback(
    (key: TimerKey) => (key === 'work' ? workMs : restMs),
    [workMs, restMs],
  );

  // Latest values for timer callbacks (read only outside render).
  const timersRef = useRef(timers);
  const fullRef = useRef(fullMs);
  useEffect(() => {
    timersRef.current = timers;
    fullRef.current = fullMs;
  }, [timers, fullMs]);

  const notifyFinished = useCallback(
    (finished: TimerKey) => {
      const next = otherTimer(finished);
      const title = finished === 'work' ? 'Работа окончена' : 'Отдых окончен';
      const nextMinutes = Math.round(fullRef.current(next) / 60_000);
      const body =
        (next === 'work' ? 'Начинается работа' : 'Начинается отдых') + `: ${nextMinutes} мин.`;
      const away = document.hidden || !document.hasFocus();
      if (away) setAlert(title);
      if (!away || !platform.notify(title, body)) toast(`${title}. ${body}`);
    },
    [platform, toast],
  );

  // The blinking title stops when the user comes back to the window.
  useEffect(() => {
    const clear = () => setAlert(null);
    const onVisible = () => {
      if (!document.hidden) clear();
    };
    const off = platform.onActivated(clear);
    window.addEventListener('focus', clear);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      window.removeEventListener('focus', clear);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [platform]);

  const anyRunning = timers.work.state === 'running' || timers.rest.state === 'running';

  // Pending automatic switches outlive the ticker: when the last running timer finishes,
  // the ticker stops, but the next timer must still start 400 ms later.
  const switches = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = switches.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  useEffect(() => {
    if (!anyRunning) return;

    const stop = startTicker(() => {
      const t = Date.now();
      setNow(t);
      for (const key of ['work', 'rest'] as const) {
        if (!isFinished(timersRef.current[key], t)) continue;
        // Mark as finished right away so the next tick does not fire it again.
        timersRef.current = { ...timersRef.current, [key]: IDLE };
        setTimers((prev) => ({ ...prev, [key]: IDLE }));
        chime(key);
        notifyFinished(key);
        const next = otherTimer(key);
        const id = setTimeout(() => {
          switches.current.delete(id);
          const at = Date.now();
          setTimers((prev) => ({ ...prev, [next]: startTimer(IDLE, fullRef.current(next), at) }));
          setLastActive(next);
          setNow(at);
        }, AUTO_SWITCH_MS);
        switches.current.add(id);
      }
    });

    return stop;
  }, [anyRunning, notifyFinished]);

  const api = useMemo<PomodoroApi>(
    () => ({
      timers,
      now,
      lastActive,
      alert,
      fullMs,
      start(key) {
        unlockAudio();
        void platform.requestNotifyPermission();
        const at = Date.now();
        setNow(at);
        setTimers((prev) => ({ ...prev, [key]: startTimer(prev[key], fullMs(key), at) }));
        setLastActive(key);
      },
      pause(key) {
        const at = Date.now();
        setNow(at);
        setTimers((prev) => ({ ...prev, [key]: pauseTimer(prev[key], at) }));
        setLastActive(key);
      },
      reset(key) {
        setNow(Date.now());
        setTimers((prev) => ({ ...prev, [key]: IDLE }));
      },
    }),
    [timers, now, lastActive, alert, fullMs, platform],
  );

  return <PomodoroContext.Provider value={api}>{children}</PomodoroContext.Provider>;
}

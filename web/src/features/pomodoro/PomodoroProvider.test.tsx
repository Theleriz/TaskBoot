import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyData } from '../../data/normalize.ts';
import { createMemoryStore } from '../../data/store.ts';
import type { Platform } from '../../platform/platform.ts';
import { AppDataProvider } from '../../state/AppDataContext.tsx';
import { PlatformContext } from '../../state/contexts.ts';
import { ToastProvider } from '../../ui/Toast.tsx';
import { type PomodoroApi, usePomodoro } from './context.ts';
import { PomodoroProvider } from './PomodoroProvider.tsx';

const platform: Platform = {
  kind: 'browser',
  notifyPermission: () => 'unsupported',
  requestNotifyPermission: async () => 'unsupported',
  notify: () => false,
  setTitle: () => {},
  setTaskbarProgress: () => {},
  setWindowDark: () => {},
  openExternal: () => {},
  onActivated: () => () => {},
  onClosing: () => () => {},
};

let api: PomodoroApi | null = null;
const capture = (p: PomodoroApi) => {
  api = p;
};

function Probe({ onApi }: { onApi: (p: PomodoroApi) => void }) {
  const p = usePomodoro();
  useEffect(() => onApi(p));
  return null;
}

afterEach(() => {
  vi.useRealTimers();
  api = null;
});

describe('PomodoroProvider', () => {
  it('starts the rest timer 400 ms after work ends (F-36)', async () => {
    vi.useFakeTimers();
    const data = createEmptyData();
    data.settings.workMinutes = 1;
    const store = createMemoryStore(data);

    render(
      <PlatformContext.Provider value={platform}>
        <ToastProvider>
          <AppDataProvider store={store}>
            <PomodoroProvider>
              <Probe onApi={capture} />
            </PomodoroProvider>
          </AppDataProvider>
        </ToastProvider>
      </PlatformContext.Provider>,
    );
    await act(async () => {}); // let the store load

    act(() => api?.start('work'));
    expect(api?.timers.work.state).toBe('running');

    await act(async () => {
      vi.advanceTimersByTime(60_000 + 300);
    });
    expect(api?.timers.work.state).toBe('idle');
    expect(api?.timers.rest.state).toBe('idle');

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api?.timers.rest.state).toBe('running');
    expect(api?.lastActive).toBe('rest');

    // The finished work session went to the statistics (phase 2).
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    const days = Object.values(store.snapshot()?.activity ?? {});
    expect(days).toEqual([expect.objectContaining({ pomodoroSessions: 1, pomodoroMinutes: 1 })]);
  });
});

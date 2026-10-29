import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyData } from '../data/normalize.ts';
import { createMemoryStore } from '../data/store.ts';
import type { Platform } from '../platform/platform.ts';
import { AppDataProvider } from './AppDataContext.tsx';
import { type AppDataApi, PlatformContext } from './contexts.ts';
import { useAppData } from './hooks.ts';

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

let api: AppDataApi | null = null;

function Probe() {
  const p = useAppData();
  useEffect(() => {
    api = p;
  });
  return null;
}

afterEach(() => {
  vi.useRealTimers();
  api = null;
});

describe('AppDataProvider', () => {
  it('saves an edit made while the save of the previous one is due', async () => {
    vi.useFakeTimers();
    const store = createMemoryStore(createEmptyData());
    render(
      <PlatformContext.Provider value={platform}>
        <AppDataProvider store={store}>
          <Probe />
        </AppDataProvider>
      </PlatformContext.Provider>,
    );
    await act(async () => {}); // let the store load

    act(() => api!.apply((d) => void (d.settings.workMinutes = 31)));
    // The second edit is not committed yet when the save timer of the first one fires.
    act(() => {
      api!.apply((d) => void (d.settings.workMinutes = 32));
      vi.advanceTimersByTime(300);
    });
    expect(store.snapshot()?.settings.workMinutes).toBe(31);

    await act(async () => vi.advanceTimersByTime(300));
    expect(store.snapshot()?.settings.workMinutes).toBe(32);
  });
});

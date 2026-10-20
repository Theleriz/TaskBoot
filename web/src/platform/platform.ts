import type { BridgeClient } from '../bridge/client.ts';
import { createBridgeClient } from '../bridge/client.ts';
import { createWebViewTransport, getWebView } from '../bridge/webview.ts';
import {
  type DataStore,
  createBrowserStore,
  createMemoryStore,
  createShellStore,
} from '../data/store.ts';

export type NotifyPermission = 'native' | 'granted' | 'default' | 'denied' | 'unsupported';

/** What the app needs from its host: an ordinary browser or the Windows WebView2 shell. */
export interface Platform {
  readonly kind: 'browser' | 'shell';
  notifyPermission(): NotifyPermission;
  /** Must be called from a user action (a click). */
  requestNotifyPermission(): Promise<NotifyPermission>;
  /** Shows a system notification. Returns false when it could not be shown. */
  notify(title: string, body: string): boolean;
  setTitle(title: string): void;
  setTaskbarProgress(state: 'none' | 'normal' | 'paused', value: number): void;
  setWindowDark(dark: boolean): void;
  openExternal(url: string): void;
  /** The user came back via a notification or the tray icon. */
  onActivated(handler: () => void): () => void;
}

function browserPlatform(win: Window): Platform {
  const N = (win as unknown as { Notification?: typeof Notification }).Notification;
  return {
    kind: 'browser',
    notifyPermission: () => (N ? N.permission : 'unsupported'),
    async requestNotifyPermission() {
      if (!N) return 'unsupported';
      if (N.permission !== 'default') return N.permission;
      try {
        return await N.requestPermission();
      } catch {
        return N.permission;
      }
    },
    notify(title, body) {
      if (!N || N.permission !== 'granted') return false;
      try {
        const n = new N(title, { body, tag: 'task-tracker-pomodoro' });
        n.onclick = () => {
          win.focus();
          n.close();
        };
        return true;
      } catch {
        return false;
      }
    },
    setTitle(title) {
      win.document.title = title;
    },
    setTaskbarProgress() {},
    setWindowDark() {},
    openExternal(url) {
      win.open(url, '_blank', 'noopener,noreferrer');
    },
    onActivated(handler) {
      win.addEventListener('focus', handler);
      return () => win.removeEventListener('focus', handler);
    },
  };
}

function shellPlatform(bridge: BridgeClient, win: Window): Platform {
  // Fire-and-forget: a failed cosmetic call must never break the app.
  const send = (p: Promise<unknown>) => {
    p.catch(() => {});
  };
  return {
    kind: 'shell',
    notifyPermission: () => 'native',
    requestNotifyPermission: async () => 'native',
    notify(title, body) {
      send(bridge.request('notify.show', { title, body }));
      return true;
    },
    setTitle(title) {
      win.document.title = title;
      send(bridge.request('window.title', { title }));
    },
    setTaskbarProgress(state, value) {
      send(bridge.request('taskbar.progress', { state, value: Math.max(0, Math.min(1, value)) }));
    },
    setWindowDark(dark) {
      send(bridge.request('window.theme', { dark }));
    },
    openExternal(url) {
      send(bridge.request('shell.openExternal', { url }));
    },
    onActivated(handler) {
      return bridge.on('app.activated', handler);
    },
  };
}

function availableLocalStorage(win: Window): Storage | null {
  try {
    const s = win.localStorage;
    const probe = '__taskTracker_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export interface Environment {
  store: DataStore;
  platform: Platform;
  /** Browser storage for UI conveniences (last tab); null when unavailable. */
  prefs: Storage | null;
}

/** Inside the WebView2 shell everything goes through one bridge; otherwise browser APIs are used. */
export function createEnvironment(win: Window = window): Environment {
  const webview = getWebView(win);
  const prefs = availableLocalStorage(win);
  if (webview) {
    const bridge = createBridgeClient(createWebViewTransport(webview));
    return { store: createShellStore(bridge), platform: shellPlatform(bridge, win), prefs };
  }
  return {
    store: prefs ? createBrowserStore(prefs) : createMemoryStore(),
    platform: browserPlatform(win),
    prefs,
  };
}

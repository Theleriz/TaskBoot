// Contract between the web app and the Windows WebView2 shell (phase 0.5 implements the C# side).
// Messages are JSON objects sent with chrome.webview.postMessage (page → host) and
// CoreWebView2.PostWebMessageAsJson (host → page). See docs/bridge-protocol.md.

/** Host methods: name → payload sent by the page and result returned by the host. */
export interface BridgeMethods {
  /** Reads %APPDATA%\TaskTracker\data.json. `json` is null when the file does not exist yet. */
  'storage.load': { payload: null; result: { json: string | null } };
  /** Writes data.json atomically (temp file + replace). */
  'storage.save': { payload: { json: string }; result: null };
  /** Windows notification (tray balloon / toast). */
  'notify.show': { payload: { title: string; body: string }; result: null };
  /** Progress on the taskbar button. `value` is 0..1. */
  'taskbar.progress': {
    payload: { state: 'none' | 'normal' | 'paused'; value: number };
    result: null;
  };
  /** Window title shown in the taskbar and Alt+Tab. */
  'window.title': { payload: { title: string }; result: null };
  /** Dark or light window title bar to match the theme background. */
  'window.theme': { payload: { dark: boolean }; result: null };
  /** Opens an http(s) link in the default browser instead of inside the shell. */
  'shell.openExternal': { payload: { url: string }; result: null };
  /** Answer to the `app.closing` event: pending data is saved, the window may close. */
  'app.readyToClose': { payload: null; result: null };
  /** Shell version, to show in settings and to detect available features. */
  'app.info': { payload: null; result: { version: string; platform: 'windows' } };
}

export type BridgeMethod = keyof BridgeMethods;

/** Events pushed by the host without a request. */
export interface BridgeEvents {
  /** The user clicked a notification or the tray icon; the window is shown again. */
  'app.activated': null;
  /** The window is about to close: save pending changes, then call `app.readyToClose`. */
  'app.closing': null;
}

export type BridgeEvent = keyof BridgeEvents;

export interface RequestMessage {
  kind: 'request';
  id: string;
  method: BridgeMethod;
  payload: unknown;
}

export interface ResponseMessage {
  kind: 'response';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

export interface EventMessage {
  kind: 'event';
  event: BridgeEvent;
  payload: unknown;
}

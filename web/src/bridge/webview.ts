import type { Transport } from './client.ts';

// The part of the WebView2 page API we use (window.chrome.webview).
interface WebViewApi {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

declare global {
  interface Window {
    chrome?: { webview?: WebViewApi };
  }
}

/** The WebView2 host API, or null when running in an ordinary browser. */
export function getWebView(win: Window = window): WebViewApi | null {
  return win.chrome?.webview ?? null;
}

export function isInShell(win: Window = window): boolean {
  return getWebView(win) !== null;
}

export function createWebViewTransport(webview: WebViewApi): Transport {
  return {
    send(message) {
      webview.postMessage(message);
    },
    listen(handler) {
      const listener = (event: { data: unknown }) => handler(event.data);
      webview.addEventListener('message', listener);
      return () => webview.removeEventListener('message', listener);
    },
  };
}

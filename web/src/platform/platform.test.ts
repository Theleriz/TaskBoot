import { describe, expect, it } from 'vitest';
import type { RequestMessage } from '../bridge/protocol.ts';
import { createEnvironment } from './platform.ts';

/** A fake WebView2 page API that records requests and lets the test push host messages. */
function fakeWebView() {
  const sent: RequestMessage[] = [];
  const listeners = new Set<(e: { data: unknown }) => void>();
  return {
    sent,
    push: (data: unknown) => listeners.forEach((l) => l({ data })),
    api: {
      postMessage: (m: RequestMessage) => {
        sent.push(m);
      },
      addEventListener: (_: 'message', l: (e: { data: unknown }) => void) => listeners.add(l),
      removeEventListener: (_: 'message', l: (e: { data: unknown }) => void) => listeners.delete(l),
    },
  };
}

describe('shell platform', () => {
  it('saves on app.closing and then tells the shell it may close', async () => {
    const webview = fakeWebView();
    const env = createEnvironment({
      chrome: { webview: webview.api },
      document,
      localStorage,
    } as unknown as Window);
    expect(env.platform.kind).toBe('shell');

    const order: string[] = [];
    env.platform.onClosing(async () => {
      order.push('saved');
    });

    webview.push({ kind: 'event', event: 'app.closing', payload: null });
    await new Promise((r) => setTimeout(r, 0));

    order.push(...webview.sent.map((m) => m.method));
    expect(order).toEqual(['saved', 'app.readyToClose']);
  });

  it('opens external links through the shell', () => {
    const webview = fakeWebView();
    const env = createEnvironment({
      chrome: { webview: webview.api },
      document,
      localStorage,
    } as unknown as Window);
    env.platform.openExternal('https://example.com/');
    expect(webview.sent[0]).toMatchObject({
      method: 'shell.openExternal',
      payload: { url: 'https://example.com/' },
    });
  });
});
